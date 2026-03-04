/**
 * POST /api/patreon/webhook
 *
 * Receives and processes Patreon webhook events for membership changes.
 *
 * NOT behind requireAuth — Patreon sends webhooks, not authenticated users.
 * Security is provided by HMAC-MD5 signature validation using PATREON_WEBHOOK_SECRET.
 *
 * Handled events:
 *   - members:pledge:create — new patron pledges (create/update entitlement)
 *   - members:pledge:update — patron changes pledge (update entitlement)
 *   - members:pledge:delete — patron cancels pledge (downgrade to thrall)
 *
 * Webhook signature validation:
 *   - Header: X-Patreon-Signature
 *   - Algorithm: HMAC-MD5 of the raw request body
 *   - Key: PATREON_WEBHOOK_SECRET
 *
 * Dual-key lookup:
 *   Uses the secondary KV index `patreon-user:{patreonUserId}` to find the user.
 *   The index value determines whether the user is authenticated or anonymous:
 *     - Starts with `patreon:` -> anonymous user, look up `entitlement:patreon:{pid}`
 *     - Otherwise -> authenticated user, look up `entitlement:{googleSub}`
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getEntitlement,
  setEntitlement,
  getAnonymousEntitlement,
  setAnonymousEntitlement,
  getGoogleSubByPatreonUserId,
  isAnonymousReverseIndex,
  extractPatreonUserIdFromReverseIndex,
} from "@/lib/kv/entitlement-store";
import { isPatreon } from "@/lib/feature-flags";
import { log } from "@/lib/logger";
import type {
  PatreonWebhookPayload,
  PatreonWebhookEvent,
  StoredEntitlement,
} from "@/lib/patreon/types";
import crypto from "crypto";

/** Valid webhook event types we process. */
const HANDLED_EVENTS = new Set<string>([
  "members:pledge:create",
  "members:pledge:update",
  "members:pledge:delete",
]);

/**
 * Validates the Patreon webhook signature.
 *
 * @param body - Raw request body as string
 * @param signature - Value from X-Patreon-Signature header
 * @returns true if the signature is valid
 */
function validateSignature(body: string, signature: string): boolean {
  log.debug("validateSignature called", {
    bodyLength: body.length,
    signatureLength: signature.length,
  });

  const secret = process.env.PATREON_WEBHOOK_SECRET;
  if (!secret) {
    log.error("validateSignature: PATREON_WEBHOOK_SECRET not configured");
    log.debug("validateSignature returning", { valid: false, reason: "no secret" });
    return false;
  }

  // Guard: reject non-hex signature strings before attempting Buffer decode
  if (!/^[0-9a-f]+$/i.test(signature)) {
    log.debug("validateSignature returning", { valid: false, reason: "non-hex signature" });
    return false;
  }

  const expectedSignature = crypto
    .createHmac("md5", secret)
    .update(body)
    .digest("hex");

  // Compare Buffer lengths (not string lengths) before timingSafeEqual
  // to avoid the throw when hex-decoded buffers differ in byte length.
  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");

    if (sigBuf.length !== expectedBuf.length) {
      log.debug("validateSignature returning", {
        valid: false,
        reason: "buffer length mismatch",
      });
      return false;
    }

    const valid = crypto.timingSafeEqual(sigBuf, expectedBuf);
    log.debug("validateSignature returning", { valid });
    return valid;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("validateSignature: timingSafeEqual threw", { error: message });
    log.debug("validateSignature returning", { valid: false, reason: "exception" });
    return false;
  }
}

/**
 * Extracts the Patreon user ID from the webhook payload.
 * The user ID is in data.relationships.user.data.id
 */
function extractPatreonUserId(payload: PatreonWebhookPayload): string | null {
  log.debug("extractPatreonUserId called");
  const userId = payload.data.relationships?.user?.data?.id ?? null;
  log.debug("extractPatreonUserId returning", { userId });
  return userId;
}

/**
 * Determines the tier based on the webhook payload's patron status and amount.
 */
function determineTierFromPayload(
  payload: PatreonWebhookPayload,
): { tier: "thrall" | "karl"; active: boolean } {
  log.debug("determineTierFromPayload called");

  const patronStatus = payload.data.attributes.patron_status;
  const amountCents = payload.data.attributes.currently_entitled_amount_cents;

  log.debug("determineTierFromPayload: checking attributes", {
    patronStatus,
    amountCents,
  });

  if (patronStatus === "active_patron" && amountCents > 0) {
    log.debug("determineTierFromPayload returning", { tier: "karl", active: true });
    return { tier: "karl", active: true };
  }

  log.debug("determineTierFromPayload returning", { tier: "thrall", active: false });
  return { tier: "thrall", active: false };
}

/**
 * Retrieves the existing entitlement based on whether the user is anonymous or authenticated.
 * Returns the entitlement and a key identifier for updating.
 */
async function getExistingEntitlement(
  reverseIndexValue: string,
  patreonUserId: string,
): Promise<{ entitlement: StoredEntitlement | null; isAnonymous: boolean }> {
  log.debug("getExistingEntitlement called", { reverseIndexValue, patreonUserId });

  if (isAnonymousReverseIndex(reverseIndexValue)) {
    const pid = extractPatreonUserIdFromReverseIndex(reverseIndexValue);
    const entitlement = await getAnonymousEntitlement(pid);
    log.debug("getExistingEntitlement returning", {
      isAnonymous: true,
      found: entitlement !== null,
    });
    return { entitlement, isAnonymous: true };
  }

  // Authenticated user — reverseIndexValue is the Google sub
  const entitlement = await getEntitlement(reverseIndexValue);
  log.debug("getExistingEntitlement returning", {
    isAnonymous: false,
    found: entitlement !== null,
  });
  return { entitlement, isAnonymous: false };
}

/**
 * Stores an updated entitlement based on whether the user is anonymous or authenticated.
 */
async function storeUpdatedEntitlement(
  reverseIndexValue: string,
  patreonUserId: string,
  entitlement: StoredEntitlement,
): Promise<void> {
  log.debug("storeUpdatedEntitlement called", { reverseIndexValue, patreonUserId });

  if (isAnonymousReverseIndex(reverseIndexValue)) {
    const pid = extractPatreonUserIdFromReverseIndex(reverseIndexValue);
    await setAnonymousEntitlement(pid, entitlement);
  } else {
    // Authenticated user — reverseIndexValue is the Google sub
    await setEntitlement(reverseIndexValue, entitlement);
  }

  log.debug("storeUpdatedEntitlement returning", { success: true });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/patreon/webhook called");

  if (!isPatreon()) {
    return NextResponse.json(
      { error: "Patreon integration is disabled" },
      { status: 404 },
    );
  }

  // --- Read raw body for signature validation ---
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    log.debug("POST /api/patreon/webhook returning", {
      status: 400,
      error: "invalid_body",
    });
    return NextResponse.json(
      { error: "invalid_body", error_description: "Could not read request body." },
      { status: 400 },
    );
  }

  // --- Validate webhook signature ---
  const signature = request.headers.get("x-patreon-signature");
  if (!signature) {
    log.debug("POST /api/patreon/webhook returning", {
      status: 400,
      error: "missing_signature",
    });
    return NextResponse.json(
      { error: "missing_signature", error_description: "Missing X-Patreon-Signature header." },
      { status: 400 },
    );
  }

  if (!validateSignature(rawBody, signature)) {
    log.debug("POST /api/patreon/webhook returning", {
      status: 400,
      error: "invalid_signature",
    });
    return NextResponse.json(
      { error: "invalid_signature", error_description: "Webhook signature validation failed." },
      { status: 400 },
    );
  }

  // --- Parse the event type ---
  const eventType = request.headers.get("x-patreon-event") as PatreonWebhookEvent | null;
  if (!eventType || !HANDLED_EVENTS.has(eventType)) {
    log.debug("POST /api/patreon/webhook returning", {
      status: 200,
      reason: "unhandled event type",
      eventType,
    });
    // Return 200 for unhandled events to prevent Patreon from retrying
    return NextResponse.json({ status: "ignored", eventType });
  }

  // --- Parse the payload ---
  let payload: PatreonWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PatreonWebhookPayload;
  } catch {
    log.debug("POST /api/patreon/webhook returning", {
      status: 400,
      error: "invalid_json",
    });
    return NextResponse.json(
      { error: "invalid_json", error_description: "Request body is not valid JSON." },
      { status: 400 },
    );
  }

  log.debug("POST /api/patreon/webhook: processing event", {
    eventType,
    memberId: payload.data.id,
  });

  // --- Extract Patreon user ID ---
  const patreonUserId = extractPatreonUserId(payload);
  if (!patreonUserId) {
    log.error("POST /api/patreon/webhook: no Patreon user ID in payload", {
      eventType,
      memberId: payload.data.id,
    });
    log.debug("POST /api/patreon/webhook returning", {
      status: 200,
      reason: "no user ID, ignoring",
    });
    return NextResponse.json({ status: "ignored", reason: "no_user_id" });
  }

  // --- Look up identity from Patreon user ID (may be Google sub or anonymous indicator) ---
  const reverseIndexValue = await getGoogleSubByPatreonUserId(patreonUserId);
  if (!reverseIndexValue) {
    log.debug("POST /api/patreon/webhook returning", {
      status: 200,
      reason: "patreon user not linked to any Fenrir account",
      patreonUserId,
    });
    // This Patreon user has not linked their account to Fenrir Ledger
    return NextResponse.json({
      status: "ignored",
      reason: "unknown_user",
    });
  }

  const isAnonymous = isAnonymousReverseIndex(reverseIndexValue);
  log.debug("POST /api/patreon/webhook: found user for Patreon ID", {
    patreonUserId,
    isAnonymous,
    reverseIndexValue: isAnonymous ? "(anonymous)" : reverseIndexValue,
  });

  try {
    // --- Handle the event ---
    if (
      eventType === "members:pledge:create" ||
      eventType === "members:pledge:update"
    ) {
      const { tier, active } = determineTierFromPayload(payload);

      // Get existing entitlement to preserve encrypted tokens
      const { entitlement: existing } = await getExistingEntitlement(
        reverseIndexValue,
        patreonUserId,
      );
      if (!existing) {
        log.debug("POST /api/patreon/webhook: no existing entitlement to update", {
          patreonUserId,
          isAnonymous,
          eventType,
        });
        // We have no stored tokens for this user — the webhook arrived before
        // or without an OAuth link. Acknowledge but take no action.
        log.debug("POST /api/patreon/webhook returning", {
          status: 200,
          reason: "no existing entitlement",
        });
        return NextResponse.json({
          status: "ignored",
          reason: "no_entitlement_record",
        });
      }

      const updatedEntitlement: StoredEntitlement = {
        ...existing,
        tier,
        active,
        checkedAt: new Date().toISOString(),
      };

      await storeUpdatedEntitlement(reverseIndexValue, patreonUserId, updatedEntitlement);

      log.debug("POST /api/patreon/webhook returning", {
        status: 200,
        eventType,
        tier,
        active,
        isAnonymous,
      });
      return NextResponse.json({
        status: "processed",
        eventType,
        tier,
        active,
      });
    }

    if (eventType === "members:pledge:delete") {
      // Downgrade to thrall, keep the link active (user can re-pledge)
      const { entitlement: existing } = await getExistingEntitlement(
        reverseIndexValue,
        patreonUserId,
      );
      if (!existing) {
        log.debug("POST /api/patreon/webhook returning", {
          status: 200,
          reason: "no existing entitlement for delete",
        });
        return NextResponse.json({
          status: "ignored",
          reason: "no_entitlement_record",
        });
      }

      const updatedEntitlement: StoredEntitlement = {
        ...existing,
        tier: "thrall",
        active: false,
        checkedAt: new Date().toISOString(),
      };

      await storeUpdatedEntitlement(reverseIndexValue, patreonUserId, updatedEntitlement);

      log.debug("POST /api/patreon/webhook returning", {
        status: 200,
        eventType,
        tier: "thrall",
        active: false,
        isAnonymous,
      });
      return NextResponse.json({
        status: "processed",
        eventType,
        tier: "thrall",
        active: false,
      });
    }

    // Should not reach here due to HANDLED_EVENTS check above
    log.debug("POST /api/patreon/webhook returning", {
      status: 200,
      reason: "unhandled event (unexpected)",
    });
    return NextResponse.json({ status: "ignored" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/patreon/webhook: processing failed", {
      eventType,
      patreonUserId,
      isAnonymous,
      error: message,
    });
    log.debug("POST /api/patreon/webhook returning", {
      status: 500,
      error: "processing_error",
    });
    return NextResponse.json(
      { error: "processing_error", error_description: "Failed to process webhook event." },
      { status: 500 },
    );
  }
}

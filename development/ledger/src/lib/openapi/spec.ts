/**
 * OpenAPI 3.1.0 specification for Fenrir Ledger API
 *
 * Covers all 23 API routes. Served by GET /api/openapi (auth-gated).
 * Consumed by Scalar at /openapi-ui/.
 *
 * Issue #2057
 */

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Fenrir Ledger API",
    version: "1.0.0",
    description:
      "Internal REST API for Fenrir Ledger. Auth-gated: all requests (except /api/auth/token) require `Authorization: Bearer <id_token>`.",
    contact: {
      name: "Fenrir Ledger",
      url: "https://www.fenrirledger.com",
    },
  },
  servers: [
    {
      url: "https://www.fenrirledger.com",
      description: "Production",
    },
    {
      url: "http://localhost:9653",
      description: "Local development",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Google id_token (JWT)",
        description:
          "Google OIDC id_token obtained from /api/auth/token. Include as `Authorization: Bearer <id_token>`.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error", "error_description"],
        properties: {
          error: { type: "string", example: "missing_token" },
          error_description: { type: "string", example: "Authorization: Bearer <id_token> header is required." },
        },
      },
      Card: {
        type: "object",
        required: ["id", "householdId", "name", "status"],
        properties: {
          id: { type: "string" },
          householdId: { type: "string" },
          name: { type: "string" },
          status: { type: "string", enum: ["active", "closed"] },
          issuer: { type: "string" },
          bonusCategories: { type: "array", items: { type: "string" } },
          annualFee: { type: "number" },
          creditLimit: { type: "number" },
          openedAt: { type: "string", format: "date" },
          closedAt: { type: "string", format: "date" },
          updatedAt: { type: "string", format: "date-time" },
          deletedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      HouseholdMember: {
        type: "object",
        properties: {
          userId: { type: "string" },
          displayName: { type: "string" },
          email: { type: "string" },
          role: { type: "string", enum: ["owner", "member"] },
          isCurrentUser: { type: "boolean" },
        },
      },
      StripeEntitlement: {
        type: "object",
        properties: {
          tier: { type: "string", enum: ["karl", "thrall"] },
          active: { type: "boolean" },
          platform: { type: "string", enum: ["stripe"] },
          checkedAt: { type: "string", format: "date-time" },
          customerId: { type: "string" },
          linkedAt: { type: "string", format: "date-time" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid Bearer token",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "missing_token", error_description: "Authorization: Bearer <id_token> header is required." },
          },
        },
      },
      Forbidden: {
        description: "Authenticated but not authorized",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "forbidden", error_description: "Karl tier required." },
          },
        },
      },
      TooManyRequests: {
        description: "Rate limited",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "rate_limited", error_description: "Too many requests. Try again later." },
          },
        },
      },
      InternalError: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "internal_error", error_description: "An unexpected error occurred." },
          },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  tags: [
    { name: "Auth", description: "Authentication and session management" },
    { name: "Admin", description: "Admin-only endpoints" },
    { name: "Config", description: "Runtime configuration" },
    { name: "Household", description: "Household management and membership" },
    { name: "Sheets", description: "Card import from Google Sheets / CSV" },
    { name: "Stripe", description: "Subscription and billing" },
    { name: "Sync", description: "Cloud card sync (Karl tier)" },
    { name: "Trial", description: "Free trial management" },
  ],
  paths: {
    "/api/admin/pack-status": {
      get: {
        tags: ["Admin"],
        summary: "Get pack status dashboard",
        description:
          "Returns full pack (agent) status dashboard data. Requires authentication **and** admin whitelist membership (ADMIN_EMAILS env var).",
        operationId: "adminGetPackStatus",
        responses: {
          "200": {
            description: "Pack status data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    in_flight_count: { type: "number" },
                    agents: { type: "array", items: { type: "object" } },
                    checkedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/auth/token": {
      post: {
        tags: ["Auth"],
        summary: "Exchange Google OAuth code for tokens",
        description:
          "Server-side proxy for Google OAuth2 token exchange. **Unauthenticated** — no Bearer token required. Supports authorization code exchange and refresh token renewal.",
        operationId: "authToken",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    title: "Authorization code exchange",
                    type: "object",
                    required: ["code", "code_verifier", "redirect_uri"],
                    properties: {
                      code: { type: "string", description: "Google authorization code" },
                      code_verifier: { type: "string", description: "PKCE code verifier" },
                      redirect_uri: { type: "string", format: "uri" },
                    },
                  },
                  {
                    title: "Refresh token renewal",
                    type: "object",
                    required: ["refresh_token"],
                    properties: {
                      refresh_token: { type: "string" },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Google token response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    access_token: { type: "string" },
                    id_token: { type: "string", description: "Google OIDC id_token (JWT) — use as Bearer token" },
                    refresh_token: { type: "string" },
                    expires_in: { type: "number" },
                    token_type: { type: "string", example: "Bearer" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid request body",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "429": { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },

    "/api/auth/session": {
      get: {
        tags: ["Auth"],
        summary: "Validate current session",
        description: "Verifies the Bearer id_token and returns the decoded user claims. Useful for checking token validity.",
        operationId: "authSession",
        responses: {
          "200": {
            description: "Session is valid",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    user: {
                      type: "object",
                      properties: {
                        sub: { type: "string" },
                        email: { type: "string" },
                        name: { type: "string" },
                        picture: { type: "string", format: "uri" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/config/picker": {
      get: {
        tags: ["Config"],
        summary: "Get Google Picker API key",
        description:
          "Returns the Google Picker API key for client-side file picker. Requires Karl tier or active trial.",
        operationId: "configGetPicker",
        responses: {
          "200": {
            description: "Picker API key",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["pickerApiKey"],
                  properties: { pickerApiKey: { type: "string" } },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/household/members": {
      get: {
        tags: ["Household"],
        summary: "Get household members",
        description: "Returns current household members list with roles and invite code (owners only).",
        operationId: "householdGetMembers",
        responses: {
          "200": {
            description: "Household members",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    householdId: { type: "string" },
                    householdName: { type: "string" },
                    ownerId: { type: "string" },
                    memberCount: { type: "number" },
                    maxMembers: { type: "number", example: 3 },
                    isSolo: { type: "boolean" },
                    isFull: { type: "boolean" },
                    isOwner: { type: "boolean" },
                    isKarl: { type: "boolean" },
                    inviteCode: { type: "string" },
                    inviteCodeExpiresAt: { type: "string", format: "date-time" },
                    members: {
                      type: "array",
                      items: { $ref: "#/components/schemas/HouseholdMember" },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/household/invite": {
      post: {
        tags: ["Household"],
        summary: "Regenerate invite code",
        description: "Regenerates the invite code for the caller's household. Owner-only.",
        operationId: "householdRegenerateInvite",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action"],
                properties: {
                  action: { type: "string", enum: ["regenerate"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "New invite code",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    inviteCode: { type: "string" },
                    inviteCodeExpiresAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid action",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": {
            description: "Household not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "409": {
            description: "Household is full (3/3 members)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/household/invite/validate": {
      get: {
        tags: ["Household"],
        summary: "Validate an invite code",
        description: "Validates an invite code and returns household preview plus caller's card count.",
        operationId: "householdValidateInvite",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "The invite code to validate",
          },
        ],
        responses: {
          "200": {
            description: "Invite code is valid",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    householdId: { type: "string" },
                    householdName: { type: "string" },
                    memberCount: { type: "number" },
                    members: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          displayName: { type: "string" },
                          email: { type: "string" },
                          role: { type: "string" },
                        },
                      },
                    },
                    userCardCount: { type: "number" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing or malformed code param",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": {
            description: "Code not found / invalid",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "409": {
            description: "Household full",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "410": {
            description: "Code expired",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/household/join": {
      post: {
        tags: ["Household"],
        summary: "Join a household",
        description:
          "Executes join + card merge transaction. Call AFTER validating the invite code via GET /api/household/invite/validate.",
        operationId: "householdJoin",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["inviteCode", "confirm"],
                properties: {
                  inviteCode: { type: "string" },
                  confirm: { type: "boolean", enum: [true] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Joined successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    householdId: { type: "string" },
                    householdName: { type: "string" },
                    movedCardCount: { type: "number" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid body",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": {
            description: "Invite code not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "409": {
            description: "Household full (race condition)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "410": {
            description: "Invite code expired",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/household/leave": {
      post: {
        tags: ["Household"],
        summary: "Leave a household",
        description:
          "Allows a non-owner member to leave their household. A new solo household is created automatically. Cards remain with the old household.",
        operationId: "householdLeave",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["confirm"],
                properties: {
                  confirm: { type: "boolean", enum: [true] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Left successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    newHouseholdId: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing/invalid body",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/household/kick": {
      post: {
        tags: ["Household"],
        summary: "Kick a household member",
        description:
          "Allows a household owner to remove a non-owner member. A new solo household is created for the kicked member. Cards remain with the caller's household.",
        operationId: "householdKick",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["memberId"],
                properties: {
                  memberId: { type: "string", description: "userId of the member to remove" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Kicked successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    newHouseholdId: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing/invalid body",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/sheets/import": {
      post: {
        tags: ["Sheets"],
        summary: "Import cards from Google Sheets / CSV / File",
        description:
          "Imports cards from a Google Sheets URL, raw CSV text, or uploaded file (XLS/XLSX). Karl tier or active trial required.",
        operationId: "sheetsImport",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                oneOf: [
                  {
                    title: "URL import",
                    properties: {
                      url: { type: "string", format: "uri", description: "Public Google Sheets URL" },
                    },
                    required: ["url"],
                  },
                  {
                    title: "CSV import",
                    properties: {
                      csv: { type: "string", description: "Raw CSV text" },
                    },
                    required: ["csv"],
                  },
                  {
                    title: "File import",
                    properties: {
                      file: { type: "string", description: "Base64-encoded file content" },
                      filename: { type: "string" },
                      format: { type: "string", enum: ["xls", "xlsx"] },
                    },
                    required: ["file", "filename", "format"],
                  },
                ],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Cards parsed successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    cards: { type: "array", items: { $ref: "#/components/schemas/Card" } },
                    count: { type: "number" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid URL, CSV, or file",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "object",
                      properties: {
                        code: { type: "string", enum: ["INVALID_URL", "INVALID_CSV", "NO_CARDS_FOUND"] },
                        message: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/stripe/checkout": {
      post: {
        tags: ["Stripe"],
        summary: "Create Stripe Checkout session",
        description:
          "Creates a Stripe Checkout session and returns the URL for client-side redirect. Handles existing subscriptions (revive canceled, new checkout).",
        operationId: "stripeCheckout",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  returnPath: { type: "string", description: "Path to return to after checkout (default: /ledger/settings)" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Checkout session created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", format: "uri", description: "Stripe Checkout URL" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/stripe/membership": {
      get: {
        tags: ["Stripe"],
        summary: "Get subscription / entitlement status",
        description:
          "Returns the current user's Stripe subscription and entitlement tier. Household state is authoritative (kept fresh by webhooks).",
        operationId: "stripeGetMembership",
        responses: {
          "200": {
            description: "Membership status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StripeEntitlement" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/stripe/portal": {
      post: {
        tags: ["Stripe"],
        summary: "Create Stripe Customer Portal session",
        description:
          "Creates a Stripe Customer Portal session for payment management (update card, cancel, view history). Requires existing Stripe entitlement.",
        operationId: "stripePortal",
        responses: {
          "200": {
            description: "Portal session created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", format: "uri", description: "Stripe Customer Portal URL" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": {
            description: "No Stripe entitlement found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "429": { $ref: "#/components/responses/TooManyRequests" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/stripe/unlink": {
      post: {
        tags: ["Stripe"],
        summary: "Cancel subscription and unlink",
        description:
          "Cancels the Stripe subscription and removes the entitlement. Preserves stripeCustomerId to prevent duplicate customers on re-subscribe. Idempotent.",
        operationId: "stripeUnlink",
        responses: {
          "200": {
            description: "Unlinked successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/stripe/webhook": {
      post: {
        tags: ["Stripe"],
        summary: "Stripe webhook handler",
        description:
          "Receives Stripe webhook events (subscription.created, invoice.paid, etc.) and updates household entitlements in Firestore. Verified via Stripe-Signature header. **Not** behind Bearer auth.",
        operationId: "stripeWebhook",
        security: [],
        parameters: [
          {
            name: "Stripe-Signature",
            in: "header",
            required: true,
            schema: { type: "string" },
            description: "Stripe webhook signature for verification",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", description: "Stripe event payload" },
            },
          },
        },
        responses: {
          "200": {
            description: "Event processed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { received: { type: "boolean" } },
                },
              },
            },
          },
          "400": {
            description: "Invalid signature or payload",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },

    "/api/sync": {
      get: {
        tags: ["Sync"],
        summary: "Fetch all cards from Firestore",
        description: "Downloads all Firestore cards for the authenticated user's household. Karl tier only.",
        operationId: "syncGet",
        responses: {
          "200": {
            description: "Cards retrieved",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    householdId: { type: "string" },
                    cards: { type: "array", items: { $ref: "#/components/schemas/Card" } },
                    syncedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
      put: {
        tags: ["Sync"],
        summary: "Push cards to Firestore (legacy)",
        description:
          "Uploads cards to Firestore with last-write-wins via updatedAt. Karl tier only. Prefer POST /api/sync/push for full conflict detection.",
        operationId: "syncPut",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["cards"],
                properties: {
                  cards: { type: "array", items: { $ref: "#/components/schemas/Card" } },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Cards written",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    householdId: { type: "string" },
                    written: { type: "number" },
                    skipped: { type: "number" },
                    syncedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/sync/push": {
      post: {
        tags: ["Sync"],
        summary: "Push cards to Firestore (with conflict detection)",
        description:
          "Uploads local cards to Firestore and returns the merged result. Uses last-write-wins per card via effectiveTimestamp. Optional clientSyncVersion for optimistic concurrency. Karl tier only.",
        operationId: "syncPush",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["householdId", "cards"],
                properties: {
                  householdId: { type: "string" },
                  cards: { type: "array", items: { $ref: "#/components/schemas/Card" } },
                  clientSyncVersion: { type: "number", description: "Optional optimistic concurrency version" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Merge result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    cards: { type: "array", items: { $ref: "#/components/schemas/Card" } },
                    syncedCount: { type: "number" },
                    syncVersion: { type: "number" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid body",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "409": {
            description: "Stale clientSyncVersion — another push occurred since last pull",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/sync/pull": {
      post: {
        tags: ["Sync"],
        summary: "Pull cards from Firestore",
        description: "Downloads and merges Firestore cards into the client's local state. Karl tier only.",
        operationId: "syncPull",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["householdId"],
                properties: {
                  householdId: { type: "string" },
                  clientSyncVersion: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Pull result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    cards: { type: "array", items: { $ref: "#/components/schemas/Card" } },
                    syncVersion: { type: "number" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid body",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/sync/state": {
      get: {
        tags: ["Sync"],
        summary: "Get sync state",
        description: "Returns the current household sync version. Used for change detection. Karl tier only.",
        operationId: "syncGetState",
        responses: {
          "200": {
            description: "Sync state",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    syncVersion: { type: "number" },
                    householdId: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/trial/init": {
      post: {
        tags: ["Trial"],
        summary: "Initialize a free trial",
        description:
          "Initializes a trial for the authenticated user. Idempotent for active/converted trials. Returns 409 if trial has already expired.",
        operationId: "trialInit",
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", description: "Empty body" },
            },
          },
        },
        responses: {
          "200": {
            description: "Trial initialized",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    startDate: { type: "string", format: "date-time" },
                    expiresAt: { type: "string", format: "date-time" },
                    isNew: { type: "boolean" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "409": {
            description: "Trial already expired",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "429": { $ref: "#/components/responses/TooManyRequests" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/trial/status": {
      post: {
        tags: ["Trial"],
        summary: "Get trial status",
        description:
          "Returns the trial status for the authenticated user. Read-only — never initializes a trial.",
        operationId: "trialStatus",
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", description: "Empty body" },
            },
          },
        },
        responses: {
          "200": {
            description: "Trial status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    remainingDays: { type: "number" },
                    status: { type: "string", enum: ["active", "expired", "converted", "none"] },
                    convertedDate: { type: "string", format: "date-time" },
                    cacheVersion: { type: "number" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },

    "/api/trial/convert": {
      post: {
        tags: ["Trial"],
        summary: "Mark trial as converted",
        description:
          "Marks a trial as converted after successful Stripe subscription. Updates trial record with convertedDate.",
        operationId: "trialConvert",
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", description: "Empty body" },
            },
          },
        },
        responses: {
          "200": {
            description: "Trial converted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { converted: { type: "boolean" } },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
  },
} as const;

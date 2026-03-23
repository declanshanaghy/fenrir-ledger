/**
 * URL validation utilities for SSRF prevention in CSV import.
 *
 * Provides:
 * - validateImportUrl: blocks private IPs, non-HTTPS schemes, and localhost
 *   for user-supplied import URLs (MEDIUM-002 / issue #1891)
 * - isValidRedirectTarget: whitelist-based validation for redirect targets
 *   during Google Sheets CSV export fetch operations
 */

import { log } from "@/lib/logger";

/**
 * Validates a user-supplied import URL for SSRF prevention.
 *
 * Blocks non-HTTPS schemes (file://, http://, etc.), private/reserved IPv4
 * ranges (loopback, RFC-1918, link-local/metadata), localhost, and private
 * IPv6 addresses.
 *
 * @param urlString - The URL to validate
 * @returns null if valid, or an error message string if invalid
 */
export function validateImportUrl(urlString: string): string | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    log.warn("validateImportUrl: rejected unparseable URL");
    return "Invalid URL format.";
  }

  // Only HTTPS
  if (url.protocol !== "https:") {
    log.warn("validateImportUrl: rejected non-HTTPS scheme", { protocol: url.protocol });
    return "Only HTTPS URLs are accepted for import.";
  }

  const hostname = url.hostname.toLowerCase();

  // Block localhost by name
  if (hostname === "localhost") {
    log.warn("validateImportUrl: rejected localhost");
    return "URL points to a disallowed host.";
  }

  // Block IPv4 private/reserved ranges
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (
      a === 127 ||                          // 127.x.x.x  — loopback
      a === 10 ||                           // 10.x.x.x   — private (RFC-1918)
      (a === 172 && b >= 16 && b <= 31) ||  // 172.16–31  — private (RFC-1918)
      (a === 192 && b === 168) ||           // 192.168.x.x — private (RFC-1918)
      (a === 169 && b === 254)              // 169.254.x.x — link-local / GCP metadata
    ) {
      log.warn("validateImportUrl: rejected private IPv4", { hostname });
      return "URL points to a disallowed host.";
    }
  }

  // Block IPv6 loopback and private ranges (ULA fc00::/7, link-local fe80::/10)
  const h = hostname.replace(/^\[|\]$/g, ""); // strip brackets from [::1]
  if (
    h === "::1" ||
    h.startsWith("fc") ||
    h.startsWith("fd") ||
    h.startsWith("fe80")
  ) {
    log.warn("validateImportUrl: rejected private IPv6", { hostname });
    return "URL points to a disallowed host.";
  }

  return null;
}

/**
 * Validates a URL against SSRF prevention rules.
 *
 * @param urlString - The URL to validate
 * @param context - Brief description of context (for logging)
 * @returns true if URL is allowed, false otherwise
 */
export function isValidRedirectTarget(urlString: string, context: string = "redirect"): boolean {
  try {
    const url = new URL(urlString);

    // 1. Only allow HTTPS (no http, file, ftp, etc.)
    if (url.protocol !== "https:") {
      log.warn(`Invalid redirect scheme in ${context}`, {
        protocol: url.protocol,
        url: urlString,
      });
      return false;
    }

    // 2. Whitelist allowed domains for redirects
    const hostname = url.hostname.toLowerCase();
    const allowedDomains = [
      "docs.google.com",
      "sheets.google.com",
      // Google's export CDN — Sheets CSV export redirects here
      "googleusercontent.com",
      // Google's various redirects and services
      "ssl.gstatic.com",
      "accounts.google.com",
    ];

    const isAllowed = allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));

    if (!isAllowed) {
      log.warn(`Redirect target hostname not in whitelist for ${context}`, {
        hostname,
        url: urlString,
      });
      return false;
    }

    return true;
  } catch (error) {
    log.warn(`Failed to parse URL in ${context}`, {
      url: urlString,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Configuration for secure fetch with redirect handling.
 */
export interface SecureFetchOptions {
  maxRedirects?: number;
}

/**
 * Safely fetch a URL with explicit redirect validation.
 *
 * @param url - The initial URL to fetch
 * @param options - Fetch options
 * @returns Response object
 * @throws Error if redirect validation fails
 */
export async function secureFetch(url: string, options: SecureFetchOptions = {}): Promise<Response> {
  const { maxRedirects = 1 } = options;

  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    log.debug("secureFetch fetching", {
      url: currentUrl,
      redirectCount,
    });

    // Fetch with manual redirect handling
    const response = await fetch(currentUrl, { redirect: "manual" });

    // If not a redirect, return the response
    if (response.status < 300 || response.status >= 400) {
      log.debug("secureFetch returning non-redirect response", {
        status: response.status,
      });
      return response;
    }

    // Handle redirect
    const locationHeader = response.headers.get("location");
    if (!locationHeader) {
      throw new Error("Invalid redirect: missing Location header");
    }

    // Validate redirect target
    if (!isValidRedirectTarget(locationHeader, `redirect-${redirectCount}`)) {
      throw new Error(`Invalid redirect target: ${locationHeader}`);
    }

    log.debug("secureFetch following valid redirect", {
      redirectCount,
      location: locationHeader,
    });

    currentUrl = locationHeader;
    redirectCount++;
  }

  // If we've exhausted max redirects, throw error
  throw new Error(`Too many redirects (max ${maxRedirects} allowed)`);
}

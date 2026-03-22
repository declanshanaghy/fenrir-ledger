/**
 * URL validation utilities for SSRF prevention in CSV import.
 *
 * Provides whitelist-based validation for redirect targets during
 * Google Sheets CSV export fetch operations.
 */

import { log } from "@/lib/logger";

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

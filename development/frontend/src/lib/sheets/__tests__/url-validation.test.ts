/**
 * Tests for SSRF prevention URL validation utilities.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { isValidRedirectTarget, secureFetch } from "../url-validation";
import { log } from "@/lib/logger";

// Mock logger
vi.mock("@/lib/logger");

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("isValidRedirectTarget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows HTTPS redirects to docs.google.com", () => {
    const valid = isValidRedirectTarget("https://docs.google.com/spreadsheets/d/abc123/export?format=csv");
    expect(valid).toBe(true);
  });

  it("allows HTTPS redirects to sheets.google.com", () => {
    const valid = isValidRedirectTarget("https://sheets.google.com/api/v1/data");
    expect(valid).toBe(true);
  });

  it("allows HTTPS redirects to subdomains of whitelisted domains", () => {
    const valid = isValidRedirectTarget("https://subdomain.docs.google.com/sheets");
    expect(valid).toBe(true);
  });

  it("allows HTTPS redirects to ssl.gstatic.com", () => {
    const valid = isValidRedirectTarget("https://ssl.gstatic.com/docs/images/logo.png");
    expect(valid).toBe(true);
  });

  it("rejects HTTP redirects (non-HTTPS)", () => {
    const valid = isValidRedirectTarget("http://docs.google.com/sheets");
    expect(valid).toBe(false);
  });

  it("rejects file:// scheme redirects", () => {
    const valid = isValidRedirectTarget("file:///etc/passwd");
    expect(valid).toBe(false);
  });

  it("rejects FTP scheme redirects", () => {
    const valid = isValidRedirectTarget("ftp://example.com/file");
    expect(valid).toBe(false);
  });

  it("rejects redirects to localhost", () => {
    const valid = isValidRedirectTarget("https://localhost:8080/admin");
    expect(valid).toBe(false);
  });

  it("rejects redirects to private IP addresses", () => {
    const valid = isValidRedirectTarget("https://192.168.1.1/admin");
    expect(valid).toBe(false);
  });

  it("rejects redirects to AWS metadata endpoint", () => {
    const valid = isValidRedirectTarget("https://169.254.169.254/latest/meta-data/");
    expect(valid).toBe(false);
  });

  it("rejects redirects to non-whitelisted domains", () => {
    const valid = isValidRedirectTarget("https://evil.example.com/malicious");
    expect(valid).toBe(false);
  });

  it("allows redirects to accounts.google.com for auth purposes", () => {
    const valid = isValidRedirectTarget("https://accounts.google.com/o/oauth2/auth");
    expect(valid).toBe(true);
  });

  it("rejects malformed URLs", () => {
    const valid = isValidRedirectTarget("not a valid url");
    expect(valid).toBe(false);
  });

  it("logs warnings for invalid redirects", () => {
    isValidRedirectTarget("http://invalid.com/path");
    expect(log.warn).toHaveBeenCalled();
  });
});

describe("secureFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockFetch.mockClear();
  });

  it("returns response for non-redirect status codes", async () => {
    const mockResponse = {
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue("csv data"),
    };
    mockFetch.mockResolvedValueOnce(mockResponse);

    const response = await secureFetch("https://docs.google.com/spreadsheets/d/abc123/export?format=csv");

    expect(response).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://docs.google.com/spreadsheets/d/abc123/export?format=csv",
      { redirect: "manual" },
    );
  });

  it("follows valid redirects", async () => {
    const mockRedirectResponse = {
      status: 301,
      headers: new Headers({
        location: "https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=1",
      }),
    };

    const mockFinalResponse = {
      status: 200,
      headers: new Headers(),
    };

    mockFetch
      .mockResolvedValueOnce(mockRedirectResponse)
      .mockResolvedValueOnce(mockFinalResponse);

    const response = await secureFetch("https://docs.google.com/initial");

    expect(response).toBe(mockFinalResponse);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("rejects redirects to invalid targets", async () => {
    const mockRedirectResponse = {
      status: 302,
      headers: new Headers({
        location: "http://evil.com/malicious",
      }),
    };

    mockFetch.mockResolvedValueOnce(mockRedirectResponse);

    await expect(secureFetch("https://docs.google.com/sheets")).rejects.toThrow(
      "Invalid redirect target: http://evil.com/malicious",
    );
  });

  it("rejects redirect with missing Location header", async () => {
    const mockRedirectResponse = {
      status: 301,
      headers: new Headers(),
    };

    mockFetch.mockResolvedValueOnce(mockRedirectResponse);

    await expect(secureFetch("https://docs.google.com/sheets")).rejects.toThrow(
      "Invalid redirect: missing Location header",
    );
  });

  it("rejects chains exceeding max redirects", async () => {
    const mockRedirect1 = {
      status: 301,
      headers: new Headers({
        location: "https://docs.google.com/sheets/redirect1",
      }),
    };

    const mockRedirect2 = {
      status: 302,
      headers: new Headers({
        location: "https://docs.google.com/sheets/redirect2",
      }),
    };

    mockFetch
      .mockResolvedValueOnce(mockRedirect1)
      .mockResolvedValueOnce(mockRedirect2);

    await expect(secureFetch("https://docs.google.com/sheets", { maxRedirects: 1 })).rejects.toThrow(
      "Too many redirects (max 1 allowed)",
    );
  });

  it("allows multiple redirects with higher maxRedirects limit", async () => {
    const mockRedirect1 = {
      status: 301,
      headers: new Headers({
        location: "https://docs.google.com/sheets/r1",
      }),
    };

    const mockRedirect2 = {
      status: 301,
      headers: new Headers({
        location: "https://docs.google.com/sheets/r2",
      }),
    };

    const mockFinal = {
      status: 200,
      headers: new Headers(),
    };

    mockFetch
      .mockResolvedValueOnce(mockRedirect1)
      .mockResolvedValueOnce(mockRedirect2)
      .mockResolvedValueOnce(mockFinal);

    const response = await secureFetch("https://docs.google.com/sheets", { maxRedirects: 2 });

    expect(response).toBe(mockFinal);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

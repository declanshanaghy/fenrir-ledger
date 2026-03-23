/**
 * validateImportUrl — SSRF prevention unit tests (issue #1891 / MEDIUM-002)
 *
 * Ensures the function blocks private IPs, non-HTTPS schemes, and localhost
 * while allowing valid public HTTPS URLs.
 */

import { describe, it, expect } from "vitest";
import { validateImportUrl } from "@/lib/sheets/url-validation";

describe("validateImportUrl — scheme enforcement", () => {
  it("accepts a valid HTTPS URL", () => {
    expect(validateImportUrl("https://docs.google.com/spreadsheets/d/abc")).toBeNull();
  });

  it("rejects http:// URLs", () => {
    expect(validateImportUrl("http://docs.google.com/spreadsheets/d/abc")).not.toBeNull();
  });

  it("rejects file:// URLs", () => {
    expect(validateImportUrl("file:///etc/passwd")).not.toBeNull();
  });

  it("rejects ftp:// URLs", () => {
    expect(validateImportUrl("ftp://example.com/data.csv")).not.toBeNull();
  });

  it("rejects completely invalid URL strings", () => {
    expect(validateImportUrl("not-a-url")).not.toBeNull();
    expect(validateImportUrl("")).not.toBeNull();
  });
});

describe("validateImportUrl — localhost blocking", () => {
  it("rejects localhost by name", () => {
    expect(validateImportUrl("https://localhost/foo")).not.toBeNull();
  });

  it("rejects localhost on an arbitrary port", () => {
    expect(validateImportUrl("https://localhost:8080/api")).not.toBeNull();
  });
});

describe("validateImportUrl — IPv4 private range blocking", () => {
  it("rejects 127.0.0.1 (loopback)", () => {
    expect(validateImportUrl("https://127.0.0.1/api")).not.toBeNull();
  });

  it("rejects 127.255.255.255 (loopback edge)", () => {
    expect(validateImportUrl("https://127.255.255.255/")).not.toBeNull();
  });

  it("rejects 10.0.0.1 (RFC-1918)", () => {
    expect(validateImportUrl("https://10.0.0.1/")).not.toBeNull();
  });

  it("rejects 10.255.255.255 (RFC-1918 edge)", () => {
    expect(validateImportUrl("https://10.255.255.255/")).not.toBeNull();
  });

  it("rejects 172.16.0.1 (RFC-1918 lower bound)", () => {
    expect(validateImportUrl("https://172.16.0.1/")).not.toBeNull();
  });

  it("rejects 172.31.255.255 (RFC-1918 upper bound)", () => {
    expect(validateImportUrl("https://172.31.255.255/")).not.toBeNull();
  });

  it("accepts 172.15.0.1 (just below RFC-1918 range)", () => {
    expect(validateImportUrl("https://172.15.0.1/")).toBeNull();
  });

  it("accepts 172.32.0.1 (just above RFC-1918 range)", () => {
    expect(validateImportUrl("https://172.32.0.1/")).toBeNull();
  });

  it("rejects 192.168.1.1 (RFC-1918)", () => {
    expect(validateImportUrl("https://192.168.1.1/")).not.toBeNull();
  });

  it("rejects 169.254.169.254 (GCP/AWS metadata endpoint)", () => {
    expect(validateImportUrl("https://169.254.169.254/latest/meta-data/")).not.toBeNull();
  });

  it("rejects 169.254.0.1 (link-local range)", () => {
    expect(validateImportUrl("https://169.254.0.1/")).not.toBeNull();
  });
});

describe("validateImportUrl — IPv6 private range blocking", () => {
  it("rejects ::1 (IPv6 loopback)", () => {
    expect(validateImportUrl("https://[::1]/")).not.toBeNull();
  });

  it("rejects fc00::1 (ULA range)", () => {
    expect(validateImportUrl("https://[fc00::1]/")).not.toBeNull();
  });

  it("rejects fd00::1 (ULA range)", () => {
    expect(validateImportUrl("https://[fd00::1]/")).not.toBeNull();
  });

  it("rejects fe80::1 (link-local range)", () => {
    expect(validateImportUrl("https://[fe80::1]/")).not.toBeNull();
  });
});

describe("validateImportUrl — public IPs accepted", () => {
  it("accepts a public IPv4 address", () => {
    expect(validateImportUrl("https://8.8.8.8/")).toBeNull();
  });

  it("accepts a public hostname", () => {
    expect(validateImportUrl("https://example.com/data.csv")).toBeNull();
  });
});

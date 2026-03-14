/**
 * Terraform dns.tf — Umami static IP and DNS record validation
 *
 * Issue #845: Automate Umami static IP and DNS in Terraform
 *
 * Validates acceptance criteria:
 * - google_compute_global_address.umami_ip resource exists
 * - google_dns_record_set.analytics resource exists and points to the static IP
 * - Import blocks exist for both resources (to adopt existing manually-created infra)
 * - Output "umami_ip" exists so Helm values can reference it
 *
 * These are static-file validation tests (Vitest unit) — no browser needed.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Terraform DNS — Umami static IP and analytics DNS record (issue #845)', () => {
  const repoRoot = path.join(__dirname, '../../../../..');
  const dnsTf = path.join(repoRoot, 'infrastructure', 'dns.tf');
  const outputsTf = path.join(repoRoot, 'infrastructure', 'outputs.tf');

  let dnsContent: string;
  let outputsContent: string;

  beforeAll(() => {
    dnsContent = fs.readFileSync(dnsTf, 'utf-8');
    outputsContent = fs.readFileSync(outputsTf, 'utf-8');
  });

  // -------------------------------------------------------------------------
  // AC-1: google_compute_global_address resource for umami-ip
  // -------------------------------------------------------------------------

  describe('google_compute_global_address.umami_ip resource', () => {
    it('declares the umami_ip resource block', () => {
      expect(dnsContent).toContain(
        'resource "google_compute_global_address" "umami_ip"'
      );
    });

    it('sets the name attribute to "umami-ip" to match the manually-created resource', () => {
      // The resource must match the existing GCP resource name exactly for import to work
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_compute_global_address" "umami_ip"'
      );
      expect(resourceBlock).toContain('name    = "umami-ip"');
    });

    it('scopes the resource to the project_id variable', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_compute_global_address" "umami_ip"'
      );
      expect(resourceBlock).toContain('project = var.project_id');
    });

    it('declares a depends_on on google_project_service.apis', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_compute_global_address" "umami_ip"'
      );
      expect(resourceBlock).toContain('google_project_service.apis');
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: google_dns_record_set resource for analytics.fenrirledger.com
  // -------------------------------------------------------------------------

  describe('google_dns_record_set.analytics resource', () => {
    it('declares the analytics record set resource block', () => {
      expect(dnsContent).toContain(
        'resource "google_dns_record_set" "analytics"'
      );
    });

    it('uses analytics.${var.domain}. as the DNS name', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "analytics"'
      );
      // Must use the domain variable — not a hardcoded string
      expect(resourceBlock).toContain('analytics.${var.domain}.');
    });

    it('sets the record type to A', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "analytics"'
      );
      expect(resourceBlock).toContain('type         = "A"');
    });

    it('references the umami_ip address for the A record data', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "analytics"'
      );
      // Must point to the Terraform-managed static IP, not a hardcoded IP
      expect(resourceBlock).toContain(
        'google_compute_global_address.umami_ip.address'
      );
    });

    it('sets a TTL value', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "analytics"'
      );
      expect(resourceBlock).toMatch(/ttl\s+=\s+\d+/);
    });

    it('references the managed zone', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "analytics"'
      );
      expect(resourceBlock).toContain('managed_zone = google_dns_managed_zone.app.name');
    });

    it('scopes the resource to the project_id variable', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "analytics"'
      );
      expect(resourceBlock).toContain('project      = var.project_id');
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: Import blocks documented for both existing resources
  // -------------------------------------------------------------------------

  describe('Terraform import blocks for existing manually-created resources', () => {
    it('includes a native import block for google_compute_global_address.umami_ip', () => {
      // Terraform 1.5+ native import block allows adopting existing resources on apply
      expect(dnsContent).toMatch(
        /import\s*\{[^}]*to\s*=\s*google_compute_global_address\.umami_ip[^}]*\}/s
      );
    });

    it('specifies the correct GCP resource ID for umami_ip import', () => {
      // The ID must match: projects/<project>/global/addresses/umami-ip
      expect(dnsContent).toContain(
        'projects/fenrir-ledger-prod/global/addresses/umami-ip'
      );
    });

    it('includes a native import block for google_dns_record_set.analytics', () => {
      expect(dnsContent).toMatch(
        /import\s*\{[^}]*to\s*=\s*google_dns_record_set\.analytics[^}]*\}/s
      );
    });

    it('specifies the correct GCP resource ID for analytics DNS import', () => {
      // The ID must match: projects/<project>/managedZones/<zone>/rrsets/<name>/<type>
      expect(dnsContent).toContain(
        'projects/fenrir-ledger-prod/managedZones/fenrirledger-com/rrsets/analytics.fenrirledger.com./A'
      );
    });

    it('documents CLI import commands as comments for both resources', () => {
      // Operators who don't use native import blocks need the CLI equivalent
      expect(dnsContent).toContain('terraform import google_compute_global_address.umami_ip');
      expect(dnsContent).toContain('terraform import google_dns_record_set.analytics');
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: Output for the Umami IP so Helm values can reference it
  // -------------------------------------------------------------------------

  describe('outputs.tf — umami_ip output', () => {
    it('declares an output named "umami_ip"', () => {
      expect(outputsContent).toContain('output "umami_ip"');
    });

    it('outputs the address attribute of the umami_ip resource', () => {
      const outputBlock = extractBlock(outputsContent, 'output "umami_ip"');
      expect(outputBlock).toContain('google_compute_global_address.umami_ip.address');
    });

    it('includes a human-readable description for the output', () => {
      const outputBlock = extractBlock(outputsContent, 'output "umami_ip"');
      expect(outputBlock).toContain('description');
      // Description should mention Umami
      expect(outputBlock.toLowerCase()).toContain('umami');
    });
  });

  // -------------------------------------------------------------------------
  // Structural integrity: existing resources are not broken
  // -------------------------------------------------------------------------

  describe('Structural integrity — existing resources unaffected', () => {
    it('retains the app_ip resource for the main application', () => {
      expect(dnsContent).toContain(
        'resource "google_compute_global_address" "app_ip"'
      );
    });

    it('retains the apex DNS A record pointing to app_ip', () => {
      const apexBlock = extractBlock(dnsContent, 'resource "google_dns_record_set" "apex"');
      expect(apexBlock).toContain('google_compute_global_address.app_ip.address');
    });

    it('retains the www DNS A record pointing to app_ip', () => {
      const wwwBlock = extractBlock(dnsContent, 'resource "google_dns_record_set" "www"');
      expect(wwwBlock).toContain('google_compute_global_address.app_ip.address');
    });

    it('retains the static_ip output for the main application', () => {
      expect(outputsContent).toContain('output "static_ip"');
    });

    it('does not hardcode the IP address 34.13.119.189 in any resource rrdatas', () => {
      // The IP must be dynamic via the Terraform resource reference, not hardcoded
      // (hardcoded IPs break if the address is recreated)
      const analyticsBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "analytics"'
      );
      expect(analyticsBlock).not.toContain('34.13.119.189');
    });
  });
});

// ---------------------------------------------------------------------------
// Helper: extract the content of the first Terraform block matching a label
// ---------------------------------------------------------------------------

function extractBlock(content: string, label: string): string {
  const start = content.indexOf(label);
  if (start === -1) return '';

  let depth = 0;
  let i = start;
  let blockStart = -1;

  while (i < content.length) {
    if (content[i] === '{') {
      depth++;
      if (blockStart === -1) blockStart = i;
    } else if (content[i] === '}') {
      depth--;
      if (depth === 0 && blockStart !== -1) {
        return content.slice(start, i + 1);
      }
    }
    i++;
  }

  return content.slice(start);
}

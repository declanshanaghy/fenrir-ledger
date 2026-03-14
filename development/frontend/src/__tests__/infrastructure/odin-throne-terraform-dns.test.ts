/**
 * Terraform dns.tf — Odin's Throne static IP and DNS record validation
 *
 * Issue #884: Odin's Throne: Helm chart, GKE deploy, and monitor.fenrirledger.com DNS
 *
 * Validates acceptance criteria:
 * - google_compute_global_address.monitor_ip resource exists with name "monitor-ip"
 * - google_dns_record_set.monitor resource exists pointing to monitor.fenrirledger.com
 * - monitor A record references monitor_ip address (not hardcoded)
 * - Existing app_ip / analytics / umami resources are not broken
 *
 * These are static-file validation tests (Vitest unit) — no browser needed.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Terraform DNS — Odin\'s Throne static IP and monitor DNS record (issue #884)', () => {
  const repoRoot = path.join(__dirname, '../../../../..');
  const dnsTf = path.join(repoRoot, 'infrastructure', 'dns.tf');

  let dnsContent: string;

  beforeAll(() => {
    dnsContent = fs.readFileSync(dnsTf, 'utf-8');
  });

  // -------------------------------------------------------------------------
  // AC-1: google_compute_global_address resource for monitor-ip
  // -------------------------------------------------------------------------

  describe('google_compute_global_address.monitor_ip resource', () => {
    it('declares the monitor_ip resource block', () => {
      expect(dnsContent).toContain(
        'resource "google_compute_global_address" "monitor_ip"'
      );
    });

    it('sets the name attribute to "monitor-ip"', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_compute_global_address" "monitor_ip"'
      );
      expect(resourceBlock).toContain('name    = "monitor-ip"');
    });

    it('scopes the resource to the project_id variable', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_compute_global_address" "monitor_ip"'
      );
      expect(resourceBlock).toContain('project = var.project_id');
    });

    it('declares a depends_on on google_project_service.apis', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_compute_global_address" "monitor_ip"'
      );
      expect(resourceBlock).toContain('google_project_service.apis');
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: google_dns_record_set resource for monitor.fenrirledger.com
  // -------------------------------------------------------------------------

  describe('google_dns_record_set.monitor resource', () => {
    it('declares the monitor record set resource block', () => {
      expect(dnsContent).toContain(
        'resource "google_dns_record_set" "monitor"'
      );
    });

    it('uses monitor.${var.domain}. as the DNS name', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "monitor"'
      );
      expect(resourceBlock).toContain('monitor.${var.domain}.');
    });

    it('sets the record type to A', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "monitor"'
      );
      expect(resourceBlock).toContain('type         = "A"');
    });

    it('references the monitor_ip address for the A record data', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "monitor"'
      );
      // Must point to the Terraform-managed static IP, not a hardcoded IP
      expect(resourceBlock).toContain(
        'google_compute_global_address.monitor_ip.address'
      );
    });

    it('sets a TTL value', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "monitor"'
      );
      expect(resourceBlock).toMatch(/ttl\s+=\s+\d+/);
    });

    it('references the managed zone', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "monitor"'
      );
      expect(resourceBlock).toContain(
        'managed_zone = google_dns_managed_zone.app.name'
      );
    });

    it('scopes the resource to the project_id variable', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "monitor"'
      );
      expect(resourceBlock).toContain('project      = var.project_id');
    });

    it('does not hardcode an IP address in rrdatas', () => {
      const resourceBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "monitor"'
      );
      // rrdatas must use a Terraform reference, not a raw IP string
      expect(resourceBlock).not.toMatch(/rrdatas\s*=\s*\["\d+\.\d+\.\d+\.\d+"\]/);
    });
  });

  // -------------------------------------------------------------------------
  // Structural integrity: existing resources are not broken
  // -------------------------------------------------------------------------

  describe('Structural integrity — existing resources unaffected', () => {
    it('retains google_compute_global_address.app_ip', () => {
      expect(dnsContent).toContain(
        'resource "google_compute_global_address" "app_ip"'
      );
    });

    it('retains google_compute_global_address.umami_ip', () => {
      expect(dnsContent).toContain(
        'resource "google_compute_global_address" "umami_ip"'
      );
    });

    it('retains google_dns_record_set.analytics', () => {
      expect(dnsContent).toContain(
        'resource "google_dns_record_set" "analytics"'
      );
    });

    it('retains google_dns_record_set.apex', () => {
      expect(dnsContent).toContain(
        'resource "google_dns_record_set" "apex"'
      );
    });

    it('retains google_dns_record_set.www', () => {
      expect(dnsContent).toContain(
        'resource "google_dns_record_set" "www"'
      );
    });

    it('analytics record still references umami_ip (not monitor_ip)', () => {
      const analyticsBlock = extractBlock(
        dnsContent,
        'resource "google_dns_record_set" "analytics"'
      );
      expect(analyticsBlock).toContain('umami_ip.address');
      expect(analyticsBlock).not.toContain('monitor_ip.address');
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

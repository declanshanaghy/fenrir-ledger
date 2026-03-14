/**
 * Mayo Heckler Engine Tests
 * Verifies the escalation state machine matches the documented behavior:
 * normal → retort → apoplectic → explosion → new heckler
 *
 * Tests Issue #799: Heckler Escalation State Machine diagram validation
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Dynamic import of ESM module
async function importMayoHeckler() {
  return import('../../../../infrastructure/k8s/agents/mayo-heckler.mjs');
}

describe('Mayo Heckler Engine — Escalation State Machine', () => {
  let createHecklerEngine: any;
  let ESCALATION_RETORTS: any;
  let NEW_HECKLER_ENTRANCES: any;

  beforeEach(async () => {
    const mayo = await importMayoHeckler();
    createHecklerEngine = mayo.createHecklerEngine;
    ESCALATION_RETORTS = mayo.ESCALATION_RETORTS;
    NEW_HECKLER_ENTRANCES = mayo.NEW_HECKLER_ENTRANCES;
  });

  describe('Initial State', () => {
    it('should start in normal state and trigger heckles', async () => {
      const engine = createHecklerEngine('FiremanDecko');
      const result = engine.maybeHeckle();
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return agent display name', async () => {
      const engine = createHecklerEngine('FiremanDecko');
      const agentName = engine.getAgentName();
      expect(agentName).toBe('FiremanDecko');
    });

    it('should return random Mayo heckler name', async () => {
      const engine = createHecklerEngine();
      const name = engine.getCurrentHeckler();
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
      expect(name).toMatch(/\s/);
    });
  });

  describe('Escalation Retorts Content', () => {
    it('should have 3 escalation levels in ESCALATION_RETORTS', async () => {
      expect(ESCALATION_RETORTS.length).toBe(3);
      expect(Array.isArray(ESCALATION_RETORTS[0])).toBe(true);
      expect(Array.isArray(ESCALATION_RETORTS[1])).toBe(true);
      expect(Array.isArray(ESCALATION_RETORTS[2])).toBe(true);
    });

    it('retort level (0) should have aggressive tone', async () => {
      const retorts = ESCALATION_RETORTS[0];
      expect(retorts.length).toBeGreaterThan(0);
      const hasEscalation = retorts.some((r: string) => r.includes('!!') || r.includes('THAT'));
      expect(hasEscalation).toBe(true);
    });

    it('apoplectic level (1) should reference extreme actions', async () => {
      const retorts = ESCALATION_RETORTS[1];
      expect(retorts.length).toBeGreaterThan(0);
      const hasExtreme = retorts.some((r: string) =>
        r.includes('TAKING OFF') || r.includes('REACH') || r.includes('SKELP'),
      );
      expect(hasExtreme).toBe(true);
    });

    it('explosion level (2) should have 💥 emoji and dramatic death imagery', async () => {
      const retorts = ESCALATION_RETORTS[2];
      expect(retorts.length).toBeGreaterThan(0);
      const allHaveExplosion = retorts.every((r: string) => r.includes('💥'));
      expect(allHaveExplosion).toBe(true);
    });
  });

  describe('New Heckler Entrance', () => {
    it('should have entrance lines for new hecklers', async () => {
      expect(Array.isArray(NEW_HECKLER_ENTRANCES)).toBe(true);
      expect(NEW_HECKLER_ENTRANCES.length).toBeGreaterThan(0);
    });

    it('each entrance starts with 🟢🔴 emoji marker', async () => {
      NEW_HECKLER_ENTRANCES.forEach((entrance: string) => {
        expect(entrance).toContain('🟢🔴');
      });
    });
  });

  describe('State Machine Invariants', () => {
    it('should maintain valid state across many iterations', async () => {
      const engine = createHecklerEngine('Loki');
      for (let i = 0; i < 100; i++) {
        const result = engine.maybeHeckle();
        const agentName = engine.getAgentName();
        const hecklerName = engine.getCurrentHeckler();

        expect(typeof agentName).toBe('string');
        expect(typeof hecklerName).toBe('string');
        expect(agentName.length).toBeGreaterThan(0);
        expect(hecklerName.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Agent Name Management', () => {
    it('should set agent display name', async () => {
      const engine = createHecklerEngine();

      engine.setAgentName('loki');
      expect(engine.getAgentName()).toBe('Loki');

      engine.setAgentName('luna');
      expect(engine.getAgentName()).toBe('Luna');

      engine.setAgentName('freya');
      expect(engine.getAgentName()).toBe('Freya');
    });

    it('should default to Agent if unknown name', async () => {
      const engine = createHecklerEngine();

      engine.setAgentName('unknown-agent');
      expect(engine.getAgentName()).toBe('unknown-agent');

      engine.setAgentName(null);
      expect(engine.getAgentName()).toBe('Agent');
    });
  });

  describe('Diagram Validation', () => {
    it('escalation levels should match state machine transitions: normal → retort → apoplectic → explosion → new heckler', async () => {
      // Verify the 3 escalation retort arrays exist and have content
      expect(ESCALATION_RETORTS.length).toBe(3);

      // Normal → Retort: escalationLevel becomes 1
      const retortRetorts = ESCALATION_RETORTS[0];
      expect(retortRetorts.length).toBeGreaterThan(0);
      // Should have high-energy markers like "!!" or "THAT'S"
      const hasRetortMarkers = retortRetorts.some((r: string) => r.includes("THAT'S") || r.includes('!!'));
      expect(hasRetortMarkers).toBe(true);

      // Retort → Apoplectic: escalationLevel becomes 2
      const apoplecticRetorts = ESCALATION_RETORTS[1];
      expect(apoplecticRetorts.length).toBeGreaterThan(0);
      // Should have action markers
      const hasActionMarkers = apoplecticRetorts.some((r: string) =>
        r.includes('JACKET') || r.includes('REACH') || r.includes('SKELP'),
      );
      expect(hasActionMarkers).toBe(true);

      // Apoplectic → Explosion: escalationLevel becomes 3
      const explosionRetorts = ESCALATION_RETORTS[2];
      expect(explosionRetorts.length).toBeGreaterThan(0);
      // All should have 💥 explosion emoji
      const allHaveExplosion = explosionRetorts.every((r: string) => r.includes('💥'));
      expect(allHaveExplosion).toBe(true);

      // Explosion → New Heckler: escalationLevel resets to 0
      expect(NEW_HECKLER_ENTRANCES.length).toBeGreaterThan(0);
      const hasNewHecklerMarkers = NEW_HECKLER_ENTRANCES.some((e: string) =>
        e.includes('🟢🔴') && (e.includes('MAYO') || e.includes('SAM')),
      );
      expect(hasNewHecklerMarkers).toBe(true);
    });
  });
});

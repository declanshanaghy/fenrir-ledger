import { registerCommand } from "./registry.js";
import { firestoreClient } from "../lib/firestore.js";
import { log } from "@fenrir/logger";

export function registerFirestoreCommands(): void {
  log.debug("registerFirestoreCommands called");

  registerCommand({
    name: "firestore-list-collections",
    desc: "List all top-level Firestore collections",
    subsystem: "firestore",
    execute: async (_ctx) => {
      log.debug("firestore-list-collections execute called");
      if (!firestoreClient) {
        log.debug("firestore-list-collections execute: no client");
        return ["ERROR: Firestore client not connected"];
      }
      const cols = await firestoreClient.listCollections();
      log.debug("firestore-list-collections execute returning", { count: cols.length });
      if (cols.length === 0) return ["(no collections)"];
      return cols.map((c) => c.id).sort();
    },
  });

  registerCommand({
    name: "firestore-get-user",
    desc: "Fetch Firestore document for the selected user",
    subsystem: "firestore",
    requiresContext: "user",
    execute: async (ctx) => {
      log.debug("firestore-get-user execute called", { hasUserId: Boolean(ctx.selectedUserId) });
      if (!firestoreClient) {
        log.debug("firestore-get-user execute: no client");
        return ["ERROR: Firestore client not connected"];
      }
      if (!ctx.selectedUserId) {
        log.debug("firestore-get-user execute: no user selected");
        return ["ERROR: No user selected"];
      }
      const snap = await firestoreClient.collection("users").doc(ctx.selectedUserId).get();
      if (!snap.exists) {
        log.debug("firestore-get-user execute: doc not found");
        return [`User ${ctx.selectedUserId} not found`];
      }
      const data = snap.data() ?? {};
      const lines = Object.entries(data).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
      log.debug("firestore-get-user execute returning", { lineCount: lines.length });
      return lines;
    },
  });

  registerCommand({
    name: "firestore-get-household",
    desc: "Fetch Firestore document for the selected household",
    subsystem: "firestore",
    requiresContext: "household",
    execute: async (ctx) => {
      log.debug("firestore-get-household execute called", { hasHouseholdId: Boolean(ctx.selectedHouseholdId) });
      if (!firestoreClient) {
        log.debug("firestore-get-household execute: no client");
        return ["ERROR: Firestore client not connected"];
      }
      if (!ctx.selectedHouseholdId) {
        log.debug("firestore-get-household execute: no household selected");
        return ["ERROR: No household selected"];
      }
      const snap = await firestoreClient.collection("households").doc(ctx.selectedHouseholdId).get();
      if (!snap.exists) {
        log.debug("firestore-get-household execute: doc not found");
        return [`Household ${ctx.selectedHouseholdId} not found`];
      }
      const data = snap.data() ?? {};
      const lines = Object.entries(data).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
      log.debug("firestore-get-household execute returning", { lineCount: lines.length });
      return lines;
    },
  });

  registerCommand({
    name: "firestore-delete-user",
    desc: "Delete the selected user document from Firestore — destructive",
    subsystem: "firestore",
    requiresContext: "user",
    destructive: true,
    execute: async (ctx) => {
      log.debug("firestore-delete-user execute called", { hasUserId: Boolean(ctx.selectedUserId) });
      if (!firestoreClient) {
        log.debug("firestore-delete-user execute: no client");
        return ["ERROR: Firestore client not connected"];
      }
      if (!ctx.selectedUserId) {
        log.debug("firestore-delete-user execute: no user selected");
        return ["ERROR: No user selected"];
      }
      await firestoreClient.collection("users").doc(ctx.selectedUserId).delete();
      log.debug("firestore-delete-user execute returning");
      return [`Deleted user: ${ctx.selectedUserId}`];
    },
  });

  log.debug("registerFirestoreCommands returning");
}

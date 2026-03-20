import { registerCommand } from "./registry.js";
import { firestoreClient } from "../lib/firestore.js";
import { log } from "@fenrir/logger";

export function registerFirestoreCommands(): void {
  log.debug("registerFirestoreCommands called");

  registerCommand({
    id: "firestore:list-collections",
    label: "Firestore: List Collections",
    description: "List all top-level Firestore collections",
    action: async () => {
      log.debug("firestore:list-collections action called");
      if (!firestoreClient) {
        log.debug("firestore:list-collections: no client");
        return;
      }
      const cols = await firestoreClient.listCollections();
      log.debug("firestore:list-collections returning", { count: cols.length });
    },
  });

  log.debug("registerFirestoreCommands returning");
}

// Fix: patch Freya's cards after household join — householdId mismatch (issue #1796)
//
// After Freya joined Odin's household, her cards in Firestore still reference
// her old solo householdId. The sync/pull API returns them but the client
// filters them out because card.householdId !== localStorage partition key.
//
// This script:
//   1. Verifies Freya's user doc points to Odin's household
//   2. Deletes Freya's orphaned solo household doc
//   3. No card patching needed — cards already belong to Odin's household
//      and the server-side sync/pull resolves the correct household.
//      The real fix is client-side (localStorage key), handled by the agent.
//
// Run via: node development/odins-spear/migrations/1796-fix-freya-household-cards.mjs

const PROJECT_ID = "fenrir-ledger-prod";
const DATABASE_ID = "fenrir-ledger-prod";

const FREYA_SUB = "113951470530790749685";
const ODIN_HOUSEHOLD = "110414050811994350775";

export async function main() {
  const { Firestore } = await import("@google-cloud/firestore");
  const db = new Firestore({ projectId: PROJECT_ID, databaseId: DATABASE_ID });

  console.log("=== Step 1: Verify Freya's user doc ===");
  const userDoc = await db.collection("users").doc(FREYA_SUB).get();
  if (!userDoc.exists) {
    console.error("ABORT: Freya user doc not found");
    return;
  }
  const userData = userDoc.data();
  console.log(`  householdId: ${userData.householdId}`);
  console.log(`  role: ${userData.role}`);
  console.log(`  email: ${userData.email}`);

  if (userData.householdId !== ODIN_HOUSEHOLD) {
    console.error(`ABORT: Freya's householdId is ${userData.householdId}, expected ${ODIN_HOUSEHOLD}`);
    console.error("She may not have joined yet, or something else changed.");
    return;
  }
  console.log("  OK: Freya points to Odin's household");

  console.log("\n=== Step 2: Check Odin's household for Freya membership ===");
  const odinDoc = await db.collection("households").doc(ODIN_HOUSEHOLD).get();
  if (!odinDoc.exists) {
    console.error("ABORT: Odin's household doc not found");
    return;
  }
  const odinData = odinDoc.data();
  console.log(`  name: ${odinData.name}`);
  console.log(`  ownerId: ${odinData.ownerId}`);
  console.log(`  memberIds: ${JSON.stringify(odinData.memberIds)}`);

  if (!odinData.memberIds?.includes(FREYA_SUB)) {
    console.error("ABORT: Freya is not in Odin's household memberIds");
    return;
  }
  console.log("  OK: Freya is a member of Odin's household");

  console.log("\n=== Step 3: Delete Freya's orphaned solo household ===");
  const soloDoc = await db.collection("households").doc(FREYA_SUB).get();
  if (!soloDoc.exists) {
    console.log("  SKIP: Freya's solo household already deleted");
  } else {
    const soloData = soloDoc.data();
    // Safety: only delete if it's actually a solo household owned by Freya
    if (soloData.ownerId !== FREYA_SUB) {
      console.error(`ABORT: Solo household ownerId is ${soloData.ownerId}, not Freya`);
      return;
    }
    console.log(`  Solo household: name=${soloData.name}, members=${JSON.stringify(soloData.memberIds)}`);
    await db.collection("households").doc(FREYA_SUB).delete();
    console.log("  DELETED: Freya's orphaned solo household");
  }

  console.log("\n=== Step 4: Verify cards in Odin's household ===");
  const cardsSnap = await db.collection("households").doc(ODIN_HOUSEHOLD).collection("cards").get();
  console.log(`  Cards in Odin's household: ${cardsSnap.size}`);

  console.log("\n=== Done ===");
  console.log("Freya should now clear her browser localStorage on fenrirledger.com and reload.");
  console.log("The sync/pull will download all cards with the correct householdId.");
  console.log("(The client-side localStorage key fix is tracked in issue #1796)");
}

// Direct execution support
main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

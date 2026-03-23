// Reset Freya to solo household after removal from Odin's household

const FREYA_SUB = "113951470530790749685";
const ODIN_HOUSEHOLD = "110414050811994350775";

export async function main() {
  const { Firestore } = await import("@google-cloud/firestore");
  const db = new Firestore({ projectId: "fenrir-ledger-prod", databaseId: "fenrir-ledger-prod" });

  console.log("=== Step 1: Update Freya's user doc ===");
  const userRef = db.collection("users").doc(FREYA_SUB);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    console.error("ABORT: Freya user doc not found");
    return;
  }
  const userData = userDoc.data();
  console.log("  Before:", JSON.stringify({ householdId: userData.householdId, role: userData.role }));

  await userRef.update({
    householdId: FREYA_SUB,
    role: "owner",
    updatedAt: new Date().toISOString(),
  });
  console.log("  After: householdId=" + FREYA_SUB + ", role=owner");

  console.log("\n=== Step 2: Re-create Freya's solo household ===");
  const soloRef = db.collection("households").doc(FREYA_SUB);
  const soloDoc = await soloRef.get();
  if (soloDoc.exists) {
    console.log("  SKIP: Solo household already exists");
  } else {
    // Generate invite code (6 char, unambiguous)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await soloRef.set({
      id: FREYA_SUB,
      name: "Freya Fenrir's Household",
      ownerId: FREYA_SUB,
      memberIds: [FREYA_SUB],
      inviteCode: code,
      inviteCodeExpiresAt: expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    console.log("  CREATED: Solo household with invite code " + code);
  }

  console.log("\n=== Step 3: Verify ===");
  const verifyUser = await userRef.get();
  const verifyHousehold = await soloRef.get();
  console.log("  User:", JSON.stringify({ householdId: verifyUser.data().householdId, role: verifyUser.data().role }));
  console.log("  Household:", verifyHousehold.exists ? "exists, members=" + JSON.stringify(verifyHousehold.data().memberIds) : "MISSING");

  console.log("\n=== Done ===");
  console.log("Freya can now clear localStorage and reload. She'll be solo with 0 cards.");
}

main().catch(console.error);

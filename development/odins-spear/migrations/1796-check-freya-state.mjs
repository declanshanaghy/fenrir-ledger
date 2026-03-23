// Check Freya's current Firestore state after household removal

const FREYA_SUB = "113951470530790749685";
const ODIN_HOUSEHOLD = "110414050811994350775";

export async function main() {
  const { Firestore } = await import("@google-cloud/firestore");
  const db = new Firestore({ projectId: "fenrir-ledger-prod", databaseId: "fenrir-ledger-prod" });

  console.log("=== Freya user doc ===");
  const userDoc = await db.collection("users").doc(FREYA_SUB).get();
  if (userDoc.exists) {
    const d = userDoc.data();
    console.log(JSON.stringify({ householdId: d.householdId, role: d.role, email: d.email }, null, 2));
  } else {
    console.log("NOT FOUND");
  }

  console.log("\n=== Odin household ===");
  const odinDoc = await db.collection("households").doc(ODIN_HOUSEHOLD).get();
  if (odinDoc.exists) {
    const d = odinDoc.data();
    console.log("memberIds:", JSON.stringify(d.memberIds));
    console.log("ownerId:", d.ownerId);
  }

  console.log("\n=== Freya solo household ===");
  const soloDoc = await db.collection("households").doc(FREYA_SUB).get();
  console.log("exists:", soloDoc.exists);
  if (soloDoc.exists) {
    console.log(JSON.stringify(soloDoc.data(), null, 2));
  }

  console.log("\n=== Stripe entitlement for Freya ===");
  const stripeDoc = await db.collection("households").doc(ODIN_HOUSEHOLD).collection("stripe").doc("subscription").get();
  if (stripeDoc.exists) {
    console.log(JSON.stringify(stripeDoc.data(), null, 2));
  } else {
    console.log("No stripe sub on Odin household");
  }
}

main().catch(console.error);

import { prisma } from "../src/lib/db";

async function runDeletionTests() {
  console.log("=== BEGIN COMPREHENSIVE CAPABILITY DELETION TESTS ===");
  let failed = false;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failed = true;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  }

  const origin = "http://localhost:3000";

  try {
    // ----------------------------------------------------
    // TEST 1: Deleting a Capability with an ACTIVE version (Must be BLOCKED)
    // ----------------------------------------------------
    console.log("\n[TEST 1] Verifying deletion of a capability with an ACTIVE version is blocked...");
    
    // Find model-developer (seeded as ACTIVE)
    const activeCap = await prisma.capability.findUnique({
      where: { name: "model-developer" },
      include: { versions: true }
    });

    if (!activeCap) {
      console.error("Baseline capability 'model-developer' not found! Re-run seed.js");
      process.exit(1);
    }

    const deleteRes = await fetch(`${origin}/api/capabilities/${activeCap.id}`, {
      method: "DELETE",
      headers: {
        "x-simulated-user": "admin",
        "x-simulated-roles": "USER,ADMIN"
      }
    });

    assert(deleteRes.status === 400, "Deleting an ACTIVE capability must return 400 Bad Request");
    const errData = await deleteRes.json();
    assert(errData.error.includes("Cannot delete a capability with ACTIVE or PENDING_REVIEW versions"), "Should return clear blocked error message");

    // ----------------------------------------------------
    // TEST 2: Successful Deletion of a REJECTED Capability
    // ----------------------------------------------------
    console.log("\n[TEST 2] Verifying successful deletion of a REJECTED capability...");

    // Create a temporary mock capability that is REJECTED
    const tempCap = await prisma.capability.create({
      data: {
        name: "temp-rejected-capability",
        description: "A temporary rejected capability for deletion verification",
        type: "SKILL",
        owner: "Security Team"
      }
    });

    const vRejected = await prisma.capabilityVersion.create({
      data: {
        capabilityId: tempCap.id,
        version: "0.1.0",
        status: "REJECTED",
        zipPath: "mock_bundles/security-playbook-bundle.zip",
        extractedPath: "extracted/temp-rejected-capability/0.1.0",
        harnesses: JSON.stringify([])
      }
    });

    // Delete using the new version deletion endpoint
    const successDeleteRes = await fetch(`${origin}/api/capabilities/versions/${vRejected.id}`, {
      method: "DELETE",
      headers: {
        "x-simulated-user": "admin",
        "x-simulated-roles": "USER,ADMIN"
      }
    });

    assert(successDeleteRes.status === 200, "Deleting a REJECTED capability version should return 200 OK");
    const successData = await successDeleteRes.json();
    assert(successData.success === true, "Should return success flag");
    assert(successData.capabilityDeleted === true, "Should indicate the entire capability was deleted since it was the only version");

    // Verify it is completely removed from database
    const queryDeletedCap = await prisma.capability.findUnique({
      where: { id: tempCap.id }
    });
    assert(queryDeletedCap === null, "Capability must be completely removed from SQLite DB");

    // ----------------------------------------------------
    // TEST 3: Successful Deletion of an INACTIVE Capability
    // ----------------------------------------------------
    console.log("\n[TEST 3] Verifying successful deletion of an INACTIVE capability...");

    // Create a temporary mock capability that is INACTIVE
    const tempInactiveCap = await prisma.capability.create({
      data: {
        name: "temp-inactive-capability",
        description: "A temporary inactive capability for deletion verification",
        type: "PLUGIN",
        owner: "Database Team"
      }
    });

    const vInactive = await prisma.capabilityVersion.create({
      data: {
        capabilityId: tempInactiveCap.id,
        version: "1.0.0",
        status: "INACTIVE",
        zipPath: "mock_bundles/database-plugin-bundle.zip",
        extractedPath: "extracted/temp-inactive-capability/1.0.0",
        harnesses: JSON.stringify([])
      }
    });

    const inactiveDeleteRes = await fetch(`${origin}/api/capabilities/versions/${vInactive.id}`, {
      method: "DELETE",
      headers: {
        "x-simulated-user": "user", // Regular developer
        "x-simulated-roles": "USER"
      }
    });

    assert(inactiveDeleteRes.status === 200, "Deleting an INACTIVE version should return 200 OK");
    const inactiveSuccessData = await inactiveDeleteRes.json();
    assert(inactiveSuccessData.success === true, "Should return success flag");

    // Verify it is completely removed from database
    const queryDeletedInactiveCap = await prisma.capability.findUnique({
      where: { id: tempInactiveCap.id }
    });
    assert(queryDeletedInactiveCap === null, "Inactive Capability must be completely removed from SQLite DB");

    // ----------------------------------------------------
    // TEST 4: Successful Deletion of a DRAFT version when there's an ACTIVE version!
    // ----------------------------------------------------
    console.log("\n[TEST 4] Verifying that a DRAFT version can always be deleted, even if there is an ACTIVE version...");

    // Find the baseline model-developer (seeded as ACTIVE v1.0.0)
    const weatherCap = await prisma.capability.findUnique({
      where: { name: "model-developer" },
      include: { versions: true }
    });

    if (!weatherCap) {
      console.error("Baseline capability 'model-developer' not found! Re-run seed.js");
      process.exit(1);
    }

    const activeVersion = weatherCap.versions.find(v => v.status === "ACTIVE");
    assert(activeVersion !== undefined, "Should have an ACTIVE version seeded");

    // Create a new DRAFT version (v1.0.5) of model-developer
    const draftVersion = await prisma.capabilityVersion.create({
      data: {
        capabilityId: weatherCap.id,
        version: "1.0.5",
        status: "DRAFT",
        zipPath: "mock_bundles/model-developer-bundle.zip",
        extractedPath: "extracted/model-developer/1.0.5",
        harnesses: JSON.stringify(["claude"])
      }
    });

    console.log(`Created temporary DRAFT version v1.0.5. Current model-developer versions count: ${weatherCap.versions.length + 1}`);

    // Attempt to delete this DRAFT version v1.0.5 via version deletion route
    const draftDeleteRes = await fetch(`${origin}/api/capabilities/versions/${draftVersion.id}`, {
      method: "DELETE",
      headers: {
        "x-simulated-user": "user",
        "x-simulated-roles": "USER"
      }
    });

    assert(draftDeleteRes.status === 200, "Deleting DRAFT version of capability with ACTIVE version should return 200 OK");
    const draftDeleteData = await draftDeleteRes.json();
    assert(draftDeleteData.success === true, "Should return success flag");
    assert(draftDeleteData.capabilityDeleted === false, "Master capability should NOT be deleted");

    // Verify that v1.0.5 is removed from DB, but ACTIVE v1.0.0 remains perfectly intact!
    const queryDraftVersion = await prisma.capabilityVersion.findUnique({
      where: { id: draftVersion.id }
    });
    assert(queryDraftVersion === null, "DRAFT version v1.0.5 must be completely removed from DB");

    const queryActiveCap = await prisma.capability.findUnique({
      where: { id: weatherCap.id },
      include: { versions: true }
    });
    assert(queryActiveCap !== null, "Master model-developer capability must still exist in DB");
    assert(queryActiveCap!.versions.some(v => v.id === activeVersion!.id), "ACTIVE version v1.0.0 must still exist and be intact");

    if (!failed) {
      console.log("\n⭐️ ALL CAPABILITY & VERSION DELETION INTEGRATION TESTS PASSED SUCCESSFULLY! ⭐️");
    } else {
      console.error("\n❌ ERROR: ONE OR MORE DELETION TEST SCENARIOS FAILED.");
      process.exit(1);
    }

  } catch (error) {
    console.error("Test suite encountered fatal exception:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDeletionTests();

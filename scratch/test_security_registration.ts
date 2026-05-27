import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

async function runTests() {
  console.log("=== BEGIN COMPREHENSIVE FUNCTIONAL & SECURITY REGISTRATION TESTS ===");
  let failed = false;

  // Helper assert
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
    // Make sure we have an ACTIVE capability version in the database to test unauthenticated access
    const activeVersion = await prisma.capabilityVersion.findFirst({
      where: { status: "ACTIVE" },
      include: { capability: true }
    });

    if (!activeVersion) {
      console.warn("⚠️ Warning: No ACTIVE capability version found in database to run guest download tests.");
    }

    // ----------------------------------------------------
    // TEST 1: Public Catalog GET Fetching (Unauthenticated)
    // ----------------------------------------------------
    console.log("\n[TEST 1] Verifying Public Catalog GET (no headers)...");
    const catalogRes = await fetch(`${origin}/api/capabilities?viewMode=public`);
    assert(catalogRes.status === 200, "Guest catalog fetch status should be 200 OK");
    const capabilities = await catalogRes.json();
    assert(Array.isArray(capabilities), "Guest catalog response should be a JSON array");
    console.log(`Guest user retrieved ${capabilities.length} active capabilities successfully.`);

    // ----------------------------------------------------
    // TEST 2: Restricted Catalog Views Enforce Authentication
    // ----------------------------------------------------
    console.log("\n[TEST 2] Verifying Restricted Catalog Views (developer/admin) Enforce Authentication...");
    const devCatalogRes = await fetch(`${origin}/api/capabilities?viewMode=developer`);
    assert(devCatalogRes.status === 401, "Developer catalog fetch without auth headers must return 401");

    const adminCatalogRes = await fetch(`${origin}/api/capabilities?viewMode=admin`);
    assert(adminCatalogRes.status === 401, "Admin catalog fetch without auth headers must return 401");

    // ----------------------------------------------------
    // TEST 3: Public Version ZIP Download Permission
    // ----------------------------------------------------
    if (activeVersion) {
      console.log(`\n[TEST 3] Verifying Public ZIP Download for ACTIVE Version (${activeVersion.capability.name} v${activeVersion.version})...`);
      const downloadRes = await fetch(`${origin}/api/capabilities/versions/${activeVersion.id}/download`);
      assert(downloadRes.status === 200, "Guest download of ACTIVE version should succeed with 200 OK");
      const disposition = downloadRes.headers.get("Content-Disposition");
      assert(disposition !== null && disposition.includes(".zip"), "Guest download response should include ZIP content attachment");
    }

    // ----------------------------------------------------
    // TEST 4: Restricted ZIP Download Permission for Non-Active versions
    // ----------------------------------------------------
    const draftVersion = await prisma.capabilityVersion.findFirst({
      where: { status: { not: "ACTIVE" } }
    });
    if (draftVersion) {
      console.log(`\n[TEST 4] Verifying Restricted ZIP Download for Non-Active Version (Status: ${draftVersion.status})...`);
      const downloadRes = await fetch(`${origin}/api/capabilities/versions/${draftVersion.id}/download`);
      assert(downloadRes.status === 401, "Guest download of draft/pending/inactive version must be blocked with 401");
    }

    // ----------------------------------------------------
    // TEST 5: User Registration Parameter Validation
    // ----------------------------------------------------
    console.log("\n[TEST 5] Testing User Registration Validation Constraints...");

    // Constraint A: Passwords must match
    const regMismatchRes = await fetch(`${origin}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "testuser",
        password: "password123",
        confirmPassword: "password456"
      })
    });
    assert(regMismatchRes.status === 400, "Mismatched passwords must return 400 Bad Request");
    const regMismatchData = await regMismatchRes.json();
    assert(regMismatchData.error === "Passwords do not match.", "Should return mismatch error message");

    // Constraint B: Weak password
    const regWeakRes = await fetch(`${origin}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "testuser",
        password: "123",
        confirmPassword: "123"
      })
    });
    assert(regWeakRes.status === 400, "Short password (< 6 chars) must return 400 Bad Request");

    // Constraint C: Invalid characters or short Username
    const regShortUserRes = await fetch(`${origin}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "us",
        password: "password123",
        confirmPassword: "password123"
      })
    });
    assert(regShortUserRes.status === 400, "Short username (< 3 chars) must return 400 Bad Request");

    const regSpecialCharRes = await fetch(`${origin}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "user@invalid!",
        password: "password123",
        confirmPassword: "password123"
      })
    });
    assert(regSpecialCharRes.status === 400, "Username with special characters must return 400 Bad Request");

    // ----------------------------------------------------
    // TEST 6: Successful Self-Service User Registration
    // ----------------------------------------------------
    console.log("\n[TEST 6] Testing Successful User Registration...");
    const testUsername = "regtestuser" + Math.floor(Math.random() * 100000);
    const testPassword = "securepass123";

    const regSuccessRes = await fetch(`${origin}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword,
        confirmPassword: testPassword
      })
    });
    assert(regSuccessRes.status === 200, "Valid registration input should return 200 OK");
    const regSuccessData = await regSuccessRes.json();
    assert(regSuccessData.success === true, "Should return success flag");
    assert(regSuccessData.user.username === testUsername.toLowerCase(), "Saved username should be normalized lowercase");
    assert(regSuccessData.user.roles === "USER", "Default provisioned role must be standard USER");

    // ----------------------------------------------------
    // TEST 7: Registration Username Uniqueness (Case-Insensitive)
    // ----------------------------------------------------
    console.log("\n[TEST 7] Testing Username Uniqueness Constraint...");
    const regDuplicateRes = await fetch(`${origin}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUsername.toUpperCase(), // Test case insensitivity
        password: testPassword,
        confirmPassword: testPassword
      })
    });
    assert(regDuplicateRes.status === 400, "Registering a duplicate username must return 400 Bad Request");
    const regDuplicateData = await regDuplicateRes.json();
    assert(regDuplicateData.error === "Username already exists. Please choose a different User ID.", "Should specify duplicate username error");

    // ----------------------------------------------------
    // TEST 8: Successful Session Login with Registered Credentials
    // ----------------------------------------------------
    console.log("\n[TEST 8] Testing Session Login with Registered Credentials...");
    const loginRes = await fetch(`${origin}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword
      })
    });
    assert(loginRes.status === 200, "Login with newly registered user must return 200 OK");
    const loginData = await loginRes.json();
    assert(loginData.success === true, "Login response success should be true");
    assert(loginData.username === testUsername.toLowerCase(), "Should return correct authenticated username");
    assert(loginData.roles === "USER", "Should return standard USER role");

    // ----------------------------------------------------
    // TEST 9: Standard User Workspace Access Controls (RBAC boundary)
    // ----------------------------------------------------
    console.log("\n[TEST 9] Testing IAM Role boundaries for Standard USER...");
    
    // Developer workspace GET should be accessible with simulated USER headers
    const devWorkspaceRes = await fetch(`${origin}/api/capabilities?viewMode=developer`, {
      headers: {
        "x-simulated-user": testUsername,
        "x-simulated-roles": "USER"
      }
    });
    assert(devWorkspaceRes.status === 200, "Standard USER session must have access to Developer Workspace");

    // Admin endpoints must be blocked for USER
    const adminWorkspaceRes = await fetch(`${origin}/api/capabilities?viewMode=admin`, {
      headers: {
        "x-simulated-user": testUsername,
        "x-simulated-roles": "USER"
      }
    });
    assert(adminWorkspaceRes.status === 403, "Standard USER session must be blocked from fetching Admin view mode (403)");

    const listUsersRes = await fetch(`${origin}/api/users`, {
      headers: {
        "x-simulated-user": testUsername,
        "x-simulated-roles": "USER"
      }
    });
    assert(listUsersRes.status === 403, "Standard USER session must be blocked from fetching IAM Users list (403)");

    const createTagRes = await fetch(`${origin}/api/tags`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-simulated-user": testUsername,
        "x-simulated-roles": "USER"
      },
      body: JSON.stringify({
        name: "HackTag",
        color: "#ef4444",
        description: "Intruder tag"
      })
    });
    assert(createTagRes.status === 403, "Standard USER session must be blocked from creating tags (403)");

    // ----------------------------------------------------
    // TEST 10: Cleanup & Database sanitation
    // ----------------------------------------------------
    console.log("\n[TEST 10] Cleaning up test user record from database...");
    await prisma.user.delete({
      where: { username: testUsername.toLowerCase() }
    });
    console.log("Cleanup finished.");

    if (!failed) {
      console.log("\n⭐️ ALL FUNCTIONAL & SECURITY REGISTRATION TESTS PASSED SUCCESSFULY! ⭐️");
    } else {
      console.error("\n❌ ERROR: ONE OR MORE INTEGRATION TEST SCENARIOS FAILED.");
      process.exit(1);
    }

  } catch (error) {
    console.error("Test suite encountered fatal exception:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();

import { prisma } from "../src/lib/db";

async function run() {
  console.log("Running Multi-Version Capability Ingestion Integration Tests...");

  // 1. Find a baseline capability
  const capability = await prisma.capability.findUnique({
    where: { name: "database-plugin" },
    include: { versions: true }
  });

  if (!capability) {
    console.error("Baseline capability 'database-plugin' not found! Run the seed first.");
    process.exit(1);
  }

  console.log(`Found baseline capability: ${capability.name}`);
  console.log(`Baseline active versions: ${capability.versions.filter(v => v.status === "ACTIVE").map(v => v.version).join(", ")}`);

  // 2. Create two new mock versions
  console.log("\nCreating two new mock versions (v2.2.0 and v2.3.0)...");
  const version22 = await prisma.capabilityVersion.create({
    data: {
      capabilityId: capability.id,
      version: "2.2.0",
      status: "DRAFT",
      zipPath: "mock_bundles/database-plugin-bundle.zip",
      extractedPath: "extracted/database-plugin/2.2.0",
      harnesses: JSON.stringify(["claude"]),
    }
  });

  const version23 = await prisma.capabilityVersion.create({
    data: {
      capabilityId: capability.id,
      version: "2.3.0",
      status: "DRAFT",
      zipPath: "mock_bundles/database-plugin-bundle.zip",
      extractedPath: "extracted/database-plugin/2.3.0",
      harnesses: JSON.stringify(["claude"]),
    }
  });

  try {
    // 3. Set BOTH versions to ACTIVE (approving them)
    console.log("Activating version v2.2.0...");
    await prisma.capabilityVersion.update({
      where: { id: version22.id },
      data: { status: "ACTIVE" }
    });

    console.log("Activating version v2.3.0...");
    await prisma.capabilityVersion.update({
      where: { id: version23.id },
      data: { status: "ACTIVE" }
    });

    // 4. Verify multiple active versions coexist simultaneously
    const updatedCap = await prisma.capability.findUnique({
      where: { id: capability.id },
      include: {
        versions: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    const activeVersions = updatedCap!.versions.filter(v => v.status === "ACTIVE");
    console.log(`\nActive versions after multi-activation: ${activeVersions.map(v => v.version).join(", ")}`);
    
    if (activeVersions.length < 3) {
      console.error("FAIL: Multiple active versions did not coexist! Expected at least 3 active versions.");
      process.exit(1);
    }
    console.log("PASS: Multiple active versions successfully coexisted simultaneously!");

    // 5. Test Catalog sorting & representation
    // In GET /api/capabilities, public view filters by status === ACTIVE and sorted by createdAt desc.
    // The first one in the list (latestVersion) represents the capability in the catalog.
    const latestActiveVersion = activeVersions[0];
    console.log(`\nCatalog representation version (newest active): v${latestActiveVersion.version}`);
    if (latestActiveVersion.version !== "2.3.0") {
      console.error("FAIL: Expected catalog to be represented by v2.3.0 (newest), got: " + latestActiveVersion.version);
      process.exit(1);
    }
    console.log("PASS: Public catalog correctly represented by the single latest active version (v2.3.0)!");

    // 6. Test Selective deactivation of a prior active version (v2.2.0)
    console.log("\nSimulating Selective Deactivation of prior version v2.2.0 by Admin...");
    await prisma.capabilityVersion.update({
      where: { id: version22.id },
      data: { status: "INACTIVE" }
    });

    const capAfterDeactivation = await prisma.capability.findUnique({
      where: { id: capability.id },
      include: {
        versions: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    const activeAfterDeact = capAfterDeactivation!.versions.filter(v => v.status === "ACTIVE");
    console.log(`Active versions after deactivating v2.2.0: ${activeAfterDeact.map(v => v.version).join(", ")}`);

    const deactVersion = capAfterDeactivation!.versions.find(v => v.version === "2.2.0");
    if (deactVersion!.status !== "INACTIVE") {
      console.error("FAIL: version v2.2.0 was not successfully deactivated!");
      process.exit(1);
    }
    if (!activeAfterDeact.some(v => v.version === "2.3.0") || !activeAfterDeact.some(v => v.version === "2.1.0")) {
      console.error("FAIL: other active versions were unintentionally modified!");
      process.exit(1);
    }
    console.log("PASS: Selective deactivation of prior versions works flawlessly! Only the selected version changed state.");

  } finally {
    // 7. Clean up database records
    console.log("\nCleaning up mock version records...");
    await prisma.capabilityVersion.delete({ where: { id: version22.id } });
    await prisma.capabilityVersion.delete({ where: { id: version23.id } });
    console.log("Cleanup complete!");
  }

  console.log("\nAll Multi-Version Capability Integration tests passed successfully!");
}

run().catch(e => {
  console.error("Test execution failed:", e);
  process.exit(1);
});

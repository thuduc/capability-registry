import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { prisma } from "../src/lib/db";
import { cleanAndNormalizeZip, saveExtractedCapability, processCapabilityZip } from "../src/lib/ingestion";

async function testUploadNormalization() {
  console.log("=== STARTING CAPABILITY ZIP UPLOAD NORMALIZATION & CONDITIONAL RIGIDITY TEST ===");

  // 1. Clean up any existing weather-agent v1.0.2 from DB and filesystem
  console.log("Cleaning up weather-agent 1.0.2 if exists...");
  const cap = await prisma.capability.findUnique({
    where: { name: "weather-agent" },
    include: { versions: true }
  });

  if (cap) {
    const v102 = cap.versions.find(v => v.version === "1.0.2");
    if (v102) {
      await prisma.capabilityVersion.delete({ where: { id: v102.id } });
      console.log("Deleted weather-agent v1.0.2 database record.");
    }
    
    // Set the baseline type of the capability to PLUGIN (to simulate the seeded state)
    await prisma.capability.update({
      where: { name: "weather-agent" },
      data: { type: "PLUGIN" }
    });
    console.log("Reset weather-agent capability baseline type to PLUGIN.");
  }

  const baseStorageDir = path.join(process.cwd(), ".registry_storage");
  const uploadZipPath = path.join(baseStorageDir, "uploads", "weather-agent-1.0.2.zip");
  const extractedPath = path.join(baseStorageDir, "extracted", "weather-agent", "1.0.2");

  if (fs.existsSync(uploadZipPath)) {
    fs.unlinkSync(uploadZipPath);
    console.log("Deleted old weather-agent-1.0.2.zip");
  }
  if (fs.existsSync(extractedPath)) {
    fs.rmSync(extractedPath, { recursive: true, force: true });
    console.log("Deleted old weather-agent 1.0.2 extracted directory.");
  }

  // 2. Build a dirty macOS-style nested zip in memory
  console.log("Creating macOS-style nested zip in memory...");
  const nestedZip = new AdmZip();
  
  // macOS resource forks/metadata
  nestedZip.addFile("__MACOSX/", Buffer.alloc(0));
  nestedZip.addFile("__MACOSX/weather-agent-1.0.2/", Buffer.alloc(0));
  nestedZip.addFile("__MACOSX/weather-agent-1.0.2/._.capability.json", Buffer.from("metadata-mac", "utf8"));
  
  // Real nested files
  nestedZip.addFile("weather-agent-1.0.2/", Buffer.alloc(0));
  nestedZip.addFile("weather-agent-1.0.2/.capability.json", Buffer.from(JSON.stringify({
    name: "weather-agent",
    description: "Climate analytics and weather agents",
    version: "1.0.2",
    owner: "Weather Team",
    harnesses: ["claude"]
  }, null, 2), "utf8"));
  nestedZip.addFile("weather-agent-1.0.2/agents/", Buffer.alloc(0));
  nestedZip.addFile("weather-agent-1.0.2/agents/subagent-profile.md", Buffer.from("# Weather Agent", "utf8"));
  nestedZip.addFile("weather-agent-1.0.2/skills/", Buffer.alloc(0));
  nestedZip.addFile("weather-agent-1.0.2/skills/weather-forecasting/SKILL.md", Buffer.from("# Forecasting", "utf8"));
  nestedZip.addFile("weather-agent-1.0.2/.DS_Store", Buffer.from("ds-store-garbage", "utf8"));

  const zipBuffer = nestedZip.toBuffer();

  // 3. Process the ZIP as it would be processed in POST /api/capabilities
  console.log("Processing capability zip using processCapabilityZip and saveExtractedCapability...");
  
  // First, verify the parsed manifest data can be extracted from normalized zip buffer
  const parsedData = processCapabilityZip(zipBuffer, "test-temp-id");
  console.log("Parsed Data Results:", {
    name: parsedData.name,
    version: parsedData.version,
    type: parsedData.type,
    filesCount: parsedData.files.length
  });

  // Ensure files in processCapabilityZip's return are root-level (normalized)
  const parsedPaths = parsedData.files.map(f => f.path);
  console.log("Parsed files in manifest check:", parsedPaths);

  const hasNestedParsed = parsedPaths.some(p => p.startsWith("weather-agent-1.0.2") || p.includes("__MACOSX"));
  if (hasNestedParsed) {
    console.error("❌ FAIL: Parsed files list has nested paths or macOS metadata!");
    process.exit(1);
  } else {
    console.log("✅ PASS: Parsed files in manifest check are 100% root-level.");
  }

  // Save the capability files to persistent disk (simulate storage path behavior)
  const storagePaths = saveExtractedCapability(zipBuffer, parsedData.name, parsedData.version);
  console.log("Extracted path:", storagePaths.extractedPath);
  console.log("Saved Zip path:", storagePaths.zipPath);

  // 4. Verify the physical file tree structure on disk
  console.log("Verifying extracted directory contents on disk...");
  const diskFiles = fs.readdirSync(extractedPath);
  console.log("Root disk entries:", diskFiles);

  const hasMacDisk = diskFiles.includes("__MACOSX");
  const hasDSStoreDisk = diskFiles.includes(".DS_Store");
  const hasNestedFolderDisk = diskFiles.includes("weather-agent-1.0.2");
  
  console.log(` - Has __MACOSX on disk: ${hasMacDisk ? "FAIL" : "PASS"}`);
  console.log(` - Has .DS_Store on disk: ${hasDSStoreDisk ? "FAIL" : "PASS"}`);
  console.log(` - Has nested parent folder on disk: ${hasNestedFolderDisk ? "FAIL" : "PASS"}`);

  if (hasMacDisk || hasDSStoreDisk || hasNestedFolderDisk) {
    console.error("❌ FAIL: Extracted filesystem directory is dirty/nested!");
    process.exit(1);
  }
  console.log("✅ PASS: Physical extracted directory contains only clean, root-level files.");

  // 5. Verify the saved Zip file itself in `uploads/` contains only clean root-level entries
  console.log("Verifying stored ZIP entries inside uploads/... ");
  const storedZipFile = path.join(process.cwd(), storagePaths.zipPath);
  const storedZip = new AdmZip(storedZipFile);
  const storedEntries = storedZip.getEntries().map(e => e.entryName);
  console.log("Stored ZIP entries:", storedEntries);

  const hasMacInZip = storedEntries.some(p => p.startsWith("__MACOSX") || p.includes("__MACOSX"));
  const hasDSStoreInZip = storedEntries.some(p => p.includes(".DS_Store"));
  const hasNestedInZip = storedEntries.some(p => p.startsWith("weather-agent-1.0.2") || p.includes("weather-agent-1.0.2/agents"));

  if (hasMacInZip || hasDSStoreInZip || hasNestedInZip) {
    console.error("❌ FAIL: Stored ZIP file in uploads/ is dirty/nested!");
    process.exit(1);
  }
  console.log("✅ PASS: Stored ZIP file contains only clean, root-level entries.");

  // 6. Test actual HTTP API POST to verify the type transition to AGENT!
  console.log("\n[API INTEGRATION TEST] Simulating direct upload POST via HTTP fetch...");
  
  const formData = new FormData();
  const fileBlob = new Blob([zipBuffer], { type: "application/zip" });
  formData.append("file", fileBlob, "weather-agent-1.0.2.zip");
  formData.append("comment", "Testing type transition to AGENT during version upload.");

  const origin = "http://localhost:3000";
  const uploadRes = await fetch(`${origin}/api/capabilities`, {
    method: "POST",
    headers: {
      "x-simulated-user": "developer",
      "x-simulated-roles": "USER",
    },
    body: formData,
  });

  if (uploadRes.status !== 200) {
    const errorText = await uploadRes.text();
    console.error(`❌ FAIL: HTTP upload failed with status ${uploadRes.status}:`, errorText);
    process.exit(1);
  }

  const uploadResultData = await uploadRes.json();
  console.log("✅ PASS: HTTP ZIP upload completed successfully:", uploadResultData);

  // Query SQLite to verify that weather-agent's logical capability type has been updated to AGENT
  const updatedCap = await prisma.capability.findUnique({
    where: { name: "weather-agent" }
  });

  console.log(`Capability overall type in SQLite DB after version upload: ${updatedCap?.type}`);
  if (updatedCap?.type !== "AGENT") {
    console.error(`❌ FAIL: Expected overall capability type to transition to AGENT, but got: ${updatedCap?.type}`);
    process.exit(1);
  }
  console.log("✅ PASS: Capability overall type successfully transitioned from PLUGIN to AGENT!");

  // 7. Test Schema Rigidity rule: SKILL capability with GHCP Agent harness (must NOT require .github/agents/profile.agent.md)
  console.log("\n[TEST 7] Verifying that a SKILL capability with 'GHCP Agent' harness does NOT require .agent.md...");
  
  const skillZip = new AdmZip();
  skillZip.addFile(".capability.json", Buffer.from(JSON.stringify({
    name: "security-playbook",
    description: "Procedural instructions and standard compliance manuals",
    version: "0.9.1",
    owner: "Cybersecurity Team",
    harnesses: ["ghcp"]
  }), "utf8"));
  skillZip.addFile("skills/", Buffer.alloc(0));
  skillZip.addFile("skills/oauth2-rotation/SKILL.md", Buffer.from("# secret rotation manuals", "utf8"));

  const skillZipBuffer = skillZip.toBuffer();

  try {
    const parsedSkill = processCapabilityZip(skillZipBuffer, "test-temp-skill-id");
    console.log("✅ PASS: processCapabilityZip parsed SKILL with 'ghcp' harness successfully! Derived type:", parsedSkill.type);
  } catch (e: any) {
    console.error("❌ FAIL: processCapabilityZip rejected SKILL with 'ghcp' harness:", e.message);
    process.exit(1);
  }

  // 8. Test Schema Rigidity rule: AGENT capability with GHCP Agent harness (must fail if missing .agent.md file under .github/agents/)
  console.log("\n[TEST 8] Verifying that an AGENT capability with 'GHCP Agent' harness FAILS if missing .agent.md file...");
  
  const badAgentZip = new AdmZip();
  badAgentZip.addFile(".capability.json", Buffer.from(JSON.stringify({
    name: "weather-agent-bad",
    description: "Agent without profile.agent.md",
    version: "1.0.9",
    owner: "Weather Team",
    harnesses: ["ghcp"]
  }), "utf8"));
  badAgentZip.addFile("agents/", Buffer.alloc(0));
  badAgentZip.addFile("agents/subagent-profile.md", Buffer.from("# Profile", "utf8"));

  const badAgentZipBuffer = badAgentZip.toBuffer();

  try {
    processCapabilityZip(badAgentZipBuffer, "test-temp-bad-agent-id");
    console.error("❌ FAIL: processCapabilityZip did not reject Agent capability lacking '.agent.md' under '.github/agents/'!");
    process.exit(1);
  } catch (e: any) {
    console.log("✅ PASS: processCapabilityZip correctly rejected Agent capability missing '.agent.md' with message:", e.message);
  }

  // 9. Test Schema Rigidity rule: AGENT capability with GHCP Agent harness (must succeed if .github/agents/custom.agent.md exists)
  console.log("\n[TEST 9] Verifying that an AGENT capability with 'GHCP Agent' harness succeeds if any .agent.md exists under .github/agents/...");
  
  const goodAgentZip = new AdmZip();
  goodAgentZip.addFile(".capability.json", Buffer.from(JSON.stringify({
    name: "weather-agent-good",
    description: "Agent with custom.agent.md",
    version: "1.0.9",
    owner: "Weather Team",
    harnesses: ["ghcp"]
  }), "utf8"));
  goodAgentZip.addFile(".github/", Buffer.alloc(0));
  goodAgentZip.addFile(".github/agents/", Buffer.alloc(0));
  goodAgentZip.addFile(".github/agents/custom.agent.md", Buffer.from("# Custom profile", "utf8"));

  const goodAgentZipBuffer = goodAgentZip.toBuffer();

  try {
    const parsedGoodAgent = processCapabilityZip(goodAgentZipBuffer, "test-temp-good-agent-id");
    console.log("✅ PASS: processCapabilityZip accepted Agent capability with custom '.github/agents/custom.agent.md'! Derived type:", parsedGoodAgent.type);
  } catch (e: any) {
    console.error("❌ FAIL: processCapabilityZip rejected valid Agent capability with custom '.github/agents/custom.agent.md':", e.message);
    process.exit(1);
  }

  console.log("\n⭐️⭐️ ALL ZIP NORMALIZATION, TYPE TRANSITION & CONDITIONAL HARNESS TESTS PASSED SUCCESSFULLY! ⭐️⭐️");
}

testUploadNormalization().catch(e => {
  console.error("Fatal Test Error:", e);
  process.exit(1);
});

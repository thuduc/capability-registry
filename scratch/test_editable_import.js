const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { processCapabilityZip } = require("../src/lib/ingestion");

// Define test variables
const mockBundlesDir = path.join(__dirname, "../mock_bundles");
const sourceZipPath = path.join(mockBundlesDir, "weather-agent-bundle.zip");
const zipBuffer = fs.readFileSync(sourceZipPath);

console.log("Running Ingestion Type Derivation Tests...");

// Test 1: Ingestion type derivation on weather-agent-bundle.zip
// It should derive as PLUGIN now because it has a plugin.json file!
const result = processCapabilityZip(zipBuffer, "test-temp-id");
console.log(`Derived type for weather-agent-bundle: ${result.type}`);
if (result.type !== "PLUGIN") {
  console.error("FAIL: expected derived type to be PLUGIN, got " + result.type);
  process.exit(1);
} else {
  console.log("PASS: Ingestion Type Derivation correctly resolved as PLUGIN.");
}

console.log("\nRunning Overwrite Manifest in ZIP Tests...");

// Test 2: Modify metadata and simulate route.ts zip overwrite logic
const zip = new AdmZip(zipBuffer);
const zipEntries = zip.getEntries();

const parsedData = {
  name: "weather-agent-modified",
  description: "Modified weather description",
  version: "1.0.9",
  owner: "Modified Weather Team",
  harnesses: ["claude", "opencode"]
};

// Update manifest in ZIP
const manifestContent = {
  name: parsedData.name,
  description: parsedData.description,
  version: parsedData.version,
  owner: parsedData.owner,
  harnesses: parsedData.harnesses
};

const manifestEntry = zipEntries.find(
  (e) => e.entryName === ".capability.json" || e.entryName.endsWith("/.capability.json")
);

if (manifestEntry) {
  manifestEntry.setData(Buffer.from(JSON.stringify(manifestContent, null, 2), "utf8"));
} else {
  zip.addFile(".capability.json", Buffer.from(JSON.stringify(manifestContent, null, 2), "utf8"));
}
const updatedZipBuffer = zip.toBuffer();

// Parse again to verify the updated manifest inside the ZIP
const updatedResult = processCapabilityZip(updatedZipBuffer, "test-temp-id-2");
console.log(`Parsed Name from updated ZIP: ${updatedResult.name}`);
console.log(`Parsed Description from updated ZIP: ${updatedResult.description}`);
console.log(`Parsed Version from updated ZIP: ${updatedResult.version}`);
console.log(`Parsed Owner from updated ZIP: ${updatedResult.owner}`);
console.log(`Parsed Harnesses from updated ZIP: ${updatedResult.harnesses.join(", ")}`);

if (
  updatedResult.name === parsedData.name &&
  updatedResult.description === parsedData.description &&
  updatedResult.version === parsedData.version &&
  updatedResult.owner === parsedData.owner &&
  updatedResult.harnesses.join(",") === parsedData.harnesses.join(",")
) {
  console.log("PASS: Metadata modification in ZIP is fully parsed and successfully preserved inside the zip archive.");
} else {
  console.error("FAIL: Preserved metadata in ZIP does not match!");
  process.exit(1);
}

console.log("\nAll unit tests passed successfully!");

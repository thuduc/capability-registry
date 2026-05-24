import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";

export interface ParsingResult {
  name: string;
  description: string;
  version: string;
  owner: string;
  harnesses: string[];
  type: "AGENT" | "PLUGIN" | "SKILL";
}

// Helper to validate semver
export function isValidSemver(version: string): boolean {
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
  return semverRegex.test(version);
}

// Ingestion and verification function
export function processCapabilityZip(
  zipBuffer: Buffer,
  tempUploadId: string
): ParsingResult & { files: { path: string; content?: string }[] } {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch (error) {
    throw new Error("Invalid ZIP file format.");
  }

  const zipEntries = zip.getEntries();
  
  // 1. Locate and parse .capability.json
  const manifestEntry = zipEntries.find(
    (entry) => entry.entryName === ".capability.json" || entry.entryName.endsWith("/.capability.json")
  );

  if (!manifestEntry) {
    throw new Error("Missing master configuration file: '.capability.json' must be at the root of the bundle.");
  }

  let manifestData: any;
  try {
    const text = manifestEntry.getData().toString("utf8");
    manifestData = JSON.parse(text);
  } catch (err) {
    throw new Error("Failed to parse '.capability.json'. File is not valid JSON.");
  }

  // 2. Validate required metadata fields
  const { name, description, version, owner, harnesses } = manifestData;
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new Error("Missing or invalid field 'name' in .capability.json.");
  }
  if (!description || typeof description !== "string") {
    throw new Error("Missing or invalid field 'description' in .capability.json.");
  }
  if (!version || typeof version !== "string" || !isValidSemver(version)) {
    throw new Error(`Invalid version format '${version}' in .capability.json. Must adhere to strict semver (e.g., '1.0.0').`);
  }
  if (!owner || typeof owner !== "string") {
    throw new Error("Missing or invalid field 'owner' in .capability.json.");
  }
  if (!harnesses || !Array.isArray(harnesses)) {
    throw new Error("Missing or invalid field 'harnesses' (must be an array of strings) in .capability.json.");
  }

  // 3. Schema Rigidity checks: verify directory structure matching harnesses
  // Let's normalize entry paths to avoid prefix issues (e.g. if zipped with a parent directory)
  const filePaths = zipEntries.map((e) => e.entryName.replace(/\\/g, "/"));

  // Check harnesses and match required files
  for (const harness of harnesses) {
    const normalizedHarness = harness.toLowerCase();
    if (normalizedHarness === "claude" || normalizedHarness === "opencode" || normalizedHarness === "codex") {
      const hasPluginJson = filePaths.some((p) => p.endsWith(".claude-plugin/plugin.json"));
      if (!hasPluginJson) {
        throw new Error(`Schema Rigidity Violation: Harness '${harness}' declared, but missing '.claude-plugin/plugin.json' in bundle.`);
      }
    } else if (normalizedHarness === "github-copilot" || normalizedHarness === "github-copilot-agent" || normalizedHarness === "ghcp") {
      const hasCopilotAgent = filePaths.some((p) => p.endsWith(".github/agents/profile.agent.md"));
      if (!hasCopilotAgent) {
        throw new Error(`Schema Rigidity Violation: Harness '${harness}' declared, but missing '.github/agents/profile.agent.md' in bundle.`);
      }
    }
  }

  // 4. Type Derivation Logic
  // - Agent: Derived if the package contains dedicated system prompts or persona layouts (e.g., `.github/agents/profile.agent.md` or `agents/subagent-profile.md`).
  // - Plugin: Derived if the package contains active script runtime (`dist/`) or infrastructure schema protocol connector (`.mcp.json`).
  // - Skill: Derived if package contains ONLY procedural manuals (`skills/[name]/SKILL.md` or `skills/SKILL.md`) and is not Agent or Plugin.
  const hasAgentFile = filePaths.some(
    (p) => p.endsWith(".github/agents/profile.agent.md") || p.includes("agents/subagent-profile.md")
  );

  const hasPluginFile = filePaths.some(
    (p) => p.includes("dist/") || p.endsWith(".mcp.json") || p.endsWith("plugin.json")
  );

  const hasSkillFile = filePaths.some(
    (p) => p.includes("skills/") && p.endsWith("SKILL.md")
  );

  let derivedType: "AGENT" | "PLUGIN" | "SKILL" = "SKILL";
  if (hasPluginFile) {
    derivedType = "PLUGIN";
  } else if (hasAgentFile) {
    derivedType = "AGENT";
  } else if (hasSkillFile) {
    derivedType = "SKILL";
  } else {
    // If none are specifically present, check if skills directory exists at least, otherwise default to skill or throw
    derivedType = "SKILL";
  }

  // Read code or prompt files for differential reviews
  const files: { path: string; content?: string }[] = [];
  zipEntries.forEach((entry) => {
    if (entry.isDirectory) return;
    
    const entryName = entry.entryName.replace(/\\/g, "/");
    // Only capture readable file content for key files we want to diff
    const isReadableTextFile =
      entryName.endsWith(".md") ||
      entryName.endsWith(".json") ||
      entryName.endsWith(".js") ||
      entryName.endsWith(".ts");

    if (isReadableTextFile) {
      files.push({
        path: entryName,
        content: entry.getData().toString("utf8"),
      });
    } else {
      files.push({
        path: entryName,
      });
    }
  });

  return {
    name,
    description,
    version,
    owner,
    harnesses,
    type: derivedType,
    files,
  };
}

// Function to save the uploaded capability files to persistent disk
export function saveExtractedCapability(
  zipBuffer: Buffer,
  capabilityName: string,
  versionStr: string
): { zipPath: string; extractedPath: string } {
  const baseStorageDir = path.join(process.cwd(), ".registry_storage");
  const uploadsDir = path.join(baseStorageDir, "uploads");
  const extractedDir = path.join(baseStorageDir, "extracted", capabilityName, versionStr);

  // Ensure directories exist
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(extractedDir, { recursive: true });

  // Save the zip file
  const zipFileName = `${capabilityName}-${versionStr}.zip`;
  const zipPath = path.join(uploadsDir, zipFileName);
  fs.writeFileSync(zipPath, zipBuffer);

  // Extract the zip contents to the storage folder
  const zip = new AdmZip(zipBuffer);
  zip.extractAllTo(extractedDir, true);

  return {
    zipPath: path.relative(process.cwd(), zipPath),
    extractedPath: path.relative(process.cwd(), extractedDir),
  };
}

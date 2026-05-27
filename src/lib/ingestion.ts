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

// Helper to fix Data Descriptors in ZIP file buffers for adm-zip compatibility.
// Data descriptors (bit 3 of general purpose bit flag is set) can cause "No descriptor present" error in adm-zip.
export function fixZipDataDescriptors(zip: any, zipBuffer: Buffer) {
  for (const entry of zip.getEntries()) {
    const header = entry.header;
    if (header) {
      header.flags &= ~8;
      header.flags_desc = false;
      
      const offset = header.offset;
      if (offset !== undefined && offset !== null) {
        const flagsOffset = offset + 6;
        if (flagsOffset + 2 <= zipBuffer.length) {
          let locFlags = zipBuffer.readUInt16LE(flagsOffset);
          locFlags &= ~8;
          zipBuffer.writeUInt16LE(locFlags, flagsOffset);
        }

        const crcOffset = offset + 14;
        if (crcOffset + 4 <= zipBuffer.length) {
          const locCrc = zipBuffer.readUInt32LE(crcOffset);
          if (locCrc === 0 && header.crc !== 0) {
            zipBuffer.writeUInt32LE(header.crc, crcOffset);
          }
        }

        const compSizeOffset = offset + 18;
        if (compSizeOffset + 4 <= zipBuffer.length) {
          const locCompSize = zipBuffer.readUInt32LE(compSizeOffset);
          if (locCompSize === 0 && header.compressedSize !== 0) {
            zipBuffer.writeUInt32LE(header.compressedSize, compSizeOffset);
          }
        }

        const sizeOffset = offset + 22;
        if (sizeOffset + 4 <= zipBuffer.length) {
          const locSize = zipBuffer.readUInt32LE(sizeOffset);
          if (locSize === 0 && header.size !== 0) {
            zipBuffer.writeUInt32LE(header.size, sizeOffset);
          }
        }
      }

      if (header.localHeader) {
        header.localHeader.flags &= ~8;
        header.localHeader.flags_desc = false;
        if (header.localHeader.crc === 0 && header.crc !== 0) {
          header.localHeader.crc = header.crc;
        }
        if (header.localHeader.compressedSize === 0 && header.compressedSize !== 0) {
          header.localHeader.compressedSize = header.compressedSize;
        }
        if (header.localHeader.size === 0 && header.size !== 0) {
          header.localHeader.size = header.size;
        }
      }
    }
  }
}

// Helper to fix Data Descriptors in Central Directory and Local Header in memory
export function cleanAndNormalizeZip(zipBuffer: Buffer): Buffer {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch (e) {
    return zipBuffer;
  }

  // First fix descriptors in memory to ensure getData() works correctly
  fixZipDataDescriptors(zip, zipBuffer);

  const entries = zip.getEntries();
  
  // Filter out macOS metadata and DS_Store
  const activeEntries = entries.filter(e => {
    const name = e.entryName.replace(/\\/g, "/");
    return !name.startsWith("__MACOSX/") && 
           !name.endsWith(".DS_Store") && 
           name !== "__MACOSX" && 
           name !== ".DS_Store" &&
           name !== "";
  });

  if (activeEntries.length === 0) {
    return zipBuffer;
  }

  // Detect single top-level directory prefix (common to all entries)
  const firstEntryName = activeEntries[0].entryName.replace(/\\/g, "/");
  const firstSlash = firstEntryName.indexOf("/");
  let commonPrefix = "";
  if (firstSlash !== -1) {
    const potentialPrefix = firstEntryName.substring(0, firstSlash + 1);
    const allSharePrefix = activeEntries.every(e => {
      const name = e.entryName.replace(/\\/g, "/");
      return name.startsWith(potentialPrefix);
    });
    if (allSharePrefix) {
      commonPrefix = potentialPrefix;
    }
  }

  const newZip = new AdmZip();
  for (const entry of activeEntries) {
    const name = entry.entryName.replace(/\\/g, "/");
    if (commonPrefix && name === commonPrefix) {
      continue;
    }
    const targetName = commonPrefix ? name.substring(commonPrefix.length) : name;
    if (!targetName) continue;

    if (entry.isDirectory) {
      newZip.addFile(targetName + (targetName.endsWith("/") ? "" : "/"), Buffer.alloc(0));
    } else {
      newZip.addFile(targetName, entry.getData());
    }
  }

  return newZip.toBuffer();
}

// Ingestion and verification function
export function processCapabilityZip(
  zipBuffer: Buffer,
  tempUploadId: string
): ParsingResult & { files: { path: string; content?: string }[] } {
  // Normalize and clean ZIP structure
  zipBuffer = cleanAndNormalizeZip(zipBuffer);

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

  // 3. Normalize paths to verify structure
  const filePaths = zipEntries.map((e) => e.entryName.replace(/\\/g, "/"));

  // 4. Type Derivation Logic
  // - Agent: Derived if the package contains dedicated system prompts or persona layouts (e.g., `.github/agents/profile.agent.md` or files ending in .agent.md under .github/agents/, or files under agents/).
  // - Plugin: Derived if the package contains active script runtime (`dist/`) or infrastructure schema protocol connector (`.mcp.json`) or a plugin.json file.
  // - Skill: Derived if package contains ONLY procedural manuals (`skills/[name]/SKILL.md` or `skills/SKILL.md` or files under skills/) and is not Agent or Plugin.
  const hasPluginFile = filePaths.some(
    (p) => p.endsWith("plugin.json") || p.includes("dist/") || p.endsWith(".mcp.json")
  );

  const hasAgentFile = filePaths.some(
    (p) => p.includes("agents/") || (p.includes(".github/agents/") && p.endsWith(".agent.md")) || p.includes("agents/subagent-profile.md")
  );

  const hasSkillFile = filePaths.some(
    (p) => p.includes("skills/")
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

  // 5. Schema Rigidity checks: verify directory structure matching harnesses
  // Check harnesses and match required files
  for (const harness of harnesses) {
    const normalizedHarness = harness.toLowerCase();
    if (normalizedHarness === "claude" || normalizedHarness === "opencode" || normalizedHarness === "codex") {
      const hasPluginJson = filePaths.some((p) => p.endsWith("plugin.json"));
      const hasAgentFileCheck = filePaths.some((p) => p.includes("agents/"));
      const hasSkillFileCheck = filePaths.some((p) => p.includes("skills/"));
      if (!hasPluginJson && !hasAgentFileCheck && !hasSkillFileCheck) {
        throw new Error(`Schema Rigidity Violation: Harness '${harness}' declared, but bundle does not contain a plugin (plugin.json), agent (under agents/), or skill (under skills/).`);
      }
    } else if (normalizedHarness === "github-copilot" || normalizedHarness === "github-copilot-agent" || normalizedHarness === "ghcp") {
      if (derivedType === "AGENT") {
        const hasCopilotAgent = filePaths.some((p) => p.includes(".github/agents/") && p.endsWith(".agent.md"));
        if (!hasCopilotAgent) {
          throw new Error(`Schema Rigidity Violation: Harness '${harness}' declared for Agent capability, but missing a '.agent.md' file under '.github/agents/' folder.`);
        }
      }
    }
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
  // Normalize and clean ZIP structure
  zipBuffer = cleanAndNormalizeZip(zipBuffer);

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

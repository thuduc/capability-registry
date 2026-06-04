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

  const newZip = new AdmZip();
  for (const entry of activeEntries) {
    const name = entry.entryName.replace(/\\/g, "/");
    if (entry.isDirectory) {
      newZip.addFile(name + (name.endsWith("/") ? "" : "/"), Buffer.alloc(0));
    } else {
      newZip.addFile(name, entry.getData());
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

  // 4. Read capability type from manifest (default to SKILL, no longer derived structurally)
  let derivedType: "AGENT" | "PLUGIN" | "SKILL" = "SKILL";
  if (manifestData && manifestData.type) {
    const upperType = manifestData.type.toUpperCase();
    if (upperType === "AGENT" || upperType === "PLUGIN" || upperType === "SKILL") {
      derivedType = upperType;
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
  const originalZipBuffer = zipBuffer; // Keep exact uploaded bytes for storage/downloads
  const cleanedZipBuffer = cleanAndNormalizeZip(zipBuffer); // Strip __MACOSX and .DS_Store for clean extraction

  const baseStorageDir = path.join(process.cwd(), ".registry_storage");
  const uploadsDir = path.join(baseStorageDir, "uploads");
  const extractedDir = path.join(baseStorageDir, "extracted", capabilityName, versionStr);

  // Ensure directories exist
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(extractedDir, { recursive: true });

  // Save the zip file using raw uploaded bytes
  const zipFileName = `${capabilityName}-${versionStr}.zip`;
  const zipPath = path.join(uploadsDir, zipFileName);
  fs.writeFileSync(zipPath, originalZipBuffer);

  // Extract only the cleaned entries (no __MACOSX or .DS_Store)
  const zip = new AdmZip(cleanedZipBuffer);
  zip.extractAllTo(extractedDir, true);

  return {
    zipPath: path.relative(process.cwd(), zipPath),
    extractedPath: path.relative(process.cwd(), extractedDir),
  };
}

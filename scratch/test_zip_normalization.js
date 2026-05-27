const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// 1. Mock functions for testing
function fixZipDataDescriptors(zip, zipBuffer) {
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

function cleanAndNormalizeZip(zipBuffer) {
  let zip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch (e) {
    return zipBuffer;
  }

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

  // Detect single top-level directory
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

  console.log(`Detected Common Prefix (unwrap folder): ${commonPrefix || "(none)"}`);

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

// 2. Generate a nested ZIP buffer simulating the issue
console.log("Generating nested ZIP buffer simulating macOS Compress...");
const nestedZip = new AdmZip();
nestedZip.addFile("__MACOSX/", Buffer.alloc(0));
nestedZip.addFile("__MACOSX/weather-agent-1.0.2/", Buffer.alloc(0));
nestedZip.addFile("__MACOSX/weather-agent-1.0.2/._.capability.json", Buffer.from("metadata-mac", "utf8"));
nestedZip.addFile("weather-agent-1.0.2/", Buffer.alloc(0));
nestedZip.addFile("weather-agent-1.0.2/.capability.json", Buffer.from('{"name": "weather-agent"}', "utf8"));
nestedZip.addFile("weather-agent-1.0.2/agents/", Buffer.alloc(0));
nestedZip.addFile("weather-agent-1.0.2/agents/subagent-profile.md", Buffer.from("# Profile", "utf8"));
nestedZip.addFile("weather-agent-1.0.2/skills/", Buffer.alloc(0));
nestedZip.addFile("weather-agent-1.0.2/skills/weather-forecasting/SKILL.md", Buffer.from("# Forecasting", "utf8"));
nestedZip.addFile("weather-agent-1.0.2/.DS_Store", Buffer.from("ds-store-garbage", "utf8"));

const originalBuffer = nestedZip.toBuffer();

console.log("\nOriginal ZIP Entries:");
const originalZip = new AdmZip(originalBuffer);
originalZip.getEntries().forEach(e => console.log(` - ${e.entryName}`));

// 3. Clean and normalize
console.log("\nNormalizing ZIP buffer...");
const cleanedBuffer = cleanAndNormalizeZip(originalBuffer);

console.log("\nNormalized ZIP Entries:");
const cleanedZip = new AdmZip(cleanedBuffer);
const cleanedEntries = cleanedZip.getEntries();
cleanedEntries.forEach(e => console.log(` - ${e.entryName}`));

// 4. Verify assertions
const paths = cleanedEntries.map(e => e.entryName);
const hasMac = paths.some(p => p.includes("__MACOSX"));
const hasDSStore = paths.some(p => p.includes(".DS_Store"));
const hasNestedFolder = paths.some(p => p.startsWith("weather-agent-1.0.2"));
const hasRootManifest = paths.includes(".capability.json");
const hasRootAgent = paths.includes("agents/subagent-profile.md");
const hasRootSkill = paths.includes("skills/weather-forecasting/SKILL.md");

console.log("\nVerifying Assertions...");
console.log(` - Has __MACOSX removed: ${!hasMac ? "PASS" : "FAIL"}`);
console.log(` - Has .DS_Store removed: ${!hasDSStore ? "PASS" : "FAIL"}`);
console.log(` - Has nested parent folder unwrapped: ${!hasNestedFolder ? "PASS" : "FAIL"}`);
console.log(` - Has .capability.json at root: ${hasRootManifest ? "PASS" : "FAIL"}`);
console.log(` - Has agents/subagent-profile.md at root: ${hasRootAgent ? "PASS" : "FAIL"}`);
console.log(` - Has skills/weather-forecasting/SKILL.md at root: ${hasRootSkill ? "PASS" : "FAIL"}`);

if (!hasMac && !hasDSStore && !hasNestedFolder && hasRootManifest && hasRootAgent && hasRootSkill) {
  console.log("\n⭐️ ALL NORMALIZATION TESTS PASSED SUCCESSFULLY! ⭐️");
} else {
  console.error("\n❌ NORMALIZATION TEST FAILED!");
  process.exit(1);
}

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const zipPath = path.join(__dirname, "../mock_bundles/weather-agent-bundle.zip");
const zip = new AdmZip(zipPath);

function fixZipDataDescriptors(zip) {
  for (const entry of zip.getEntries()) {
    const header = entry.header;
    if (header) {
      header.flags &= ~8;
      header.flags_desc = false;
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

console.log("Before patch:");
for (const entry of zip.getEntries()) {
  console.log(`Entry: ${entry.entryName}, flags_desc: ${entry.header.flags_desc}`);
}

fixZipDataDescriptors(zip);

console.log("\nAfter patch:");
for (const entry of zip.getEntries()) {
  console.log(`Entry: ${entry.entryName}, flags_desc: ${entry.header.flags_desc}, localHeader flags_desc: ${entry.header.localHeader ? entry.header.localHeader.flags_desc : "N/A"}`);
}

const buffer = zip.toBuffer();
console.log(`\ntoBuffer() generated ${buffer.length} bytes successfully.`);

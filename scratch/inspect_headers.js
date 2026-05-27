const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const zipPath = path.join(__dirname, "../mock_bundles/weather-agent-bundle.zip");
const zip = new AdmZip(zipPath);

for (const entry of zip.getEntries()) {
  console.log(`Entry: ${entry.entryName}`);
  console.log(` - header:`, JSON.stringify(entry.header));
  console.log(` - flags: ${entry.header.flags}`);
  console.log(` - bit 3 set (Data Descriptor): ${(entry.header.flags & 8) !== 0}`);
}

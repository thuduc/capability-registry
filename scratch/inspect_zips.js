const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const mockBundlesDir = path.join(process.cwd(), "mock_bundles");
const zips = fs.readdirSync(mockBundlesDir).filter(f => f.endsWith(".zip"));

for (const zipName of zips) {
  const zipPath = path.join(mockBundlesDir, zipName);
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().map(e => e.entryName);
  const hasPluginJson = entries.some(e => e.endsWith("plugin.json"));
  const hasAgentFile = entries.some(e => e.endsWith("profile.agent.md") || e.includes("agents/subagent-profile.md"));
  const hasSkillFile = entries.some(e => e.includes("skills/") && e.endsWith("SKILL.md"));
  
  console.log(`ZIP: ${zipName}`);
  console.log(` - files: ${entries.join(", ")}`);
  console.log(` - has plugin.json: ${hasPluginJson}`);
  console.log(` - has agent file: ${hasAgentFile}`);
  console.log(` - has skill file: ${hasSkillFile}`);
  console.log("-----------------------------------------");
}

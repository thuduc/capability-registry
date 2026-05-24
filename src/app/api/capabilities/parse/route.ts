import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";

export async function POST(req: NextRequest) {
  try {
    const userHeader = req.headers.get("x-simulated-user") || "";
    if (!userHeader) {
      return NextResponse.json({ error: "Access Denied: Login required." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const gitUrl = formData.get("gitUrl") as string;
    const gitTag = formData.get("gitTag") as string;

    let zipBuffer: Buffer;

    if (file) {
      zipBuffer = Buffer.from(await file.arrayBuffer());
    } else if (gitUrl && gitTag) {
      const mockBundlesDir = `${process.cwd()}/mock_bundles`;
      const fallbackZip = `${mockBundlesDir}/security-playbook-bundle.zip`;
      zipBuffer = require("fs").readFileSync(fallbackZip);
    } else {
      return NextResponse.json({ error: "No ZIP file or Git Repository provided." }, { status: 400 });
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch (e) {
      return NextResponse.json({ error: "Invalid ZIP file format." }, { status: 400 });
    }

    const zipEntries = zip.getEntries();
    const filePaths = zipEntries.map((e) => e.entryName.replace(/\\/g, "/"));

    // 1. Check if .capability.json exists
    const manifestEntry = zipEntries.find(
      (entry) => entry.entryName === ".capability.json" || entry.entryName.endsWith("/.capability.json")
    );

    // Derive capability type based on structure
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
    }

    if (!manifestEntry) {
      // Return hasManifest: false
      return NextResponse.json({
        hasManifest: false,
        metadata: {
          name: "",
          description: "",
          version: "",
          owner: "",
          harnesses: [],
          type: derivedType
        }
      });
    }

    // Parse manifest
    let manifestData: any;
    try {
      const text = manifestEntry.getData().toString("utf8");
      manifestData = JSON.parse(text);
    } catch (err) {
      return NextResponse.json({ error: "Failed to parse '.capability.json'. File is not valid JSON." }, { status: 400 });
    }

    const { name, description, version, owner, harnesses } = manifestData;

    // Return hasManifest: true, and the parsed metadata
    return NextResponse.json({
      hasManifest: true,
      metadata: {
        name: name || "",
        description: description || "",
        version: version || "",
        owner: owner || "",
        harnesses: Array.isArray(harnesses) ? harnesses : [],
        type: derivedType
      }
    });
  } catch (error: any) {
    console.error("POST /api/capabilities/parse error:", error);
    return NextResponse.json({ error: error.message || "Failed to parse capability package" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { cleanAndNormalizeZip } from "@/lib/ingestion";

function isTextBuffer(buffer: Buffer): boolean {
  if (buffer.length === 0) return true;
  const sampleSize = Math.min(buffer.length, 8000);
  let nullCount = 0;
  let nonAsciiCount = 0;
  
  for (let i = 0; i < sampleSize; i++) {
    const byte = buffer[i];
    if (byte === 0) {
      nullCount++;
    } else if (byte < 7 || (byte > 14 && byte < 32 && byte !== 27)) {
      nonAsciiCount++;
    }
  }
  
  if (nullCount > 0) return false;
  if (nonAsciiCount / sampleSize > 0.3) return false;
  
  return true;
}

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

    // Normalize and clean ZIP structure
    zipBuffer = cleanAndNormalizeZip(zipBuffer);

    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch (e) {
      return NextResponse.json({ error: "Invalid ZIP file format." }, { status: 400 });
    }

    const zipEntries = zip.getEntries();
    const files: { path: string; content?: string; isText?: boolean; isImage?: boolean }[] = [];
    zipEntries.forEach((entry) => {
      if (entry.isDirectory) return;
      const entryName = entry.entryName.replace(/\\/g, "/");
      const ext = entryName.split(".").pop()?.toLowerCase() || "";

      const imageExtensions = ["png", "gif", "svg", "jpg", "jpeg", "webp", "ico", "bmp"];
      const isImage = imageExtensions.includes(ext);

      if (isImage) {
        try {
          const mimeType = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
          const base64Data = entry.getData().toString("base64");
          files.push({
            path: entryName,
            content: `data:${mimeType};base64,${base64Data}`,
            isImage: true,
          });
        } catch (e) {
          files.push({ path: entryName });
        }
      } else {
        try {
          const buffer = entry.getData();
          if (isTextBuffer(buffer)) {
            files.push({
              path: entryName,
              content: buffer.toString("utf8"),
              isText: true,
            });
          } else {
            files.push({ path: entryName });
          }
        } catch (e) {
          files.push({ path: entryName });
        }
      }
    });

    // 1. Check if .capability.json exists
    const manifestEntry = zipEntries.find(
      (entry) => entry.entryName === ".capability.json" || entry.entryName.endsWith("/.capability.json")
    );

    let derivedType: "AGENT" | "PLUGIN" | "SKILL" = "SKILL";

    if (!manifestEntry) {
      // Return hasManifest: false
      return NextResponse.json({
        hasManifest: false,
        files,
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

    const { name, description, version, owner, harnesses, type } = manifestData;
    if (type) {
      const upperType = type.toUpperCase();
      if (upperType === "AGENT" || upperType === "PLUGIN" || upperType === "SKILL") {
        derivedType = upperType;
      }
    }

    // Return hasManifest: true, and the parsed metadata
    return NextResponse.json({
      hasManifest: true,
      files,
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

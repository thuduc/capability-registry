import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const userHeader = req.headers.get("x-simulated-user") || "";
    if (!userHeader) {
      return NextResponse.json({ error: "Access Denied: Login required." }, { status: 401 });
    }

    const { versionId } = await params;

    const versionRecord = await prisma.capabilityVersion.findUnique({
      where: { id: versionId },
      include: { capability: true }
    });

    if (!versionRecord) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    const absoluteZipPath = path.resolve(process.cwd(), versionRecord.zipPath);
    if (!fs.existsSync(absoluteZipPath)) {
      return NextResponse.json({ error: "ZIP bundle file not found on disk." }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(absoluteZipPath);
    
    // Return the binary ZIP file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${versionRecord.capability.name}-${versionRecord.version}.zip"`,
        "Content-Length": fileBuffer.length.toString()
      }
    });
  } catch (error: any) {
    console.error("GET /api/capabilities/versions/[versionId]/download error:", error);
    return NextResponse.json({ error: error.message || "Failed to download ZIP bundle" }, { status: 500 });
  }
}

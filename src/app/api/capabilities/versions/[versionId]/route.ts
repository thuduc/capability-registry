import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const userHeader = req.headers.get("x-simulated-user") || "";
    if (!userHeader) {
      return NextResponse.json({ error: "Access Denied: Login required." }, { status: 401 });
    }

    // 1. Fetch capability version
    const version = await prisma.capabilityVersion.findUnique({
      where: { id: versionId },
      include: { capability: { include: { versions: true } } }
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // 2. Validate deletion eligibility:
    // A DRAFT, INACTIVE, or REJECTED version can always be deleted.
    // ACTIVE or PENDING_REVIEW cannot be deleted directly.
    if (version.status === "ACTIVE" || version.status === "PENDING_REVIEW") {
      return NextResponse.json({ error: `Access Denied: Cannot delete a version in ${version.status} state. Please deactivate or cancel review first.` }, { status: 400 });
    }

    // 3. Perform deletion of physical files for this version
    if (version.zipPath) {
      const absoluteZipPath = path.join(process.cwd(), version.zipPath);
      if (fs.existsSync(absoluteZipPath)) {
        try {
          fs.unlinkSync(absoluteZipPath);
        } catch (e) {
          console.error(`Failed to delete zip file: ${absoluteZipPath}`, e);
        }
      }
    }

    if (version.extractedPath) {
      const absoluteExtractedPath = path.join(process.cwd(), version.extractedPath);
      if (fs.existsSync(absoluteExtractedPath)) {
        try {
          fs.rmSync(absoluteExtractedPath, { recursive: true, force: true });
        } catch (e) {
          console.error(`Failed to delete extracted path: ${absoluteExtractedPath}`, e);
        }
      }
    }

    // 4. Delete the version from DB
    await prisma.capabilityVersion.delete({
      where: { id: versionId }
    });

    // 5. If this was the ONLY version of the capability, delete the master capability record too!
    const capability = version.capability;
    const remainingVersions = capability.versions.filter(v => v.id !== versionId);

    if (remainingVersions.length === 0) {
      await prisma.capability.delete({
        where: { id: capability.id }
      });
      return NextResponse.json({ 
        success: true, 
        capabilityDeleted: true,
        message: `Version v${version.version} was the only version. Capability '${capability.name}' deleted successfully.` 
      });
    }

    return NextResponse.json({ 
      success: true, 
      capabilityDeleted: false,
      message: `Version v${version.version} of capability '${capability.name}' deleted successfully.` 
    });
  } catch (error: any) {
    console.error("DELETE /api/capabilities/versions/[versionId] error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete version" }, { status: 500 });
  }
}

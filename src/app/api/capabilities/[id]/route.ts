import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const capability = await prisma.capability.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          include: {
            comments: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!capability) {
      return NextResponse.json({ error: "Capability not found" }, { status: 404 });
    }

    const mappedVersions = capability.versions.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      zipPath: v.zipPath,
      extractedPath: v.extractedPath,
      harnesses: JSON.parse(v.harnesses) as string[],
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      comments: v.comments,
    }));

    return NextResponse.json({
      id: capability.id,
      name: capability.name,
      description: capability.description,
      type: capability.type,
      owner: capability.owner,
      createdAt: capability.createdAt,
      updatedAt: capability.updatedAt,
      versions: mappedVersions,
    });
  } catch (error: any) {
    console.error("GET /api/capabilities/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch capability details" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userHeader = req.headers.get("x-simulated-user") || "";
    if (!userHeader) {
      return NextResponse.json({ error: "Access Denied: Login required." }, { status: 401 });
    }

    // 1. Fetch capability with all its versions
    const capability = await prisma.capability.findUnique({
      where: { id },
      include: { versions: true }
    });

    if (!capability) {
      return NextResponse.json({ error: "Capability not found" }, { status: 404 });
    }

    // 2. Validate deletion eligibility: cannot delete if there is an ACTIVE or PENDING_REVIEW version
    const hasActiveVersion = capability.versions.some(
      (v) => v.status === "ACTIVE" || v.status === "PENDING_REVIEW"
    );
    if (hasActiveVersion) {
      return NextResponse.json({ error: "Access Denied: Cannot delete a capability with ACTIVE or PENDING_REVIEW versions. Please deactivate it first." }, { status: 400 });
    }

    // 3. Perform deletion of physical files for all versions
    const fs = require("fs");
    const path = require("path");

    for (const v of capability.versions) {
      if (v.zipPath) {
        const absoluteZipPath = path.join(process.cwd(), v.zipPath);
        if (fs.existsSync(absoluteZipPath)) {
          try {
            fs.unlinkSync(absoluteZipPath);
          } catch (e) {
            console.error(`Failed to delete zip file: ${absoluteZipPath}`, e);
          }
        }
      }

      if (v.extractedPath) {
        const absoluteExtractedPath = path.join(process.cwd(), v.extractedPath);
        if (fs.existsSync(absoluteExtractedPath)) {
          try {
            fs.rmSync(absoluteExtractedPath, { recursive: true, force: true });
          } catch (e) {
            console.error(`Failed to delete extracted path: ${absoluteExtractedPath}`, e);
          }
        }
      }
    }

    // Also try to clean up parent extracted directory if it becomes empty
    const extractedParentDir = path.join(process.cwd(), ".registry_storage", "extracted", capability.name);
    if (fs.existsSync(extractedParentDir)) {
      try {
        const files = fs.readdirSync(extractedParentDir);
        if (files.length === 0) {
          fs.rmdirSync(extractedParentDir);
        }
      } catch (e) {
        console.error(`Failed to cleanup parent extracted directory: ${extractedParentDir}`, e);
      }
    }

    // 4. Delete from DB (onDelete: Cascade will take care of Cascade deletes on versions & comments)
    await prisma.capability.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: `Capability '${capability.name}' deleted successfully.` });
  } catch (error: any) {
    console.error("DELETE /api/capabilities/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete capability" }, { status: 500 });
  }
}


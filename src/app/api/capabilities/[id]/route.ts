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

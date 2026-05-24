import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const body = await req.json();
    const { author, text } = body;

    if (!author || !text || text.trim() === "") {
      return NextResponse.json({ error: "Missing required fields: author and text are required." }, { status: 400 });
    }

    if (author !== "Developer" && author !== "Admin") {
      return NextResponse.json({ error: "Invalid author. Must be 'Developer' or 'Admin'." }, { status: 400 });
    }

    const version = await prisma.capabilityVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      return NextResponse.json({ error: "Capability version not found." }, { status: 404 });
    }

    const newComment = await prisma.reviewComment.create({
      data: {
        versionId,
        author,
        text,
      },
    });

    return NextResponse.json(newComment);
  } catch (error: any) {
    console.error("POST /api/capabilities/versions/[versionId]/comments error:", error);
    return NextResponse.json({ error: error.message || "Failed to add comment" }, { status: 500 });
  }
}

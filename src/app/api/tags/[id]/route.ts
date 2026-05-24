import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const roles = req.headers.get("x-simulated-roles") || "";
    if (!roles.split(",").includes("ADMIN")) {
      return NextResponse.json({ error: "Access Denied: Admin role required." }, { status: 403 });
    }

    const { id } = await params;
    await prisma.tag.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete tag" }, { status: 400 });
  }
}

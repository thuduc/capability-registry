import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" }
    });
    return NextResponse.json(tags);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch tags" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const roles = req.headers.get("x-simulated-roles") || "";
    if (!roles.split(",").includes("ADMIN")) {
      return NextResponse.json({ error: "Access Denied: Admin role required." }, { status: 403 });
    }

    const { name, color, description } = await req.json();
    if (!name || !color) {
      return NextResponse.json({ error: "Name and Color are required." }, { status: 400 });
    }

    const tag = await prisma.tag.create({
      data: { name, color, description }
    });
    return NextResponse.json(tag);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create tag" }, { status: 400 });
  }
}

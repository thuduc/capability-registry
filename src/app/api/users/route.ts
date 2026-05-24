import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const roles = req.headers.get("x-simulated-roles") || "";
    if (!roles.split(",").includes("ADMIN")) {
      return NextResponse.json({ error: "Access Denied: Admin role required." }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        roles: true,
        createdAt: true
      },
      orderBy: { username: "asc" }
    });
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rolesHeader = req.headers.get("x-simulated-roles") || "";
    if (!rolesHeader.split(",").includes("ADMIN")) {
      return NextResponse.json({ error: "Access Denied: Admin role required." }, { status: 403 });
    }

    const { username, password, roles } = await req.json();
    if (!username || !password || !roles) {
      return NextResponse.json({ error: "Username, Password, and Roles are required." }, { status: 400 });
    }

    // Uniqueness check
    const existing = await prisma.user.findUnique({
      where: { username }
    });
    if (existing) {
      return NextResponse.json({ error: "Username already exists." }, { status: 400 });
    }

    const passwordHash = hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        roles // comma-separated roles e.g. "USER" or "USER,ADMIN"
      },
      select: {
        id: true,
        username: true,
        roles: true,
        createdAt: true
      }
    });

    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 400 });
  }
}

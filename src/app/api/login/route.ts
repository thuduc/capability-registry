import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and Password are required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const isValid = verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      username: user.username,
      roles: user.roles
    });
  } catch (error: any) {
    console.error("POST /api/login error:", error);
    return NextResponse.json({ error: error.message || "Authentication failed." }, { status: 500 });
  }
}

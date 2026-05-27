import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password, confirmPassword } = await req.json();

    if (!username || typeof username !== "string" || username.trim() === "") {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.trim() === "") {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }
    if (!confirmPassword || typeof confirmPassword !== "string" || confirmPassword.trim() === "") {
      return NextResponse.json({ error: "Please enter the password twice to confirm." }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Enforce valid username characters (alphanumeric, underscores, hyphens)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(cleanUsername)) {
      return NextResponse.json({ error: "Username must be between 3 and 20 characters and contain only letters, numbers, underscores, or hyphens." }, { status: 400 });
    }

    // Enforce basic password length constraint (e.g. at least 6 characters)
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    // Check if username already exists in database
    const existing = await prisma.user.findUnique({
      where: { username: cleanUsername }
    });

    if (existing) {
      return NextResponse.json({ error: "Username already exists. Please choose a different User ID." }, { status: 400 });
    }

    // Hash the password and save
    const passwordHash = hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        passwordHash,
        roles: "USER" // Assign standard 'USER' role by default
      },
      select: {
        id: true,
        username: true,
        roles: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      message: "Registration completed successfully!",
      user
    });
  } catch (error: any) {
    console.error("POST /api/register error:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred during registration." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";

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

export async function PATCH(req: NextRequest) {
  try {
    const simulatedUser = req.headers.get("x-simulated-user") || "";
    const rolesHeader = req.headers.get("x-simulated-roles") || "";
    const isAdmin = rolesHeader.split(",").includes("ADMIN");

    const { userId, oldPassword, password, confirmPassword } = await req.json();
    if (!password || !confirmPassword) {
      return NextResponse.json({ error: "New Password and Confirm Password are required." }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "New passwords do not match." }, { status: 400 });
    }

    // Resolve user either by userId or by simulatedUser (if self-updating)
    let targetUser = null;
    if (userId) {
      targetUser = await prisma.user.findUnique({
        where: { id: userId }
      });
    } else if (simulatedUser) {
      targetUser = await prisma.user.findUnique({
        where: { username: simulatedUser.toLowerCase() }
      });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Authorization checks:
    // Either the requester is an admin, OR they are updating their own password.
    const isSelfUpdate = targetUser.username.toLowerCase() === simulatedUser.toLowerCase();

    if (!isAdmin && !isSelfUpdate) {
      return NextResponse.json({ error: "Access Denied: Admin role required or you can only update your own password." }, { status: 403 });
    }

    // If it is a self-update, the old password is strictly required and must match the current password hash in the database
    if (isSelfUpdate) {
      if (!oldPassword) {
        return NextResponse.json({ error: "Old password is required for self password update." }, { status: 400 });
      }
      
      const isOldPasswordCorrect = verifyPassword(oldPassword, targetUser.passwordHash);
      if (!isOldPasswordCorrect) {
        return NextResponse.json({ error: "Incorrect old password." }, { status: 400 });
      }
    }

    // Hash and save the new password
    const passwordHash = hashPassword(password);

    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        passwordHash
      },
      select: {
        id: true,
        username: true,
        roles: true,
        createdAt: true
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update user password" }, { status: 400 });
  }
}


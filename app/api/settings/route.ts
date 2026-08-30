import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, families } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, appName, familyName, password } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    if (!appName || typeof appName !== "string") {
      return NextResponse.json({ error: "Invalid app name" }, { status: 400 });
    }

    if (!familyName || typeof familyName !== "string") {
      return NextResponse.json({ error: "Invalid family name" }, { status: 400 });
    }

    const updateData: any = { name };

    if (password) {
      if (typeof password !== "string" || password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    // Update user info (name, and optionally passwordHash)
    await db.update(users)
      .set(updateData)
      .where(eq(users.email, session.user.email));

    // Update family app name and family name
    if (session.user.familyId) {
      await db.update(families)
        .set({ appName, name: familyName })
        .where(eq(families.id, session.user.familyId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

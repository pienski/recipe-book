import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";

// Create a blank note. The client opens it immediately and saves via PUT.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const [newNote] = await db
      .insert(notes)
      .values({ familyId: session.user.familyId, title: "", content: "" })
      .returning();

    return NextResponse.json(newNote);
  } catch (error) {
    console.error("Failed to create note:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

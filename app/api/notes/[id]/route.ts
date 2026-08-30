import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content } = body;

    if (typeof title !== "string" || typeof content !== "string") {
      return new NextResponse("Missing or invalid fields", { status: 400 });
    }

    const [updatedNote] = await db
      .update(notes)
      .set({
        // Store the title as-is (may be empty); the list renders "Untitled" as a fallback.
        title: title.trim(),
        content,
        updated_at: new Date(),
      })
      .where(and(eq(notes.id, id), eq(notes.familyId, session.user.familyId)))
      .returning();

    if (!updatedNote) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json(updatedNote);
  } catch (error) {
    console.error("Failed to update note:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    const [deletedNote] = await db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.familyId, session.user.familyId)))
      .returning();

    if (!deletedNote) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete note:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

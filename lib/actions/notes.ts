"use server";

import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Full rows, most-recently-edited first. The note set is small (personal app),
// so loading everything once lets the client switch between notes with no extra
// round-trips; only mutations hit the API.
export async function getNotes() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  return db
    .select({
      id: notes.id,
      title: notes.title,
      content: notes.content,
      updated_at: notes.updated_at,
    })
    .from(notes)
    .where(eq(notes.familyId, session.user.familyId))
    .orderBy(desc(notes.updated_at));
}

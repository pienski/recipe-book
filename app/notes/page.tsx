import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getNotes } from "@/lib/actions/notes";
import NotesClient from "@/components/notes/NotesClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notes",
};

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const notes = await getNotes();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Notes</h1>
      <NotesClient initialNotes={notes} />
    </div>
  );
}

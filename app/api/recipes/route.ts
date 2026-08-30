import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { recipes } from "@/lib/db/schema";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, photo_url, photo_position, tags, servings, ingredients, use_ingredient_groups, directions, notes, source_url, isShared } = body;

    if (!title || !servings || !ingredients || !directions) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const [newRecipe] = await db.insert(recipes).values({
      familyId: session.user.familyId,
      createdByUserId: session.user.id,
      isShared: !!isShared,
      title,
      description,
      photo_url,
      photo_position,
      tags: tags || [],
      servings: Number(servings),
      ingredients,
      use_ingredient_groups: !!use_ingredient_groups,
      directions,
      notes,
      source_url,
    }).returning();

    return NextResponse.json(newRecipe);
  } catch (error) {
    console.error("Failed to create recipe:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

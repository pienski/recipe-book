import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { recipes } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    const recipe = await db.query.recipes.findFirst({
      where: and(
        eq(recipes.id, id),
        or(eq(recipes.familyId, session.user.familyId), eq(recipes.isShared, true))
      ),
    });

    if (!recipe) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json(recipe);
  } catch (error) {
    console.error("Failed to fetch recipe:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

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
    const { title, description, photo_url, photo_position, tags, servings, ingredients, use_ingredient_groups, directions, notes, source_url, isShared } = body;

    if (!title || !servings || !ingredients || !directions) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const [updatedRecipe] = await db
      .update(recipes)
      .set({
        title,
        isShared: !!isShared,
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
        updated_at: new Date(),
      })
      .where(and(eq(recipes.id, id), eq(recipes.familyId, session.user.familyId)))
      .returning();

    if (!updatedRecipe) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json(updatedRecipe);
  } catch (error) {
    console.error("Failed to update recipe:", error);
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
    const [deletedRecipe] = await db
      .delete(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.familyId, session.user.familyId)))
      .returning();

    if (!deletedRecipe) {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (deletedRecipe.photo_url) {
      try {
        await del(deletedRecipe.photo_url);
      } catch (blobError) {
        console.error("Failed to delete image from blob storage:", blobError);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete recipe:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

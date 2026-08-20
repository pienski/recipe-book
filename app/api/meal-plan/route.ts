import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { mealPlan, recipes } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getCategories(): string[] {
  return process.env.CATEGORIES
    ? process.env.CATEGORIES.split(",").map((c) => c.trim()).filter(Boolean)
    : [];
}

// Upsert the recipe assigned to a (date, category) slot. One recipe per cell.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { category } = body;

    // Accept either a single `date` or a batch `dates: string[]` — one recipe
    // dropped into several days of the same category at once.
    const rawDates: unknown = body.dates ?? body.date;
    const dates = [
      ...new Set(
        (Array.isArray(rawDates) ? rawDates : [rawDates]).filter(
          (d): d is string => typeof d === "string",
        ),
      ),
    ];

    if (dates.length === 0 || !dates.every((d) => DATE_RE.test(d))) {
      return new NextResponse("Invalid or missing date(s)", { status: 400 });
    }
    if (!category || !getCategories().includes(category)) {
      return new NextResponse("Invalid or missing category", { status: 400 });
    }
    // `recipe_id: null` is a deliberate "No meal" slot; an absent key is a bad request.
    if (!("recipe_id" in body)) {
      return new NextResponse("Missing recipe_id", { status: 400 });
    }
    const recipe_id: string | null = body.recipe_id ?? null;
    const custom_title: string | null = body.custom_title ?? null;

    // Servings to cook for this slot (drives grocery scaling). Default 2.
    const parsedServings = Number(body.servings);
    const servings =
      Number.isInteger(parsedServings) && parsedServings > 0 ? parsedServings : 2;

    // Look up the recipe only for real assignments (skip the lookup for "No meal").
    const recipe = recipe_id
      ? await db.query.recipes.findFirst({
          where: eq(recipes.id, recipe_id),
          columns: { id: true, title: true, photo_url: true, photo_position: true },
        })
      : null;
    if (recipe_id && !recipe) {
      return new NextResponse("Recipe not found", { status: 400 });
    }

    // One upsert covering every target cell; the unique (date, category) index
    // means re-assigning an occupied slot just overwrites it.
    await db
      .insert(mealPlan)
      .values(dates.map((date) => ({ date, category, recipe_id, custom_title, servings })))
      .onConflictDoUpdate({
        target: [mealPlan.date, mealPlan.category],
        set: { recipe_id, custom_title, servings },
      });

    // Return the joined shape the calendar cells need for an optimistic update
    // (nulls for a "No meal" slot).
    return NextResponse.json({
      dates,
      category,
      recipe_id,
      title: recipe?.title ?? (custom_title || "No meal"),
      photo_url: recipe?.photo_url ?? null,
      photo_position: recipe?.photo_position ?? null,
      servings,
    });
  } catch (error) {
    console.error("Failed to save meal plan slot:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Clear a (date, category) slot.
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const category = searchParams.get("category");

    if (!date || !DATE_RE.test(date) || !category) {
      return new NextResponse("Invalid or missing date/category", { status: 400 });
    }

    await db
      .delete(mealPlan)
      .where(and(eq(mealPlan.date, date), eq(mealPlan.category, category)));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete meal plan slot:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

"use server";

import { db } from "@/lib/db";
import { mealPlan, recipes, type Ingredient } from "@/lib/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";

export interface RangeMeal {
  date: string; // 'YYYY-MM-DD'
  category: string;
  recipe_id: string;
  title: string;
  photo_url: string | null;
  photo_position: string | null;
  servings: number; // planned servings (meal_plan)
  baseServings: number; // recipe's base servings
  ingredients: Ingredient[];
}

/**
 * Planned meals in the inclusive date range [fromISO, toISO], ordered by date.
 * Uses an inner join so deliberate "No meal" slots (null recipe_id) are excluded.
 * Returns full ingredient data so the grocery list can be built client-side.
 */
export async function getPlannedMealsInRange(
  fromISO: string,
  toISO: string,
  familyId: string,
): Promise<RangeMeal[]> {
  return db
    .select({
      date: mealPlan.date,
      category: mealPlan.category,
      recipe_id: recipes.id,
      title: recipes.title,
      photo_url: recipes.photo_url,
      photo_position: recipes.photo_position,
      servings: mealPlan.servings,
      baseServings: recipes.servings,
      ingredients: recipes.ingredients,
    })
    .from(mealPlan)
    .innerJoin(recipes, eq(mealPlan.recipe_id, recipes.id))
    .where(
      and(
        eq(mealPlan.familyId, familyId),
        gte(mealPlan.date, fromISO),
        lte(mealPlan.date, toISO)
      )
    )
    .orderBy(asc(mealPlan.date));
}

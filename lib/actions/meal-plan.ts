"use server";

import { db } from "@/lib/db";
import { mealPlan, recipes } from "@/lib/db/schema";
import { and, eq, gte, lte, sql, or } from "drizzle-orm";
import { addDays, daysBetween } from "@/lib/dates";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ---- Suggestion tuning (keep recency primary; frequency a modest "liked" boost) ----
const RECENT_EXCLUDE_DAYS = 4; // hard-exclude meals eaten within the last N days
const RECENCY_CAP_DAYS = 45; // staleness saturates here so ancient meals don't dominate
const FREQ_WINDOW_DAYS = 90; // only count cooks within this window toward "liked"
const FREQ_WEIGHT = 3; // each in-window cook adds this many "days-equivalent" (capped)
const FREQ_CAP = 5; // a beloved staple can't monopolize the list
const NEVER_EATEN_SCORE = RECENCY_CAP_DAYS; // never-eaten = maximally stale → surfaces new recipes
const SUGGESTION_LIMIT = 12;

export interface PlannedMeal {
  date: string; // 'YYYY-MM-DD'
  category: string;
  recipe_id: string | null; // null = deliberate "No meal" slot
  title: string | null; // null for a "No meal" slot
  photo_url: string | null;
  photo_position: string | null;
  servings: number; // how many servings to cook (drives grocery scaling)
}

// Keyed by `${date}|${category}`.
export type WeekPlan = Record<string, PlannedMeal>;

/** Planned meals for the week starting at `mondayISO` (Mon→Sun), keyed `${date}|${category}`. */
export async function getWeekPlan(mondayISO: string): Promise<WeekPlan> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");
  
  const familyId = session.user.familyId;
  const sunday = addDays(mondayISO, 6);

  const rows = await db
    .select({
      date: mealPlan.date,
      category: mealPlan.category,
      recipe_id: mealPlan.recipe_id,
      title: recipes.title,
      custom_title: mealPlan.custom_title,
      photo_url: recipes.photo_url,
      photo_position: recipes.photo_position,
      servings: mealPlan.servings,
    })
    .from(mealPlan)
    // Left join: "No meal" rows have a null recipe_id and no matching recipe.
    .leftJoin(recipes, eq(mealPlan.recipe_id, recipes.id))
    .where(and(gte(mealPlan.date, mondayISO), lte(mealPlan.date, sunday), eq(mealPlan.familyId, familyId)));

  const plan: WeekPlan = {};
  for (const row of rows) {
    plan[`${row.date}|${row.category}`] = {
      date: row.date,
      category: row.category,
      recipe_id: row.recipe_id,
      title: row.recipe_id ? row.title : (row.custom_title || "No meal"),
      photo_url: row.photo_url,
      photo_position: row.photo_position,
      servings: row.servings,
    };
  }
  return plan;
}

export interface SuggestedRecipe {
  id: string;
  title: string;
  photo_url: string | null;
  photo_position: string | null;
  tags: string[];
  last_eaten: string | null; // 'YYYY-MM-DD'
  freq: number; // cooks within FREQ_WINDOW_DAYS
  score: number;
}

export interface GetSuggestionsParams {
  category: string;
  today: string; // 'YYYY-MM-DD' (client-derived "today")
  all?: boolean; // ignore the category filter and consider every recipe
}

/**
 * Ranked recipe suggestions for a meal slot. Prioritises meals not eaten recently,
 * with a capped boost for frequently-eaten (= liked) ones. Never-eaten recipes are
 * treated as maximally stale so new recipes still surface.
 */
export async function getSuggestions({
  category,
  today,
  all = false,
}: GetSuggestionsParams): Promise<SuggestedRecipe[]> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");
  
  const familyId = session.user.familyId;
  const windowStart = addDays(today, -FREQ_WINDOW_DAYS);

  const rows = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      photo_url: recipes.photo_url,
      photo_position: recipes.photo_position,
      tags: recipes.tags,
      last_eaten: sql<string | null>`max(${mealPlan.date})`,
      freq: sql<number>`count(${mealPlan.id}) filter (where ${mealPlan.date} >= ${windowStart} AND ${mealPlan.familyId} = ${familyId})`,
    })
    .from(recipes)
    .leftJoin(mealPlan, and(eq(recipes.id, mealPlan.recipe_id), eq(mealPlan.familyId, familyId)))
    .where(and(
      or(eq(recipes.familyId, familyId), eq(recipes.isShared, true)),
      all ? undefined : sql`${recipes.tags} @> ${JSON.stringify([category])}::jsonb`
    ))
    .groupBy(recipes.id);

  const scored: SuggestedRecipe[] = [];
  for (const row of rows) {
    const lastEaten = row.last_eaten;
    const daysSince = lastEaten ? daysBetween(lastEaten, today) : null;

    // Skip anything eaten in the last few days — don't repeat it this week.
    if (daysSince !== null && daysSince < RECENT_EXCLUDE_DAYS) continue;

    const recency =
      daysSince === null ? NEVER_EATEN_SCORE : Math.min(daysSince, RECENCY_CAP_DAYS);
    const freq = Number(row.freq) || 0;
    const freqBoost = Math.min(freq, FREQ_CAP) * FREQ_WEIGHT;

    scored.push({
      id: row.id,
      title: row.title,
      photo_url: row.photo_url,
      photo_position: row.photo_position,
      tags: row.tags,
      last_eaten: lastEaten,
      freq,
      score: recency + freqBoost,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: older-eaten first (nulls = never eaten sort first), then title.
    if (a.last_eaten !== b.last_eaten) {
      if (a.last_eaten === null) return -1;
      if (b.last_eaten === null) return 1;
      return a.last_eaten < b.last_eaten ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });

  return scored.slice(0, SUGGESTION_LIMIT);
}

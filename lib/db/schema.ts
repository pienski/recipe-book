import { pgTable, text, integer, timestamp, jsonb, boolean, date, unique } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export type Ingredient = {
  name: string;
  amount: number;
  unit: string | null;
  metric_amount?: number | null;
  metric_unit?: 'g' | 'ml' | null;
  group?: string | null;
};

export const recipes = pgTable("recipes", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull(),
  description: text("description"),
  photo_url: text("photo_url"),
  photo_position: text("photo_position"), // CSS object-position, e.g. "50% 30%" (focal point)
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  servings: integer("servings").notNull(),
  ingredients: jsonb("ingredients").$type<Ingredient[]>().notNull(),
  use_ingredient_groups: boolean("use_ingredient_groups").notNull().default(false),
  directions: jsonb("directions").$type<string[]>().notNull(),
  notes: text("notes"),
  source_url: text("source_url"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// A planned/eaten meal slot. Assigning a recipe to a (date, category) cell in the
// calendar IS the permanent record — past weeks constitute the meal history.
export const mealPlan = pgTable(
  "meal_plan",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    date: date("date", { mode: "string" }).notNull(), // 'YYYY-MM-DD'
    category: text("category").notNull(), // one of CATEGORIES env values
    // null = a deliberate "No meal" slot (distinct from an empty/undecided cell)
    recipe_id: text("recipe_id").references(() => recipes.id, {
      onDelete: "cascade",
    }),
    custom_title: text("custom_title"), // Custom title for placeholder meals
    // How many servings to cook for this slot — drives grocery-list scaling.
    servings: integer("servings").notNull().default(2),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("meal_plan_date_category_unique").on(t.date, t.category)],
);

// Free-form notes (Notion-style). `content` holds Tiptap-produced HTML.
export const notes = pgTable("notes", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull().default("Untitled"),
  content: text("content").notNull().default(""), // Tiptap HTML
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type MealPlan = typeof mealPlan.$inferSelect;
export type NewMealPlan = typeof mealPlan.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

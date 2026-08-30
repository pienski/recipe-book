import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { recipes, mealPlan } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";
import IngredientList from "@/components/recipes/IngredientList";
import DirectionSteps from "@/components/recipes/DirectionSteps";
import DeleteButton from "@/components/recipes/DeleteButton";
import CopyMarkdownButton from "@/components/recipes/CopyMarkdownButton";
import { recipeToMarkdown } from "@/lib/markdown/recipe";
import { getTagStyles, cn } from "@/lib/utils";
import { formatTimeAgo, formatFullDate } from "@/lib/dates";
import ReactMarkdown from "react-markdown";
import { Pencil, StickyNote, ArrowLeft, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: RecipeDetailPageProps) {
  const { id } = await params;
  const recipe = await db.query.recipes.findFirst({
    where: eq(recipes.id, id),
  });

  return {
    title: recipe ? recipe.title : "Recipe Not Found",
  };
}

interface RecipeDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;
  
  const recipe = await db.query.recipes.findFirst({
    where: eq(recipes.id, id),
    with: {
      createdByUser: true,
      family: true,
    }
  });

  if (!recipe) {
    notFound();
  }

  // Most recent date this recipe appears in the meal plan (= last cooked).
  const [lastCookedRow] = await db
    .select({ date: sql<string | null>`max(${mealPlan.date})` })
    .from(mealPlan)
    .where(and(eq(mealPlan.recipe_id, id), eq(mealPlan.familyId, session.user.familyId)));
  // Keep the raw 'YYYY-MM-DD' string; date helpers parse it without UTC day-shift.
  const lastCookedIso = lastCookedRow?.date ?? null;

  const isEditable = session.user.familyId === recipe.familyId;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link
        href="/recipes"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to recipes
      </Link>

      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Left column: Photo (or placeholder) */}
        <div className="w-full md:w-64 lg:w-80 shrink-0">
          {recipe.photo_url ? (
            <img
              src={recipe.photo_url}
              alt={recipe.title}
              style={{ objectPosition: recipe.photo_position || "50% 50%" }}
              className="w-full aspect-[4/3] object-cover rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800"
            />
          ) : (
            <div className="w-full aspect-[4/3] bg-gray-50 dark:bg-zinc-900 rounded-xl flex items-center justify-center text-6xl shadow-inner border border-dashed border-gray-200 dark:border-zinc-800 text-gray-400">
              🍳
            </div>
          )}
        </div>

        {/* Right column: Title, tags, description, meta */}
        <div className="w-full md:flex-1 flex flex-col justify-between py-1">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3 leading-tight">{recipe.title}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              {recipe.tags.map((tag) => {
                const styles = getTagStyles(tag);
                return (
                  <span
                    key={tag}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border transition-colors font-sans",
                      styles.bg,
                      styles.text,
                      styles.border,
                      "dark:bg-opacity-10 dark:border-opacity-30"
                    )}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
            {recipe.description && (
              <p className="text-base text-gray-600 dark:text-gray-400 italic line-clamp-2 hover:line-clamp-none transition-all cursor-default">
                {recipe.description}
              </p>
            )}
          </div>

          <div className="mt-6 md:mt-auto pt-4 border-t border-gray-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {isEditable && (
                <Link
                  href={`/recipes/${recipe.id}/edit`}
                  className="flex items-center gap-2 bg-blue-600 dark:bg-blue-700 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-sm"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
              )}
              <CopyMarkdownButton markdown={recipeToMarkdown(recipe)} />
              {isEditable && <DeleteButton recipeId={recipe.id} recipeTitle={recipe.title} />}
            </div>
            
            <div className="flex items-center gap-2.5 text-xs text-gray-400 dark:text-gray-500">
              {recipe.source_url && (
                <>
                  <a
                    href={recipe.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-gray-400 hover:text-blue-500 transition-colors"
                    title="Original Recipe"
                  >
                    <ExternalLink className="w-3 h-3" /> Source
                  </a>
                  <span>·</span>
                </>
              )}
              {recipe.family && (
                <>
                  <span className="flex items-center gap-1">
                    By <span className="font-medium text-gray-700 dark:text-gray-300">{recipe.family.name}</span>
                  </span>
                  <span>·</span>
                </>
              )}
              <span>
                Created{" "}
                <span className="hidden sm:inline">
                  {new Date(recipe.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
                <span className="sm:hidden">
                  {new Date(recipe.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </span>
              {recipe.updated_at && Math.abs(recipe.updated_at.getTime() - recipe.created_at.getTime()) > 86400000 && (
                <>
                  <span>·</span>
                  <span>
                    Edited{" "}
                    <span className="hidden sm:inline">
                      {new Date(recipe.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                    <span className="sm:hidden">
                      {new Date(recipe.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                </>
              )}
              {lastCookedIso && (
                <>
                  <span>·</span>
                  <span className="group relative italic cursor-default">
                    Last cooked {formatTimeAgo(lastCookedIso)}
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 dark:bg-zinc-700 px-2.5 py-1.5 text-xs font-medium not-italic text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      {formatFullDate(lastCookedIso)}
                      <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-zinc-700" />
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {recipe.notes && (
        <div className="mb-8 flex gap-4 items-start bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/20 rounded-xl p-5">
          <StickyNote className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold text-yellow-800 dark:text-yellow-400 text-[10px] uppercase tracking-wider mb-1">
              Notes
            </h4>
            <div className="text-yellow-900 dark:text-yellow-200 text-base leading-relaxed markdown-content">
              <ReactMarkdown>{recipe.notes}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5">
          <IngredientList
            ingredients={recipe.ingredients}
            baseServings={recipe.servings}
            useIngredientGroups={recipe.use_ingredient_groups}
          />
        </div>
        <div className="lg:col-span-7">
          <DirectionSteps directions={recipe.directions} />
        </div>
      </div>
    </div>
  );
}

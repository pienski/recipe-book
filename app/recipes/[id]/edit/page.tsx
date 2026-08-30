import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { recipes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import RecipeForm from "@/components/recipes/RecipeForm";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: EditRecipePageProps) {
  const { id } = await params;
  const recipe = await db.query.recipes.findFirst({
    where: eq(recipes.id, id),
  });

  return {
    title: recipe ? `Edit: ${recipe.title}` : "Edit Recipe",
  };
}

interface EditRecipePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;
  
  const categories = process.env.CATEGORIES 
    ? process.env.CATEGORIES.split(',').map(c => c.trim()).filter(Boolean) 
    : [];

  const [recipe, allRecipes] = await Promise.all([
    db.query.recipes.findFirst({
      where: eq(recipes.id, id),
    }),
    db.query.recipes.findMany({
      columns: {
        tags: true,
      },
    }),
  ]);

  if (!recipe) {
    notFound();
  }

  if (session.user.familyId !== recipe.familyId) {
    redirect(`/recipes/${recipe.id}`);
  }

  const dbTags = new Set(allRecipes.flatMap((r) => r.tags as string[]));
  const otherTags = Array.from(dbTags)
    .filter(tag => !categories.includes(tag))
    .sort((a, b) => a.localeCompare(b));

  const existingTags = [...categories, ...otherTags];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit Recipe</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Update the details for &quot;{recipe.title}&quot;.</p>
      </div>
      <RecipeForm initialData={recipe} isEditing={true} existingTags={existingTags} />
    </div>
  );
}

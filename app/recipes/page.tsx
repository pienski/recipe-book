import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import RecipeList from "@/components/recipes/RecipeList";
import AddRecipeDropdown from "@/components/recipes/AddRecipeDropdown";
import { getRecipes, getAllTags } from "@/lib/actions/recipes";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recipes",
};

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const categories = process.env.CATEGORIES 
    ? process.env.CATEGORIES.split(',').map(c => c.trim()).filter(Boolean) 
    : [];

  const [initialRecipes, allTags] = await Promise.all([
    getRecipes({ limit: 15 }),
    getAllTags(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Recipes</h1>
        <AddRecipeDropdown />
      </div>

      <RecipeList 
        initialRecipes={initialRecipes} 
        categories={categories} 
        serverTags={allTags}
      />
    </div>
  );
}

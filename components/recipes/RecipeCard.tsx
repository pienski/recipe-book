/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import { getTagStyles, cn } from "@/lib/utils";
import { formatTimeAgo, formatFullDate } from "@/lib/dates";

import { RecipeWithLastCooked } from "@/lib/actions/recipes";

interface RecipeCardProps {
  recipe: RecipeWithLastCooked;
}

export default function RecipeCard({ recipe }: RecipeCardProps) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:shadow-lg transition-all bg-white dark:bg-zinc-900 flex flex-col h-full shadow-sm"
    >
      <div className="relative aspect-[4/3] w-full bg-gray-50 dark:bg-zinc-800/50 overflow-hidden">
        {recipe.photo_url ? (
          <img
            src={recipe.photo_url}
            alt={recipe.title}
            style={{ objectPosition: recipe.photo_position || "50% 50%" }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-4xl">
            🍳
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <h2 className="text-xl font-bold mb-3 line-clamp-2 text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">{recipe.title}</h2>
        
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {recipe.tags.map((tag) => {
              const styles = getTagStyles(tag);
              return (
                <span
                  key={tag}
                  className={cn(
                    "px-3 py-0.5 rounded-full text-xs font-medium border transition-colors font-sans",
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
        )}

        <div className="mt-auto pt-4 border-t border-gray-100 dark:border-zinc-800/50 text-xs font-medium text-gray-400 dark:text-gray-500 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="opacity-60">👥</span> {recipe.servings}
            </span>
            <span className="opacity-30">·</span>
            {recipe.family && (
              <>
                <span className="truncate max-w-[80px] sm:max-w-[120px]">By {recipe.family.name}</span>
                <span className="opacity-30">·</span>
              </>
            )}
            <span>
              {recipe.updated_at && Math.abs(new Date(recipe.updated_at).getTime() - new Date(recipe.created_at).getTime()) > 86400000 
                ? `Edited ${new Date(recipe.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                : `Created ${new Date(recipe.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
              }
            </span>
          </div>
          {recipe.last_cooked_at && (
            <span
              className="flex items-center gap-1 italic shrink-0"
              title={`Last cooked ${formatFullDate(recipe.last_cooked_at)}`}
            >
              Last: {formatTimeAgo(recipe.last_cooked_at)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

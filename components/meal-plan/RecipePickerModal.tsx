"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Ban, Check, Loader2, Search, X, Utensils } from "lucide-react";
import { cn, getTagStyles } from "@/lib/utils";
import { formatDayMonth, getTodayISO, type WeekDay } from "@/lib/dates";
import { getSuggestions } from "@/lib/actions/meal-plan";
import { getRecipes } from "@/lib/actions/recipes";

export interface PickerItem {
  id: string;
  title: string;
  photo_url: string | null;
  photo_position: string | null;
  tags: string[];
  last_eaten: string | null; // 'YYYY-MM-DD'
}

// Sentinel "recipe" for a deliberate skip; persisted as recipe_id = null.
export const NO_MEAL_ID = "__no_meal__";
export const NO_MEAL_ITEM: PickerItem = {
  id: NO_MEAL_ID,
  title: "No meal",
  photo_url: null,
  photo_position: null,
  tags: [],
  last_eaten: null,
};

interface RecipePickerModalProps {
  weekDays: WeekDay[];
  initialDate: string; // the clicked cell's day (pre-selected)
  category: string;
  presetRecipe?: PickerItem | null; // "Repeat" mode: recipe already chosen
  initialServings?: number; // servings to pre-fill the stepper with (default 2)
  occupied: Record<string, string>; // date -> existing recipe title for this category
  onClose: () => void;
  onConfirm: (recipe: PickerItem, dates: string[], servings: number) => void;
}

export default function RecipePickerModal({
  weekDays,
  initialDate,
  category,
  presetRecipe = null,
  initialServings = 2,
  occupied,
  onClose,
  onConfirm,
}: RecipePickerModalProps) {
  const [selectedRecipe, setSelectedRecipe] = useState<PickerItem | null>(presetRecipe);
  const [selectedDates, setSelectedDates] = useState<string[]>([initialDate]);
  const [servings, setServings] = useState(initialServings);

  // Recipe-list state (only used in the "choose recipe" step).
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customMealText, setCustomMealText] = useState("");

  const inDayStep = selectedRecipe !== null;
  const isNoMeal = selectedRecipe?.id === NO_MEAL_ID;

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch: ranked suggestions when empty, title search via getRecipes otherwise.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let result: PickerItem[];
      if (debounced.trim()) {
        const recipes = await getRecipes({
          search: debounced,
          tags: showAll ? [] : [category],
          limit: 20,
        });
        result = recipes.map((r) => ({
          id: r.id,
          title: r.title,
          photo_url: r.photo_url,
          photo_position: r.photo_position,
          tags: r.tags,
          last_eaten: r.last_cooked_at,
        }));
      } else {
        const suggestions = await getSuggestions({
          category,
          today: getTodayISO(),
          all: showAll,
        });
        result = suggestions.map((s) => ({
          id: s.id,
          title: s.title,
          photo_url: s.photo_url,
          photo_position: s.photo_position,
          tags: s.tags,
          last_eaten: s.last_eaten,
        }));
      }
      if (!cancelled) {
        setItems(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, showAll, category]);

  const toggleDate = (date: string) =>
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date],
    );

  const allSelected = selectedDates.length === weekDays.length;
  const toggleAll = () =>
    setSelectedDates(allSelected ? [initialDate] : weekDays.map((d) => d.date));

  // Selected days that already hold a *different* meal — i.e. ones we'd overwrite.
  const replacing = useMemo(
    () =>
      weekDays.filter(
        (d) =>
          selectedDates.includes(d.date) &&
          occupied[d.date] &&
          occupied[d.date] !== selectedRecipe?.title,
      ),
    [weekDays, selectedDates, occupied, selectedRecipe],
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">
              {inDayStep ? "Add to which days?" : `Choose for ${category}`}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{category}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {inDayStep ? (
          /* ---- Step 2: choose which days ---- */
          <>
            <div className="p-4 flex flex-col gap-4 overflow-y-auto">
              {/* Chosen recipe */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-zinc-800/50">
                <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                  {isNoMeal ? (
                    selectedRecipe!.title !== "No meal" ? (
                      <Utensils className="w-5 h-5 text-gray-400" />
                    ) : (
                      <Ban className="w-5 h-5 text-gray-400" />
                    )
                  ) : selectedRecipe!.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedRecipe!.photo_url}
                      alt={selectedRecipe!.title}
                      style={{ objectPosition: selectedRecipe!.photo_position || "50% 50%" }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">🍳</span>
                  )}
                </div>
                <p className="font-medium line-clamp-1 flex-1 min-w-0">{selectedRecipe!.title}</p>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Change
                </button>
              </div>

              {/* Servings to cook (drives the grocery list) */}
              {!isNoMeal && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Servings to cook
                  </span>
                  <div className="flex items-center gap-1 border border-gray-100 dark:border-zinc-800 rounded-lg p-1 bg-gray-50/50 dark:bg-zinc-800/50">
                    <button
                      type="button"
                      onClick={() => setServings((s) => Math.max(1, s - 1))}
                      className="w-7 h-7 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors text-gray-500 dark:text-gray-400"
                      aria-label="Fewer servings"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-gray-900 dark:text-gray-100">
                      {servings}
                    </span>
                    <button
                      type="button"
                      onClick={() => setServings((s) => s + 1)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors text-gray-500 dark:text-gray-400"
                      aria-label="More servings"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Day toggles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Add to
                  </span>
                  <button
                    onClick={toggleAll}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {allSelected ? "Just this day" : "Whole week"}
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {weekDays.map((d) => {
                    const active = selectedDates.includes(d.date);
                    const isOccupied = !!occupied[d.date];
                    return (
                      <button
                        key={d.date}
                        onClick={() => toggleDate(d.date)}
                        title={isOccupied ? `Replaces ${occupied[d.date]}` : undefined}
                        className={cn(
                          "relative flex flex-col items-center py-2 rounded-lg border text-center transition-colors",
                          active
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-500"
                            : "border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-zinc-700",
                        )}
                      >
                        <span className="text-[11px] font-semibold">{d.dayName}</span>
                        <span className="text-[10px] text-gray-400">{d.label}</span>
                        {isOccupied && (
                          <span
                            className={cn(
                              "absolute top-1 right-1 w-1.5 h-1.5 rounded-full",
                              active ? "bg-blue-500" : "bg-amber-400",
                            )}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                {replacing.length > 0 && (
                  <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                    Replaces existing meals on {replacing.map((d) => d.dayName).join(", ")}.
                  </p>
                )}
              </div>
            </div>

            {/* Confirm */}
            <div className="p-4 border-t border-gray-100 dark:border-zinc-800">
              <button
                onClick={() => onConfirm(selectedRecipe!, selectedDates, servings)}
                disabled={selectedDates.length === 0}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-colors",
                  selectedDates.length === 0
                    ? "bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-gray-600 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700",
                )}
              >
                <Check className="w-4 h-4" />
                {isNoMeal
                  ? selectedDates.length <= 1
                    ? `Mark as ${selectedRecipe!.title}`
                    : `Mark ${selectedDates.length} days as ${selectedRecipe!.title}`
                  : selectedDates.length <= 1
                    ? "Add meal"
                    : `Add to ${selectedDates.length} days`}
              </button>
            </div>
          </>
        ) : (
          /* ---- Step 1: choose a recipe ---- */
          <>
            {/* Controls */}
            <div className="p-4 flex flex-col gap-3 border-b border-gray-100 dark:border-zinc-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search recipes..."
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-100 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {debounced.trim()
                    ? "Search results"
                    : showAll
                      ? "Suggestions · all recipes"
                      : `Suggestions · ${category}`}
                </span>
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showAll ? `Filter to ${category}` : "Show all recipes"}
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Custom meal / Skip meal"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-100 dark:border-zinc-800 rounded-lg bg-gray-50 dark:bg-zinc-800/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={customMealText}
                  onChange={(e) => setCustomMealText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSelectedRecipe({ ...NO_MEAL_ITEM, title: customMealText.trim() || "No meal" });
                    }
                  }}
                />
                <button
                  onClick={() => setSelectedRecipe({ ...NO_MEAL_ITEM, title: customMealText.trim() || "No meal" })}
                  className="px-4 py-1.5 text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 font-medium transition-colors"
                >
                  Use
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-gray-500 dark:text-gray-400">No recipes found.</p>
                  {!showAll && !debounced.trim() && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="mt-3 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                    >
                      Show all recipes
                    </button>
                  )}
                </div>
              ) : (
                <ul className="flex flex-col gap-1">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => setSelectedRecipe(item)}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-left"
                      >
                        <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-50 dark:bg-zinc-800 flex items-center justify-center">
                          {item.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.photo_url}
                              alt={item.title}
                              style={{ objectPosition: item.photo_position || "50% 50%" }}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl text-gray-300 dark:text-gray-600">🍳</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                            {item.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {item.tags.slice(0, 3).map((tag) => {
                              const styles = getTagStyles(tag);
                              return (
                                <span
                                  key={tag}
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                                    styles.bg,
                                    styles.text,
                                    styles.border,
                                    "dark:bg-opacity-10 dark:border-opacity-30",
                                  )}
                                >
                                  {tag}
                                </span>
                              );
                            })}
                            <span className="text-[11px] italic text-gray-400">
                              {item.last_eaten
                                ? `Last: ${formatDayMonth(item.last_eaten)}`
                                : "Never made"}
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

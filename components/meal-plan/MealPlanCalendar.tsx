"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, ChevronLeft, ChevronRight, Copy, Pencil, Plus, X, Utensils } from "lucide-react";
import { addWeeks, getWeekDates, getWeekStart, getTodayISO } from "@/lib/dates";
import { cn, getTagStyles } from "@/lib/utils";
import type { PlannedMeal, WeekPlan } from "@/lib/actions/meal-plan";
import RecipePickerModal, {
  type PickerItem,
  NO_MEAL_ID,
  NO_MEAL_ITEM,
} from "./RecipePickerModal";

interface MealPlanCalendarProps {
  weekStart: string; // Monday 'YYYY-MM-DD'
  weekProvided: boolean; // whether ?week= was in the URL
  categories: string[];
  plan: WeekPlan;
}

interface PickerState {
  date: string; // the clicked cell (pre-selected day)
  category: string;
  presetRecipe?: PickerItem; // "Repeat" mode: recipe chosen, only pick days
}

const slotKey = (date: string, category: string) => `${date}|${category}`;

export default function MealPlanCalendar({
  weekStart,
  weekProvided,
  categories,
  plan: initialPlan,
}: MealPlanCalendarProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<WeekPlan>(initialPlan);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [todayISO, setTodayISO] = useState<string | null>(null);
  const mobileTodayRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => getWeekDates(weekStart), [weekStart]);

  // Scroll to today on mobile
  useEffect(() => {
    if (todayISO && mobileTodayRef.current && mobileTodayRef.current.offsetParent !== null) {
      // 64px for header + 16px extra padding = 80px offset
      const y = mobileTodayRef.current.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, [todayISO, weekStart]);

  // Compute "today" on the client only (avoids SSR/hydration timezone mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTodayISO(getTodayISO());
  }, []);

  // If no week was specified and the client's current week differs from the
  // server's guess (timezone gap), re-align the URL to the browser's week.
  useEffect(() => {
    if (weekProvided) return;
    const clientWeek = getWeekStart();
    if (clientWeek !== weekStart) {
      router.replace(`/plan?week=${clientWeek}`);
    }
  }, [weekProvided, weekStart, router]);

  const goToWeek = (iso: string) => router.push(`/plan?week=${iso}`);

  // date -> existing recipe title, for one category across the visible week.
  const occupiedFor = (category: string): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const day of days) {
      const meal = plan[slotKey(day.date, category)];
      if (meal) map[day.date] = meal.title ?? "No meal";
    }
    return map;
  };

  const openPick = (date: string, category: string) => setPicker({ date, category });

  // "Repeat" a filled cell: open the picker with its recipe preset, day-step first.
  const openRepeat = (date: string, category: string) => {
    const meal = plan[slotKey(date, category)];
    if (!meal) return;
    setPicker({
      date,
      category,
      presetRecipe:
        meal.recipe_id === null
          ? { ...NO_MEAL_ITEM, title: meal.title || "No meal" }
          : {
              id: meal.recipe_id,
              title: meal.title ?? "",
              photo_url: meal.photo_url,
              photo_position: meal.photo_position,
              tags: [],
              last_eaten: null,
            },
    });
  };

  // Assign one recipe to a whole set of (date, category) cells at once.
  const assignRecipeToDates = async (
    category: string,
    recipe: PickerItem,
    dates: string[],
    servings: number,
  ) => {
    if (dates.length === 0) return;
    setPicker(null);

    const isNoMeal = recipe.id === NO_MEAL_ID;
    const recipeId = isNoMeal ? null : recipe.id;
    const customTitle = isNoMeal ? recipe.title : null;
    const keys = dates.map((d) => slotKey(d, category));
    const previous = keys.map((k) => plan[k]); // snapshot for rollback

    setPlan((p) => {
      const next = { ...p };
      for (const date of dates) {
        next[slotKey(date, category)] = {
          date,
          category,
          recipe_id: recipeId,
          title: isNoMeal ? customTitle : recipe.title,
          photo_url: isNoMeal ? null : recipe.photo_url,
          photo_position: isNoMeal ? null : recipe.photo_position,
          servings,
        };
      }
      return next;
    });

    try {
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates, category, recipe_id: recipeId, custom_title: customTitle, servings }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (error) {
      console.error("Failed to assign meals:", error);
      setPlan((p) => {
        const next = { ...p };
        keys.forEach((k, i) => {
          const prev = previous[i];
          if (prev) next[k] = prev;
          else delete next[k];
        });
        return next;
      });
      alert("Couldn't save that meal. Please try again.");
    }
  };

  const removeRecipe = async (date: string, category: string) => {
    const key = slotKey(date, category);
    const previous = plan[key];
    if (!previous) return;
    setPlan((p) => {
      const next = { ...p };
      delete next[key];
      return next;
    });

    try {
      const res = await fetch(
        `/api/meal-plan?date=${date}&category=${encodeURIComponent(category)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (error) {
      console.error("Failed to remove meal:", error);
      setPlan((p) => ({ ...p, [key]: previous })); // restore
      alert("Couldn't remove that meal. Please try again.");
    }
  };

  const monthSpan = `${days[0].label} – ${days[6].label}`;

  return (
    <div>
      {/* Header + week navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Meal Plan</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToWeek(addWeeks(weekStart, -1))}
            className="p-2 rounded-full border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => goToWeek(getWeekStart())}
            className="px-4 py-2 rounded-full text-sm font-medium border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => goToWeek(addWeeks(weekStart, 1))}
            className="p-2 rounded-full border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {monthSpan}
          </span>
        </div>
      </div>

      {/* Desktop grid: days (rows) × categories (columns) */}
      <div
        className="hidden md:grid gap-2"
        style={{
          gridTemplateColumns: `7rem repeat(${categories.length}, minmax(0, 1fr))`,
        }}
      >
        <div /> {/* empty corner */}
        {categories.map((category) => {
          const styles = getTagStyles(category);
          return (
            <div
              key={category}
              className={cn(
                "text-center text-sm font-semibold py-2 rounded-lg border",
                styles.bg,
                styles.text,
                styles.border,
                "dark:bg-opacity-10 dark:border-opacity-30",
              )}
            >
              {category}
            </div>
          );
        })}

        {days.map((day) => (
          <FragmentRow
            key={day.date}
            day={day}
            categories={categories}
            plan={plan}
            isToday={day.date === todayISO}
            onPick={(category) => openPick(day.date, category)}
            onRepeat={(category) => openRepeat(day.date, category)}
            onRemove={(category) => removeRecipe(day.date, category)}
          />
        ))}
      </div>

      {/* Mobile: per-day cards */}
      <div className="md:hidden flex flex-col gap-4">
        {days.map((day) => (
          <div
            key={day.date}
            ref={day.date === todayISO ? mobileTodayRef : null}
            className={cn(
              "rounded-xl border p-4",
              day.date === todayISO
                ? "border-blue-400 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-900/10"
                : "border-gray-200 dark:border-zinc-800",
            )}
          >
            <div className="flex items-baseline gap-2 mb-3">
              <span className="font-semibold">{day.dayName}</span>
              <span className="text-sm text-gray-400">{day.label}</span>
              {day.date === todayISO && (
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Today</span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {categories.map((category) => (
                <div key={category}>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {category}
                  </div>
                  <Cell
                    meal={plan[slotKey(day.date, category)]}
                    onPick={() => openPick(day.date, category)}
                    onRepeat={() => openRepeat(day.date, category)}
                    onRemove={() => removeRecipe(day.date, category)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {picker && (
        <RecipePickerModal
          weekDays={days}
          initialDate={picker.date}
          category={picker.category}
          presetRecipe={picker.presetRecipe}
          initialServings={plan[slotKey(picker.date, picker.category)]?.servings ?? 2}
          occupied={occupiedFor(picker.category)}
          onClose={() => setPicker(null)}
          onConfirm={(recipe, dates, servings) =>
            assignRecipeToDates(picker.category, recipe, dates, servings)
          }
        />
      )}
    </div>
  );
}

// One desktop grid row: a day label cell followed by one cell per category.
function FragmentRow({
  day,
  categories,
  plan,
  isToday,
  onPick,
  onRepeat,
  onRemove,
}: {
  day: { date: string; dayName: string; label: string };
  categories: string[];
  plan: WeekPlan;
  isToday: boolean;
  onPick: (category: string) => void;
  onRepeat: (category: string) => void;
  onRemove: (category: string) => void;
}) {
  return (
    <>
      <div
        className={cn(
          "flex flex-col justify-center px-2 py-3 rounded-lg",
          isToday && "bg-blue-50 dark:bg-blue-900/15",
        )}
      >
        <span className={cn("font-semibold", isToday && "text-blue-600 dark:text-blue-400")}>
          {day.dayName}
        </span>
        <span className="text-xs text-gray-400">{day.label}</span>
      </div>
      {categories.map((category) => (
        <Cell
          key={category}
          meal={plan[slotKey(day.date, category)]}
          onPick={() => onPick(category)}
          onRepeat={() => onRepeat(category)}
          onRemove={() => onRemove(category)}
        />
      ))}
    </>
  );
}

// A single slot: either an assigned recipe or an empty "+ Add" target.
function Cell({
  meal,
  onPick,
  onRepeat,
  onRemove,
}: {
  meal: PlannedMeal | undefined;
  onPick: () => void;
  onRepeat: () => void;
  onRemove: () => void;
}) {
  if (!meal) {
    return (
      <button
        onClick={onPick}
        className="group min-h-[3.5rem] w-full rounded-lg border border-dashed border-gray-200 dark:border-zinc-800 flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 dark:hover:border-blue-500 dark:hover:bg-blue-900/10 transition-colors"
      >
        <Plus className="w-4 h-4 mr-1" />
        <span className="text-xs font-medium">Add</span>
      </button>
    );
  }

  // Deliberate "No meal" slot — subtle, muted, not a link to a recipe.
  if (meal.recipe_id === null) {
    const isCustom = meal.title && meal.title !== "No meal";
    return (
      <div
        className={cn(
          "group relative flex items-center gap-2 min-h-[3.5rem] w-full rounded-lg p-1.5 transition-colors",
          isCustom
            ? "border border-gray-200 dark:border-zinc-800 bg-gray-100/50 dark:bg-zinc-800/50 hover:border-gray-300 dark:hover:border-zinc-700"
            : "border border-dashed border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/40"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 flex-1 min-w-0 pl-1.5",
            isCustom ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"
          )}
        >
          {isCustom ? (
            <Utensils className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" />
          ) : (
            <Ban className="w-3.5 h-3.5 shrink-0" />
          )}
          <span
            className={cn(
              "text-xs line-clamp-2",
              isCustom ? "font-medium" : "italic"
            )}
          >
            {meal.title || "No meal"}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 self-start opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
          <button
            onClick={onRepeat}
            title="Repeat on other days"
            className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onPick}
            title="Choose a meal"
            className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRemove}
            title="Clear"
            className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex items-center gap-2 min-h-[3.5rem] w-full rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 hover:border-gray-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all">
      <Link
        href={`/recipes/${meal.recipe_id}`}
        className="flex items-center gap-2 flex-1 min-w-0"
      >
        <div className="w-11 h-11 shrink-0 rounded-md overflow-hidden bg-gray-50 dark:bg-zinc-800/50 flex items-center justify-center">
          {meal.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meal.photo_url}
              alt={meal.title ?? ""}
              style={{ objectPosition: meal.photo_position || "50% 50%" }}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-lg">🍳</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-medium leading-snug line-clamp-2 text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {meal.title}
          </span>
          <span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
            {meal.servings} {meal.servings === 1 ? "serving" : "servings"}
          </span>
        </div>
      </Link>
      <div className="flex items-center gap-0.5 shrink-0 self-start opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
        <button
          onClick={onRepeat}
          title="Repeat on other days"
          className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onPick}
          title="Change"
          className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRemove}
          title="Remove"
          className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

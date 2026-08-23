import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getWeekPlan } from "@/lib/actions/meal-plan";
import { getWeekStart } from "@/lib/dates";
import MealPlanCalendar from "@/components/meal-plan/MealPlanCalendar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plan",
};

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface PlanPageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { week } = await searchParams;
  const weekProvided = !!(week && DATE_RE.test(week));
  // Normalize any provided date to its Monday; otherwise default to the current
  // week (server clock — the client re-aligns on mount if its week differs).
  const weekStart = weekProvided
    ? getWeekStart(new Date(`${week}T00:00:00`))
    : getWeekStart();

  const categories = process.env.CATEGORIES
    ? process.env.CATEGORIES.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  const plan = await getWeekPlan(weekStart);

  return (
    <div className="container mx-auto px-4 py-8">
      <MealPlanCalendar
        key={weekStart}
        weekStart={weekStart}
        weekProvided={weekProvided}
        categories={categories}
        plan={plan}
      />
    </div>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlannedMealsInRange } from "@/lib/actions/grocery";
import { addDays, getTodayISO } from "@/lib/dates";
import GroceryBuilder from "@/components/grocery/GroceryBuilder";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Groceries",
};

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface GroceryPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function GroceryPage({ searchParams }: GroceryPageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { from: rawFrom, to: rawTo } = await searchParams;
  const fromValid = !!(rawFrom && DATE_RE.test(rawFrom));
  const toValid = !!(rawTo && DATE_RE.test(rawTo));
  const rangeProvided = fromValid || toValid;

  // Default to the next 7 days (server clock; the client re-aligns on mount if its
  // local "today" differs and no explicit range was given).
  const today = getTodayISO();
  let from = fromValid ? rawFrom! : today;
  let to = toValid ? rawTo! : addDays(today, 6);
  if (to < from) {
    from = today;
    to = addDays(today, 6);
  }

  const categories = process.env.CATEGORIES
    ? process.env.CATEGORIES.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  const meals = await getPlannedMealsInRange(from, to);

  return (
    <div className="container mx-auto px-4 py-8">
      <GroceryBuilder
        key={`${from}|${to}`}
        from={from}
        to={to}
        rangeProvided={rangeProvided}
        categories={categories}
        meals={meals}
      />
    </div>
  );
}

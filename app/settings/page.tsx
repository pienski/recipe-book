import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="container mx-auto p-4 max-w-lg">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">User Settings</h1>
      
      <SettingsForm 
        email={session.user.email} 
        name={session.user.name} 
        appName={session.user.appName}
        familyName={session.user.familyName}
      />
    </main>
  );
}

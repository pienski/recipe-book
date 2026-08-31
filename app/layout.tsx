import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const session = await getServerSession(authOptions);
  const appName = session?.user?.appName || "Ginger";
  
  return {
    title: {
      default: appName,
      template: `%s | ${appName}`,
    },
    description: "A personal recipe manager for two.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

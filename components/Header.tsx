"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import appIcon from "@/app/assets/new_favicon.png";

export function Header() {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!session) return null;

  const navLinks = [
    { href: "/recipes", label: "Recipes" },
    { href: "/notes", label: "Notes" },
    { href: "/plan", label: "Plan" },
    { href: "/grocery", label: "Groceries" },
  ];

  const appName = session?.user?.appName || "Ginger";

  return (
    <header className="bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 transition-colors duration-300 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link
          href="/recipes"
          className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 min-w-0"
          title={appName}
        >
          <Image
            src={appIcon}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-md"
            priority
          />
          <span className="truncate whitespace-nowrap min-w-0">{appName}</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link 
              key={link.href}
              href={link.href} 
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/settings"
            className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap"
          >
            Settings
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2 -mr-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      <div className={cn(
        "md:hidden overflow-hidden transition-all duration-300 ease-in-out border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900",
        isMenuOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
      )}>
        <nav className="flex flex-col p-4 gap-4">
          {navLinks.map((link) => (
            <Link 
              key={link.href}
              href={link.href} 
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/settings"
            className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
            onClick={() => setIsMenuOpen(false)}
          >
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}

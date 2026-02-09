"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  Camera,
  Library,
  Download,
  Merge,
  Settings,
} from "lucide-react";

function subscribeContributor(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener("ris-settings-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("ris-settings-changed", callback);
  };
}

function getContributor() {
  return localStorage.getItem("ris_contributor_id") || "";
}

const links = [
  { href: "/capture", label: "Capture", icon: Camera },
  { href: "/library", label: "Library", icon: Library },
  { href: "/export", label: "Export", icon: Download },
  { href: "/merge", label: "Merge", icon: Merge },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function NavBar() {
  const pathname = usePathname();
  const contributor = useSyncExternalStore(
    subscribeContributor,
    getContributor,
    () => ""
  );

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold text-sm whitespace-nowrap mr-2">
          RIS Builder
        </Link>

        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors whitespace-nowrap",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function FooterBar() {
  const contributor = useSyncExternalStore(
    subscribeContributor,
    getContributor,
    () => ""
  );

  return (
    <footer className="border-t bg-background mt-auto">
      <div className="mx-auto flex h-10 max-w-5xl items-center justify-center px-4">
        <div className="text-xs text-muted-foreground truncate">
          {contributor ? (
            <span>
              Contributor: <strong>{contributor}</strong>
            </span>
          ) : (
            <Link href="/settings" className="text-destructive underline">
              Set contributor ID
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
}

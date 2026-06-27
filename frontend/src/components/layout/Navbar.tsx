"use client";

import Link from "next/link";
import { Compass, Moon, Sun, Trash2, LogOut, ChevronDown, Search, Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTravelStore } from "@/store/travel-store";
import PreferencesDialog from "@/components/settings/PreferencesDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import NotificationToast from "@/components/notifications/NotificationToast";

function NavIconButton({
  onClick,
  className,
  children,
}: {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipTrigger
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "text-muted-foreground",
        className
      )}
    >
      {children}
    </TooltipTrigger>
  );
}

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!session?.user) return null;

  const { name, email, image } = session.user;
  const initials = (name || email || "U").slice(0, 1).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-8 px-1.5 rounded-md hover:bg-muted transition-colors"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name ?? "avatar"} className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-[#146ef5] flex items-center justify-center text-white text-[10px] font-bold">
            {initials}
          </div>
        )}
        <span className="text-xs font-medium text-foreground hidden sm:block max-w-24 truncate">
          {name || email}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-52 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden py-1">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-semibold text-foreground truncate">{name}</p>
            <p className="text-[11px] text-foreground/50 truncate">{email}</p>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              setPrefsOpen(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
          >
            <Heart className="w-3.5 h-3.5 text-foreground/50" />
            Sở thích du lịch
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-foreground/50" />
            Đăng xuất
          </button>
        </div>
      )}

      <PreferencesDialog open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </div>
  );
}

export default function Navbar() {
  const [isDark, setIsDark] = useState(false);
  const clearMessages = useTravelStore((s) => s.clearMessages);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <>
      <header className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 gap-3 shrink-0 z-50">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="w-8 h-8 rounded-md bg-terracotta flex items-center justify-center">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-base tracking-tight text-foreground">
            Compa<span className="text-terracotta">sso</span>
          </span>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("travelbot:open-command-palette"))
            }
            className="hidden sm:flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Tìm nhanh</span>
            <kbd className="rounded border border-border bg-background px-1 py-0.5 text-[10px] font-medium">
              Ctrl K
            </kbd>
          </button>

          <Tooltip>
            <NavIconButton onClick={clearMessages} className="hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </NavIconButton>
            <TooltipContent>Xóa hội thoại</TooltipContent>
          </Tooltip>

          <Tooltip>
            <NavIconButton onClick={toggleTheme}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </NavIconButton>
            <TooltipContent>Chế độ {isDark ? "sáng" : "tối"}</TooltipContent>
          </Tooltip>

          <NotificationCenter />

          <div className="w-px h-5 bg-border mx-1" />

          <UserMenu />
        </div>
      </header>

      {/* Toast overlay — renders outside header */}
      <NotificationToast />
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FolderKanban,
  FileSearch,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  BookOpen,
  Settings,
  Bell,
} from "lucide-react";

import { cn, initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// ─────────────────────────────────────────────
// Navigation items
// ─────────────────────────────────────────────
const NAV_ITEMS = [
  {
    label: "Home",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    label: "Reviews",
    href: "/reviews",
    icon: FileSearch,
  },
];

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface SidebarProps {
  user: {
    name: string;
    email: string;
  };
}

// ─────────────────────────────────────────────
// Nav Link — used in both desktop + mobile
// ─────────────────────────────────────────────
function NavLink({
  item,
  isActive,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number];
  isActive: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <div className="relative">
      {/* Active indicator bar */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r-full bg-blue-600" />
      )}
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-gradient-to-r from-blue-50/80 to-indigo-50/50 text-blue-700"
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
        )}
      >
        <Icon
          className={cn(
            "h-[18px] w-[18px] shrink-0 transition-colors",
            isActive ? "text-blue-600" : "text-gray-400",
          )}
          strokeWidth={isActive ? 2.2 : 1.8}
        />
        {item.label}
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar Content (shared between desktop + mobile)
// ─────────────────────────────────────────────
function SidebarContent({
  user,
  pathname,
  onNavClick,
}: {
  user: SidebarProps["user"];
  pathname: string;
  onNavClick?: () => void;
}) {
  async function handleSignOut() {
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Logo ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-200">
          <BookOpen className="h-[18px] w-[18px] text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-bold text-gray-900 tracking-tight">
            Technical BPO
          </p>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="flex-1 space-y-1 px-3 pt-2 pb-4">
        <p className="mb-3 px-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
          Menu
        </p>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={
              pathname === item.href || pathname.startsWith(item.href + "/")
            }
            onClick={onNavClick}
          />
        ))}
      </nav>

      {/* ── Bottom Section ─────────────────────────────────────────── */}
      <div className="space-y-1 px-3 pb-2">
        <Link
          href="#"
          className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-500 transition-all hover:bg-gray-50 hover:text-gray-800"
        >
          <Settings className="h-[18px] w-[18px] text-gray-400" strokeWidth={1.8} />
          Settings
        </Link>
        <Link
          href="#"
          className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-500 transition-all hover:bg-gray-50 hover:text-gray-800"
        >
          <Bell className="h-[18px] w-[18px] text-gray-400" strokeWidth={1.8} />
          Notifications
        </Link>
      </div>

      <div className="border-t border-gray-100 mx-3" />

      {/* ── User Profile ──────────────────────────────────────────── */}
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Avatar className="h-9 w-9 shrink-0 rounded-xl">
              <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 text-xs font-semibold rounded-xl">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">
                {user.name}
              </p>
              <p className="truncate text-[11px] text-gray-400">{user.email}</p>
            </div>
            <LogOut className="h-4 w-4 shrink-0 text-gray-300 hover:text-gray-500 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); handleSignOut(); }} />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={8}
            className="w-56"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                window.location.href = "/profile";
              }}
            >
              <User className="mr-2 h-4 w-4" />
              Profile settings
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Sidebar Component
// ─────────────────────────────────────────────
export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside className="hidden lg:flex lg:w-[260px] lg:shrink-0 lg:flex-col lg:border-r lg:border-gray-100 lg:bg-white">
        <SidebarContent user={user} pathname={pathname} />
      </aside>

      {/* ── Mobile top bar + sheet ─────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3.5 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>

          <SheetContent side="left" className="w-[280px] p-0">
            {/* Close button */}
            <div className="absolute right-3 top-3 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded-xl"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <SidebarContent
              user={user}
              pathname={pathname}
              onNavClick={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Mobile logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-gray-900 tracking-tight">
            Technical BPO
          </span>
        </div>
      </div>
    </>
  );
}

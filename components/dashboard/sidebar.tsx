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
} from "lucide-react";

import { cn, initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
    label: "Dashboard",
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
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-indigo-50 text-indigo-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          isActive ? "text-indigo-600" : "text-gray-400",
        )}
      />
      {item.label}
    </Link>
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
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <BookOpen className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-gray-900">AdvisorDesk</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">
            Review System
          </p>
        </div>
      </div>

      <Separator />

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
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

      <Separator />

      {/* ── User Profile ──────────────────────────────────────────── */}
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {user.name}
              </p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
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
      <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-gray-200 lg:bg-white">
        <SidebarContent user={user} pathname={pathname} />
      </aside>

      {/* ── Mobile top bar + sheet ─────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>

          <SheetContent side="left" className="w-64 p-0">
            {/* Close button */}
            <div className="absolute right-3 top-3 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
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
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
            <BookOpen className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-gray-900">AdvisorDesk</span>
        </div>
      </div>
    </>
  );
}

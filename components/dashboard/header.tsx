"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FolderKanban,
  FileSearch,
  LogOut,
  Bell,
  Settings,
  BookOpen,
  User,
  Search,
  Menu,
  X,
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

const NAV_ITEMS = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Reviews", href: "/reviews", icon: FileSearch },
];

interface DashboardHeaderProps {
  user: {
    name: string;
    email: string;
  };
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-[100] w-full transition-all duration-300",
        scrolled
          ? "bg-white/80 backdrop-blur-xl border-b border-gray-200/50 py-2.5 shadow-sm"
          : "bg-transparent py-4"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/* ── Left: Logo & Desktop Nav ──────────────────────────────── */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-200 transition-transform group-hover:scale-105">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-black text-gray-900 tracking-tight hidden sm:block">
                Technical BPO
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative px-4 py-2 text-sm font-bold transition-all rounded-xl",
                      isActive
                        ? "text-blue-600 bg-blue-50/50"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    )}
                  >
                    {item.label}
                    {isActive && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ── Center: Search Bar (Creative Element) ─────────────────── */}
          <div className="hidden lg:flex flex-1 max-w-[240px] relative group px-2">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-gray-100/50 border-transparent focus:bg-white focus:border-blue-100 focus:ring-4 focus:ring-blue-50 transition-all rounded-2xl pl-10 pr-4 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>

          {/* ── Right: Search/Mobile/User ─────────────────────────────── */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Search (Mobile/Tablet Icon) */}
            <Button variant="ghost" size="icon" className="lg:hidden rounded-xl text-gray-500">
              <Search className="h-5 w-5" />
            </Button>

            {/* Notifications */}
            <div className="relative">
              <Button variant="ghost" size="icon" className="rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50">
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
              </Button>
            </div>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 p-1 rounded-2xl hover:bg-gray-100/80 transition-colors focus:outline-none">
                <Avatar className="h-8 w-8 rounded-xl ring-2 ring-gray-100 group-hover:ring-blue-100 transition-all">
                  <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 text-xs font-bold rounded-xl">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left mr-1">
                  <p className="text-xs font-bold text-gray-900 leading-tight truncate max-w-[100px]">
                    {user.name.split(" ")[0]}
                  </p>
                  <p className="text-[10px] text-gray-400 leading-tight">Advisor</p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-56 p-2 rounded-2xl shadow-xl border-gray-100">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal px-2 py-2">
                    <p className="text-sm font-bold text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-gray-50" />
                <DropdownMenuGroup>
                  <DropdownMenuItem className="rounded-xl focus:bg-blue-50 focus:text-blue-600 cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl focus:bg-blue-50 focus:text-blue-600 cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-gray-50" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="rounded-xl text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger
                  render={
                    <Button variant="ghost" size="icon" className="rounded-xl text-gray-500">
                      <Menu className="h-6 w-6" />
                    </Button>
                  }
                />
                <SheetContent side="top" className="p-0 border-none rounded-b-[32px] overflow-hidden">
                  <div className="bg-white p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
                          <BookOpen className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-black text-gray-900">Technical BPO</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                        <X className="h-6 w-6" />
                      </Button>
                    </div>
                    <nav className="flex flex-col gap-2">
                      {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-4 px-4 py-4 rounded-2xl text-lg font-bold transition-all",
                              isActive
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                : "text-gray-500 hover:bg-gray-50"
                            )}
                          >
                            <item.icon className="h-6 w-6" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </nav>
                    <div className="pt-4 border-t border-gray-100">
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-4 px-4 py-6 rounded-2xl text-red-600 hover:bg-red-50"
                        onClick={handleSignOut}
                      >
                        <LogOut className="h-6 w-6" />
                        Sign out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

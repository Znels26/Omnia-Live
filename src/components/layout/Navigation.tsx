"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Eye,
  Users,
  Shield,
  Clock,
  BookOpen,
  Vote,
  Coins,
  Bell,
  Settings,
  LayoutDashboard,
  Flame,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const APP_NAV: NavItem[] = [
  { href: "/watch", label: "Watch", icon: <Eye className="w-4 h-4" /> },
  { href: "/characters", label: "Characters", icon: <Users className="w-4 h-4" /> },
  { href: "/clans", label: "Clans", icon: <Shield className="w-4 h-4" /> },
  { href: "/timeline", label: "Timeline", icon: <Clock className="w-4 h-4" /> },
  { href: "/recaps", label: "Recaps", icon: <BookOpen className="w-4 h-4" /> },
  { href: "/vote", label: "Vote", icon: <Vote className="w-4 h-4" /> },
  { href: "/tokens", label: "Tokens", icon: <Coins className="w-4 h-4" /> },
  { href: "/notifications", label: "Alerts", icon: <Bell className="w-4 h-4" /> },
];

// First 5 items shown in mobile bottom nav
const MOBILE_NAV = APP_NAV.slice(0, 5);

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/admin/world", label: "World", icon: <Eye className="w-4 h-4" /> },
  { href: "/admin/characters", label: "Characters", icon: <Users className="w-4 h-4" /> },
  { href: "/admin/tokens", label: "Tokens", icon: <Coins className="w-4 h-4" /> },
  { href: "/admin/analytics", label: "Analytics", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/admin/god", label: "God Mode", icon: <Flame className="w-4 h-4" /> },
];

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const nav = isAdmin ? ADMIN_NAV : APP_NAV;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex flex-col w-[200px] min-h-screen bg-fv-surface border-r border-fv-border fixed left-0 top-0 z-30">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-fv-border">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-fv-ember to-fv-gold flex items-center justify-center glow-ember group-hover:scale-110 transition-transform">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-fv-moon text-sm tracking-wide">First Valley</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {nav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150",
                  isActive
                    ? "bg-fv-ember/15 text-fv-ember border border-fv-ember/25 font-medium"
                    : "text-fv-text-muted hover:bg-fv-card hover:text-fv-text"
                )}
              >
                <span className={cn(isActive ? "text-fv-ember" : "text-fv-text-dim")}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-2 py-4 border-t border-fv-border space-y-0.5">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 text-fv-text-muted hover:bg-fv-card hover:text-fv-text"
          >
            <Settings className="w-4 h-4 text-fv-text-dim" />
            Settings
          </Link>
          {!isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-fv-text-dim hover:bg-fv-card hover:text-fv-text transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              Admin
            </Link>
          )}
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-fv-surface border-b border-fv-border z-40 flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-fv-ember to-fv-gold flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-bold text-fv-moon text-sm">First Valley</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-fv-text-muted p-1.5 hover:text-fv-text"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-fv-surface border-r border-fv-border flex flex-col">
            <div className="px-4 py-4 border-b border-fv-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-fv-ember to-fv-gold flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-display font-bold text-fv-moon text-sm">First Valley</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-fv-text-muted hover:text-fv-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
              {nav.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-all",
                      isActive
                        ? "bg-fv-ember/15 text-fv-ember border border-fv-ember/25 font-medium"
                        : "text-fv-text-muted hover:bg-fv-card hover:text-fv-text"
                    )}
                  >
                    <span className={cn(isActive ? "text-fv-ember" : "text-fv-text-dim")}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="px-2 py-4 border-t border-fv-border space-y-0.5">
              <Link
                href="/settings"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-md text-sm text-fv-text-muted hover:bg-fv-card hover:text-fv-text transition-all"
              >
                <Settings className="w-4 h-4 text-fv-text-dim" />
                Settings
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-fv-surface border-t border-fv-border flex items-center">
        {MOBILE_NAV.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors",
                isActive ? "text-fv-ember" : "text-fv-text-dim hover:text-fv-text-muted"
              )}
            >
              <span className={cn("w-5 h-5", isActive ? "text-fv-ember" : "")}>
                {item.icon}
              </span>
              <span className="text-[10px] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function TopBar({ tokenBalance = 0, notificationCount = 0 }: {
  tokenBalance?: number;
  notificationCount?: number;
}) {
  return (
    <header className="fixed top-0 right-0 md:left-[200px] left-0 h-12 bg-fv-surface/80 backdrop-blur-sm border-b border-fv-border z-20 flex items-center justify-end px-4 gap-3 md:flex hidden">
      {/* Token balance */}
      <Link href="/tokens" className="token-badge hover:bg-fv-gold/15 transition-colors">
        <span className="text-xs">⚡</span>
        <span>{tokenBalance} tokens</span>
      </Link>

      {/* Notifications */}
      <Link href="/notifications" className="relative text-fv-text-muted hover:text-fv-text transition-colors">
        <Bell className="w-4 h-4" />
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-fv-ember rounded-full text-white text-xs flex items-center justify-center">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        )}
      </Link>

      {/* Account */}
      <Link href="/settings" className="w-7 h-7 rounded-full bg-fv-border flex items-center justify-center text-fv-text-muted hover:bg-fv-card transition-colors text-xs">
        U
      </Link>
    </header>
  );
}

export function MobileTopBar({ tokenBalance = 0, notificationCount = 0 }: {
  tokenBalance?: number;
  notificationCount?: number;
}) {
  return (
    <div className="md:hidden fixed top-0 right-0 z-40 h-12 flex items-center gap-3 px-4">
      <Link href="/tokens" className="token-badge hover:bg-fv-gold/15 transition-colors">
        <span className="text-xs">⚡</span>
        <span>{tokenBalance}</span>
      </Link>
      <Link href="/notifications" className="relative text-fv-text-muted">
        <Bell className="w-4 h-4" />
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-fv-ember rounded-full text-white text-[9px] flex items-center justify-center">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        )}
      </Link>
    </div>
  );
}

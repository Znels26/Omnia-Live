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
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
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

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/admin/world", label: "World", icon: <Eye className="w-4 h-4" /> },
  { href: "/admin/characters", label: "Characters", icon: <Users className="w-4 h-4" /> },
  { href: "/admin/tokens", label: "Tokens", icon: <Coins className="w-4 h-4" /> },
  { href: "/admin/analytics", label: "Analytics", icon: <LayoutDashboard className="w-4 h-4" /> },
];

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const nav = isAdmin ? ADMIN_NAV : APP_NAV;

  return (
    <aside className="flex flex-col w-[200px] min-h-screen bg-fv-surface border-r border-fv-border fixed left-0 top-0 z-30">
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
              {item.badge && (
                <span className="ml-auto text-xs bg-fv-ember text-white rounded-full w-4 h-4 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 py-4 border-t border-fv-border space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 text-fv-text-muted hover:bg-fv-card hover:text-fv-text"
          )}
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
  );
}

export function TopBar({ tokenBalance = 0, notificationCount = 0 }: {
  tokenBalance?: number;
  notificationCount?: number;
}) {
  return (
    <header className="fixed top-0 right-0 left-[200px] h-12 bg-fv-surface/80 backdrop-blur-sm border-b border-fv-border z-20 flex items-center justify-end px-4 gap-3">
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

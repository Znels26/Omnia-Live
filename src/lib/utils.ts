import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: Date | string, fmt = "MMM d, yyyy") {
  return format(new Date(date), fmt);
}

export function formatWorldTime(worldTime: number): string {
  const hours = Math.floor(worldTime % 24);
  const minutes = Math.floor((worldTime % 1) * 60);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export function formatWorldAge(age: string): string {
  const labels: Record<string, string> = {
    SURVIVAL: "Age of Survival",
    TRIBE_FORMATION: "Age of Tribes",
    SETTLEMENT: "Age of Settlement",
    EARLY_POLITICS: "Age of Politics",
    CIVILIZATION: "Age of Civilization",
    EXPANSION: "Age of Expansion",
    COLLAPSE: "Age of Collapse",
    RENEWAL: "Age of Renewal",
  };
  return labels[age] ?? age;
}

export function worldTickToTime(tick: number): string {
  // 1 tick = ~5 seconds real time = ~1 hour world time
  const worldHours = tick;
  const worldDays = Math.floor(worldHours / 24);
  const worldYears = Math.floor(worldDays / 365);
  const remainingDays = worldDays % 365;

  if (worldYears > 0) {
    return `Year ${worldYears}, Day ${remainingDays}`;
  }
  return `Day ${worldDays}, Hour ${worldHours % 24}`;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function generateSeed(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Seeded pseudo-random number generator
export function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function () {
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b);
    h ^= h >>> 16;
    return ((h >>> 0) / 4294967296) as number;
  };
}

export function getEventIcon(type: string): string {
  const icons: Record<string, string> = {
    BIRTH: "👶",
    DEATH: "💀",
    MARRIAGE: "💍",
    ALLIANCE: "🤝",
    WAR_DECLARED: "⚔️",
    BATTLE: "🗡️",
    PEACE_TREATY: "🕊️",
    MIGRATION: "🚶",
    FAMINE: "🌵",
    FEAST: "🍖",
    PLAGUE: "🦠",
    NATURAL_DISASTER: "🌪️",
    DISCOVERY: "🔍",
    INVENTION: "💡",
    RITUAL: "🔥",
    ELECTION: "👑",
    BETRAYAL: "🗡️",
    ASSASSINATION: "☠️",
    SETTLEMENT_FOUNDED: "🏕️",
    SETTLEMENT_DESTROYED: "💥",
    RELIGION_FOUNDED: "⭐",
    MIRACLE: "✨",
    DROUGHT: "☀️",
    FLOOD: "🌊",
    FIRE: "🔥",
    FIRST_CONTACT: "👁️",
    TRADE_ROUTE: "🛤️",
    MONUMENT_BUILT: "🗿",
    RULER_CHANGED: "👑",
    INTERVENTION: "🌟",
    VIEWER_VOTE: "🗳️",
    ERA_TRANSITION: "🌅",
    CUSTOM: "📌",
  };
  return icons[type] ?? "📌";
}

export function getEventCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    SURVIVAL: "text-amber-400",
    SOCIAL: "text-emerald-400",
    POLITICAL: "text-purple-400",
    MILITARY: "text-red-400",
    SPIRITUAL: "text-blue-400",
    NATURAL: "text-green-400",
    CULTURAL: "text-yellow-400",
    ECONOMIC: "text-orange-400",
    VIEWER: "text-fv-gold",
    GENERAL: "text-stone-400",
  };
  return colors[category] ?? "text-stone-400";
}

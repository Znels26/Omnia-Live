// The Director / Showrunner System
// Determines what matters, what to highlight, what to summarize

import { SimEvent, SimBeing, SimClan, WorldState } from "./types";
import { pickRandom, formatWorldAge } from "../utils";

export interface DirectorFocus {
  type: "being" | "clan" | "event" | "region";
  id: string;
  reason: string;
  priority: number;
}

export interface Recap {
  title: string;
  summary: string;
  highlights: Array<{
    title: string;
    description: string;
    importance: number;
  }>;
  periodStart: number;
  periodEnd: number;
}

export function scoreEventForDirector(event: SimEvent): number {
  let score = event.importance;

  // Boost for highlighted events
  if (event.highlighted) score += 20;

  // Boost for certain categories
  const categoryBoosts: Record<string, number> = {
    MILITARY: 15,
    POLITICAL: 12,
    SPIRITUAL: 10,
    SURVIVAL: 8,
    NATURAL: 10,
    CULTURAL: 6,
  };
  score += categoryBoosts[event.category] ?? 0;

  // Decay by recency (more recent = less important for recap, more for live)
  return Math.min(score, 100);
}

export function selectDirectorFocus(state: WorldState): DirectorFocus | null {
  // Find the most dramatic / interesting thing happening right now

  // Check for ongoing war
  const warringClans = state.clans.filter((c) => c.status === "AT_WAR");
  if (warringClans.length >= 2) {
    return {
      type: "clan",
      id: warringClans[0].id,
      reason: `The ${warringClans[0].name} are at war`,
      priority: 90,
    };
  }

  // Check for dying core beings
  const dyingCore = state.beings.find((b) => b.isCore && (b.status === "DYING" || b.health < 20));
  if (dyingCore) {
    return {
      type: "being",
      id: dyingCore.id,
      reason: `${dyingCore.name} is dying`,
      priority: 88,
    };
  }

  // Check for most important recent event
  const recentImportant = state.recentEvents
    .sort((a, b) => b.importance - a.importance)
    .find((e) => e.importance > 70);

  if (recentImportant) {
    return {
      type: "event",
      id: recentImportant.id,
      reason: recentImportant.title,
      priority: recentImportant.importance,
    };
  }

  // Fall back to most powerful clan
  const powerfulClan = [...state.clans].sort((a, b) => b.power - a.power)[0];
  if (powerfulClan) {
    return {
      type: "clan",
      id: powerfulClan.id,
      reason: `The ${powerfulClan.name} are the dominant force`,
      priority: 40,
    };
  }

  return null;
}

export function generateRecapText(
  events: SimEvent[],
  state: WorldState,
  type: "daily" | "weekly" | "since_last_visit"
): Recap {
  const sorted = [...events].sort((a, b) => b.importance - a.importance);
  const top = sorted.slice(0, 8);

  const highImpact = top.filter((e) => e.importance > 70);
  const notable = top.filter((e) => e.importance > 50 && e.importance <= 70);

  const ageLabel = formatWorldAge(state.age);
  const periodLabel = type === "daily"
    ? "today"
    : type === "weekly"
    ? "this week"
    : "while you were away";

  // Build narrative summary
  let summary = "";

  if (events.length === 0) {
    summary = `The valley breathes. No major events have shaken the ${ageLabel}. The clans endure.`;
  } else {
    const warEvents = events.filter((e) => e.type === "WAR_DECLARED" || e.type === "BATTLE");
    const politicEvents = events.filter((e) => e.type === "ELECTION" || e.type === "RULER_CHANGED");
    const spiritualEvents = events.filter((e) => e.type === "RITUAL" || e.type === "RELIGION_FOUNDED");

    if (warEvents.length > 0) {
      summary = `Conflict has shaped the valley ${periodLabel}. `;
    } else if (politicEvents.length > 0) {
      summary = `Power has shifted in the valley ${periodLabel}. `;
    } else if (spiritualEvents.length > 0) {
      summary = `The spirit of the valley stirred ${periodLabel}. `;
    } else {
      summary = `Life continues in the valley ${periodLabel}. `;
    }

    if (highImpact.length > 0) {
      summary += `${highImpact.length} major event${highImpact.length > 1 ? "s" : ""} have altered the course of history. `;
    }

    const population = state.beings.filter((b) => b.status === "ALIVE").length;
    const activeClanCount = state.clans.filter((c) => c.status !== "COLLAPSED").length;
    summary += `${population} souls still walk this world, across ${activeClanCount} active clans.`;
  }

  const highlights = top.map((e) => ({
    title: e.title,
    description: e.description,
    importance: e.importance,
  }));

  const titles: Record<string, string[]> = {
    daily: [
      "A Day in First Valley",
      "Today's Chronicle",
      "The Valley Report",
      "What the Day Brought",
    ],
    weekly: [
      "This Week in First Valley",
      "The Weekly Chronicle",
      "Seven Days in the Valley",
    ],
    since_last_visit: [
      "While You Were Away",
      "Since Last You Watched",
      "The Valley Did Not Wait",
      "What Happened in Your Absence",
    ],
  };

  return {
    title: pickRandom(titles[type] ?? titles.daily),
    summary,
    highlights,
    periodStart: events.length > 0 ? events[events.length - 1].tick : state.tick,
    periodEnd: state.tick,
  };
}

export function generateSinceLastVisitRecap(
  events: SimEvent[],
  state: WorldState,
  lastVisitTick: number
): string {
  const elapsed = state.tick - lastVisitTick;
  const worldDays = Math.floor(elapsed / 24);

  if (elapsed < 10) {
    return "You haven't been away long. The valley is much as you left it.";
  }

  const majorEvents = events.filter((e) => e.importance > 70);
  const deathCount = events.filter((e) => e.type === "DEATH").length;
  const warEvents = events.filter((e) => e.type === "WAR_DECLARED" || e.type === "BATTLE");

  let recap = `${worldDays} days have passed in the valley. `;

  if (majorEvents.length > 5) {
    recap += `The world moved quickly — ${majorEvents.length} major events have shaped fate. `;
  } else if (majorEvents.length > 0) {
    recap += `${majorEvents.length} turning point${majorEvents.length > 1 ? "s" : ""} marked the time. `;
  }

  if (warEvents.length > 0) {
    recap += `War touched the valley — there was bloodshed and struggle. `;
  }

  if (deathCount > 3) {
    recap += `${deathCount} souls have been lost. `;
  }

  const currentFocus = selectDirectorFocus(state);
  if (currentFocus) {
    recap += `Right now, ${currentFocus.reason}.`;
  }

  return recap;
}

export function getCurrentStoryArc(state: WorldState): {
  title: string;
  description: string;
  tension: number;
  participants: string[];
} {
  const warring = state.clans.filter((c) => c.status === "AT_WAR");
  if (warring.length >= 2) {
    return {
      title: "A War for Dominance",
      description: `The ${warring.map((c) => c.name).join(" and ")} are locked in conflict. Blood has been shed. Neither side will yield easily.`,
      tension: 90,
      participants: warring.map((c) => c.name),
    };
  }

  const dyingCore = state.beings.find((b) => b.isCore && b.health < 30);
  if (dyingCore) {
    return {
      title: "A Hero at the Edge",
      description: `${dyingCore.name} clings to life. Will they endure, or will their story end here?`,
      tension: 85,
      participants: [dyingCore.name],
    };
  }

  const alliances = state.clans.filter((c) => c.status === "IN_ALLIANCE");
  if (alliances.length >= 2) {
    return {
      title: "The Great Alliance",
      description: `The ${alliances.map((c) => c.name).join(", ")} have bound themselves together. A new power rises in the valley.`,
      tension: 60,
      participants: alliances.map((c) => c.name),
    };
  }

  const dominant = state.clans.sort((a, b) => b.power - a.power)[0];
  if (dominant) {
    return {
      title: "The Ascendancy",
      description: `The ${dominant.name} grow ever stronger. The other clans watch, wondering whether to kneel or resist.`,
      tension: 50,
      participants: [dominant.name],
    };
  }

  return {
    title: "The Quiet Valley",
    description: "An uneasy peace settles over the clans. But peace in First Valley never lasts forever.",
    tension: 25,
    participants: state.clans.map((c) => c.name),
  };
}

export function getUpcomingVoteSuggestions(state: WorldState): Array<{
  title: string;
  description: string;
  options: Array<{ id: string; label: string; description: string }>;
  tokenCost: number;
  type: string;
}> {
  const suggestions = [];

  // War/peace vote if at war
  const warring = state.clans.filter((c) => c.status === "AT_WAR");
  if (warring.length >= 2) {
    suggestions.push({
      title: `Intervention: The ${warring[0].name} War`,
      description: "The clans are locked in battle. The audience may shape fate.",
      options: [
        { id: "aid_attacker", label: `Aid the ${warring[0].name}`, description: "Supply them with food and weapons." },
        { id: "aid_defender", label: `Aid the defender`, description: "Help those who resist the aggressor." },
        { id: "broker_peace", label: "Broker peace", description: "Intervene to end the conflict." },
        { id: "let_fate_decide", label: "Let fate decide", description: "Do not interfere." },
      ],
      tokenCost: 0,
      type: "CLAN_FATE",
    });
  }

  // Leader vote
  const clan = state.clans.find((c) => c.status === "ACTIVE" && c.power > 15);
  if (clan) {
    const candidates = state.beings
      .filter((b) => b.clanId === clan.id && b.status === "ALIVE" && b.charisma > 40)
      .slice(0, 3);

    if (candidates.length > 1) {
      suggestions.push({
        title: `Who shall lead the ${clan.name}?`,
        description: `The ${clan.name} need a new direction. The audience speaks.`,
        options: candidates.map((b) => ({
          id: b.id,
          label: b.name,
          description: `${b.role}, ${b.age} years old. ${b.bravery > 60 ? "Bold" : "Cautious"} and ${b.empathy > 60 ? "compassionate" : "calculating"}.`,
        })),
        tokenCost: 0,
        type: "CHARACTER_FATE",
      });
    }
  }

  return suggestions;
}

"use client";

import { useState, useEffect, useRef } from "react";
import { WorldViewer } from "@/components/world/WorldViewer";
import { EventFeed } from "@/components/events/EventFeed";
import { WorldState, SimEvent, SimBeing, SimClan } from "@/lib/simulation/types";
import { getCurrentStoryArc, selectDirectorFocus } from "@/lib/simulation/director";
import { formatWorldAge, formatWorldTime, worldTickToTime } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DirectorArc = {
  arc_title: string;
  arc_description: string;
  tension: number;
  focus_character: string | null;
  focus_reason: string;
  omen: string;
  day: number;
} | null;

export default function WatchPage() {
  const [worldState, setWorldState] = useState<WorldState | null>(null);
  const [selectedBeing, setSelectedBeing] = useState<string | null>(null);
  const [selectedClan, setSelectedClan] = useState<string | null>(null);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [since, setSince] = useState<string | null>(null);
  const [tickStatus, setTickStatus] = useState<"ok" | "err" | "idle">("idle");
  const [directorArc, setDirectorArc] = useState<DirectorArc>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const clockRef = useRef<NodeJS.Timeout | null>(null);
  const aiTickRef = useRef<NodeJS.Timeout | null>(null);
  const directorRef = useRef<NodeJS.Timeout | null>(null);
  const worldRef = useRef<WorldState | null>(null);
  const clientTimeRef = useRef<number>(8);

  useEffect(() => {
    loadWorldState();

    // Core simulation tick every 3 seconds
    tickRef.current = setInterval(runTick, 3000);

    // Sync fresh state from DB every 8 seconds
    pollRef.current = setInterval(loadWorldState, 8000);

    // AI character decisions every 30 seconds
    aiTickRef.current = setInterval(runAITick, 30000);

    // Story director every 5 minutes
    directorRef.current = setInterval(runDirector, 5 * 60 * 1000);
    // Run director on load after a short delay
    setTimeout(runDirector, 4000);

    // Smooth client clock: 1 sim day = 12 real hours
    // Rate: 24 / (12h * 3600s/h / 0.2s per tick) = 24/216000 = 1/9000 world-hours per tick
    clockRef.current = setInterval(() => {
      clientTimeRef.current = (clientTimeRef.current + 1 / 9000) % 24;

      setWorldState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          worldTime: clientTimeRef.current,
          // tiny positional jitter so beings look continuously alive
          beings: prev.beings.map(b => {
            if (b.status === "DEAD") return b;
            const jx = (Math.random() - 0.5) * 1.5;
            const jy = (Math.random() - 0.5) * 1.5;
            return {
              ...b,
              x: Math.max(10, Math.min(790, b.x + jx)),
              y: Math.max(40, Math.min(520, b.y + jy)),
            };
          }),
        };
      });
    }, 200);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      if (clockRef.current) clearInterval(clockRef.current);
      if (aiTickRef.current) clearInterval(aiTickRef.current);
      if (directorRef.current) clearInterval(directorRef.current);
    };
  }, []);

  async function runTick() {
    try {
      const res = await fetch("/api/world/tick", { method: "POST" });
      if (!res.ok) { setTickStatus("err"); return; }
      setTickStatus("ok");
      // After tick: merge new being positions without snapping the clock
      const stateRes = await fetch("/api/world", { cache: "no-store" });
      if (!stateRes.ok) return;
      const data = await stateRes.json();
      const serverWorld: WorldState = data.world;
      // Preserve client clock — only use server worldTime to seed it on first load
      setWorldState(prev => {
        const merged = {
          ...serverWorld,
          worldTime: clientTimeRef.current,
        };
        worldRef.current = merged;
        return merged;
      });
      setEvents(data.events ?? []);
    } catch {
      setTickStatus("err");
    }
  }

  async function runAITick() {
    try {
      await fetch("/api/world/ai-tick", { method: "POST" });
    } catch {
      // Silent — AI tick is best-effort
    }
  }

  async function runDirector() {
    try {
      const res = await fetch("/api/world/director", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.arc) setDirectorArc(data.arc);
      }
    } catch {
      // Silent
    }
  }

  async function loadWorldState() {
    try {
      const res = await fetch("/api/world", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const serverWorld: WorldState = data.world;
      // Capture director arc from server if available and we don't have one yet
      if (data.directorArc && !directorArc) setDirectorArc(data.directorArc);
      // On very first load, seed client clock from server
      if (!worldRef.current) {
        clientTimeRef.current = serverWorld.worldTime;
      }
      // Merge: keep smooth client clock, use server for everything else
      const merged = {
        ...serverWorld,
        worldTime: clientTimeRef.current,
      };
      worldRef.current = merged;
      setWorldState(merged);
      setEvents(data.events ?? []);
      setSince(data.sinceLastVisit);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  const selectedBeingData = worldState?.beings.find((b) => b.id === selectedBeing);
  const selectedClanData = worldState?.clans.find((c) => c.id === selectedClan);
  const proceduralArc = worldState ? getCurrentStoryArc(worldState) : null;
  // Prefer AI director arc; fall back to procedural
  const displayArc = directorArc
    ? { title: directorArc.arc_title, description: directorArc.arc_description, tension: directorArc.tension }
    : proceduralArc
      ? { title: proceduralArc.title, description: proceduralArc.description, tension: proceduralArc.tension }
      : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-fv-base">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse-ember">🔥</div>
          <div className="font-display text-fv-moon text-xl mb-2">Loading the Valley...</div>
          <div className="text-fv-text-muted text-sm">Connecting to the living world</div>
        </div>
      </div>
    );
  }

  return (
    // h-dvh on mobile pins the whole page to the viewport — no scroll jumping when events arrive
    <div className="flex flex-col h-dvh md:flex-row md:h-[calc(100vh-48px)] bg-fv-void overflow-hidden">
      {/* ── MAIN WORLD VIEWER ────────────────────────────────────────── */}
      {/* Mobile: fixed 45% of viewport height so panel always fits below.
          Desktop: flex-1 fills the row. */}
      <div className="relative h-[45dvh] md:h-auto md:aspect-auto md:flex-1 flex-shrink-0">
        {/* Canvas fills container absolutely on both mobile and desktop */}
        <WorldViewer
          worldState={worldState}
          selectedBeing={selectedBeing}
          selectedClan={selectedClan}
          onSelectBeing={setSelectedBeing}
          onSelectClan={setSelectedClan}
          className="absolute inset-0 w-full h-full"
        />

        {/* ── Since Last Visit Banner ── */}
        {since && (
          <div className="absolute top-3 right-3 max-w-[180px] md:max-w-xs overlay-panel p-2.5 z-20 animate-fade-in">
            <div className="text-fv-gold text-xs font-display uppercase tracking-wider mb-1">
              While You Were Away
            </div>
            <p className="text-xs text-fv-text-muted leading-relaxed line-clamp-3">{since}</p>
          </div>
        )}

        {/* ── Bottom Story Arc Bar (desktop only) ── */}
        {displayArc && (
          <div className="hidden md:block absolute bottom-0 left-0 right-0 bg-gradient-to-t from-fv-void to-transparent p-4 pt-12">
            <div
              className="overlay-panel p-4 flex items-start gap-4"
              style={{
                borderColor: displayArc.tension > 70 ? "rgba(201,113,74,0.4)" : "rgba(37,37,56,1)",
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-fv-ember animate-pulse flex-shrink-0" />
                  <span className="text-xs text-fv-ember font-display uppercase tracking-wider">
                    {directorArc ? "AI Director" : "Story Arc"}
                  </span>
                  <div className="ml-auto flex-shrink-0">
                    <TensionBar tension={displayArc.tension} />
                  </div>
                </div>
                <div className="font-display text-fv-moon font-medium">{displayArc.title}</div>
                <p className="text-xs text-fv-text-muted mt-0.5 line-clamp-1">
                  {displayArc.description}
                </p>
                {directorArc?.omen && (
                  <p className="text-xs text-fv-text-dim italic mt-1 line-clamp-1">
                    {directorArc.omen}
                  </p>
                )}
              </div>
              <Button variant="token" size="sm" className="flex-shrink-0">
                Vote ⚡
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT / BOTTOM PANEL ─────────────────────────────────────── */}
      {/* flex-1 + min-h-0 lets this fill remaining dvh space on mobile without pushing the page */}
      <div className="md:w-[340px] w-full flex flex-col flex-1 min-h-0 border-t md:border-t-0 md:border-l border-fv-border bg-fv-surface overflow-hidden">
        {/* World status header */}
        <div className="px-4 py-3 border-b border-fv-border flex items-center justify-between flex-shrink-0">
          <div>
            <div className="font-display text-fv-moon text-sm font-medium flex items-center gap-2">
              {worldState?.name ?? "First Valley"}
              {/* Live pulse indicator */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: tickStatus === "err" ? "#f87171" : "#4ade80",
                  boxShadow: tickStatus !== "err" ? "0 0 6px #4ade80" : undefined,
                  animation: tickStatus !== "err" ? "pulse 2s infinite" : undefined,
                }}
                title={tickStatus === "err" ? "Simulation error" : "Simulation running"}
              />
            </div>
            <div className="text-xs text-fv-text-muted">
              {worldState ? formatWorldAge(worldState.age) : "Loading..."}
            </div>
          </div>
          {worldState && (
            <div className="text-right">
              <div className="text-xs text-fv-ember font-display">
                {formatWorldTime(worldState.worldTime)}
              </div>
              <div className="text-xs text-fv-text-dim">
                Day {worldState.day} · Year {worldState.year}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <PanelTabs
          worldState={worldState}
          events={events}
          selectedBeing={selectedBeingData ?? null}
          selectedClan={selectedClanData ?? null}
          onSelectBeing={setSelectedBeing}
          onSelectClan={setSelectedClan}
        />
      </div>
    </div>
  );
}

function TensionBar({ tension }: { tension: number }) {
  const color =
    tension > 80 ? "#f87171" : tension > 60 ? "#c9714a" : tension > 40 ? "#c9a050" : "#4ade80";

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-fv-text-dim">tension</span>
      <div className="w-16 h-1.5 bg-fv-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${tension}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

type Tab = "events" | "beings" | "clans" | "vote";

function PanelTabs({
  worldState,
  events,
  selectedBeing,
  selectedClan,
  onSelectBeing,
  onSelectClan,
}: {
  worldState: WorldState | null;
  events: SimEvent[];
  selectedBeing: SimBeing | null;
  selectedClan: SimClan | null;
  onSelectBeing: (id: string | null) => void;
  onSelectClan: (id: string | null) => void;
}) {
  const [tab, setTab] = useState<Tab>("events");

  const tabs: { id: Tab; label: string }[] = [
    { id: "events", label: "Events" },
    { id: "beings", label: "Beings" },
    { id: "clans", label: "Clans" },
    { id: "vote", label: "Vote" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-fv-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-all ${
              tab === t.id
                ? "text-fv-ember border-b-2 border-fv-ember"
                : "text-fv-text-muted hover:text-fv-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "events" && (
          <EventFeed
            events={events}
            compact={false}
            maxHeight="100%"
            autoScroll={true}
          />
        )}

        {tab === "beings" && (
          <BeingsPanel
            beings={worldState?.beings ?? []}
            clans={worldState?.clans ?? []}
            selected={selectedBeing}
            onSelect={onSelectBeing}
          />
        )}

        {tab === "clans" && (
          <ClansPanel
            clans={worldState?.clans ?? []}
            selected={selectedClan}
            onSelect={onSelectClan}
          />
        )}

        {tab === "vote" && (
          <VotePanel worldId={worldState?.id} />
        )}
      </div>
    </div>
  );
}

function BeingsPanel({
  beings,
  clans,
  selected,
  onSelect,
}: {
  beings: SimBeing[];
  clans: SimClan[];
  selected: SimBeing | null;
  onSelect: (id: string | null) => void;
}) {
  const alive = beings.filter((b) => b.status !== "DEAD");
  const core = alive.filter((b) => b.isCore);
  const background = alive.filter((b) => !b.isCore).slice(0, 20);

  return (
    <div className="p-3 space-y-2">
      {/* Selected being detail */}
      {selected && (
        <div className="fv-card p-3 mb-4 border-fv-gold/30 bg-fv-gold/5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-display font-bold text-fv-moon text-base">{selected.name}</div>
              <div className="text-xs text-fv-text-muted">
                {selected.role} · {selected.lifeStage.toLowerCase().replace("_", " ")} · Age {selected.age}
              </div>
            </div>
            <button onClick={() => onSelect(null)} className="text-fv-text-dim hover:text-fv-text text-lg">×</button>
          </div>

          {/* Stat bars */}
          <div className="space-y-2 mb-3">
            {[
              { label: "Health", value: selected.health, color: "#4ade80" },
              { label: "Hunger", value: selected.hunger, color: "#facc15" },
              { label: "Thirst", value: selected.thirst, color: "#60a5fa" },
              { label: "Happiness", value: selected.happiness, color: "#c084fc" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-fv-text-dim">{stat.label}</span>
                  <span className="text-fv-text-muted">{stat.value}%</span>
                </div>
                <div className="stat-bar">
                  <div
                    className="stat-bar-fill"
                    style={{ width: `${stat.value}%`, backgroundColor: stat.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {selected.currentAction && (
            <div className="text-xs text-fv-ember italic">Currently: {selected.currentAction}</div>
          )}

          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" className="flex-1">Follow</Button>
            <Button variant="token" size="sm" className="flex-1">Inspire ⚡</Button>
          </div>
        </div>
      )}

      {/* Core beings */}
      <div className="text-xs text-fv-text-dim uppercase tracking-wider px-1 mb-2">Core Characters</div>
      {core.map((being) => {
        const clan = clans.find((c) => c.id === being.clanId);
        return (
          <BeingRow
            key={being.id}
            being={being}
            clanColor={clan?.color ?? "#888"}
            clanName={clan?.name}
            isSelected={selected?.id === being.id}
            onClick={() => onSelect(being.id === selected?.id ? null : being.id)}
          />
        );
      })}

      {/* Background beings */}
      {background.length > 0 && (
        <>
          <div className="text-xs text-fv-text-dim uppercase tracking-wider px-1 mt-4 mb-2">Valley Folk</div>
          {background.slice(0, 15).map((being) => {
            const clan = clans.find((c) => c.id === being.clanId);
            return (
              <BeingRow
                key={being.id}
                being={being}
                clanColor={clan?.color ?? "#888"}
                clanName={clan?.name}
                isSelected={selected?.id === being.id}
                onClick={() => onSelect(being.id === selected?.id ? null : being.id)}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

function BeingRow({
  being,
  clanColor,
  clanName,
  isSelected,
  onClick,
}: {
  being: SimBeing;
  clanColor: string;
  clanName?: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusColors: Record<string, string> = {
    ALIVE: "bg-green-500",
    INJURED: "bg-yellow-500",
    SICK: "bg-orange-500",
    DYING: "bg-red-500",
    DEAD: "bg-gray-500",
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition-all ${
        isSelected
          ? "bg-fv-gold/10 border border-fv-gold/30"
          : "hover:bg-fv-card"
      }`}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs border"
        style={{ borderColor: clanColor, background: clanColor + "25" }}
      >
        {being.isCore ? "★" : being.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-fv-text font-medium truncate">{being.name}</span>
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColors[being.status]}`} />
        </div>
        <div className="text-xs text-fv-text-dim truncate">
          {being.role} · {clanName}
        </div>
      </div>
      <div className="text-xs text-fv-text-dim flex-shrink-0">
        ❤ {being.health}
      </div>
    </button>
  );
}

function ClansPanel({
  clans,
  selected,
  onSelect,
}: {
  clans: SimClan[];
  selected: SimClan | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="p-3 space-y-3">
      {clans.map((clan) => (
        <button
          key={clan.id}
          onClick={() => onSelect(clan.id === selected?.id ? null : clan.id)}
          className={`w-full p-3 rounded-lg text-left transition-all border ${
            selected?.id === clan.id
              ? "bg-fv-card-hover border-fv-border-bright"
              : "bg-fv-card border-fv-border hover:border-fv-border-bright"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-lg flex-shrink-0 border-2 flex items-center justify-center text-lg"
              style={{ borderColor: clan.color, background: clan.color + "20" }}
            >
              🛡
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-medium text-fv-moon text-sm">{clan.name}</span>
                <ClanStatusBadge status={clan.status} />
              </div>
              <div className="text-xs text-fv-text-muted mt-0.5">
                {clan.population} people · Power: {clan.power}
              </div>
              <div className="mt-2">
                <div className="text-xs text-fv-text-dim mb-1">Power</div>
                <div className="stat-bar">
                  <div
                    className="stat-bar-fill"
                    style={{
                      width: `${Math.min(clan.power, 100)}%`,
                      backgroundColor: clan.color,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ClanStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "ember" | "storm" | "forest" | "gold" | "danger" }> = {
    ACTIVE: { label: "Active", variant: "forest" },
    AT_WAR: { label: "At War", variant: "ember" },
    IN_ALLIANCE: { label: "Allied", variant: "storm" },
    DOMINANT: { label: "Dominant", variant: "gold" },
    COLLAPSED: { label: "Collapsed", variant: "danger" },
  };
  const config = map[status] ?? { label: status, variant: "forest" as const };
  return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
}

function VotePanel({ worldId }: { worldId?: string }) {
  const [votes, setVotes] = useState<Array<{
    id: string;
    title: string;
    description: string;
    options: Array<{ id: string; label: string; description: string; votes: number }>;
    tokenCost: number;
    endsAt: string;
    status: string;
  }>>([]);

  useEffect(() => {
    if (!worldId) return;
    fetch(`/api/votes?worldId=${worldId}`)
      .then((r) => r.json())
      .then((d) => setVotes(d.votes ?? []))
      .catch(() => {});
  }, [worldId]);

  if (votes.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-3xl mb-3">🗳️</div>
        <div className="text-sm text-fv-text-muted">No active votes right now.</div>
        <div className="text-xs text-fv-text-dim mt-1">Check back — the valley always needs guidance.</div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {votes.map((vote) => (
        <VoteCard key={vote.id} vote={vote} />
      ))}
    </div>
  );
}

function VoteCard({
  vote,
}: {
  vote: {
    id: string;
    title: string;
    description: string;
    options: Array<{ id: string; label: string; description: string; votes: number }>;
    tokenCost: number;
    status: string;
  };
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const totalVotes = vote.options.reduce((s, o) => s + o.votes, 0);

  async function castVote() {
    if (!selected || voted) return;
    setLoading(true);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteId: vote.id, optionId: selected }),
      });
      if (res.ok) setVoted(true);
    } catch (error) {
      console.error("Vote error:", error);
    }
    setLoading(false);
  }

  if (voted) {
    return (
      <div className="fv-card p-3">
        <div className="font-medium text-fv-text text-sm mb-2">{vote.title}</div>
        <div className="bg-green-900/20 border border-green-800/40 rounded p-3 text-center">
          <div className="text-green-400 text-xs font-medium">✓ Vote cast</div>
          <div className="text-xs text-fv-text-dim mt-0.5">The valley has received your guidance.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fv-card p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="font-medium text-fv-text text-sm">{vote.title}</div>
        {vote.tokenCost > 0 && (
          <Badge variant="gold" className="text-xs flex-shrink-0 ml-2">
            ⚡ {vote.tokenCost}
          </Badge>
        )}
      </div>
      <p className="text-xs text-fv-text-muted mb-3">{vote.description}</p>

      <div className="space-y-2">
        {vote.options.map((option) => {
          const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
          const isSelected = selected === option.id;

          return (
            <button
              key={option.id}
              onClick={() => setSelected(option.id)}
              className={`w-full p-2 rounded border text-left transition-all text-xs ${
                isSelected
                  ? "border-fv-ember bg-fv-ember/10"
                  : "border-fv-border hover:border-fv-border-bright hover:bg-fv-card"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={isSelected ? "text-fv-ember font-medium" : "text-fv-text"}>
                  {option.label}
                </span>
                <span className="text-fv-text-dim">{pct}%</span>
              </div>
              <div className="stat-bar">
                <div
                  className="stat-bar-fill"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isSelected ? "var(--fv-ember)" : "var(--fv-border-bright)",
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <Button
          variant="primary"
          size="sm"
          className="w-full mt-3"
          loading={loading}
          onClick={castVote}
        >
          {vote.tokenCost > 0 ? `Cast Vote (⚡ ${vote.tokenCost})` : "Cast Vote"}
        </Button>
      )}
    </div>
  );
}

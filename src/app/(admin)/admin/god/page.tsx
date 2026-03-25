"use client";

import { useEffect, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface WorldData {
  id: string;
  status: string;
  in_game_day: number;
  in_game_year: number;
  era: string;
  config: Record<string, unknown>;
}

interface Person {
  id: string;
  name: string;
  is_alive: boolean;
  occupation: string | null;
  health_score: number;
  is_featured: boolean;
}

interface Settlement {
  id: string;
  name: string;
  settlement_type: string;
}

interface RecentEvent {
  id: string;
  title: string;
  event_type: string;
  significance_score: number;
  in_game_day: number;
}

interface GodData {
  world: WorldData | null;
  persons: Person[];
  settlements: Settlement[];
  recentEvents: RecentEvent[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getWeatherLabel(config: Record<string, unknown>): string {
  const w = config?.weather;
  if (!w) return "clear";
  if (typeof w === "string") return w;
  if (typeof w === "object" && w !== null && "type" in w) return String((w as Record<string, unknown>).type);
  return "clear";
}

function getSeasonLabel(config: Record<string, unknown>): string {
  const s = config?.season;
  if (!s) return "spring";
  if (typeof s === "string") return s;
  if (typeof s === "object" && s !== null && "name" in s) return String((s as Record<string, unknown>).name);
  return "spring";
}

const WEATHER_ICONS: Record<string, string> = {
  clear: "☀️", rain: "🌧️", storm: "⛈️", snow: "❄️",
  drought: "🌵", fog: "🌫️", heatwave: "🔥",
};

const EVENT_ICONS: Record<string, string> = {
  BIRTH: "👶", DEATH: "💀", MARRIAGE: "💍", CONFLICT: "⚔️",
  WEATHER: "🌩️", PLAGUE: "🦠", FAMINE: "🌾", CUSTOM: "📜", default: "📌",
};

// ---------------------------------------------------------------------------
// God Mode Page
// ---------------------------------------------------------------------------
export default function GodModePage() {
  const [data, setData] = useState<GodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedSettlementId, setSelectedSettlementId] = useState("");
  const [warClanA, setWarClanA] = useState("");
  const [warClanB, setWarClanB] = useState("");
  const [warReason, setWarReason] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/god");
    if (res.ok) {
      const json = await res.json() as GodData;
      setData(json);
      if (!selectedPersonId && json.persons?.length) {
        const alive = json.persons.find((p) => p.is_alive);
        if (alive) setSelectedPersonId(alive.id);
      }
      if (!selectedSettlementId && json.settlements?.length) {
        setSelectedSettlementId(json.settlements[0].id);
      }
    }
    setLoading(false);
  }, [selectedPersonId, selectedSettlementId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function act(action: string, payload?: Record<string, unknown>) {
    setToast(null);
    const res = await fetch("/api/admin/god", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const json = await res.json() as { message?: string; error?: string };
    setToast({ text: json.message ?? json.error ?? (res.ok ? "Done" : "Failed"), ok: res.ok });
    if (res.ok) fetchData();
    setTimeout(() => setToast(null), 3500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-fv-text-muted text-sm animate-pulse">Loading world state...</div>
      </div>
    );
  }

  const world = data?.world;
  const alivePeople = (data?.persons ?? []).filter((p) => p.is_alive);
  const deadCount = (data?.persons ?? []).length - alivePeople.length;
  const settlements = data?.settlements ?? [];
  const recentEvents = data?.recentEvents ?? [];
  const weather = world ? getWeatherLabel(world.config) : "clear";
  const season = world ? getSeasonLabel(world.config) : "spring";
  const selectedPerson = alivePeople.find((p) => p.id === selectedPersonId);
  const selectedSettlement = settlements.find((s) => s.id === selectedSettlementId);

  return (
    <div className="min-h-screen" style={{ background: "var(--fv-base)" }}>
      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg border transition-all"
          style={{
            background: toast.ok ? "rgba(20,40,20,0.95)" : "rgba(40,10,10,0.95)",
            borderColor: toast.ok ? "rgba(60,180,80,0.4)" : "rgba(220,60,60,0.4)",
            color: toast.ok ? "#5fd87a" : "#f87171",
            backdropFilter: "blur(12px)",
          }}
        >
          {toast.ok ? "✓" : "✗"} {toast.text}
        </div>
      )}

      <div className="px-4 py-5 max-w-2xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">⚡</span>
            <h1 className="font-display text-2xl font-bold text-fv-moon">God Mode</h1>
          </div>
          <p className="text-fv-text-muted text-sm">Direct control over First Valley</p>
        </div>

        {/* ── World Pulse (live stats strip) ──────────────────────────── */}
        {world && (
          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: "var(--fv-card)", border: "1px solid var(--fv-border)" }}
          >
            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <Stat label="Day" value={`${world.in_game_day}`} sub={`Year ${world.in_game_year}`} />
              <Stat label="Alive" value={`${alivePeople.length}`} sub={`${deadCount} dead`} />
              <Stat label="Weather" value={WEATHER_ICONS[weather] ?? "☀️"} sub={weather} />
            </div>

            <div className="flex gap-2 flex-wrap mb-3">
              <span
                className="px-2.5 py-1 rounded-full text-xs font-display uppercase tracking-wide"
                style={{
                  background: world.status === "active" ? "rgba(60,180,80,0.15)" : "rgba(240,160,40,0.15)",
                  color: world.status === "active" ? "#5fd87a" : "#facc15",
                  border: `1px solid ${world.status === "active" ? "rgba(60,180,80,0.3)" : "rgba(240,160,40,0.3)"}`,
                }}
              >
                {world.status === "active" ? "● Live" : "⏸ Paused"}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs" style={{ background: "var(--fv-surface)", color: "var(--fv-text-muted)", border: "1px solid var(--fv-border)" }}>
                {world.era}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs capitalize" style={{ background: "var(--fv-surface)", color: "var(--fv-text-muted)", border: "1px solid var(--fv-border)" }}>
                {season}
              </span>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Btn onClick={() => act("RESUME_WORLD")} variant="success" sm>▶ Resume</Btn>
              <Btn onClick={() => act("PAUSE_WORLD")} variant="warn" sm>⏸ Pause</Btn>
              <Btn
                onClick={() => { if (confirm("Reset world to Day 1, Year 1?")) act("RESTART_WORLD"); }}
                variant="danger" sm
              >
                ↺ Restart
              </Btn>
            </div>
          </div>
        )}

        {/* ── Recent Events (what's actually happening) ────────────────── */}
        {recentEvents.length > 0 && (
          <Section title="What's Happening Now" icon="📖">
            <div className="space-y-2">
              {recentEvents.slice(0, 6).map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2.5 py-2"
                  style={{ borderBottom: "1px solid var(--fv-border)" }}
                >
                  <span className="text-base flex-shrink-0 mt-0.5">
                    {EVENT_ICONS[ev.event_type] ?? EVENT_ICONS.default}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fv-text leading-snug">{ev.title}</p>
                    <p className="text-xs text-fv-text-dim mt-0.5">Day {ev.in_game_day} · score {ev.significance_score}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Character Control ─────────────────────────────────────────── */}
        <Section title="Characters" icon="👤">
          <div className="mb-3">
            <label className="text-xs text-fv-text-muted uppercase tracking-wide block mb-2">
              Select ({alivePeople.length} alive)
            </label>
            <select
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={{ background: "var(--fv-surface)", border: "1px solid var(--fv-border)", color: "var(--fv-text)" }}
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
            >
              {alivePeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.occupation ?? "No role"} · HP {Math.round(p.health_score)}
                  {p.is_featured ? " ★" : ""}
                </option>
              ))}
            </select>

            {/* Selected person quick info */}
            {selectedPerson && (
              <div
                className="mt-2 px-3 py-2 rounded-lg text-xs flex gap-4"
                style={{ background: "var(--fv-surface)", border: "1px solid var(--fv-border)" }}
              >
                <span className="text-fv-text-muted">Health: <span className={selectedPerson.health_score < 30 ? "text-red-400" : "text-fv-success"}>{Math.round(selectedPerson.health_score)}</span></span>
                <span className="text-fv-text-muted">Role: <span className="text-fv-text">{selectedPerson.occupation ?? "None"}</span></span>
                {selectedPerson.is_featured && <span className="text-fv-gold">★ Featured</span>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => { if (confirm(`Kill ${selectedPerson?.name}?`)) act("KILL_CHARACTER", { personId: selectedPersonId }); }} variant="danger" disabled={!selectedPersonId}>
              💀 Kill
            </Btn>
            <Btn onClick={() => act("HEAL_CHARACTER", { personId: selectedPersonId })} variant="success" disabled={!selectedPersonId}>
              💚 Heal
            </Btn>
            <Btn onClick={() => act("FEATURE_CHARACTER", { personId: selectedPersonId, featured: true })} variant="default" disabled={!selectedPersonId}>
              ★ Feature
            </Btn>
            <Btn onClick={() => act("FEATURE_CHARACTER", { personId: selectedPersonId, featured: false })} variant="default" disabled={!selectedPersonId}>
              ☆ Unfeature
            </Btn>
          </div>
        </Section>

        {/* ── Weather ───────────────────────────────────────────────────── */}
        <Section title="Weather" icon={WEATHER_ICONS[weather] ?? "🌤️"}>
          <p className="text-xs text-fv-text-muted mb-3">Currently: <span className="text-fv-text capitalize">{weather}</span></p>
          <div className="grid grid-cols-3 gap-2">
            {["clear", "rain", "storm", "snow", "drought", "fog", "heatwave"].map((w) => (
              <Btn key={w} onClick={() => act("SET_WEATHER", { weather: w })} variant={weather === w ? "success" : "default"} sm>
                {WEATHER_ICONS[w]} {w}
              </Btn>
            ))}
          </div>
        </Section>

        {/* ── Season & Time ─────────────────────────────────────────────── */}
        <Section title="Season & Time" icon="🌱">
          <div className="mb-3">
            <p className="text-xs text-fv-text-muted mb-2">Season</p>
            <div className="grid grid-cols-4 gap-2">
              {[["spring","🌱"],["summer","☀️"],["autumn","🍂"],["winter","❄️"]].map(([s, icon]) => (
                <Btn key={s} onClick={() => act("SET_SEASON", { season: s })} variant={season === s ? "success" : "default"} sm>
                  {icon} {s}
                </Btn>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-fv-text-muted mb-2">Jump to time</p>
            <div className="grid grid-cols-4 gap-2">
              {[["Dawn","🌅",6],["Noon","☀️",12],["Dusk","🌆",19],["Night","🌙",23]].map(([label, icon, h]) => (
                <Btn key={label} onClick={() => act("SET_WORLD_TIME", { hour: h })} variant="default" sm>
                  {icon} {label}
                </Btn>
              ))}
            </div>
          </div>
        </Section>

        {/* ── War & Conflict ────────────────────────────────────────────── */}
        <Section title="War & Conflict" icon="⚔️">
          <p className="text-xs text-fv-text-muted mb-3">Declare open conflict between two groups in the valley</p>
          <div className="space-y-2 mb-3">
            <input
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--fv-surface)", border: "1px solid var(--fv-border)", color: "var(--fv-text)" }}
              placeholder="First group / clan name..."
              value={warClanA}
              onChange={(e) => setWarClanA(e.target.value)}
            />
            <input
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--fv-surface)", border: "1px solid var(--fv-border)", color: "var(--fv-text)" }}
              placeholder="Second group / clan name..."
              value={warClanB}
              onChange={(e) => setWarClanB(e.target.value)}
            />
            <input
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--fv-surface)", border: "1px solid var(--fv-border)", color: "var(--fv-text)" }}
              placeholder="Reason (optional — e.g. water rights, territory...)"
              value={warReason}
              onChange={(e) => setWarReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Btn
              onClick={() => act("START_WAR", { clanA: warClanA, clanB: warClanB, reason: warReason || "territorial dispute" })}
              variant="danger"
              disabled={!warClanA || !warClanB}
            >
              ⚔️ Declare War
            </Btn>
            <Btn onClick={() => act("END_WAR")} variant="warn">
              🕊️ End War
            </Btn>
          </div>
        </Section>

        {/* ── Clan Boost ────────────────────────────────────────────────── */}
        <Section title="Clan Boost" icon="🏘️">
          <p className="text-xs text-fv-text-muted mb-3">Fully restore health and morale for everyone in a settlement</p>
          <select
            className="w-full rounded-lg px-3 py-2.5 text-sm mb-3"
            style={{ background: "var(--fv-surface)", border: "1px solid var(--fv-border)", color: "var(--fv-text)" }}
            value={selectedSettlementId}
            onChange={(e) => setSelectedSettlementId(e.target.value)}
          >
            {settlements.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.settlement_type})
              </option>
            ))}
          </select>
          {selectedSettlement && (
            <Btn
              onClick={() => act("BOOST_CLAN", { settlementId: selectedSettlementId })}
              variant="success"
              disabled={!selectedSettlementId}
            >
              ⚡ Bless {selectedSettlement.name}
            </Btn>
          )}
        </Section>

        {/* ── Disasters ─────────────────────────────────────────────────── */}
        <Section title="Disasters" icon="💀">
          <p className="text-xs text-fv-text-muted mb-3">Unleash catastrophe on the valley</p>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[["mild","🦠 Mild Plague"],["moderate","🦠 Plague"],["severe","🦠 Severe Plague"]].map(([sev, label]) => (
                <Btn key={sev} onClick={() => act("TRIGGER_PLAGUE", { severity: sev })} variant="danger" sm>
                  {label}
                </Btn>
              ))}
            </div>
            <Btn onClick={() => act("TRIGGER_FAMINE")} variant="danger">
              🌾 Trigger Famine
            </Btn>
          </div>
        </Section>

        {/* ── Custom Event ──────────────────────────────────────────────── */}
        <Section title="Inject Event" icon="📜">
          <p className="text-xs text-fv-text-muted mb-3">Write any event into the world&apos;s history right now</p>
          <div className="space-y-2">
            <input
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--fv-surface)", border: "1px solid var(--fv-border)", color: "var(--fv-text)" }}
              placeholder="Event headline..."
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              rows={3}
              style={{ background: "var(--fv-surface)", border: "1px solid var(--fv-border)", color: "var(--fv-text)" }}
              placeholder="What happened? Write it like a story beat..."
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
            />
            <Btn
              onClick={() => {
                act("CREATE_EVENT", { title: customTitle, description: customDesc, significance: 75 });
                setCustomTitle("");
                setCustomDesc("");
              }}
              variant="default"
              disabled={!customTitle || !customDesc}
            >
              📜 Inject into history
            </Btn>
          </div>
        </Section>

        <div className="h-20" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny UI primitives
// ---------------------------------------------------------------------------

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-xs text-fv-text-dim uppercase tracking-wide mb-0.5">{label}</div>
      <div className="font-display font-bold text-lg text-fv-moon leading-none">{value}</div>
      <div className="text-xs text-fv-text-muted mt-0.5">{sub}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4 mb-3"
      style={{ background: "var(--fv-card)", border: "1px solid var(--fv-border)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icon}</span>
        <h2 className="font-display font-semibold text-sm text-fv-text uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </div>
  );
}

type BtnVariant = "default" | "danger" | "warn" | "success";

function Btn({
  children,
  onClick,
  variant = "default",
  disabled = false,
  sm = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  sm?: boolean;
}) {
  const styles: Record<BtnVariant, React.CSSProperties> = {
    default: { background: "var(--fv-surface)", border: "1px solid var(--fv-border)", color: "var(--fv-text)" },
    danger:  { background: "rgba(180,40,40,0.2)", border: "1px solid rgba(220,60,60,0.4)", color: "#f87171" },
    warn:    { background: "rgba(180,120,20,0.2)", border: "1px solid rgba(240,160,40,0.35)", color: "#facc15" },
    success: { background: "rgba(30,120,60,0.2)", border: "1px solid rgba(60,180,80,0.35)", color: "#5fd87a" },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-display font-medium uppercase tracking-wide transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed active:scale-95 ${sm ? "px-2 py-1.5 text-[10px]" : "w-full px-3 py-2.5 text-xs"}`}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

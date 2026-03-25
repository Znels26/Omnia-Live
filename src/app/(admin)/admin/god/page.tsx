"use client";

import { useEffect, useState } from "react";

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

interface GodData {
  world: WorldData | null;
  persons: Person[];
  settlements: Settlement[];
}

// ---------------------------------------------------------------------------
// God Mode Page
// ---------------------------------------------------------------------------
export default function GodModePage() {
  const [data, setData] = useState<GodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [warClanA, setWarClanA] = useState("");
  const [warClanB, setWarClanB] = useState("");
  const [warReason, setWarReason] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedSettlementId, setSelectedSettlementId] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch("/api/admin/god");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.persons?.length) setSelectedPersonId(json.persons.find((p: Person) => p.is_alive)?.id ?? "");
        if (json.settlements?.length) setSelectedSettlementId(json.settlements[0]?.id ?? "");
      }
    } finally {
      setLoading(false);
    }
  }

  async function godAction(action: string, payload?: Record<string, unknown>) {
    setMessage(null);
    try {
      const res = await fetch("/api/admin/god", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ text: json.message ?? "Done", ok: true });
        await fetchData();
      } else {
        setMessage({ text: json.error ?? "Failed", ok: false });
      }
    } catch {
      setMessage({ text: "Network error", ok: false });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-fv-text-muted text-sm animate-pulse">Loading God Mode...</div>
      </div>
    );
  }

  const world = data?.world;
  const persons = data?.persons ?? [];
  const settlements = data?.settlements ?? [];
  const alivePeople = persons.filter((p) => p.is_alive);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-fv-moon mb-1 flex items-center gap-3">
          <span>⚡</span> God Mode
        </h1>
        <p className="text-fv-text-muted text-sm">Direct control over the First Valley simulation</p>
      </div>

      {/* Status message */}
      {message && (
        <div
          className="mb-6 px-4 py-3 rounded-lg text-sm font-medium border"
          style={{
            background: message.ok ? "rgba(60,180,80,0.1)" : "rgba(220,60,60,0.1)",
            borderColor: message.ok ? "rgba(60,180,80,0.3)" : "rgba(220,60,60,0.3)",
            color: message.ok ? "#5fd87a" : "#f87171",
          }}
        >
          {message.text}
        </div>
      )}

      {/* World status */}
      {world && (
        <GodCard title="World State" icon="🌍">
          <div className="flex items-center gap-6 mb-4 flex-wrap text-sm">
            <span className="text-fv-text-muted">
              Status: <span className={world.status === "active" ? "text-fv-success" : "text-fv-warning"}>{world.status}</span>
            </span>
            <span className="text-fv-text-muted">Year <span className="text-fv-text">{world.in_game_year}</span></span>
            <span className="text-fv-text-muted">Day <span className="text-fv-text">{world.in_game_day}</span></span>
            <span className="text-fv-text-muted">Era: <span className="text-fv-text">{world.era}</span></span>
            <span className="text-fv-text-muted">Weather: <span className="text-fv-text">{String(world.config?.weather ?? "clear")}</span></span>
          </div>
          <div className="flex gap-3 flex-wrap">
            <GodButton onClick={() => godAction("RESUME_WORLD")} variant="success">▶ Resume</GodButton>
            <GodButton onClick={() => godAction("PAUSE_WORLD")} variant="warn">⏸ Pause</GodButton>
            <GodButton
              onClick={() => {
                if (confirm("Restart the world? This resets Day/Year to 1. Persons and events remain.")) {
                  godAction("RESTART_WORLD");
                }
              }}
              variant="danger"
            >
              ↺ Restart World
            </GodButton>
          </div>
        </GodCard>
      )}

      {/* Season & Time */}
      <GodCard title="World Time & Season" icon="☀️">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-fv-text-muted uppercase tracking-wide mb-2 block">Season</label>
            <div className="flex gap-2 flex-wrap">
              {["spring", "summer", "autumn", "winter"].map((s) => (
                <GodButton key={s} onClick={() => godAction("SET_SEASON", { season: s })} variant="default">
                  {s}
                </GodButton>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-fv-text-muted uppercase tracking-wide mb-2 block">Time of Day</label>
            <div className="flex gap-2 flex-wrap">
              {[{ label: "Dawn", h: 6 }, { label: "Noon", h: 12 }, { label: "Dusk", h: 19 }, { label: "Night", h: 23 }].map(({ label, h }) => (
                <GodButton key={label} onClick={() => godAction("SET_WORLD_TIME", { hour: h })} variant="default">
                  {label}
                </GodButton>
              ))}
            </div>
          </div>
        </div>
      </GodCard>

      {/* Weather */}
      <GodCard title="Weather Control" icon="🌩️">
        <div className="flex gap-2 flex-wrap">
          {["clear", "rain", "storm", "snow", "drought", "fog", "heatwave"].map((w) => (
            <GodButton key={w} onClick={() => godAction("SET_WEATHER", { weather: w })} variant="default">
              {w}
            </GodButton>
          ))}
        </div>
      </GodCard>

      {/* Wars */}
      <GodCard title="War & Conflict" icon="⚔️">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <input
            className="fv-input text-sm"
            placeholder="Clan A name"
            value={warClanA}
            onChange={(e) => setWarClanA(e.target.value)}
          />
          <input
            className="fv-input text-sm"
            placeholder="Clan B name"
            value={warClanB}
            onChange={(e) => setWarClanB(e.target.value)}
          />
          <input
            className="fv-input text-sm"
            placeholder="Reason (optional)"
            value={warReason}
            onChange={(e) => setWarReason(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <GodButton
            onClick={() => godAction("START_WAR", { clanA: warClanA, clanB: warClanB, reason: warReason || undefined })}
            variant="danger"
            disabled={!warClanA || !warClanB}
          >
            ⚔️ Declare War
          </GodButton>
          <GodButton onClick={() => godAction("END_WAR")} variant="warn">
            🕊️ End War
          </GodButton>
        </div>
      </GodCard>

      {/* Disasters */}
      <GodCard title="Disasters & Calamities" icon="💀">
        <div className="flex gap-3 flex-wrap">
          {["mild", "moderate", "severe"].map((sev) => (
            <GodButton
              key={sev}
              onClick={() => godAction("TRIGGER_PLAGUE", { severity: sev })}
              variant="danger"
            >
              🦠 {sev} Plague
            </GodButton>
          ))}
          <GodButton onClick={() => godAction("TRIGGER_FAMINE")} variant="danger">
            🌾 Famine
          </GodButton>
        </div>
      </GodCard>

      {/* Character actions */}
      <GodCard title="Character Control" icon="👤">
        <div className="mb-3">
          <label className="text-xs text-fv-text-muted uppercase tracking-wide mb-2 block">
            Select Character ({alivePeople.length} alive)
          </label>
          <select
            className="fv-input text-sm w-full max-w-xs"
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
          >
            {alivePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.occupation ?? "Unknown"} (HP: {Math.round(p.health_score)})
                {p.is_featured ? " ★" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 flex-wrap">
          <GodButton
            onClick={() => {
              if (confirm("Kill this character?")) godAction("KILL_CHARACTER", { personId: selectedPersonId });
            }}
            variant="danger"
            disabled={!selectedPersonId}
          >
            💀 Kill
          </GodButton>
          <GodButton
            onClick={() => godAction("HEAL_CHARACTER", { personId: selectedPersonId })}
            variant="success"
            disabled={!selectedPersonId}
          >
            💚 Heal
          </GodButton>
          <GodButton
            onClick={() => godAction("FEATURE_CHARACTER", { personId: selectedPersonId, featured: true })}
            variant="default"
            disabled={!selectedPersonId}
          >
            ★ Feature
          </GodButton>
          <GodButton
            onClick={() => godAction("FEATURE_CHARACTER", { personId: selectedPersonId, featured: false })}
            variant="default"
            disabled={!selectedPersonId}
          >
            ☆ Unfeature
          </GodButton>
        </div>
      </GodCard>

      {/* Clan boost */}
      <GodCard title="Clan Boost" icon="🏘️">
        <div className="mb-3">
          <label className="text-xs text-fv-text-muted uppercase tracking-wide mb-2 block">Select Settlement</label>
          <select
            className="fv-input text-sm w-full max-w-xs"
            value={selectedSettlementId}
            onChange={(e) => setSelectedSettlementId(e.target.value)}
          >
            {settlements.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.settlement_type})
              </option>
            ))}
          </select>
        </div>
        <GodButton
          onClick={() => godAction("BOOST_CLAN", { settlementId: selectedSettlementId })}
          variant="success"
          disabled={!selectedSettlementId}
        >
          ⚡ Boost Clan (full health & happiness)
        </GodButton>
      </GodCard>

      {/* Custom event */}
      <GodCard title="Inject Custom Event" icon="📜">
        <div className="space-y-3">
          <input
            className="fv-input text-sm w-full"
            placeholder="Event title..."
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
          />
          <textarea
            className="fv-input text-sm w-full h-20 resize-none"
            placeholder="Event description..."
            value={customDesc}
            onChange={(e) => setCustomDesc(e.target.value)}
          />
          <GodButton
            onClick={() => {
              godAction("CREATE_EVENT", { title: customTitle, description: customDesc, significance: 75 });
              setCustomTitle("");
              setCustomDesc("");
            }}
            variant="default"
            disabled={!customTitle || !customDesc}
          >
            📜 Inject Event
          </GodButton>
        </div>
      </GodCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------

function GodCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div
      className="mb-4 rounded-xl p-5"
      style={{ background: "var(--fv-card)", border: "1px solid var(--fv-border)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{icon}</span>
        <h2 className="font-display font-semibold text-sm text-fv-text uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </div>
  );
}

type ButtonVariant = "default" | "danger" | "warn" | "success";

function GodButton({
  children,
  onClick,
  variant = "default",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  const styles: Record<ButtonVariant, React.CSSProperties> = {
    default: { background: "var(--fv-surface)", border: "1px solid var(--fv-border)", color: "var(--fv-text)" },
    danger:  { background: "rgba(220,60,60,0.15)", border: "1px solid rgba(220,60,60,0.4)", color: "#f87171" },
    warn:    { background: "rgba(240,160,40,0.12)", border: "1px solid rgba(240,160,40,0.35)", color: "#facc15" },
    success: { background: "rgba(60,180,80,0.12)", border: "1px solid rgba(60,180,80,0.35)", color: "#5fd87a" },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-lg text-xs font-medium font-display uppercase tracking-wide transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-125"
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

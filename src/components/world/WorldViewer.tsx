"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { WorldState, SimBeing, SimClan, SimSettlement, SimEvent } from "@/lib/simulation/types";
import {
  getSkyColor,
  getAmbientLight,
  getDayNightProgress,
  getWeatherDescription,
  getSeasonDescription,
} from "@/lib/simulation/world";
import { getBeingStatusColor } from "@/lib/simulation/beings";
import { formatWorldTime } from "@/lib/utils";

interface WorldViewerProps {
  worldState: WorldState | null;
  selectedBeing?: string | null;
  selectedClan?: string | null;
  onSelectBeing?: (id: string | null) => void;
  onSelectClan?: (id: string | null) => void;
  onSelectEvent?: (event: SimEvent) => void;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
  color: string;
}

interface Bird {
  x: number; y: number;
  vx: number; vy: number;
  phase: number; size: number;
}

interface CanvasNote {
  id: string; text: string;
  x: number; y: number;
  offsetY: number;
  opacity: number;
  color: string;
}

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 560;

export function WorldViewer({
  worldState,
  selectedBeing,
  selectedClan,
  onSelectBeing,
  onSelectClan,
  onSelectEvent,
  className = "",
}: WorldViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef<number>(0);
  const [hoveredBeing, setHoveredBeing] = useState<SimBeing | null>(null);
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });
  const worldStateRef = useRef<WorldState | null>(null);
  const birdsRef = useRef<Bird[]>([]);
  const posCacheRef = useRef<Map<string, { cx: number; cy: number; tx: number; ty: number }>>(new Map());
  const notesRef = useRef<CanvasNote[]>([]);
  const knownEventIdsRef = useRef<Set<string>>(new Set());

  worldStateRef.current = worldState;

  const getScale = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { sx: 1, sy: 1 };
    return {
      sx: canvas.width / WORLD_WIDTH,
      sy: canvas.height / WORLD_HEIGHT,
    };
  }, []);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = worldStateRef.current;
    timeRef.current += 0.016;
    const t = timeRef.current;

    const W = canvas.width;
    const H = canvas.height;
    const scaleX = W / WORLD_WIDTH;
    const scaleY = H / WORLD_HEIGHT;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // ── Sky Background ──────────────────────────────────────────
    const worldTime = state?.worldTime ?? 8;
    const skyColor = getSkyColor(worldTime, state?.weather ?? { type: "clear", intensity: 0.3, temperature: 20, windSpeed: 0.2 });
    const ambientLight = getAmbientLight(worldTime);

    const skyGradient = ctx.createLinearGradient(0, 0, 0, H);
    skyGradient.addColorStop(0, skyColor);
    skyGradient.addColorStop(1, adjustColor(skyColor, -30));
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, W, H);

    // ── Stars (night time) ──────────────────────────────────────
    if (worldTime < 6 || worldTime > 20) {
      const starOpacity = worldTime < 5 || worldTime > 21 ? 0.8 : 0.4;
      ctx.fillStyle = `rgba(255, 255, 240, ${starOpacity})`;
      const starPositions = [
        [50, 40], [150, 60], [250, 30], [380, 50], [480, 25],
        [600, 45], [700, 30], [100, 90], [320, 75], [550, 80],
        [750, 55], [200, 45], [430, 70], [650, 35],
      ];
      for (const [sx, sy] of starPositions) {
        const twinkle = 0.5 + 0.5 * Math.sin(t * 2 + sx * 0.1);
        ctx.globalAlpha = starOpacity * (0.5 + 0.5 * twinkle);
        const r = 1 + twinkle * 0.5;
        ctx.beginPath();
        ctx.arc(sx * scaleX, sy * scaleY, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ── Sun / Moon ───────────────────────────────────────────────
    const dayProgress = getDayNightProgress(worldTime);
    const celestialX = (dayProgress * WORLD_WIDTH * 1.2 - WORLD_WIDTH * 0.1) * scaleX;
    const celestialY = (100 - Math.sin(dayProgress * Math.PI) * 80) * scaleY;

    if (worldTime >= 5 && worldTime <= 20) {
      // Sun
      const sunGlow = ctx.createRadialGradient(celestialX, celestialY, 0, celestialX, celestialY, 60 * scaleX);
      sunGlow.addColorStop(0, "rgba(255, 230, 150, 0.3)");
      sunGlow.addColorStop(1, "rgba(255, 150, 50, 0)");
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(celestialX, celestialY, 60 * scaleX, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffe89a";
      ctx.beginPath();
      ctx.arc(celestialX, celestialY, 14 * scaleX, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Moon
      ctx.fillStyle = "rgba(220, 215, 200, 0.9)";
      ctx.beginPath();
      ctx.arc(celestialX, celestialY, 10 * scaleX, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Birds ─────────────────────────────────────────────────────
    drawBirds(ctx, birdsRef.current, W, H, scaleX, scaleY, t, ambientLight);

    // ── Mountains (background) ───────────────────────────────────
    drawMountains(ctx, W, H, scaleX, scaleY, ambientLight);

    // ── Ground plane — covers the lower 55% with a grass gradient ──
    {
      const horizonY = H * 0.42;
      const groundGrad = ctx.createLinearGradient(0, horizonY, 0, H);
      const gBase = ambientLight > 0.5
        ? `rgba(38,58,28,${0.5 + ambientLight * 0.3})`
        : `rgba(18,28,14,${0.4 + ambientLight * 0.3})`;
      const gEdge = ambientLight > 0.5
        ? `rgba(28,42,20,${0.6 + ambientLight * 0.2})`
        : `rgba(10,16,8,0.7)`;
      groundGrad.addColorStop(0, gBase);
      groundGrad.addColorStop(1, gEdge);
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, horizonY, W, H - horizonY);
    }

    // ── Clan Territories ─────────────────────────────────────────
    if (state?.clans && state?.beings && state?.settlements) {
      drawClanTerritories(ctx, state, scaleX, scaleY, ambientLight);
    }

    // ── Regions / Terrain ─────────────────────────────────────────
    if (state?.regions) {
      for (const region of state.regions) {
        drawRegion(ctx, region, scaleX, scaleY, ambientLight, t);
      }
    }

    // ── Settlements ───────────────────────────────────────────────
    if (state?.settlements) {
      for (const settlement of state.settlements) {
        const clan = state.clans.find((c) => c.id === settlement.clanId);
        drawSettlement(ctx, settlement, clan?.color ?? "#8b4513", scaleX, scaleY, ambientLight, t);
      }
    }

    // ── Beings ────────────────────────────────────────────────────
    if (state?.beings) {
      const alive = state.beings.filter((b) => b.status !== "DEAD");
      const cache = posCacheRef.current;

      // Lerp cached display positions toward current targets each frame
      for (const being of alive) {
        const pos = cache.get(being.id);
        if (pos) {
          pos.cx += (pos.tx - pos.cx) * 0.06;
          pos.cy += (pos.ty - pos.cy) * 0.06;
        }
      }

      for (const being of alive) {
        const isSelected = being.id === selectedBeing;
        const isHovered = being.id === hoveredBeing?.id;
        const clan = state.clans.find((c) => c.id === being.clanId);
        const pos = cache.get(being.id);
        const drawX = pos ? pos.cx : being.x;
        const drawY = pos ? pos.cy : being.y;
        drawBeing(ctx, being, clan?.color ?? "#888", scaleX, scaleY, ambientLight, t, isSelected, isHovered, drawX, drawY);
      }
    }

    // ── Canvas Event Notifications ────────────────────────────────
    notesRef.current = notesRef.current.filter(n => n.opacity > 0.02);
    for (const note of notesRef.current) {
      note.opacity = Math.max(0, note.opacity - 0.0025); // ~7 second fade
      note.offsetY += 0.3; // float upward
    }
    drawCanvasNotes(ctx, notesRef.current, scaleX, scaleY);

    // ── Weather Effects ───────────────────────────────────────────
    const weather = state?.weather ?? { type: "clear", intensity: 0.3, temperature: 20, windSpeed: 0.2 };
    drawWeather(ctx, weather, W, H, t, particlesRef, scaleX, scaleY);

    // ── Day/Night Overlay ──────────────────────────────────────────
    if (ambientLight < 0.7) {
      const nightOpacity = (0.7 - ambientLight) * 0.85;
      ctx.fillStyle = `rgba(8, 8, 30, ${nightOpacity})`;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Fog Effect ────────────────────────────────────────────────
    if (weather.type === "fog") {
      const fogOpacity = 0.25 + Math.sin(t * 0.3) * 0.05;
      ctx.fillStyle = `rgba(180, 175, 190, ${fogOpacity * weather.intensity})`;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Vignette ──────────────────────────────────────────────────
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
    vignette.addColorStop(0, "transparent");
    vignette.addColorStop(1, "rgba(3, 3, 10, 0.7)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [selectedBeing, hoveredBeing]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
    });

    resizeObserver.observe(canvas);

    // Initial size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    birdsRef.current = Array.from({ length: 7 }, () => ({
      x: Math.random() * WORLD_WIDTH,
      y: 15 + Math.random() * 90,
      vx: 0.25 + Math.random() * 0.35,
      vy: (Math.random() - 0.5) * 0.04,
      phase: Math.random() * Math.PI * 2,
      size: 2.5 + Math.random() * 1.5,
    }));
  }, []);

  useEffect(() => {
    if (!worldState) return;
    const cache = posCacheRef.current;
    for (const being of worldState.beings) {
      if (being.status === 'DEAD') continue;
      const existing = cache.get(being.id);
      if (existing) {
        existing.tx = being.x;
        existing.ty = being.y;
      } else {
        cache.set(being.id, { cx: being.x, cy: being.y, tx: being.x, ty: being.y });
      }
    }
  }, [worldState]);

  useEffect(() => {
    const events = worldState?.recentEvents;
    if (!events?.length) return;
    const known = knownEventIdsRef.current;
    const newEvents = events.filter(e => !known.has(e.id));
    if (!newEvents.length) return;

    for (const e of newEvents) known.add(e.id);

    // Spawn canvas notifications for notable new events
    const toSpawn = newEvents.filter(e => e.importance >= 35).slice(0, 2);
    for (const e of toSpawn) {
      const being = e.beingId ? worldState?.beings.find(b => b.id === e.beingId) : null;
      const pos = being ? posCacheRef.current.get(being.id) : null;
      const nx = pos ? pos.cx : being ? being.x : 300 + Math.random() * 200;
      const ny = pos ? pos.cy : being ? being.y : 200 + Math.random() * 150;
      notesRef.current.push({
        id: e.id,
        text: e.title.length > 32 ? e.title.slice(0, 32) + '…' : e.title,
        x: nx,
        y: ny,
        offsetY: 0,
        opacity: 1,
        color: e.importance >= 70 ? '#c9a050' : 'rgba(200,195,185,0.9)',
      });
    }
    // Cap at 4 simultaneous notifications
    if (notesRef.current.length > 4) {
      notesRef.current = notesRef.current.slice(-4);
    }
  }, [worldState?.recentEvents]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const state = worldStateRef.current;
      if (!state?.beings) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = ((e.clientX - rect.left) / rect.width) * WORLD_WIDTH;
      const canvasY = ((e.clientY - rect.top) / rect.height) * WORLD_HEIGHT;

      const found = state.beings.find((b) => {
        if (b.status === "DEAD") return false;
        const dx = b.x - canvasX;
        const dy = b.y - canvasY;
        return Math.sqrt(dx * dx + dy * dy) < 15;
      });

      setHoveredBeing(found ?? null);
      setHoveredPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    []
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const state = worldStateRef.current;
      if (!state?.beings) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = ((e.clientX - rect.left) / rect.width) * WORLD_WIDTH;
      const canvasY = ((e.clientY - rect.top) / rect.height) * WORLD_HEIGHT;

      const found = state.beings.find((b) => {
        if (b.status === "DEAD") return false;
        const dx = b.x - canvasX;
        const dy = b.y - canvasY;
        return Math.sqrt(dx * dx + dy * dy) < 15;
      });

      if (found) {
        onSelectBeing?.(found.id === selectedBeing ? null : found.id);
      } else {
        onSelectBeing?.(null);
        // Check clan settlement click
        const settlement = state.settlements.find((s) => {
          const dx = s.x - canvasX;
          const dy = s.y - canvasY;
          return Math.sqrt(dx * dx + dy * dy) < 30;
        });
        if (settlement?.clanId) {
          onSelectClan?.(settlement.clanId);
        }
      }
    },
    [selectedBeing, onSelectBeing, onSelectClan]
  );

  return (
    <div className={`relative world-viewport ${className}`} style={{ background: "#03030a" }}>
      <canvas
        ref={canvasRef}
        className="world-canvas cursor-crosshair"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={() => setHoveredBeing(null)}
        style={{ width: "100%", height: "100%" }}
      />

      {/* Being tooltip */}
      {hoveredBeing && (
        <div
          className="absolute pointer-events-none z-20 fv-panel px-3 py-2 text-xs"
          style={{
            left: hoveredPos.x + 16,
            top: hoveredPos.y - 10,
            minWidth: 160,
          }}
        >
          <div className="font-display font-medium text-fv-moon text-sm">{hoveredBeing.name}</div>
          <div className="text-fv-text-muted mt-0.5">{hoveredBeing.role} · {hoveredBeing.age}y</div>
          {hoveredBeing.currentAction && (
            <div className="text-fv-ember mt-1 italic">{hoveredBeing.currentAction}</div>
          )}
          <div className="flex gap-2 mt-1.5">
            <span className="text-fv-text-dim">❤ {hoveredBeing.health}%</span>
            <span className="text-fv-text-dim">🍖 {hoveredBeing.hunger}%</span>
          </div>
        </div>
      )}

      {/* World info overlay */}
      {worldState && (
        <div className="absolute top-3 left-3 overlay-panel px-3 py-2 text-xs space-y-0.5 z-10">
          <div className="font-display text-fv-moon text-sm font-medium">
            {worldState.name}
          </div>
          <div className="text-fv-text-muted">
            ⏱ {formatWorldTime(worldState.worldTime)} · Day {worldState.day ?? 1} · Year {worldState.year ?? 1}
          </div>
          <div className="text-fv-ember-bright">
            {getWeatherDescription(worldState.weather)}
          </div>
          <div className="text-fv-text-dim capitalize">
            {worldState.season?.name} · {worldState.beings.filter(b => b.status === "ALIVE").length} souls
          </div>
        </div>
      )}

      {/* Legend */}
      {worldState && (
        <div className="absolute bottom-3 left-3 overlay-panel px-3 py-2 text-xs space-y-1 z-10">
          <div className="text-fv-text-dim text-xs uppercase tracking-wider mb-1">Clans</div>
          {worldState.clans.map((clan) => (
            <div key={clan.id} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: clan.color }}
              />
              <span className="text-fv-text-muted">{clan.name}</span>
              <span className="text-fv-text-dim ml-auto">{clan.population}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Drawing Helpers ───────────────────────────────────────────

function drawMountains(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  scaleX: number,
  scaleY: number,
  ambientLight: number
) {
  // Far mountain range
  const farPeaks: [number, number][] = [
    [0, 0.45], [0.05, 0.25], [0.12, 0.15], [0.2, 0.21],
    [0.3, 0.1], [0.38, 0.19], [0.48, 0.12], [0.57, 0.2],
    [0.67, 0.08], [0.76, 0.16], [0.85, 0.22], [0.93, 0.13],
    [1, 0.28],
  ];

  ctx.fillStyle = `rgba(38, 36, 52, ${0.55 * ambientLight + 0.2})`;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.45);
  for (const [px, py] of farPeaks) ctx.lineTo(W * px, H * py);
  ctx.lineTo(W, H * 0.5);
  ctx.closePath();
  ctx.fill();

  // Snow caps on far peaks
  ctx.fillStyle = `rgba(230, 228, 240, ${0.4 * ambientLight + 0.1})`;
  for (const [px, py] of farPeaks.slice(1, -1)) {
    if (py < 0.22) {
      const capH = (0.22 - py) * H * 0.55;
      const baseW = capH * 0.9;
      ctx.beginPath();
      ctx.moveTo(W * px, H * py);
      ctx.lineTo(W * px - baseW * 0.5, H * py + capH);
      ctx.lineTo(W * px + baseW * 0.5, H * py + capH);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Near mountain range (darker, in front)
  const nearPeaks: [number, number][] = [
    [0, 0.5], [0.07, 0.35], [0.18, 0.27], [0.28, 0.35],
    [0.38, 0.22], [0.48, 0.33], [0.6, 0.25], [0.72, 0.38],
    [0.82, 0.28], [0.92, 0.34], [1, 0.4],
  ];

  ctx.fillStyle = `rgba(24, 22, 36, ${0.65 * ambientLight + 0.15})`;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.5);
  for (const [px, py] of nearPeaks) ctx.lineTo(W * px, H * py);
  ctx.lineTo(W, H * 0.5);
  ctx.closePath();
  ctx.fill();

  // Snow caps on near peaks
  ctx.fillStyle = `rgba(220, 218, 235, ${0.35 * ambientLight + 0.08})`;
  for (const [px, py] of nearPeaks.slice(1, -1)) {
    if (py < 0.3) {
      const capH = (0.3 - py) * H * 0.45;
      const baseW = capH * 0.85;
      ctx.beginPath();
      ctx.moveTo(W * px, H * py);
      ctx.lineTo(W * px - baseW * 0.5, H * py + capH);
      ctx.lineTo(W * px + baseW * 0.5, H * py + capH);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawRegion(
  ctx: CanvasRenderingContext2D,
  region: { x: number; y: number; width: number; height: number; color: string; name: string; type: string; fertility: number },
  scaleX: number,
  scaleY: number,
  ambientLight: number,
  t: number
) {
  const x = region.x * scaleX;
  const y = region.y * scaleY;
  const w = region.width * scaleX;
  const h = region.height * scaleY;

  // Terrain base
  const baseColor = region.color;
  const lightColor = adjustBrightness(baseColor, ambientLight * 0.8 + 0.1);

  ctx.globalAlpha = 0.6;
  ctx.fillStyle = lightColor;
  ctx.beginPath();

  // Rounded irregular shape
  const rx = w * 0.5;
  const ry = h * 0.5;
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Forest: proper pine tree silhouettes
  if (region.type === "FOREST") {
    const treePositions: [number, number][] = [];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + i * 0.3;
      const dist = (0.2 + (i % 3) * 0.25) * Math.min(rx, ry);
      treePositions.push([
        x + Math.cos(angle) * dist,
        y + Math.sin(angle) * dist * 0.6,
      ]);
    }
    for (const [tx, ty] of treePositions) {
      const treeH = (12 + ((tx * 7 + ty * 3) % 6)) * scaleX;
      const sway = Math.sin(t * 0.8 + tx * 0.05) * 0.5 * scaleX;
      // Trunk
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = "#3d2b1a";
      ctx.fillRect(tx - 1.2 * scaleX + sway * 0.3, ty, 2.4 * scaleX, treeH * 0.35);
      // Layers of foliage
      for (let layer = 0; layer < 3; layer++) {
        const ly = ty - layer * treeH * 0.28;
        const lw = treeH * (0.7 - layer * 0.18);
        ctx.globalAlpha = 0.5 - layer * 0.05;
        ctx.fillStyle = layer === 0 ? "#1a4220" : layer === 1 ? "#1e5228" : "#246030";
        ctx.beginPath();
        ctx.moveTo(tx + sway, ly - treeH * 0.5);
        ctx.lineTo(tx - lw * 0.5 + sway * 0.5, ly);
        ctx.lineTo(tx + lw * 0.5 + sway * 0.5, ly);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // River effect for river basin
  if (region.type === "RIVER_BASIN") {
    ctx.globalAlpha = 0.55;
    const riverGrad = ctx.createLinearGradient(x - rx * 0.3, y, x + rx * 0.3, y);
    riverGrad.addColorStop(0, "#2a6ab5");
    riverGrad.addColorStop(0.5, "#4a9fd9");
    riverGrad.addColorStop(1, "#2a6ab5");
    ctx.strokeStyle = riverGrad;
    ctx.lineWidth = 5 * scaleX;
    ctx.lineCap = "round";
    const flow = Math.sin(t * 0.5) * 5 * scaleX;
    ctx.beginPath();
    ctx.moveTo(x - rx * 0.4 + flow, y - h * 0.25);
    ctx.bezierCurveTo(
      x - rx * 0.1 + flow, y + h * 0.05,
      x + rx * 0.1 - flow, y + h * 0.15,
      x + rx * 0.4 - flow, y + h * 0.3
    );
    ctx.stroke();
    // Shimmer
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = "rgba(200,230,255,0.8)";
    ctx.lineWidth = 2 * scaleX;
    ctx.beginPath();
    ctx.moveTo(x - rx * 0.38 + flow, y - h * 0.22);
    ctx.bezierCurveTo(
      x - rx * 0.08 + flow, y + h * 0.06,
      x + rx * 0.08 - flow, y + h * 0.17,
      x + rx * 0.38 - flow, y + h * 0.28
    );
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  // Region label
  ctx.fillStyle = `rgba(220, 210, 200, ${0.5 * ambientLight + 0.1})`;
  ctx.font = `${10 * scaleX}px var(--font-display, Georgia, serif)`;
  ctx.textAlign = "center";
  ctx.fillText(region.name, x, y + 4 * scaleY);
}

function drawSettlement(
  ctx: CanvasRenderingContext2D,
  settlement: { x: number; y: number; type: string; name: string; population: number },
  clanColor: string,
  scaleX: number,
  scaleY: number,
  ambientLight: number,
  t: number
) {
  const x = settlement.x * scaleX;
  const y = settlement.y * scaleY;
  const s = Math.min(scaleX, scaleY);

  const sizeMap: Record<string, number> = {
    CAMP: 6, HAMLET: 10, VILLAGE: 15, TOWN: 22, CITY: 30, FORTRESS: 26, RUINS: 16,
  };
  const size = (sizeMap[settlement.type] ?? 10) * s;

  // Night glow
  if (ambientLight < 0.7) {
    const glowR = size * 4;
    const fireGlow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    const intensity = (0.7 - ambientLight) * 0.6;
    fireGlow.addColorStop(0, `rgba(220, 110, 30, ${intensity})`);
    fireGlow.addColorStop(1, "rgba(200, 70, 10, 0)");
    ctx.fillStyle = fireGlow;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();
  }

  const wallColor = lightenColor(clanColor, 0.2 * ambientLight + 0.05);
  const roofColor = adjustBrightness(clanColor, 0.45 + 0.25 * ambientLight);
  ctx.strokeStyle = adjustBrightness(clanColor, 0.35);
  ctx.lineWidth = 1 * s;

  if (settlement.type === "CAMP") {
    // 2-3 tents
    for (let i = -1; i <= 1; i++) {
      const tx = x + i * size * 0.9;
      const th = size * (i === 0 ? 1.2 : 0.9);
      ctx.fillStyle = i === 0 ? wallColor : adjustBrightness(clanColor, 0.5);
      ctx.beginPath();
      ctx.moveTo(tx, y - th);
      ctx.lineTo(tx - th * 0.7, y + th * 0.3);
      ctx.lineTo(tx + th * 0.7, y + th * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

  } else if (settlement.type === "FORTRESS") {
    // Thick walls
    ctx.fillStyle = wallColor;
    ctx.fillRect(x - size, y - size * 0.8, size * 2, size * 1.6);
    ctx.strokeRect(x - size, y - size * 0.8, size * 2, size * 1.6);
    // Corner towers
    for (const [tx, ty] of [[x - size, y - size * 0.8], [x + size, y - size * 0.8]] as [number, number][]) {
      ctx.fillStyle = lightenColor(clanColor, 0.1);
      ctx.fillRect(tx - size * 0.22, ty - size * 0.4, size * 0.44, size * 1.2);
      ctx.strokeRect(tx - size * 0.22, ty - size * 0.4, size * 0.44, size * 1.2);
      // Battlements
      for (let bi = 0; bi < 3; bi++) {
        ctx.fillStyle = wallColor;
        ctx.fillRect(tx - size * 0.22 + bi * size * 0.15, ty - size * 0.55, size * 0.1, size * 0.18);
      }
    }
    // Gate
    ctx.fillStyle = "rgba(10,8,5,0.7)";
    ctx.beginPath();
    ctx.arc(x, y + size * 0.2, size * 0.22, Math.PI, 0);
    ctx.rect(x - size * 0.22, y + size * 0.2, size * 0.44, size * 0.4);
    ctx.fill();

  } else if (settlement.type === "RUINS") {
    // Crumbled walls
    ctx.fillStyle = "rgba(90,80,70,0.6)";
    const ruinPts: [number, number, number, number][] = [
      [x - size, y, size * 0.35, size * 0.7],
      [x - size * 0.3, y - size * 0.5, size * 0.3, size * 0.5],
      [x + size * 0.4, y - size * 0.3, size * 0.4, size * 0.55],
      [x + size * 0.1, y, size * 0.5, size * 0.35],
    ];
    for (const [rx, ry, rw, rh] of ruinPts) {
      ctx.fillRect(rx, ry, rw, rh);
    }

  } else {
    // Village / Hamlet / Town / City — cluster of houses
    const houseCount = settlement.type === "CITY" ? 9 : settlement.type === "TOWN" ? 6 : settlement.type === "VILLAGE" ? 4 : 2;
    const angles = Array.from({ length: houseCount }, (_, i) => (i / houseCount) * Math.PI * 2);
    const spread = size * 0.75;

    for (let i = 0; i < houseCount; i++) {
      const hx = i === 0 ? x : x + Math.cos(angles[i]) * spread;
      const hy = i === 0 ? y : y + Math.sin(angles[i]) * spread * 0.7;
      const hw = size * (i === 0 ? 0.55 : 0.38);
      const hh = size * (i === 0 ? 0.5 : 0.35);
      const roofH = hh * 0.7;

      // Walls
      ctx.fillStyle = i === 0 ? wallColor : adjustBrightness(clanColor, 0.55 + 0.2 * ambientLight);
      ctx.strokeStyle = adjustBrightness(clanColor, 0.35);
      ctx.fillRect(hx - hw, hy - hh * 0.5, hw * 2, hh);
      ctx.strokeRect(hx - hw, hy - hh * 0.5, hw * 2, hh);

      // Roof (triangle)
      ctx.fillStyle = roofColor;
      ctx.beginPath();
      ctx.moveTo(hx, hy - hh * 0.5 - roofH);
      ctx.lineTo(hx - hw * 1.1, hy - hh * 0.5);
      ctx.lineTo(hx + hw * 1.1, hy - hh * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Window
      ctx.fillStyle = ambientLight < 0.5 ? "rgba(255, 200, 80, 0.7)" : "rgba(160,140,100,0.5)";
      ctx.fillRect(hx - hw * 0.25, hy - hh * 0.25, hw * 0.5, hh * 0.35);

      // Chimney smoke
      if (i === 0 || i === 1) {
        const chimneyX = hx + hw * 0.5;
        const chimneyBaseY = hy - hh * 0.5 - roofH * 0.55;
        ctx.strokeStyle = adjustBrightness(clanColor, 0.4);
        ctx.lineWidth = 1.5 * s;
        ctx.strokeRect(chimneyX - 1.5 * s, chimneyBaseY - 3 * s, 3 * s, 3 * s);

        // Animated smoke puffs
        const smokeAlpha = ambientLight < 0.6 ? 0.45 : 0.2;
        for (let p = 0; p < 3; p++) {
          const pAge = ((t * 0.4 + p * 0.33 + settlement.x * 0.01) % 1);
          const px = chimneyX + Math.sin(pAge * 5 + p) * 3 * s;
          const py = chimneyBaseY - pAge * 18 * s;
          const pr = (2 + pAge * 4) * s;
          ctx.globalAlpha = smokeAlpha * (1 - pAge);
          ctx.fillStyle = "rgba(180,170,165,1)";
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1 * s;
      }
    }
  }

  // Central fire for camps at night
  if (settlement.type === "CAMP" && ambientLight < 0.6) {
    const flicker = Math.sin(t * 9 + settlement.x) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 140, 30, ${0.8 * flicker})`;
    ctx.beginPath();
    ctx.arc(x, y + size * 0.15, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 220, 80, ${0.9 * flicker})`;
    ctx.beginPath();
    ctx.arc(x, y + size * 0.1, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Label
  const labelY = y + size + 13 * s;
  ctx.save();
  ctx.font = `${10 * s}px var(--font-display, Georgia, serif)`;
  ctx.textAlign = "center";
  const lw = ctx.measureText(settlement.name).width;
  ctx.fillStyle = "rgba(5,5,15,0.55)";
  rrect(ctx, x - lw / 2 - 3, labelY - 9, lw + 6, 11, 2);
  ctx.fill();
  ctx.fillStyle = `rgba(220, 210, 190, ${0.6 * ambientLight + 0.3})`;
  ctx.fillText(settlement.name, x, labelY);
  ctx.restore();
}

function drawBeing(
  ctx: CanvasRenderingContext2D,
  being: { id: string; x: number; y: number; status: string; isCore: boolean; name: string; currentAction: string | null },
  clanColor: string,
  scaleX: number,
  scaleY: number,
  ambientLight: number,
  t: number,
  isSelected: boolean,
  isHovered: boolean,
  drawX?: number,
  drawY?: number
) {
  const x = (drawX ?? being.x) * scaleX;
  const y = (drawY ?? being.y) * scaleY;
  const seed = being.x * 0.37 + being.y * 0.19;
  const walkCycle = t * 2.5 + seed;
  const bobY = Math.sin(walkCycle) * 1.2 * scaleY;
  const legSwing = Math.sin(walkCycle) * 0.35;
  const armSwing = Math.sin(walkCycle + Math.PI) * 0.3;

  // Scale for core vs regular
  const s = (being.isCore ? 1.5 : 1.0) * Math.min(scaleX, scaleY);

  // Head radius, body measurements
  const headR = 4 * s;
  const shoulderY = y + bobY + headR * 2.2;
  const hipY = shoulderY + 9 * s;
  const groundY = hipY + 9 * s;
  const cx = x;
  const headY = y + bobY;

  // Glow for core beings
  if (being.isCore) {
    const glow = ctx.createRadialGradient(cx, headY, 0, cx, headY, headR * 5);
    glow.addColorStop(0, `${clanColor}55`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, headY, headR * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Selection ring (ground)
  if (isSelected) {
    ctx.strokeStyle = "#c9a050";
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.ellipse(cx, groundY, headR * 2.5, headR * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Hover ring (ground)
  if (isHovered && !isSelected) {
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.ellipse(cx, groundY, headR * 2.2, headR * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.globalAlpha = Math.min(1, 0.6 + ambientLight * 0.4);

  const strokeW = Math.max(1.2, 1.5 * s);
  ctx.lineWidth = strokeW;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Shadow / ground dot
  ctx.globalAlpha = Math.min(1, 0.6 + ambientLight * 0.4) * 0.3;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 1 * s, headR * 1.6, headR * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = Math.min(1, 0.6 + ambientLight * 0.4);

  // Legs
  ctx.strokeStyle = adjustBrightness(clanColor, 0.65);
  // Left leg
  ctx.beginPath();
  ctx.moveTo(cx - 2 * s, hipY);
  const lLegMidX = cx - 2 * s + Math.sin(legSwing) * 3 * s;
  const lLegMidY = hipY + 5 * s;
  ctx.quadraticCurveTo(lLegMidX, lLegMidY, cx - 2 * s + Math.sin(legSwing) * 4 * s, groundY);
  ctx.stroke();
  // Right leg
  ctx.beginPath();
  ctx.moveTo(cx + 2 * s, hipY);
  const rLegMidX = cx + 2 * s + Math.sin(-legSwing) * 3 * s;
  ctx.quadraticCurveTo(rLegMidX, hipY + 5 * s, cx + 2 * s + Math.sin(-legSwing) * 4 * s, groundY);
  ctx.stroke();

  // Body
  ctx.strokeStyle = clanColor;
  ctx.beginPath();
  ctx.moveTo(cx, shoulderY);
  ctx.lineTo(cx, hipY);
  ctx.stroke();

  // Arms
  ctx.strokeStyle = adjustBrightness(clanColor, 0.75);
  const armLen = 6 * s;
  // Left arm
  ctx.beginPath();
  ctx.moveTo(cx, shoulderY + 2 * s);
  ctx.lineTo(cx - armLen + Math.sin(armSwing) * 3 * s, shoulderY + armLen + Math.sin(armSwing) * 2 * s);
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.moveTo(cx, shoulderY + 2 * s);
  ctx.lineTo(cx + armLen + Math.sin(-armSwing) * 3 * s, shoulderY + armLen + Math.sin(-armSwing) * 2 * s);
  ctx.stroke();

  // Head
  const headColor = lightenColor(clanColor, 0.4);
  ctx.fillStyle = headColor;
  ctx.strokeStyle = adjustBrightness(clanColor, 0.5);
  ctx.lineWidth = strokeW * 0.8;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eyes (tiny dots for core beings)
  if (being.isCore) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(cx - headR * 0.32, headY - headR * 0.1, headR * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + headR * 0.32, headY - headR * 0.1, headR * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Name label (always for core, only on hover/select for others)
  if (being.isCore || isSelected || isHovered) {
    const labelY = headY - headR - 5 * s;
    ctx.save();
    ctx.font = `${being.isCore ? 10 : 8}px var(--font-display, Georgia, serif)`;
    ctx.textAlign = "center";
    const tw = ctx.measureText(being.name).width;
    ctx.fillStyle = "rgba(8,8,20,0.7)";
    rrect(ctx, cx - tw / 2 - 3, labelY - 10, tw + 6, 13, 3);
    ctx.fill();
    ctx.fillStyle = being.isCore ? "#e8d5a0" : "rgba(220,210,200,0.9)";
    ctx.fillText(being.name, cx, labelY);
    ctx.restore();
  }

  // Action bubble for selected/hovered
  if ((isSelected || isHovered) && being.currentAction) {
    const bubbleY = headY - headR - 24 * s;
    ctx.save();
    ctx.font = `italic ${8}px var(--font-body, sans-serif)`;
    ctx.textAlign = "center";
    const tw = Math.min(ctx.measureText(being.currentAction).width, 100);
    ctx.fillStyle = "rgba(8,8,20,0.75)";
    rrect(ctx, cx - tw / 2 - 4, bubbleY - 10, tw + 8, 12, 4);
    ctx.fill();
    ctx.fillStyle = "#c8a060";
    // Trim long actions
    const action = being.currentAction.length > 22 ? being.currentAction.slice(0, 22) + "…" : being.currentAction;
    ctx.fillText(action, cx, bubbleY);
    ctx.restore();
  }
}

function drawWeather(
  ctx: CanvasRenderingContext2D,
  weather: { type: string; intensity: number; windSpeed: number },
  W: number,
  H: number,
  t: number,
  particlesRef: React.MutableRefObject<Particle[]>,
  scaleX: number,
  scaleY: number
) {
  if (weather.type === "rain" || weather.type === "storm") {
    // Rain drops
    const count = Math.floor(weather.intensity * 80);
    ctx.strokeStyle = `rgba(160, 180, 220, ${weather.intensity * 0.4})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      const x = ((t * 30 * weather.windSpeed + i * 37) % (W + 40)) - 20;
      const y = (t * 200 * (1 + weather.windSpeed * 0.5) + i * 71) % (H + 40);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4 * weather.windSpeed, y + 12);
      ctx.stroke();
    }
  }

  if (weather.type === "snow") {
    ctx.fillStyle = `rgba(240, 240, 255, ${weather.intensity * 0.6})`;
    const count = Math.floor(weather.intensity * 50);
    for (let i = 0; i < count; i++) {
      const x = ((t * 15 * (1 + Math.sin(i)) + i * 53) % W);
      const y = (t * 40 + i * 83) % H;
      const size = 2 + Math.sin(i * 1.3) * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (weather.type === "fog") {
    for (let i = 0; i < 5; i++) {
      const x = ((t * 8 * (1 + i * 0.2) + i * 200) % (W + 200)) - 100;
      const y = H * 0.4 + i * H * 0.08;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 200);
      grad.addColorStop(0, `rgba(170, 165, 180, ${weather.intensity * 0.15})`);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(x - 200, y - 100, 400, 200);
    }
  }
}

function adjustColor(cssColor: string, amount: number): string {
  try {
    const match = cssColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return cssColor;
    const r = Math.max(0, Math.min(255, parseInt(match[1]) + amount));
    const g = Math.max(0, Math.min(255, parseInt(match[2]) + amount));
    const b = Math.max(0, Math.min(255, parseInt(match[3]) + amount));
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return cssColor;
  }
}

function adjustBrightness(hexColor: string, factor: number): string {
  try {
    const hex = hexColor.replace("#", "");
    const r = Math.round(parseInt(hex.slice(0, 2), 16) * factor);
    const g = Math.round(parseInt(hex.slice(2, 4), 16) * factor);
    const b = Math.round(parseInt(hex.slice(4, 6), 16) * factor);
    return `rgb(${Math.max(0, Math.min(255, r))}, ${Math.max(0, Math.min(255, g))}, ${Math.max(0, Math.min(255, b))})`;
  } catch {
    return hexColor;
  }
}

function lightenColor(hexColor: string, amount: number): string {
  try {
    const hex = hexColor.replace("#", "");
    const r = Math.round(parseInt(hex.slice(0, 2), 16) * (1 + amount));
    const g = Math.round(parseInt(hex.slice(2, 4), 16) * (1 + amount));
    const b = Math.round(parseInt(hex.slice(4, 6), 16) * (1 + amount));
    return `rgb(${Math.max(0, Math.min(255, r))}, ${Math.max(0, Math.min(255, g))}, ${Math.max(0, Math.min(255, b))})`;
  } catch {
    return hexColor;
  }
}

function darkenColor(hexColor: string, amount: number): string {
  return adjustBrightness(hexColor, amount);
}

function drawBirds(
  ctx: CanvasRenderingContext2D,
  birds: Bird[],
  W: number,
  H: number,
  scaleX: number,
  scaleY: number,
  t: number,
  ambientLight: number
) {
  if (ambientLight < 0.25) return; // no birds at night
  ctx.save();
  ctx.strokeStyle = `rgba(25, 20, 15, ${0.25 + ambientLight * 0.35})`;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  for (const bird of birds) {
    bird.phase += 0.12;
    bird.x += bird.vx;
    bird.y += bird.vy + Math.sin(bird.phase) * 0.25;
    if (bird.x > WORLD_WIDTH + 20) bird.x = -20;
    bird.y = Math.max(12, Math.min(WORLD_HEIGHT * 0.38, bird.y));
    const bx = bird.x * scaleX;
    const by = bird.y * scaleY;
    const wing = Math.sin(bird.phase) * bird.size * 0.45;
    const s = bird.size * scaleX;
    ctx.beginPath();
    ctx.moveTo(bx - s, by + wing);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + s, by + wing);
    ctx.stroke();
  }
  ctx.restore();
}

function drawClanTerritories(
  ctx: CanvasRenderingContext2D,
  state: { clans: Array<{ id: string; color: string }>; beings: Array<{ id: string; clanId: string | null; x: number; y: number; status: string }>; settlements: Array<{ clanId: string | null; x: number; y: number }> },
  scaleX: number,
  scaleY: number,
  ambientLight: number
) {
  for (const clan of state.clans) {
    const points: Array<{ x: number; y: number }> = [
      ...state.beings
        .filter(b => b.clanId === clan.id && b.status !== 'DEAD')
        .map(b => ({ x: b.x * scaleX, y: b.y * scaleY })),
      ...state.settlements
        .filter(s => s.clanId === clan.id)
        .map(s => ({ x: s.x * scaleX, y: s.y * scaleY })),
    ];
    if (points.length < 2) continue;
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    const maxDist = Math.max(...points.map(p => Math.hypot(p.x - cx, p.y - cy)));
    if (maxDist < 8) continue;
    ctx.save();
    ctx.globalAlpha = 0.055 + ambientLight * 0.03;
    ctx.fillStyle = clan.color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, maxDist * 1.3 + 18, maxDist * 0.85 + 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCanvasNotes(
  ctx: CanvasRenderingContext2D,
  notes: CanvasNote[],
  scaleX: number,
  scaleY: number
) {
  for (const note of notes) {
    if (note.opacity <= 0.02) continue;
    const x = note.x * scaleX;
    const y = (note.y - note.offsetY) * scaleY;
    ctx.save();
    ctx.globalAlpha = note.opacity;
    ctx.font = `bold ${Math.max(8, 9 * scaleX)}px var(--font-display, Georgia, serif)`;
    ctx.textAlign = 'center';
    const tw = ctx.measureText(note.text).width;
    ctx.fillStyle = 'rgba(4, 4, 12, 0.75)';
    rrect(ctx, x - tw / 2 - 5, y - 12, tw + 10, 15, 4);
    ctx.fill();
    ctx.fillStyle = note.color;
    ctx.fillText(note.text, x, y);
    ctx.restore();
  }
}

/** Browser-safe rounded rectangle — avoids ctx.roundRect which is Chrome 99+ */
function rrect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  const rc = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rc, y);
  ctx.lineTo(x + w - rc, y);
  ctx.arcTo(x + w, y,     x + w, y + rc,     rc);
  ctx.lineTo(x + w, y + h - rc);
  ctx.arcTo(x + w, y + h, x + w - rc, y + h, rc);
  ctx.lineTo(x + rc, y + h);
  ctx.arcTo(x,     y + h, x, y + h - rc,     rc);
  ctx.lineTo(x, y + rc);
  ctx.arcTo(x, y,     x + rc, y,             rc);
  ctx.closePath();
}

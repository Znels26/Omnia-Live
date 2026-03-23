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

    // ── Mountains (background) ───────────────────────────────────
    drawMountains(ctx, W, H, scaleX, scaleY, ambientLight);

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
      for (const being of alive) {
        const isSelected = being.id === selectedBeing;
        const isHovered = being.id === hoveredBeing?.id;
        const clan = state.clans.find((c) => c.id === being.clanId);
        drawBeing(ctx, being, clan?.color ?? "#888", scaleX, scaleY, ambientLight, t, isSelected, isHovered);
      }
    }

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
  // Far mountains
  ctx.fillStyle = `rgba(40, 38, 55, ${0.6 * ambientLight + 0.2})`;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.45);
  const peaks = [
    [0.05, 0.25], [0.15, 0.15], [0.25, 0.22], [0.35, 0.1],
    [0.45, 0.18], [0.55, 0.12], [0.65, 0.2], [0.75, 0.08],
    [0.85, 0.17], [0.95, 0.22], [1, 0.28],
  ];
  for (const [px, py] of peaks) {
    ctx.lineTo(W * px, H * py);
  }
  ctx.lineTo(W, H * 0.45);
  ctx.closePath();
  ctx.fill();

  // Near mountains
  ctx.fillStyle = `rgba(30, 28, 42, ${0.7 * ambientLight + 0.15})`;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.5);
  const nearPeaks = [
    [0, 0.35], [0.08, 0.28], [0.2, 0.22], [0.32, 0.32],
    [0.42, 0.18], [0.5, 0.3], [1, 0.38],
  ];
  for (const [px, py] of nearPeaks) {
    ctx.lineTo(W * px, H * py);
  }
  ctx.lineTo(W, H * 0.5);
  ctx.closePath();
  ctx.fill();
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

  // Add texture for forests
  if (region.type === "FOREST") {
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 15; i++) {
      const treex = x + (Math.cos(i * 2.1 + t * 0.05) * rx * 0.7);
      const treey = y + (Math.sin(i * 1.7 + t * 0.03) * ry * 0.7);
      ctx.fillStyle = "#1d4a22";
      ctx.beginPath();
      ctx.arc(treex, treey, 8 * scaleX, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // River effect for river basin
  if (region.type === "RIVER_BASIN") {
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = "#4a90d9";
    ctx.lineWidth = 4 * scaleX;
    ctx.beginPath();
    const ry2 = y - h * 0.2;
    ctx.moveTo(x - rx * 0.3, ry2 - h * 0.2);
    ctx.bezierCurveTo(x + rx * 0.1, ry2, x - rx * 0.1, ry2 + h * 0.3, x + rx * 0.3, ry2 + h * 0.5);
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

  const sizeMap: Record<string, number> = {
    CAMP: 8,
    HAMLET: 12,
    VILLAGE: 18,
    TOWN: 25,
    CITY: 35,
    FORTRESS: 30,
    RUINS: 20,
  };

  const size = (sizeMap[settlement.type] ?? 10) * scaleX;

  // Firelight glow (night)
  if (ambientLight < 0.6) {
    const fireGlow = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
    fireGlow.addColorStop(0, "rgba(220, 120, 40, 0.3)");
    fireGlow.addColorStop(1, "rgba(220, 80, 20, 0)");
    ctx.fillStyle = fireGlow;
    ctx.beginPath();
    ctx.arc(x, y, size * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Settlement body
  const lightenedColor = lightenColor(clanColor, 0.3 * ambientLight);
  ctx.fillStyle = lightenedColor;
  ctx.strokeStyle = adjustBrightness(clanColor, 0.6);
  ctx.lineWidth = 1 * scaleX;

  if (settlement.type === "CAMP") {
    // Triangle tent
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size * 0.8, y + size * 0.5);
    ctx.lineTo(x + size * 0.8, y + size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (settlement.type === "FORTRESS") {
    // Square with battlements
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
    ctx.strokeRect(x - size, y - size, size * 2, size * 2);
    // Towers
    ctx.fillRect(x - size - 4 * scaleX, y - size, 8 * scaleX, 10 * scaleX);
    ctx.fillRect(x + size - 4 * scaleX, y - size, 8 * scaleX, 10 * scaleX);
  } else {
    // Rounded settlement
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner structures
    const structCount = Math.min(Math.floor(settlement.population / 3), 8);
    for (let i = 0; i < structCount; i++) {
      const angle = (i / structCount) * Math.PI * 2;
      const dist = size * 0.55;
      const sx = x + Math.cos(angle) * dist;
      const sy = y + Math.sin(angle) * dist;
      ctx.fillStyle = darkenColor(clanColor, 0.5);
      ctx.fillRect(sx - 2 * scaleX, sy - 2 * scaleY, 4 * scaleX, 4 * scaleY);
    }
  }

  // Fire/smoke
  if (settlement.type !== "RUINS") {
    const flicker = Math.sin(t * 8 + settlement.x) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 140, 30, ${0.7 * flicker * (ambientLight < 0.5 ? 1 : 0.5)})`;
    ctx.beginPath();
    ctx.arc(x, y - size * 0.5, 3 * scaleX, 0, Math.PI * 2);
    ctx.fill();
  }

  // Label
  ctx.fillStyle = `rgba(220, 210, 200, ${0.7 * ambientLight + 0.2})`;
  ctx.font = `${9 * scaleX}px var(--font-display, Georgia, serif)`;
  ctx.textAlign = "center";
  ctx.fillText(settlement.name, x, y + size + 12 * scaleY);
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
  isHovered: boolean
) {
  const x = being.x * scaleX;
  const y = being.y * scaleY;
  const pulse = Math.sin(t * 3 + being.x * 0.1) * 0.2 + 0.8;
  const size = (being.isCore ? 6 : 4) * scaleX;
  const statusColor = getBeingStatusColor(being as SimBeing);

  // Selection ring
  if (isSelected) {
    ctx.strokeStyle = "#c9a050";
    ctx.lineWidth = 2 * scaleX;
    ctx.beginPath();
    ctx.arc(x, y, size + 5 * scaleX, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Hover ring
  if (isHovered && !isSelected) {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1 * scaleX;
    ctx.beginPath();
    ctx.arc(x, y, size + 4 * scaleX, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Glow for core beings
  if (being.isCore) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
    glow.addColorStop(0, `${clanColor}60`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, size * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Being dot
  ctx.globalAlpha = 0.6 + pulse * 0.4;
  ctx.fillStyle = statusColor;
  ctx.beginPath();
  ctx.arc(x, y, size * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Clan color inner dot
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = clanColor;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
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

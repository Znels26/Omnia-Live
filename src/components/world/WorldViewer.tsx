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

interface Cloud {
  x: number; y: number;
  speed: number;
  puffs: Array<{ dx: number; dy: number; r: number }>;
  width: number;
}

interface CanvasNote {
  id: string; text: string;
  x: number; y: number;
  offsetY: number;
  opacity: number;
  color: string;
}

interface SpeechBubble {
  personId: string;
  text: string;       // short (max 45 chars)
  createdAt: number;  // performance.now()
  duration: number;   // ms to show
  isThought: boolean; // thought vs speech
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
  const cloudsRef = useRef<Cloud[]>([]);
  // cx/cy = current display position, tx/ty = target, dx/dy = movement direction
  const posCacheRef = useRef<Map<string, { cx: number; cy: number; tx: number; ty: number; dx: number; dy: number }>>(new Map());
  const notesRef = useRef<CanvasNote[]>([]);
  const knownEventIdsRef = useRef<Set<string>>(new Set());
  const speechBubblesRef = useRef<SpeechBubble[]>([]);
  // Camera follow: position in world coords, zoom multiplier
  const cameraRef = useRef({ x: 400, y: 280, zoom: 1, targetX: 400, targetY: 280, targetZoom: 1 });
  // Event ripple animations: expanding rings at event locations
  const ripplesRef = useRef<Array<{ x: number; y: number; startTime: number; color: string; maxR: number }>>([]);
  // Storm lightning state
  const lightningRef = useRef({ boltPoints: [] as Array<[number, number]>, flashAlpha: 0, lastStrike: 0, nextStrike: 4000 + Math.random() * 6000 });

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

    // ── Clouds ────────────────────────────────────────────────────
    drawClouds(ctx, cloudsRef.current, W, H, scaleX, scaleY, ambientLight, worldTime);

    // ── Birds ─────────────────────────────────────────────────────
    drawBirds(ctx, birdsRef.current, W, H, scaleX, scaleY, t, ambientLight);

    // ── Mountains (background) ───────────────────────────────────
    drawMountains(ctx, W, H, scaleX, scaleY, ambientLight, worldTime);

    // ── Dawn / Dusk horizon glow ──────────────────────────────────
    const horizonY = H * 0.42;
    {
      const isDawn = worldTime >= 5 && worldTime < 12;
      const isDusk = worldTime >= 17 && worldTime < 21;
      if (isDawn || isDusk) {
        const center = isDawn ? 6 : 18.5;
        const gi = Math.max(0, 1 - Math.abs(worldTime - center) / 1.5);
        if (gi > 0.01) {
          const hg = ctx.createLinearGradient(0, horizonY - H * 0.12, 0, horizonY + H * 0.15);
          hg.addColorStop(0, `rgba(255,130,30,0)`);
          hg.addColorStop(0.35, `rgba(255,80,10,${0.45 * gi})`);
          hg.addColorStop(0.65, `rgba(200,50,0,${0.28 * gi})`);
          hg.addColorStop(1, `rgba(120,30,0,0)`);
          ctx.fillStyle = hg;
          ctx.fillRect(0, horizonY - H * 0.12, W, H * 0.27);
        }
      }
    }

    // ── Rolling hill layers ───────────────────────────────────────
    drawHillLayers(ctx, W, H, scaleX, scaleY, ambientLight, worldTime);

    // ── Ground plane ──────────────────────────────────────────────
    {
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

    // ── Ground texture ────────────────────────────────────────────
    drawGroundTexture(ctx, W, H, scaleX, scaleY, ambientLight);

    // ── Perspective depth grid (isometric illusion) ───────────────
    {
      ctx.save();
      const vpX = W * 0.48;
      // Horizontal receding lines — quadratic spacing gives depth
      for (let i = 1; i <= 9; i++) {
        const p = Math.pow(i / 10, 1.7);
        const gy = horizonY + p * (H - horizonY);
        ctx.globalAlpha = (0.02 + 0.05 * p) * (0.4 + 0.6 * ambientLight);
        ctx.strokeStyle = 'rgba(90, 140, 50, 1)';
        ctx.lineWidth = 0.7 * scaleY;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }
      // Converging radial lines toward vanishing point
      for (let i = -9; i <= 9; i++) {
        if (i === 0) continue;
        const bx = W * 0.5 + i * W * 0.115;
        const fade = Math.max(0, 1 - Math.abs(i) * 0.085);
        ctx.globalAlpha = 0.022 * fade * (0.4 + 0.6 * ambientLight);
        ctx.strokeStyle = 'rgba(90, 140, 50, 1)';
        ctx.lineWidth = 0.6 * scaleX;
        ctx.beginPath();
        ctx.moveTo(vpX, horizonY);
        ctx.lineTo(bx, H);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // ── Camera follow: lerp toward target position/zoom ───────────
    const cam = cameraRef.current;
    // When following a being, track their live position
    if (selectedBeing && state?.beings) {
      const followed = state.beings.find(b => b.id === selectedBeing);
      if (followed) {
        const pos = posCacheRef.current.get(followed.id);
        cam.targetX = pos ? pos.cx : followed.x;
        cam.targetY = pos ? pos.cy : followed.y;
      }
    }
    const lerpSpeed = 0.045;
    cam.x += (cam.targetX - cam.x) * lerpSpeed;
    cam.y += (cam.targetY - cam.y) * lerpSpeed;
    cam.zoom += (cam.targetZoom - cam.zoom) * lerpSpeed;

    // Apply world-space camera transform: pan + zoom around canvas center
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x * scaleX, -cam.y * scaleY);

    // ── Clan Territories ─────────────────────────────────────────
    if (state?.clans && state?.beings && state?.settlements) {
      drawClanTerritories(ctx, state, scaleX, scaleY, ambientLight);
    }

    // ── Settlement paths / trade routes ───────────────────────────
    if (state?.settlements && state.settlements.length > 1) {
      drawPaths(ctx, state.settlements, scaleX, scaleY, ambientLight);
    }

    // ── Regions / Terrain ─────────────────────────────────────────
    if (state?.regions) {
      for (const region of state.regions) {
        drawRegion(ctx, region, scaleX, scaleY, ambientLight, t);
      }
    }

    // ── Settlements + crop fields ─────────────────────────────────
    if (state?.settlements) {
      // Draw crop fields behind settlements
      for (const settlement of state.settlements) {
        drawCropField(ctx, settlement, scaleX, scaleY, ambientLight, t);
      }
      for (const settlement of state.settlements) {
        const clan = state.clans.find((c) => c.id === settlement.clanId);
        drawSettlement(ctx, settlement, clan?.color ?? "#8b4513", scaleX, scaleY, ambientLight, t);
      }
    }

    // ── Beings (y-sorted for depth) ───────────────────────────────
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

      // Y-sort: beings further back (smaller y) drawn first so foreground overlaps
      const sorted = [...alive].sort((a, b) => {
        const ay = cache.get(a.id)?.cy ?? a.y;
        const by = cache.get(b.id)?.cy ?? b.y;
        return ay - by;
      });

      for (const being of sorted) {
        const isSelected = being.id === selectedBeing;
        const isHovered = being.id === hoveredBeing?.id;
        const clan = state.clans.find((c) => c.id === being.clanId);
        const pos = cache.get(being.id);
        const drawX = pos ? pos.cx : being.x;
        const drawY = pos ? pos.cy : being.y;
        // Flip sprite when moving left (dx < -0.3 means sustained leftward motion)
        const facingLeft = pos ? pos.dx < -0.3 : false;
        drawBeing(ctx, being, clan?.color ?? "#888", scaleX, scaleY, ambientLight, t, isSelected, isHovered, drawX, drawY, facingLeft);
      }
    }

    // ── Interaction arcs between beings currently speaking ────────
    if (state?.beings) {
      const activeSpeakerIds = new Set(speechBubblesRef.current
        .filter(b => performance.now() - b.createdAt < b.duration)
        .map(b => b.personId));
      const cache = posCacheRef.current;
      const speakingBeings = state.beings.filter(b => b.status !== 'DEAD' && activeSpeakerIds.has(b.id));
      for (let i = 0; i < speakingBeings.length; i++) {
        for (let j = i + 1; j < speakingBeings.length; j++) {
          const a = speakingBeings[i];
          const b = speakingBeings[j];
          const posA = cache.get(a.id);
          const posB = cache.get(b.id);
          const ax = posA ? posA.cx * scaleX : a.x * scaleX;
          const ay = posA ? posA.cy * scaleY : a.y * scaleY;
          const bx2 = posB ? posB.cx * scaleX : b.x * scaleX;
          const by2 = posB ? posB.cy * scaleY : b.y * scaleY;
          const dist = Math.sqrt((ax - bx2) ** 2 + (ay - by2) ** 2);
          if (dist < 200 * Math.min(scaleX, scaleY)) {
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = 'rgba(255,220,150,0.6)';
            ctx.lineWidth = 0.8;
            ctx.setLineDash([3, 5]);
            ctx.beginPath();
            const cpx = (ax + bx2) / 2;
            const cpy = Math.min(ay, by2) - 20;
            ctx.moveTo(ax, ay);
            ctx.quadraticCurveTo(cpx, cpy, bx2, by2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    // ── Speech bubbles ─────────────────────────────────────────────
    if (state?.beings) {
      const nowMs = performance.now();
      speechBubblesRef.current = speechBubblesRef.current.filter(b => nowMs - b.createdAt < b.duration);
      for (const bubble of speechBubblesRef.current) {
        const being = state.beings.find(b => b.id === bubble.personId);
        if (!being || being.status === 'DEAD') continue;
        const pos = posCacheRef.current.get(being.id);
        const bx = (pos ? pos.cx : being.x) * scaleX;
        const worldDrawY2 = pos ? pos.cy : being.y;
        const depthFactor2 = Math.max(0.45, Math.min(1.6, 0.5 + (worldDrawY2 - WORLD_HEIGHT * 0.40) / (WORLD_HEIGHT * 0.55)));
        const headR2 = 4.5 * (being.isCore ? 1.5 : 1.0) * Math.min(scaleX, scaleY) * depthFactor2;
        const byHead = worldDrawY2 * scaleY - headR2 * 0.5 - headR2 * 1.5;
        const elapsed = nowMs - bubble.createdAt;
        const fadeStart = bubble.duration * 0.7;
        const alpha = elapsed > fadeStart ? 1 - (elapsed - fadeStart) / (bubble.duration * 0.3) : 1;
        if (alpha > 0.05) {
          drawSpeechBubble(ctx, bx, byHead, bubble.text, bubble.isThought, alpha);
        }
      }
    }

    // ── Atmospheric particles (fireflies / dust) ──────────────────
    if (state?.settlements) {
      drawAtmosphericParticles(ctx, state.settlements, W, H, scaleX, scaleY, ambientLight, t, worldTime);
    }

    // ── Canvas Event Notifications ────────────────────────────────
    notesRef.current = notesRef.current.filter(n => n.opacity > 0.02);
    for (const note of notesRef.current) {
      note.opacity = Math.max(0, note.opacity - 0.0025); // ~7 second fade
      note.offsetY += 0.3; // float upward
    }
    drawCanvasNotes(ctx, notesRef.current, scaleX, scaleY);

    // ── Event Ripples ─────────────────────────────────────────────
    const nowMs2 = performance.now();
    ripplesRef.current = ripplesRef.current.filter(r => nowMs2 - r.startTime < 2800);
    for (const ripple of ripplesRef.current) {
      const elapsed = nowMs2 - ripple.startTime;
      const progress = elapsed / 2800;
      const rx = ripple.x * scaleX;
      const ry = ripple.y * scaleY;
      // Three expanding concentric rings
      for (let ring = 0; ring < 3; ring++) {
        const ringProgress = Math.max(0, progress - ring * 0.12);
        if (ringProgress <= 0 || ringProgress >= 1) continue;
        const r = ringProgress * ripple.maxR * scaleX;
        const alpha = (1 - ringProgress) * 0.65;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = ripple.color;
        ctx.lineWidth = (2.5 - ring * 0.6) * Math.min(scaleX, scaleY);
        ctx.beginPath();
        ctx.arc(rx, ry, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Close camera transform ────────────────────────────────────
    ctx.restore();

    // ── Weather Effects ───────────────────────────────────────────
    const weather = state?.weather ?? { type: "clear", intensity: 0.3, temperature: 20, windSpeed: 0.2 };
    drawWeather(ctx, weather, W, H, t, particlesRef, scaleX, scaleY);

    // ── Storm Lightning ───────────────────────────────────────────
    if (weather.type === 'storm') {
      const lightning = lightningRef.current;
      const nowMsL = performance.now();
      // Trigger a new bolt periodically
      if (nowMsL - lightning.lastStrike > lightning.nextStrike) {
        lightning.lastStrike = nowMsL;
        lightning.nextStrike = 3500 + Math.random() * 7000;
        lightning.flashAlpha = 0.55;
        // Generate jagged bolt from sky to ground
        const boltX = W * (0.15 + Math.random() * 0.7);
        const pts: Array<[number, number]> = [[boltX, H * 0.05]];
        let cx2 = boltX, cy2 = H * 0.05;
        for (let i = 0; i < 8; i++) {
          cx2 += (Math.random() - 0.5) * W * 0.12;
          cy2 += H * 0.11;
          pts.push([cx2, cy2]);
        }
        lightning.boltPoints = pts;
      }
      // Draw flash overlay
      if (lightning.flashAlpha > 0.01) {
        ctx.fillStyle = `rgba(220, 230, 255, ${lightning.flashAlpha})`;
        ctx.fillRect(0, 0, W, H);
        lightning.flashAlpha *= 0.78; // decay
      }
      // Draw bolt
      if (lightning.boltPoints.length > 1 && nowMsL - lightning.lastStrike < 200) {
        const boltAlpha = Math.max(0, 1 - (nowMsL - lightning.lastStrike) / 200);
        ctx.save();
        ctx.globalAlpha = boltAlpha;
        ctx.strokeStyle = 'rgba(200, 220, 255, 1)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(150, 180, 255, 0.9)';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(lightning.boltPoints[0][0], lightning.boltPoints[0][1]);
        for (const [bx, by] of lightning.boltPoints.slice(1)) {
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
        // Bright core
        ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Day/Night Overlay ──────────────────────────────────────────
    // Only apply for genuine night hours (not dusk/dawn — sky handles those)
    if (worldTime < 6.5 || worldTime > 20.5) {
      // Fade in gently: 0 at dusk/dawn boundaries, max at full night
      const nightDepth = worldTime > 12
        ? Math.min((worldTime - 20.5) / 1.5, 1)   // evening → night
        : Math.min((6.5 - worldTime) / 1.5, 1);    // night → dawn
      const nightOpacity = Math.max(0, nightDepth) * 0.28;
      if (nightOpacity > 0.01) {
        ctx.fillStyle = `rgba(8, 8, 30, ${nightOpacity})`;
        ctx.fillRect(0, 0, W, H);
      }
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
    cloudsRef.current = Array.from({ length: 7 }, (_, i) => {
      const w = 70 + Math.random() * 130;
      const puffCount = 4 + Math.floor(Math.random() * 5);
      return {
        x: Math.random() * WORLD_WIDTH,
        y: 18 + Math.random() * 95,
        width: w,
        speed: 0.06 + Math.random() * 0.1,
        puffs: Array.from({ length: puffCount }, (_, j) => {
          const spread = w * 0.45;
          return {
            dx: (j / puffCount - 0.5) * spread * 2 + (Math.random() - 0.5) * 20,
            dy: (Math.random() - 0.5) * 18,
            r: 12 + Math.random() * 18,
          };
        }),
      };
    });
  }, []);

  useEffect(() => {
    if (!worldState) return;
    const cache = posCacheRef.current;
    for (const being of worldState.beings) {
      if (being.status === 'DEAD') continue;
      const existing = cache.get(being.id);
      if (existing) {
        // Track movement direction from old target to new target
        const newDx = being.x - existing.tx;
        const newDy = being.y - existing.ty;
        // Smooth direction: blend toward new direction to avoid jitter
        existing.dx = existing.dx * 0.7 + newDx * 0.3;
        existing.dy = existing.dy * 0.7 + newDy * 0.3;
        existing.tx = being.x;
        existing.ty = being.y;
      } else {
        cache.set(being.id, { cx: being.x, cy: being.y, tx: being.x, ty: being.y, dx: 0, dy: 0 });
      }
    }
  }, [worldState]);

  // Camera: zoom in when a being is selected, zoom out when deselected
  useEffect(() => {
    const cam = cameraRef.current;
    if (selectedBeing && worldState) {
      const being = worldState.beings.find(b => b.id === selectedBeing);
      if (being) {
        const pos = posCacheRef.current.get(being.id);
        cam.targetX = pos ? pos.cx : being.x;
        cam.targetY = pos ? pos.cy : being.y;
        cam.targetZoom = 2.2;
      }
    } else {
      cam.targetX = 400;
      cam.targetY = 280;
      cam.targetZoom = 1;
    }
  }, [selectedBeing]);

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

      // Spawn ripple effect for important events
      if (e.importance >= 50) {
        ripplesRef.current.push({
          x: nx,
          y: ny,
          startTime: performance.now(),
          color: e.importance >= 75
            ? 'rgba(212,175,55,0.9)'   // gold for major
            : e.category === 'MILITARY'
              ? 'rgba(220,80,60,0.8)'  // red for war/death
              : e.category === 'SPIRITUAL'
                ? 'rgba(160,120,220,0.8)' // purple for spiritual
                : 'rgba(180,220,255,0.7)', // blue-white for social
          maxR: e.importance >= 75 ? 90 : 60,
        });
        if (ripplesRef.current.length > 8) {
          ripplesRef.current = ripplesRef.current.slice(-8);
        }
      }
    }
    // Cap at 4 simultaneous notifications
    if (notesRef.current.length > 4) {
      notesRef.current = notesRef.current.slice(-4);
    }

    // ── Speech bubbles from events ─────────────────────────────────
    const now = performance.now();
    for (const e of newEvents) {
      const isSocial = e.category === 'SOCIAL' || (e.type === 'MARRIAGE' || e.type === 'ALLIANCE') || e.title.includes(' and ');
      const quoteRegex = /"([^"]{5,60})"/g;
      const desc = e.description ?? '';
      const quotes: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = quoteRegex.exec(desc)) !== null) {
        quotes.push(m[1]);
      }

      if (isSocial && quotes.length >= 1 && e.beingId) {
        // Person A gets first quote
        speechBubblesRef.current.push({
          personId: e.beingId,
          text: quotes[0].length > 45 ? quotes[0].slice(0, 45) + '…' : quotes[0],
          createdAt: now,
          duration: 7000,
          isThought: false,
        });
        // Person B gets second quote if present
        const personBId = e.metadata?.person_b_id as string | undefined;
        if (quotes.length >= 2 && personBId) {
          speechBubblesRef.current.push({
            personId: personBId,
            text: quotes[1].length > 45 ? quotes[1].slice(0, 45) + '…' : quotes[1],
            createdAt: now,
            duration: 7000,
            isThought: false,
          });
        }
      } else if (!isSocial && e.importance >= 50 && e.beingId && quotes.length === 0) {
        // Thought bubble for high-importance non-social events
        const shortTitle = e.title.length > 38 ? e.title.slice(0, 38) + '…' : e.title;
        speechBubblesRef.current.push({
          personId: e.beingId,
          text: shortTitle,
          createdAt: now,
          duration: 6000,
          isThought: true,
        });
      }
    }
    // Cap speech bubbles
    if (speechBubblesRef.current.length > 8) {
      speechBubblesRef.current = speechBubblesRef.current.slice(-8);
    }
  }, [worldState?.recentEvents]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const state = worldStateRef.current;
      if (!state?.beings) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      // Invert camera transform: mouse pos → world coords accounting for zoom/pan
      const cam = cameraRef.current;
      const normX = (e.clientX - rect.left) / rect.width - 0.5;
      const normY = (e.clientY - rect.top) / rect.height - 0.5;
      const canvasX = normX * WORLD_WIDTH / cam.zoom + cam.x;
      const canvasY = normY * WORLD_HEIGHT / cam.zoom + cam.y;

      // Use cached display positions for accurate hit detection
      const cache = posCacheRef.current;
      const found = state.beings.find((b) => {
        if (b.status === "DEAD") return false;
        const pos = cache.get(b.id);
        const bx = pos ? pos.cx : b.x;
        const by = pos ? pos.cy : b.y;
        const dx = bx - canvasX;
        const dy = by - canvasY;
        return Math.sqrt(dx * dx + dy * dy) < 28 / cam.zoom;
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
      // Invert camera transform
      const cam = cameraRef.current;
      const normX = (e.clientX - rect.left) / rect.width - 0.5;
      const normY = (e.clientY - rect.top) / rect.height - 0.5;
      const canvasX = normX * WORLD_WIDTH / cam.zoom + cam.x;
      const canvasY = normY * WORLD_HEIGHT / cam.zoom + cam.y;

      const cache = posCacheRef.current;
      const found = state.beings.find((b) => {
        if (b.status === "DEAD") return false;
        const pos = cache.get(b.id);
        const bx = pos ? pos.cx : b.x;
        const by = pos ? pos.cy : b.y;
        const dx = bx - canvasX;
        const dy = by - canvasY;
        return Math.sqrt(dx * dx + dy * dy) < 28 / cam.zoom;
      });

      if (found) {
        onSelectBeing?.(found.id === selectedBeing ? null : found.id);
      } else {
        onSelectBeing?.(null);
        // Check clan settlement click
        const settlement = state.settlements.find((s) => {
          const dx = s.x - canvasX;
          const dy = s.y - canvasY;
          return Math.sqrt(dx * dx + dy * dy) < 30 / cam.zoom;
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

      {/* World info overlay — hidden on mobile (panel header shows same info) */}
      {worldState && (
        <div className="hidden md:block absolute top-3 left-3 overlay-panel px-3 py-2 text-xs space-y-0.5 z-10">
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

      {/* Mobile-only compact bar — time + weather in one line */}
      {worldState && (
        <div className="md:hidden absolute top-2 left-2 right-2 flex items-center justify-between z-10 pointer-events-none">
          <div className="overlay-panel px-2.5 py-1 text-xs flex items-center gap-2">
            <span className="text-fv-ember-bright">{getWeatherDescription(worldState.weather)}</span>
            <span className="text-fv-text-dim">·</span>
            <span className="text-fv-text-muted capitalize">{worldState.season?.name}</span>
          </div>
          <div className="overlay-panel px-2.5 py-1 text-xs text-fv-text-dim">
            {worldState.beings.filter(b => b.status === "ALIVE").length} souls
          </div>
        </div>
      )}

      {/* Clan legend — hidden on mobile (Clans tab covers this) */}
      {worldState && (
        <div className="hidden md:block absolute bottom-3 left-3 overlay-panel px-3 py-2 text-xs space-y-1 z-10">
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
  ambientLight: number,
  worldTime: number
) {
  const isDawn = worldTime >= 5 && worldTime < 9;
  const isDusk = worldTime >= 17 && worldTime < 21;

  // Far mountain range
  const farPeaks: [number, number][] = [
    [0, 0.45], [0.05, 0.25], [0.12, 0.15], [0.2, 0.21],
    [0.3, 0.1], [0.38, 0.19], [0.48, 0.12], [0.57, 0.2],
    [0.67, 0.08], [0.76, 0.16], [0.85, 0.22], [0.93, 0.13],
    [1, 0.28],
  ];

  // Atmospheric haze behind far mountains (dawn = warm, dusk = orange/purple)
  {
    const hazeColor = isDawn ? 'rgba(255,160,80,' : isDusk ? 'rgba(200,80,30,' : 'rgba(80,90,120,';
    const hazeAlpha = (isDawn || isDusk) ? 0.18 * ambientLight : 0.08 * ambientLight;
    if (hazeAlpha > 0.005) {
      const hg = ctx.createLinearGradient(0, H * 0.08, 0, H * 0.45);
      hg.addColorStop(0, `${hazeColor}0)`);
      hg.addColorStop(0.6, `${hazeColor}${hazeAlpha})`);
      hg.addColorStop(1, `${hazeColor}0)`);
      ctx.fillStyle = hg;
      ctx.fillRect(0, H * 0.08, W, H * 0.37);
    }
  }

  ctx.fillStyle = `rgba(38, 36, 52, ${0.55 * ambientLight + 0.2})`;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.45);
  for (const [px, py] of farPeaks) ctx.lineTo(W * px, H * py);
  ctx.lineTo(W, H * 0.5);
  ctx.closePath();
  ctx.fill();

  // Snow caps
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

  // Snow caps
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

  // Atmospheric fade band at mountain base (aerial perspective)
  const fadeColor = isDawn ? 'rgba(255,180,100,' : isDusk ? 'rgba(180,80,30,' : 'rgba(60,80,100,';
  const mg = ctx.createLinearGradient(0, H * 0.38, 0, H * 0.48);
  mg.addColorStop(0, `${fadeColor}0)`);
  mg.addColorStop(0.5, `${fadeColor}${0.12 * ambientLight})`);
  mg.addColorStop(1, `${fadeColor}0)`);
  ctx.fillStyle = mg;
  ctx.fillRect(0, H * 0.38, W, H * 0.1);
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
  const rx = w * 0.5;
  const ry = h * 0.5;
  const s = Math.min(scaleX, scaleY);

  // ── FOREST ───────────────────────────────────────────────────────
  if (region.type === "FOREST") {
    // Dark forest floor
    ctx.globalAlpha = 0.55;
    const floorGrad = ctx.createRadialGradient(x, y, 0, x, y, rx);
    floorGrad.addColorStop(0, '#1a3a18');
    floorGrad.addColorStop(1, '#0e2010');
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dappled sunlight patches on forest floor
    ctx.globalAlpha = 0.06 * ambientLight;
    for (let i = 0; i < 8; i++) {
      const pr = pseudoRand(i * 1.7 + region.x * 0.01);
      const pa = pseudoRand(i * 2.3 + region.y * 0.01);
      const lx = x + (pr - 0.5) * rx * 1.4;
      const ly = y + (pa - 0.5) * ry * 1.2;
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 14 * s);
      lg.addColorStop(0, 'rgba(180,220,80,1)');
      lg.addColorStop(1, 'transparent');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, ly, 14 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Trees — back row (smaller, lighter)
    const backSeeds = Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2 + pseudoRand(i * 3.1) * 0.5;
      const dist = (0.35 + pseudoRand(i * 1.9) * 0.35) * Math.min(rx, ry) * 0.85;
      return [x + Math.cos(angle) * dist, y + Math.sin(angle) * dist * 0.65] as [number, number];
    });

    for (const [tx, ty] of backSeeds) {
      const treeH = (8 + pseudoRand(tx * 0.1 + ty * 0.07) * 7) * s;
      const sway = Math.sin(t * 0.7 + tx * 0.08) * 1.0 * s;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#12301a';
      ctx.beginPath();
      ctx.arc(tx + sway, ty - treeH * 0.55, treeH * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#163d20';
      ctx.beginPath();
      ctx.arc(tx + sway * 0.7, ty - treeH * 0.75, treeH * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }

    // Trees — front row (larger, darker, shadow-casting)
    const frontSeeds = Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * Math.PI * 2 + pseudoRand(i * 7.3) * 0.3;
      const dist = (0.6 + pseudoRand(i * 2.7) * 0.3) * Math.min(rx, ry) * 0.9;
      return [x + Math.cos(angle) * dist, y + Math.sin(angle) * dist * 0.65] as [number, number];
    });

    for (const [tx, ty] of frontSeeds) {
      const treeH = (12 + pseudoRand(tx * 0.09 + ty * 0.05) * 9) * s;
      const sway = Math.sin(t * 0.6 + tx * 0.06) * 1.5 * s;
      // Trunk
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#2a1a0e';
      ctx.fillRect(tx - 1.5 * s + sway * 0.2, ty, 3 * s, treeH * 0.4);
      // Shadow on ground
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.ellipse(tx + 8 * s, ty + 3 * s, treeH * 0.35, treeH * 0.12, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // Canopy — 3 overlapping blobs
      const canopyColors = ['#0e2a12', '#133218', '#183d1e'];
      for (let ci = 0; ci < 3; ci++) {
        const offX = (pseudoRand(tx * 0.1 + ci) - 0.5) * treeH * 0.35;
        const offY = -treeH * (0.5 + ci * 0.22);
        const cr = treeH * (0.52 - ci * 0.08);
        ctx.globalAlpha = 0.75 - ci * 0.1;
        ctx.fillStyle = canopyColors[ci];
        ctx.beginPath();
        ctx.arc(tx + offX + sway, ty + offY, cr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── RIVER / WATER ─────────────────────────────────────────────────
  else if (region.type === "RIVER_BASIN" || region.type === "LAKE" || region.type === "MARSH") {
    // Water base
    ctx.globalAlpha = 0.65;
    const waterGrad = ctx.createRadialGradient(x, y, 0, x, y, rx);
    waterGrad.addColorStop(0, '#3a8acc');
    waterGrad.addColorStop(0.6, '#2a6aaa');
    waterGrad.addColorStop(1, '#1a4a80');
    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Animated flow lines
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = 'rgba(120,190,255,0.8)';
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = 'round';
    for (let fi = 0; fi < 4; fi++) {
      const offset = (fi / 4) * ry * 0.8 - ry * 0.4;
      const phase = t * 0.4 + fi * 0.7;
      ctx.beginPath();
      ctx.moveTo(x - rx * 0.7, y + offset);
      ctx.bezierCurveTo(
        x - rx * 0.3, y + offset + Math.sin(phase) * 6 * s,
        x + rx * 0.3, y + offset + Math.sin(phase + 1.2) * 6 * s,
        x + rx * 0.7, y + offset + Math.sin(phase + 2.4) * 4 * s
      );
      ctx.stroke();
    }

    // Caustic sparkles — bright shimmer dots on surface
    ctx.globalAlpha = 0.5 * ambientLight;
    for (let ci = 0; ci < 12; ci++) {
      const seed1 = ci * 1.37;
      const seed2 = ci * 2.71;
      const sparkX = x + (pseudoRand(seed1 + Math.floor(t * 0.3)) - 0.5) * rx * 1.4;
      const sparkY = y + (pseudoRand(seed2 + Math.floor(t * 0.3)) - 0.5) * ry * 1.0;
      const flicker = 0.3 + 0.7 * Math.abs(Math.sin(t * 4 + ci * 0.9));
      ctx.fillStyle = `rgba(200, 240, 255, ${flicker * 0.8})`;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, (0.8 + flicker * 1.2) * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Foam edge highlight
    ctx.globalAlpha = 0.15 * ambientLight;
    ctx.strokeStyle = 'rgba(220,240,255,1)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 0.92, ry * 0.65, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  // ── COAST / SHORE ─────────────────────────────────────────────────
  else if (region.type === "COAST" || region.type === "BEACH") {
    // Sand base
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#c8a86a';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ocean water offset toward one edge
    ctx.globalAlpha = 0.6;
    const wg = ctx.createLinearGradient(x - rx, y, x + rx * 0.3, y);
    wg.addColorStop(0, '#1a5a9a');
    wg.addColorStop(0.5, '#2a7ac8');
    wg.addColorStop(1, 'transparent');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.2, y, rx * 0.85, ry * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wave lines
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = 'rgba(200,240,255,0.9)';
    ctx.lineWidth = 1.5 * s;
    for (let wi = 0; wi < 3; wi++) {
      const wt = (t * 0.6 + wi * 0.4) % 1;
      const wy = y - ry * 0.3 + wi * ry * 0.25;
      const alpha = Math.sin(wt * Math.PI);
      ctx.globalAlpha = 0.3 * alpha;
      ctx.beginPath();
      ctx.moveTo(x - rx * 0.6, wy);
      ctx.bezierCurveTo(x - rx * 0.2, wy - 4 * s, x + rx * 0.2, wy + 4 * s, x + rx * 0.6, wy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ── MOUNTAINS / HIGHLANDS ─────────────────────────────────────────
  else if (region.type === "MOUNTAINS" || region.type === "HIGHLANDS") {
    ctx.globalAlpha = 0.5;
    const rockGrad = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.3, 0, x, y, rx);
    rockGrad.addColorStop(0, adjustBrightness(region.color, ambientLight * 0.9 + 0.3));
    rockGrad.addColorStop(1, adjustBrightness(region.color, ambientLight * 0.5 + 0.1));
    ctx.fillStyle = rockGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rocky facets
    ctx.globalAlpha = 0.35;
    for (let ri = 0; ri < 8; ri++) {
      const angle = (ri / 8) * Math.PI * 2;
      const dist = (0.2 + pseudoRand(ri * 1.3) * 0.5) * Math.min(rx, ry) * 0.7;
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist * 0.65;
      const faceW = (8 + pseudoRand(ri * 2.1) * 12) * s;
      const faceH = (6 + pseudoRand(ri * 3.3) * 8) * s;
      ctx.fillStyle = ri % 2 === 0
        ? adjustBrightness(region.color, ambientLight * 0.4 + 0.1)
        : adjustBrightness(region.color, ambientLight * 0.8 + 0.2);
      ctx.beginPath();
      ctx.ellipse(px, py, faceW, faceH, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── PLAINS / VALLEY / DEFAULT ──────────────────────────────────────
  else {
    ctx.globalAlpha = 0.45;
    const lightColor = adjustBrightness(region.color, ambientLight * 0.8 + 0.15);
    const plainGrad = ctx.createRadialGradient(x, y - ry * 0.2, 0, x, y, rx);
    plainGrad.addColorStop(0, lightenColor(region.color, 0.2 * ambientLight));
    plainGrad.addColorStop(1, lightColor);
    ctx.fillStyle = plainGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Scattered grass tufts
    ctx.globalAlpha = 0.22 * ambientLight;
    ctx.strokeStyle = adjustBrightness(region.color, 0.7);
    ctx.lineWidth = 0.9 * s;
    for (let gi = 0; gi < 20; gi++) {
      const gx = x + (pseudoRand(gi * 1.7 + region.x) - 0.5) * rx * 1.5;
      const gy = y + (pseudoRand(gi * 2.3 + region.y) - 0.5) * ry * 1.3;
      const gh = (3 + pseudoRand(gi * 3.1) * 3) * s;
      ctx.beginPath();
      ctx.moveTo(gx - 2 * s, gy);
      ctx.lineTo(gx, gy - gh);
      ctx.moveTo(gx + 2 * s, gy);
      ctx.lineTo(gx, gy - gh);
      ctx.stroke();
    }

    // Wildflower dots
    if (region.fertility > 0.5) {
      const flowerColors = ['rgba(255,200,80,0.7)', 'rgba(200,80,200,0.6)', 'rgba(255,255,255,0.5)'];
      for (let fi = 0; fi < 12; fi++) {
        const fx = x + (pseudoRand(fi * 5.1 + region.x) - 0.5) * rx * 1.4;
        const fy = y + (pseudoRand(fi * 4.7 + region.y) - 0.5) * ry * 1.2;
        ctx.globalAlpha = 0.4 * ambientLight;
        ctx.fillStyle = flowerColors[fi % flowerColors.length];
        ctx.beginPath();
        ctx.arc(fx, fy, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Region label
  ctx.fillStyle = `rgba(220, 210, 200, ${0.45 * ambientLight + 0.15})`;
  ctx.font = `italic ${9 * Math.min(scaleX, scaleY)}px var(--font-display, Georgia, serif)`;
  ctx.textAlign = "center";
  ctx.fillText(region.name, x, y + 4 * scaleY);
}

function drawCropField(
  ctx: CanvasRenderingContext2D,
  settlement: { x: number; y: number; type: string; population: number },
  scaleX: number,
  scaleY: number,
  ambientLight: number,
  t: number
) {
  // Only villages and above get visible crop fields
  if (settlement.type === 'CAMP' || settlement.type === 'RUINS') return;

  const s = Math.min(scaleX, scaleY);
  const fieldCount = settlement.type === 'CITY' ? 4 : settlement.type === 'TOWN' ? 3 : settlement.type === 'VILLAGE' ? 2 : 1;

  // Deterministic field positions around settlement
  const offsets = [
    { dx: -60, dy: 30 }, { dx: 55, dy: 35 },
    { dx: -40, dy: 55 }, { dx: 60, dy: 55 },
  ];

  for (let i = 0; i < fieldCount; i++) {
    const off = offsets[i];
    const fx = (settlement.x + off.dx) * scaleX;
    const fy = (settlement.y + off.dy) * scaleY;
    const fw = (22 + i * 6) * scaleX;
    const fh = (14 + i * 4) * scaleY;

    ctx.save();
    ctx.globalAlpha = 0.35 + ambientLight * 0.2;

    // Field base
    ctx.fillStyle = '#4a7a20';
    ctx.fillRect(fx, fy, fw, fh);

    // Crop rows — animated gentle sway
    const rowCount = 4;
    ctx.strokeStyle = `rgba(80, 140, 40, 0.7)`;
    ctx.lineWidth = 1.2 * s;
    for (let r = 0; r < rowCount; r++) {
      const ry = fy + (r / rowCount) * fh + fh / (rowCount * 2);
      const sway = Math.sin(t * 0.6 + settlement.x * 0.02 + r * 0.8) * 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(fx, ry);
      for (let cx2 = fx; cx2 < fx + fw; cx2 += 5 * s) {
        ctx.lineTo(cx2 + sway, ry - 2 * s);
        ctx.lineTo(cx2 + 2.5 * s, ry);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
  ctx.globalAlpha = 1;
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

  // Settlement ground shadow
  ctx.save();
  ctx.globalAlpha = 0.18 * ambientLight;
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.beginPath();
  ctx.ellipse(x + size * 0.4, y + size * 0.9, size * 1.6, size * 0.4, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Palisade fence ring for village+
  if (settlement.type === 'VILLAGE' || settlement.type === 'TOWN' || settlement.type === 'CITY') {
    const fenceR = size * 1.55;
    const postCount = settlement.type === 'CITY' ? 28 : settlement.type === 'TOWN' ? 22 : 16;
    const postH = size * 0.55;
    const postW = size * 0.09;
    ctx.save();
    ctx.globalAlpha = 0.55 + ambientLight * 0.2;
    for (let pi = 0; pi < postCount; pi++) {
      const angle = (pi / postCount) * Math.PI * 2;
      const px = x + Math.cos(angle) * fenceR;
      const py = y + Math.sin(angle) * fenceR * 0.55;
      ctx.fillStyle = adjustBrightness(clanColor, 0.4 + ambientLight * 0.25);
      ctx.fillRect(px - postW / 2, py - postH, postW, postH);
      // Post shadow
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(px - postW / 2 + 1.5, py - postH + 2, postW * 0.8, postH);
      ctx.globalAlpha = 0.55 + ambientLight * 0.2;
    }
    ctx.restore();
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

  // Night fire / torch glow for all settlements
  if (ambientLight < 0.65) {
    const nightDepth = Math.max(0, 0.65 - ambientLight);
    const flicker = Math.sin(t * 8 + settlement.x * 0.4) * 0.28 + 0.72;
    const fireY = settlement.type === "CAMP" ? y + size * 0.15 : y + size * 0.05;

    // Outer warm halo
    const haloR = size * (settlement.type === "CAMP" ? 5 : 3.5);
    const halo = ctx.createRadialGradient(x, fireY, 0, x, fireY, haloR);
    halo.addColorStop(0, `rgba(255,140,30,${0.35 * nightDepth * flicker})`);
    halo.addColorStop(1, 'rgba(200,70,10,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, fireY, haloR, 0, Math.PI * 2);
    ctx.fill();

    // Flame core
    ctx.fillStyle = `rgba(255, 120, 20, ${0.75 * nightDepth * flicker})`;
    ctx.beginPath();
    ctx.arc(x, fireY, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 230, 90, ${0.9 * nightDepth * flicker})`;
    ctx.beginPath();
    ctx.arc(x, fireY - 1.5 * s, 1.5 * s, 0, Math.PI * 2);
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

function getOccupationColor(role: string): string {
  const r = role.toLowerCase();
  if (r.includes('hunt')) return '#3d5a30';
  if (r.includes('farm')) return '#8b6914';
  if (r.includes('heal')) return '#3a6080';
  if (r.includes('guard')) return '#4a4a5a';
  if (r.includes('fish')) return '#2a6080';
  if (r.includes('trad')) return '#8b5a2b';
  if (r.includes('craft')) return '#5a4535';
  if (r.includes('scout')) return '#4a6040';
  if (r.includes('lead')) return '#7a4a20';
  return '#5a4a35';
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  text: string,
  isThought: boolean,
  alpha: number
) {
  const padding = { x: 8, y: 5 };
  ctx.font = '9px sans-serif';
  const w = ctx.measureText(text).width + padding.x * 2;
  const h = 18;
  const bx = cx - w / 2;
  const by = topY - h - 12;

  // White/cream rounded rect
  ctx.globalAlpha = alpha * 0.92;
  ctx.fillStyle = isThought ? 'rgba(200,200,240,0.9)' : 'rgba(255,252,240,0.95)';
  rrect(ctx, bx, by, w, h, 4);
  ctx.fill();

  // Border
  ctx.strokeStyle = isThought ? 'rgba(150,150,200,0.6)' : 'rgba(180,160,120,0.7)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Tail (triangle pointing down to being head)
  ctx.fillStyle = isThought ? 'rgba(200,200,240,0.9)' : 'rgba(255,252,240,0.95)';
  ctx.beginPath();
  ctx.moveTo(cx - 4, by + h);
  ctx.lineTo(cx + 4, by + h);
  ctx.lineTo(cx, by + h + 8);
  ctx.closePath();
  ctx.fill();

  // Text
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#2a1a0a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.length > 42 ? text.slice(0, 42) + '…' : text, cx, by + h / 2);
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 1;
}

function drawBeing(
  ctx: CanvasRenderingContext2D,
  being: SimBeing,
  clanColor: string,
  scaleX: number,
  scaleY: number,
  ambientLight: number,
  t: number,
  isSelected: boolean,
  isHovered: boolean,
  drawX?: number,
  drawY?: number,
  facingLeft: boolean = false
) {
  const worldDrawY = drawY ?? being.y;
  const cx = (drawX ?? being.x) * scaleX;
  const baseY = worldDrawY * scaleY;

  // Per-being deterministic walk offset so they don't all step in sync
  const seed = being.id.charCodeAt(0) * 0.31 + being.id.charCodeAt(1) * 0.17;
  const walkCycle = t * 2.2 + seed;
  const bob = Math.sin(walkCycle) * 1.0;
  const legSwing = Math.sin(walkCycle);
  const armSwingPhase = Math.sin(walkCycle + Math.PI * 0.8);

  // Depth-based scale for perspective
  const depthFactor = Math.max(0.45, Math.min(1.6,
    0.5 + (worldDrawY - WORLD_HEIGHT * 0.40) / (WORLD_HEIGHT * 0.55)
  ));
  const ageScale = being.lifeStage === 'CHILD' ? 0.55 : being.lifeStage === 'ELDER' ? 0.85 : 1.0;
  const s = (being.isCore ? 1.5 : 1.0) * ageScale * Math.min(scaleX, scaleY) * depthFactor;

  // ── Measurements ──────────────────────────────────────────────
  const headR   = 4.5 * s * (being.lifeStage === 'CHILD' ? 1.1 : 1.0);
  const headY   = baseY + bob * scaleY - headR * 0.5;
  const neckY   = headY + headR * 1.75;
  const hipY    = neckY + 10 * s;
  const groundY = hipY + 9 * s;
  const shoulderW = 5.5 * s;
  const hipW      = 4.0 * s;
  const legW      = 2.0 * s;

  const alpha = Math.min(1, 0.55 + ambientLight * 0.45);

  // ── Core glow ─────────────────────────────────────────────────
  if (being.isCore) {
    const glow = ctx.createRadialGradient(cx, headY, 0, cx, headY, headR * 5.5);
    glow.addColorStop(0, `${clanColor}60`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, headY, headR * 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Emotion aura ──────────────────────────────────────────────
  const emotionColor = being.health < 30 ? 'rgba(150,80,80,0.25)'
    : being.fear > 60 ? 'rgba(80,80,180,0.20)'
    : being.happiness > 70 ? 'rgba(220,180,60,0.22)'
    : being.health < 55 ? 'rgba(120,100,60,0.18)'
    : null;
  if (emotionColor) {
    const aura = ctx.createRadialGradient(cx, headY, 0, cx, headY, headR * 4.5);
    aura.addColorStop(0, emotionColor);
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, headY, headR * 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Selection / hover ring ────────────────────────────────────
  if (isSelected) {
    ctx.strokeStyle = '#c9a050';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 1.5 * s, headR * 3, headR * 0.65, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (isHovered) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 1.5 * s, headR * 2.7, headR * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  // Flip entire body horizontally when moving left
  if (facingLeft) {
    ctx.translate(cx * 2, 0);
    ctx.scale(-1, 1);
  }

  // ── Ground shadow (ellipse under feet) ────────────────────────
  ctx.globalAlpha = alpha * 0.28;
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 1.8 * s, headR * 2.4, headR * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;

  // ── Legs (filled tapered quads, animated) ─────────────────────
  const lSwing = legSwing * 3.5 * s;
  const rSwing = -legSwing * 3.5 * s;
  const legColor = adjustBrightness(clanColor, 0.55);
  const bootColor = adjustBrightness(clanColor, 0.35);

  // Left leg
  ctx.fillStyle = legColor;
  ctx.beginPath();
  ctx.moveTo(cx - hipW * 0.8 + lSwing * 0.15, hipY);
  ctx.lineTo(cx - hipW * 0.3 + lSwing * 0.15, hipY);
  ctx.lineTo(cx - legW * 0.3 + lSwing, groundY);
  ctx.lineTo(cx - legW * 1.8 + lSwing, groundY);
  ctx.closePath();
  ctx.fill();
  // Left boot
  ctx.fillStyle = bootColor;
  ctx.beginPath();
  ctx.ellipse(cx - legW * 0.8 + lSwing, groundY + 1.2 * s, 3.2 * s, 1.6 * s, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Right leg
  ctx.fillStyle = legColor;
  ctx.beginPath();
  ctx.moveTo(cx + hipW * 0.3 + rSwing * 0.15, hipY);
  ctx.lineTo(cx + hipW * 0.8 + rSwing * 0.15, hipY);
  ctx.lineTo(cx + legW * 1.8 + rSwing, groundY);
  ctx.lineTo(cx + legW * 0.3 + rSwing, groundY);
  ctx.closePath();
  ctx.fill();
  // Right boot
  ctx.fillStyle = bootColor;
  ctx.beginPath();
  ctx.ellipse(cx + legW * 0.8 + rSwing, groundY + 1.2 * s, 3.2 * s, 1.6 * s, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // ── Torso (filled trapezoid, wider at shoulders) ───────────────
  const occupationColor = getOccupationColor(being.role);
  ctx.fillStyle = occupationColor;
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, neckY);
  ctx.lineTo(cx + shoulderW, neckY);
  ctx.lineTo(cx + hipW, hipY);
  ctx.lineTo(cx - hipW, hipY);
  ctx.closePath();
  ctx.fill();

  // Torso shading overlay
  const torsoGrad = ctx.createLinearGradient(cx - shoulderW, neckY, cx + shoulderW, hipY);
  torsoGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
  torsoGrad.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, neckY);
  ctx.lineTo(cx + shoulderW, neckY);
  ctx.lineTo(cx + hipW, hipY);
  ctx.lineTo(cx - hipW, hipY);
  ctx.closePath();
  ctx.fill();

  // ── Arms (filled, animated swing) ────────────────────────────
  const armColor = adjustBrightness(occupationColor, 0.72);
  const armW = 2.2 * s;
  const armH = 7.5 * s;
  const lArmSwing = armSwingPhase * 3.5 * s;
  const rArmSwing = -armSwingPhase * 3.5 * s;

  // Left arm (behind: drawn first)
  ctx.fillStyle = adjustBrightness(occupationColor, 0.58);
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW + armW * 0.5, neckY + 1 * s);
  ctx.lineTo(cx - shoulderW - armW * 0.3, neckY + 1 * s);
  ctx.lineTo(cx - shoulderW - armW + lArmSwing, neckY + armH);
  ctx.lineTo(cx - shoulderW + armW * 0.8 + lArmSwing * 0.3, neckY + armH);
  ctx.closePath();
  ctx.fill();

  // Right arm
  ctx.fillStyle = armColor;
  ctx.beginPath();
  ctx.moveTo(cx + shoulderW - armW * 0.5, neckY + 1 * s);
  ctx.lineTo(cx + shoulderW + armW * 0.3, neckY + 1 * s);
  ctx.lineTo(cx + shoulderW + armW + rArmSwing, neckY + armH);
  ctx.lineTo(cx + shoulderW - armW * 0.8 + rArmSwing * 0.3, neckY + armH);
  ctx.closePath();
  ctx.fill();

  // ── Head (filled circle with gradient shading) ────────────────
  const skinBase = lightenColor(clanColor, 0.55);
  const skinHighlight = lightenColor(clanColor, 0.75);
  const headGrad = ctx.createRadialGradient(
    cx - headR * 0.25, headY - headR * 0.3, 0,
    cx, headY, headR
  );
  headGrad.addColorStop(0, skinHighlight);
  headGrad.addColorStop(0.65, skinBase);
  headGrad.addColorStop(1, adjustBrightness(clanColor, 0.45));
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Thin outline
  ctx.strokeStyle = adjustBrightness(clanColor, 0.38);
  ctx.lineWidth = 0.7 * s;
  ctx.stroke();

  // ── Hair (cap on top of head) ─────────────────────────────────
  const hairColor = adjustBrightness(clanColor, 0.28);
  ctx.fillStyle = hairColor;
  ctx.beginPath();
  ctx.arc(cx, headY - headR * 0.15, headR * 0.93, Math.PI * 1.08, Math.PI * 1.92);
  ctx.fill();

  // ── Eyes (two small dots with pupils) ────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(cx - headR * 0.3, headY + headR * 0.1, headR * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + headR * 0.3, headY + headR * 0.1, headR * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(15,8,4,0.85)';
  ctx.beginPath();
  ctx.arc(cx - headR * 0.28, headY + headR * 0.12, headR * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + headR * 0.28, headY + headR * 0.12, headR * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;

  // ── Occupation prop ───────────────────────────────────────────
  const role = being.role.toLowerCase();
  ctx.save();
  const propAlpha = Math.min(1, 0.5 + ambientLight * 0.35);
  ctx.globalAlpha = propAlpha;
  if (facingLeft) {
    ctx.translate(cx * 2, 0);
    ctx.scale(-1, 1);
  }

  if (role.includes('hunt') || role.includes('ranger')) {
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.arc(cx + 8 * s, neckY + 3 * s, 5.5 * s, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(210,190,150,0.55)';
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(cx + 8 * s, neckY + 3 * s - 5.5 * s * Math.sin(0.6));
    ctx.lineTo(cx + 8 * s, neckY + 3 * s + 5.5 * s * Math.sin(0.6));
    ctx.stroke();

  } else if (role.includes('farm') || role.includes('herder') || role.includes('shepherd')) {
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 1.8 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + 7 * s, neckY + 2 * s);
    ctx.lineTo(cx + 4 * s, groundY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 1 * s, groundY - 4 * s);
    ctx.lineTo(cx + 7 * s, groundY - 2 * s);
    ctx.stroke();

  } else if (role.includes('guard') || role.includes('soldier') || role.includes('warrior')) {
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(cx + 10 * s, groundY);
    ctx.lineTo(cx + 10 * s, headY - 10 * s);
    ctx.stroke();
    ctx.fillStyle = `rgba(190,185,195,${propAlpha})`;
    ctx.beginPath();
    ctx.moveTo(cx + 10 * s, headY - 15 * s);
    ctx.lineTo(cx + 6.5 * s, headY - 8 * s);
    ctx.lineTo(cx + 13.5 * s, headY - 8 * s);
    ctx.closePath();
    ctx.fill();

  } else if (role.includes('fish') || role.includes('sailor')) {
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 5 * s, neckY + 2 * s);
    ctx.lineTo(cx - 17 * s, neckY - 12 * s);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,185,155,0.4)';
    ctx.lineWidth = 0.7 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 17 * s, neckY - 12 * s);
    ctx.lineTo(cx - 21 * s, neckY - 3 * s);
    ctx.stroke();

  } else if (role.includes('heal') || role.includes('shaman') || role.includes('priest')) {
    const crossY = headY - headR * 1.6 - 7 * s;
    ctx.strokeStyle = 'rgba(70, 210, 120, 0.9)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(cx, crossY - 4 * s);
    ctx.lineTo(cx, crossY + 4 * s);
    ctx.moveTo(cx - 4 * s, crossY);
    ctx.lineTo(cx + 4 * s, crossY);
    ctx.stroke();

  } else if (role.includes('trade') || role.includes('merchant')) {
    ctx.fillStyle = adjustBrightness(clanColor, 0.65);
    const packW = 6 * s, packH = 9 * s;
    ctx.fillRect(cx - shoulderW - packW, neckY + 1 * s, packW, packH);
    ctx.strokeStyle = adjustBrightness(clanColor, 0.4);
    ctx.lineWidth = 0.8 * s;
    ctx.strokeRect(cx - shoulderW - packW, neckY + 1 * s, packW, packH);
    // Strap
    ctx.beginPath();
    ctx.moveTo(cx - shoulderW, neckY + 1 * s);
    ctx.lineTo(cx - shoulderW - packW, neckY + 4 * s);
    ctx.stroke();

  } else if (role.includes('craft') || role.includes('smith') || role.includes('builder')) {
    ctx.strokeStyle = '#7a7a80';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(cx + 8 * s, neckY + 1 * s);
    ctx.lineTo(cx + 8 * s, hipY - 1 * s);
    ctx.stroke();
    ctx.fillStyle = `rgba(130,125,135,${propAlpha})`;
    ctx.fillRect(cx + 4.5 * s, neckY - 2 * s, 7 * s, 3.5 * s);
  }

  ctx.restore();
  ctx.globalAlpha = 1;

  // ── Name label ────────────────────────────────────────────────
  if (being.isCore || isSelected || isHovered) {
    const labelY = headY - headR - 4 * s;
    ctx.save();
    ctx.font = `${being.isCore ? 10 : 8}px var(--font-display, Georgia, serif)`;
    ctx.textAlign = 'center';
    const tw = ctx.measureText(being.name).width;
    ctx.fillStyle = 'rgba(6,6,18,0.72)';
    rrect(ctx, cx - tw / 2 - 3, labelY - 10, tw + 6, 13, 3);
    ctx.fill();
    ctx.fillStyle = being.isCore ? '#e8d5a0' : 'rgba(220,210,200,0.9)';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 2;
    ctx.fillText(being.name, cx, labelY);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Action label — always visible for core, on hover/select for others ────
  const showAction = being.isCore ? being.currentAction : ((isSelected || isHovered) && being.currentAction) ? being.currentAction : null;
  if (showAction) {
    const bubbleY = headY - headR - (being.isCore || isSelected ? 26 : 22) * s;
    ctx.save();
    ctx.font = `italic 8px var(--font-body, sans-serif)`;
    ctx.textAlign = 'center';
    const action = showAction.length > 28 ? showAction.slice(0, 28) + '…' : showAction;
    const tw = ctx.measureText(action).width;
    ctx.fillStyle = 'rgba(6,6,18,0.78)';
    rrect(ctx, cx - tw / 2 - 4, bubbleY - 10, tw + 8, 12, 4);
    ctx.fill();
    ctx.fillStyle = '#c8a060';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 2;
    ctx.fillText(action, cx, bubbleY);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// Seeded deterministic pseudo-random — avoids per-frame flicker from Math.random()
function pseudoRand(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

function drawClouds(
  ctx: CanvasRenderingContext2D,
  clouds: Cloud[],
  W: number,
  H: number,
  scaleX: number,
  _scaleY: number,
  ambientLight: number,
  worldTime: number
) {
  const opacity = Math.min(1, Math.max(0, (ambientLight - 0.15) * 2.2));
  if (opacity <= 0.02) return;

  const isDawn = worldTime >= 5 && worldTime < 9;
  const isDusk = worldTime >= 17 && worldTime < 21;
  const isGolden = isDawn || isDusk;

  for (const cloud of clouds) {
    // Drift clouds forward each frame
    cloud.x = (cloud.x + cloud.speed) % (WORLD_WIDTH + cloud.width);

    const cx = cloud.x * scaleX;
    const cy = cloud.y * (H / WORLD_HEIGHT);

    // Subtle cloud shadow on ground plane
    if (ambientLight > 0.55) {
      const shadowY = H * 0.62 + (cloud.y / WORLD_HEIGHT) * H * 0.08;
      ctx.save();
      ctx.globalAlpha = 0.045 * ambientLight;
      ctx.fillStyle = 'rgba(0,0,25,1)';
      ctx.beginPath();
      ctx.ellipse(cx, shadowY, cloud.width * scaleX * 0.45, 7 * (H / WORLD_HEIGHT), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw each puff
    for (const puff of cloud.puffs) {
      const px = cx + puff.dx * scaleX;
      const py = cy + puff.dy * (H / WORLD_HEIGHT);
      const pr = puff.r * scaleX;

      const g = ctx.createRadialGradient(px, py - pr * 0.18, 0, px, py, pr);
      if (isGolden) {
        const warm = isDawn ? 'rgba(255,205,145,' : 'rgba(255,170,100,';
        g.addColorStop(0, `${warm}${0.92 * opacity})`);
        g.addColorStop(0.65, `${warm}${0.7 * opacity})`);
        g.addColorStop(1, `${warm}0)`);
      } else {
        g.addColorStop(0, `rgba(255,255,255,${0.88 * opacity})`);
        g.addColorStop(0.65, `rgba(240,242,255,${0.65 * opacity})`);
        g.addColorStop(1, 'rgba(220,225,240,0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawHillLayers(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  _scaleX: number,
  _scaleY: number,
  ambientLight: number,
  worldTime: number
) {
  const isDawn = worldTime >= 5 && worldTime < 9;
  const isDusk = worldTime >= 17 && worldTime < 21;

  // 3 hill layers from far to near, each progressively darker/greener
  const layers: Array<{ peaks: [number, number][]; r: number; g: number; b: number; baseY: number }> = [
    {
      peaks: [[0,0.445],[0.12,0.415],[0.26,0.43],[0.42,0.405],[0.58,0.42],[0.74,0.41],[0.88,0.43],[1,0.445]],
      r: 32, g: 45, b: 24, baseY: 0.445,
    },
    {
      peaks: [[0,0.46],[0.1,0.435],[0.24,0.45],[0.4,0.425],[0.56,0.44],[0.72,0.43],[0.86,0.45],[1,0.46]],
      r: 40, g: 56, b: 28, baseY: 0.46,
    },
    {
      peaks: [[0,0.475],[0.08,0.455],[0.22,0.465],[0.38,0.448],[0.54,0.46],[0.7,0.452],[0.85,0.465],[1,0.475]],
      r: 50, g: 68, b: 34, baseY: 0.475,
    },
  ];

  for (const layer of layers) {
    const lf = ambientLight * 0.75 + 0.12;
    // Warm tint at dawn/dusk
    let tintR = 0, tintG = 0, tintB = 0;
    if (isDawn) { tintR = 30; tintG = 10; }
    else if (isDusk) { tintR = 25; tintG = -5; tintB = -5; }

    const r = Math.max(0, Math.min(255, Math.round(layer.r * lf + tintR)));
    const g = Math.max(0, Math.min(255, Math.round(layer.g * lf + tintG)));
    const b = Math.max(0, Math.min(255, Math.round(layer.b * lf + tintB)));

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.moveTo(0, H);

    const peaks = layer.peaks;
    ctx.lineTo(0, H * peaks[0][1]);
    for (let i = 0; i < peaks.length - 1; i++) {
      const [x1, y1] = peaks[i];
      const [x2, y2] = peaks[i + 1];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      ctx.quadraticCurveTo(W * x1, H * y1, W * mx, H * my);
    }
    const last = peaks[peaks.length - 1];
    ctx.lineTo(W * last[0], H * last[1]);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  // Aerial haze band at the horizon line
  if (isDawn || isDusk) {
    const hazeColor = isDawn ? 'rgba(255,150,60,' : 'rgba(200,70,20,';
    const hg = ctx.createLinearGradient(0, H * 0.41, 0, H * 0.5);
    hg.addColorStop(0, `${hazeColor}0)`);
    hg.addColorStop(0.5, `${hazeColor}${0.12 * ambientLight})`);
    hg.addColorStop(1, `${hazeColor}0)`);
    ctx.fillStyle = hg;
    ctx.fillRect(0, H * 0.41, W, H * 0.09);
  }
}

function drawGroundTexture(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  scaleX: number,
  scaleY: number,
  ambientLight: number
) {
  if (ambientLight < 0.25) return;

  const horizonY = H * 0.48;
  const lf = ambientLight * 0.55 + 0.08;

  ctx.save();
  ctx.strokeStyle = `rgba(55,80,30,${0.22 * lf})`;
  ctx.lineWidth = 0.9 * scaleX;
  ctx.lineCap = 'round';

  const spacingX = 20 * scaleX;
  const spacingY = 14 * scaleY;

  for (let gx = 0; gx < W; gx += spacingX) {
    for (let gy = horizonY; gy < H; gy += spacingY) {
      const depth = (gy - horizonY) / (H - horizonY);
      // More grass density in foreground, sparse near horizon
      if (pseudoRand(gx * 0.05 + gy * 0.04) > depth * 0.85 + 0.15) continue;

      // Deterministic jitter
      const jx = (pseudoRand(gx * 7919 * 0.001 + gy * 6271 * 0.001) - 0.5) * spacingX * 0.8;
      const jy = (pseudoRand(gx * 3571 * 0.001 + gy * 7993 * 0.001) - 0.5) * spacingY * 0.6;
      const tx = gx + jx;
      const ty = gy + jy;
      const gh = (1.5 + depth * 4) * scaleY;
      const lean = (pseudoRand(tx * 0.1 + ty * 0.07) - 0.5) * 2 * scaleX;

      ctx.beginPath();
      ctx.moveTo(tx - 2.2 * scaleX, ty);
      ctx.lineTo(tx + lean, ty - gh);
      ctx.moveTo(tx + 2.2 * scaleX, ty);
      ctx.lineTo(tx + lean, ty - gh);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawAtmosphericParticles(
  ctx: CanvasRenderingContext2D,
  settlements: Array<{ x: number; y: number }>,
  _W: number,
  _H: number,
  scaleX: number,
  scaleY: number,
  ambientLight: number,
  t: number,
  worldTime: number
) {
  const isNight = worldTime < 5.5 || worldTime > 21.5;
  const isEvening = worldTime >= 19 || worldTime <= 7;

  // ── Fireflies near settlements at night/dusk ────────────────
  if (isEvening || isNight) {
    const nightDepth = Math.max(0, 1 - ambientLight * 1.4);
    if (nightDepth > 0.05) {
      for (const settlement of settlements) {
        const sx = settlement.x * scaleX;
        const sy = settlement.y * scaleY;
        const count = 6;
        for (let i = 0; i < count; i++) {
          const seed1 = i * 1.73 + settlement.x * 0.01;
          const seed2 = i * 2.31 + settlement.y * 0.01;
          const fx = sx + Math.sin(t * 0.35 + seed1 * 3.7) * 50 * scaleX;
          const fy = sy + Math.cos(t * 0.27 + seed2 * 2.9) * 30 * scaleY - 12 * scaleY;
          const flicker = 0.4 + 0.6 * Math.abs(Math.sin(t * 4.1 + seed1 * 6.3));
          ctx.save();
          ctx.globalAlpha = flicker * nightDepth * 0.75;
          const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 5 * scaleX);
          fg.addColorStop(0, 'rgba(160,255,80,1)');
          fg.addColorStop(0.5, 'rgba(120,220,60,0.4)');
          fg.addColorStop(1, 'transparent');
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(fx, fy, 5 * scaleX, 0, Math.PI * 2);
          ctx.fill();
          // Bright core
          ctx.globalAlpha = flicker * nightDepth;
          ctx.fillStyle = 'rgba(200,255,100,0.9)';
          ctx.beginPath();
          ctx.arc(fx, fy, 1.2 * scaleX, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  // ── Dust motes floating in daytime ─────────────────────────
  if (ambientLight > 0.65) {
    const dustAlpha = (ambientLight - 0.65) * 0.25;
    ctx.fillStyle = `rgba(255, 238, 190, ${dustAlpha})`;
    for (let i = 0; i < 18; i++) {
      const seed = i * 137.5;
      const mx = ((t * 6 * (1 + pseudoRand(seed) * 0.4) + seed * 55) % (_W || 800));
      const my = (_H || 560) * 0.52 + Math.sin(t * 0.25 + seed) * (_H || 560) * 0.14 + pseudoRand(seed + 1) * (_H || 560) * 0.18;
      const mSize = (0.8 + pseudoRand(seed + 2) * 1.4) * scaleX;
      ctx.beginPath();
      ctx.arc(mx, my, mSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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

function drawPaths(
  ctx: CanvasRenderingContext2D,
  settlements: Array<{ x: number; y: number; clanId: string | null }>,
  scaleX: number,
  scaleY: number,
  ambientLight: number
) {
  const s = Math.min(scaleX, scaleY);
  for (let i = 0; i < settlements.length; i++) {
    for (let j = i + 1; j < settlements.length; j++) {
      const a = settlements[i];
      const b = settlements[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 240) continue;

      // Deterministic mid-point curve (no jitter — seed from positions)
      const seed = ((a.x * 7 + b.y * 13) % 40) - 20;
      const mx = ((a.x + b.x) / 2 + seed) * scaleX;
      const my = ((a.y + b.y) / 2 + seed * 0.4) * scaleY;

      ctx.save();
      ctx.globalAlpha = 0.11 + 0.07 * ambientLight;
      ctx.strokeStyle = '#7a5a2a';
      ctx.lineWidth = 2.2 * s;
      ctx.setLineDash([5 * scaleX, 8 * scaleX]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x * scaleX, a.y * scaleY);
      ctx.quadraticCurveTo(mx, my, b.x * scaleX, b.y * scaleY);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
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

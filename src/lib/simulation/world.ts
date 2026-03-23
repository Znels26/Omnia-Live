import { WorldState, Weather, Season, SimRegion } from "./types";
import { clamp, randomBetween } from "../utils";

const WEATHER_TYPES = ["clear", "cloudy", "rain", "storm", "fog", "drought", "snow"] as const;

export function advanceWorldTime(state: WorldState): WorldState {
  const updated = { ...state };

  // Advance tick and world time
  updated.tick += 1;
  updated.worldTime = (state.worldTime + 1) % 24;

  // Day counter
  if (updated.worldTime === 0) {
    updated.day = (state.day ?? 0) + 1;
  }

  // Year counter
  if ((updated.day ?? 0) % 365 === 0 && (updated.day ?? 0) > 0) {
    updated.year = (state.year ?? 0) + 1;
  }

  // Update weather
  updated.weather = advanceWeather(state.weather, updated.tick);

  // Update season
  updated.season = getCurrentSeason(updated.day ?? 0);

  return updated;
}

export function advanceWeather(current: Weather, tick: number): Weather {
  // Weather changes every ~48 ticks (~2 days)
  if (tick % 48 !== 0 && Math.random() > 0.05) return current;

  const nextType = Math.random() < 0.7
    ? current.type // Stay same weather
    : WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];

  const intensity = clamp(current.intensity + randomBetween(-0.2, 0.2), 0.1, 1.0);
  const temperature = clamp(current.temperature + randomBetween(-3, 3), -10, 40);

  return {
    type: nextType,
    intensity,
    temperature,
    windSpeed: clamp(current.windSpeed + randomBetween(-0.1, 0.1), 0, 1),
  };
}

export function getCurrentSeason(day: number): Season {
  const dayOfYear = day % 365;

  if (dayOfYear < 91) {
    return { name: "spring", progress: dayOfYear / 91 };
  } else if (dayOfYear < 182) {
    return { name: "summer", progress: (dayOfYear - 91) / 91 };
  } else if (dayOfYear < 273) {
    return { name: "autumn", progress: (dayOfYear - 182) / 91 };
  } else {
    return { name: "winter", progress: (dayOfYear - 273) / 92 };
  }
}

export function getDayNightProgress(worldTime: number): number {
  // Returns 0 = midnight, 0.5 = noon, 1 = midnight again
  return worldTime / 24;
}

export function getSkyColor(worldTime: number, weather: Weather): string {
  const hour = worldTime;

  // Base sky colors by time
  let skyColor: [number, number, number];

  if (hour < 5 || hour >= 22) {
    // Night
    skyColor = [10, 12, 35];
  } else if (hour < 7) {
    // Dawn
    const t = (hour - 5) / 2;
    skyColor = [
      Math.round(10 + t * 200),
      Math.round(12 + t * 80),
      Math.round(35 + t * 30),
    ];
  } else if (hour < 17) {
    // Day
    skyColor = [100, 160, 220];
  } else if (hour < 20) {
    // Dusk
    const t = (hour - 17) / 3;
    skyColor = [
      Math.round(100 + t * 130),
      Math.round(160 - t * 120),
      Math.round(220 - t * 190),
    ];
  } else {
    // Evening transition
    const t = (hour - 20) / 2;
    skyColor = [
      Math.round(230 - t * 220),
      Math.round(40 - t * 28),
      Math.round(30 - t * 5),
    ];
  }

  // Weather modification
  if (weather.type === "rain" || weather.type === "storm") {
    skyColor = skyColor.map((c) => Math.round(c * 0.6)) as [number, number, number];
  } else if (weather.type === "fog") {
    skyColor = skyColor.map((c) => Math.round(c * 0.8 + 40)) as [number, number, number];
  }

  return `rgb(${skyColor[0]}, ${skyColor[1]}, ${skyColor[2]})`;
}

export function getAmbientLight(worldTime: number): number {
  const hour = worldTime;
  if (hour < 5 || hour >= 22) return 0.15;
  if (hour < 7) return 0.15 + ((hour - 5) / 2) * 0.7;
  if (hour < 17) return 0.85;
  if (hour < 20) return 0.85 - ((hour - 17) / 3) * 0.7;
  return 0.15 + ((22 - hour) / 2) * 0.15;
}

export function createInitialWorld(): Partial<WorldState> {
  return {
    tick: 0,
    worldTime: 8, // Start at 8am
    age: "SURVIVAL",
    paused: false,
    day: 1,
    year: 1,
    weather: {
      type: "clear",
      intensity: 0.3,
      temperature: 20,
      windSpeed: 0.2,
    },
    season: {
      name: "spring",
      progress: 0.1,
    },
  };
}

export const WORLD_REGIONS: Omit<SimRegion, "id" | "worldId">[] = [
  {
    name: "The River Basin",
    type: "RIVER_BASIN",
    biome: "wetlands",
    x: 400,
    y: 300,
    width: 200,
    height: 150,
    fertility: 0.9,
    waterAccess: 1.0,
    elevation: 0.1,
    temperature: 0.5,
    color: "#3d7a4a",
  },
  {
    name: "The Northern Peaks",
    type: "MOUNTAINS",
    biome: "alpine",
    x: 350,
    y: 100,
    width: 250,
    height: 150,
    fertility: 0.2,
    waterAccess: 0.4,
    elevation: 0.9,
    temperature: 0.2,
    color: "#6b6b7a",
  },
  {
    name: "The Eastern Forest",
    type: "FOREST",
    biome: "temperate_forest",
    x: 620,
    y: 250,
    width: 180,
    height: 200,
    fertility: 0.7,
    waterAccess: 0.6,
    elevation: 0.3,
    temperature: 0.5,
    color: "#2d5a27",
  },
  {
    name: "The Southern Coast",
    type: "COAST",
    biome: "coastal",
    x: 400,
    y: 480,
    width: 300,
    height: 100,
    fertility: 0.6,
    waterAccess: 0.95,
    elevation: 0.05,
    temperature: 0.7,
    color: "#4a7a6a",
  },
  {
    name: "The Western Plains",
    type: "PLAINS",
    biome: "grassland",
    x: 160,
    y: 280,
    width: 220,
    height: 200,
    fertility: 0.75,
    waterAccess: 0.5,
    elevation: 0.2,
    temperature: 0.55,
    color: "#7a8a3a",
  },
];

export function getWeatherDescription(weather: Weather): string {
  const descriptions: Record<string, string> = {
    clear: "Clear skies. The stars guide the night watch.",
    cloudy: "Thick clouds gather. Rain may come.",
    rain: "Rain falls steadily. Rivers run high.",
    storm: "A violent storm tears through the valley.",
    fog: "Dense fog cloaks the valley floor.",
    drought: "The earth cracks. Wells run low.",
    snow: "Snow blankets the high ground. Travel is treacherous.",
  };
  return descriptions[weather.type] ?? "The weather shifts.";
}

export function getSeasonDescription(season: Season): string {
  const descriptions: Record<string, string> = {
    spring: "Spring returns. Hunger eases. Green shoots emerge.",
    summer: "Summer heat. Crops grow. Tensions run high.",
    autumn: "Harvest time. What was planted is now gathered.",
    winter: "Winter's grip. The cold tests every soul.",
  };
  return descriptions[season.name] ?? "The season turns.";
}

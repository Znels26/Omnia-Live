// Simulation type definitions — shared between client and server

export type WorldAge =
  | "SURVIVAL"
  | "TRIBE_FORMATION"
  | "SETTLEMENT"
  | "EARLY_POLITICS"
  | "CIVILIZATION"
  | "EXPANSION"
  | "COLLAPSE"
  | "RENEWAL";

export type RegionType =
  | "RIVER_BASIN"
  | "MOUNTAINS"
  | "FOREST"
  | "COAST"
  | "PLAINS"
  | "VALLEY"
  | "DESERT"
  | "SWAMP";

export type ClanStatus =
  | "ACTIVE"
  | "AT_WAR"
  | "IN_ALLIANCE"
  | "COLLAPSED"
  | "MERGED"
  | "DOMINANT";

export type BeingStatus = "ALIVE" | "INJURED" | "SICK" | "DYING" | "DEAD" | "EXILED";
export type LifeStage = "CHILD" | "YOUNG_ADULT" | "ADULT" | "ELDER";

export type EventType =
  | "BIRTH"
  | "DEATH"
  | "MARRIAGE"
  | "ALLIANCE"
  | "WAR_DECLARED"
  | "BATTLE"
  | "PEACE_TREATY"
  | "MIGRATION"
  | "FAMINE"
  | "FEAST"
  | "PLAGUE"
  | "NATURAL_DISASTER"
  | "DISCOVERY"
  | "INVENTION"
  | "RITUAL"
  | "ELECTION"
  | "BETRAYAL"
  | "ASSASSINATION"
  | "SETTLEMENT_FOUNDED"
  | "SETTLEMENT_DESTROYED"
  | "RELIGION_FOUNDED"
  | "MIRACLE"
  | "DROUGHT"
  | "FLOOD"
  | "FIRE"
  | "FIRST_CONTACT"
  | "TRADE_ROUTE"
  | "MONUMENT_BUILT"
  | "RULER_CHANGED"
  | "INTERVENTION"
  | "VIEWER_VOTE"
  | "ERA_TRANSITION"
  | "CUSTOM";

export type EventCategory =
  | "GENERAL"
  | "SURVIVAL"
  | "SOCIAL"
  | "POLITICAL"
  | "MILITARY"
  | "SPIRITUAL"
  | "NATURAL"
  | "CULTURAL"
  | "ECONOMIC"
  | "VIEWER";

export interface Position {
  x: number;
  y: number;
}

export interface Weather {
  type: "clear" | "cloudy" | "rain" | "storm" | "snow" | "fog" | "drought";
  intensity: number; // 0-1
  temperature: number; // -20 to 50 (celsius)
  windSpeed: number; // 0-1
}

export interface Season {
  name: "spring" | "summer" | "autumn" | "winter";
  progress: number; // 0-1 through the season
}

export interface SimBeing {
  id: string;
  worldId: string;
  clanId: string | null;
  regionId: string | null;
  name: string;
  age: number;
  lifeStage: LifeStage;
  role: string;
  isCore: boolean;
  status: BeingStatus;
  x: number;
  y: number;
  // Personality
  bravery: number;
  cunning: number;
  empathy: number;
  ambition: number;
  wisdom: number;
  charisma: number;
  // Physical
  health: number;
  hunger: number;
  thirst: number;
  fatigue: number;
  // Mental
  happiness: number;
  fear: number;
  anger: number;
  hope: number;
  // Goals
  primaryGoal: string | null;
  currentAction: string | null;
  drives: string[];
  fears: string[];
  beliefs: Record<string, unknown>;
  trustMap: Record<string, number>;
  relationships: Array<{ beingId: string; type: string; strength: number }>;
  // Target position (for movement animation)
  targetX?: number;
  targetY?: number;
  // Movement state
  movementProgress?: number;
  description?: string | null;
  backstory?: string | null;
}

export interface SimClan {
  id: string;
  worldId: string;
  regionId: string | null;
  name: string;
  color: string;
  population: number;
  status: ClanStatus;
  age: WorldAge;
  beliefs: string[];
  traits: string[];
  relations: Record<string, "ally" | "neutral" | "hostile">;
  resources: Record<string, number>;
  territory: Position[];
  x: number;
  y: number;
  power: number;
}

export interface SimSettlement {
  id: string;
  worldId: string;
  clanId: string | null;
  regionId: string | null;
  name: string;
  type: "CAMP" | "HAMLET" | "VILLAGE" | "TOWN" | "CITY" | "FORTRESS" | "RUINS";
  population: number;
  x: number;
  y: number;
  level: number;
  health: number;
  defense: number;
  food: number;
  water: number;
  morale: number;
  features: string[];
}

export interface SimEvent {
  id: string;
  worldId: string;
  type: EventType;
  category: EventCategory;
  title: string;
  description: string;
  impact?: string;
  tick: number;
  worldTime: number;
  x?: number;
  y?: number;
  importance: number;
  highlighted: boolean;
  clanId?: string;
  beingId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface WorldState {
  id: string;
  name: string;
  tick: number;
  worldTime: number; // hours (0-24 cycle)
  age: WorldAge;
  paused: boolean;
  weather: Weather;
  season: Season;
  regions: SimRegion[];
  clans: SimClan[];
  beings: SimBeing[];
  settlements: SimSettlement[];
  recentEvents: SimEvent[];
  population: number;
  day: number;
  year: number;
}

export interface SimRegion {
  id: string;
  worldId: string;
  name: string;
  type: RegionType;
  biome: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fertility: number;
  waterAccess: number;
  elevation: number;
  temperature: number;
  color: string;
}

export interface SimulationConfig {
  tickIntervalMs: number;
  worldTimePerTick: number; // hours per tick
  hungerDecayPerTick: number;
  thirstDecayPerTick: number;
  fatigueIncreasePerTick: number;
  reproductionChancePerTick: number;
  deathChanceWhenHungry: number;
  agingTicksPerYear: number;
  eventChancePerTick: number;
  migrationChancePerTick: number;
}

export const DEFAULT_SIM_CONFIG: SimulationConfig = {
  tickIntervalMs: 5000,
  worldTimePerTick: 1, // 1 world hour per tick
  hungerDecayPerTick: 2,
  thirstDecayPerTick: 3,
  fatigueIncreasePerTick: 1,
  reproductionChancePerTick: 0.005,
  deathChanceWhenHungry: 0.01,
  agingTicksPerYear: 8760, // 24h * 365
  eventChancePerTick: 0.15,
  migrationChancePerTick: 0.002,
};

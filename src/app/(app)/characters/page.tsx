import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FollowButton } from "@/components/world/FollowButton";
import Link from "next/link";

export default async function CharactersPage() {
  const session = await auth();

  const world = await db.world.findFirst({ where: { slug: "first-valley" } });
  const userId = session?.user?.id;
  if (!world) {
    return <div className="p-8 text-fv-text-muted">World not found.</div>;
  }

  const beings = await db.being.findMany({
    where: { worldId: world.id, status: { not: "DEAD" } },
    include: { clan: true },
    orderBy: [{ isCore: "desc" }, { charisma: "desc" }],
    take: 60,
  });

  const follows = userId
    ? await db.follow.findMany({
        where: { userId, targetType: "BEING" },
        select: { beingId: true },
      })
    : [];
  const followedBeingIds = new Set(follows.map((f) => f.beingId));

  const core = beings.filter((b) => b.isCore);
  const background = beings.filter((b) => !b.isCore);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-fv-moon mb-2">Characters</h1>
        <p className="text-fv-text-muted">
          {beings.length} souls walk the valley. Each with their own story.
        </p>
      </div>

      {/* Core Characters */}
      <section className="mb-10">
        <h2 className="font-display text-sm text-fv-ember uppercase tracking-wider mb-4">
          Core Characters — The Stars of First Valley
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {core.map((being) => (
            <BeingCard key={being.id} being={being} isCore isFollowing={followedBeingIds.has(being.id)} />
          ))}
        </div>
      </section>

      {/* Background Characters */}
      <section>
        <h2 className="font-display text-sm text-fv-text-muted uppercase tracking-wider mb-4">
          Valley Folk — {background.length} characters
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {background.map((being) => (
            <BeingCard key={being.id} being={being} isCore={false} compact isFollowing={followedBeingIds.has(being.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function BeingCard({ being, isCore, compact = false, isFollowing = false }: {
  being: {
    id: string;
    name: string;
    role: string;
    age: number;
    lifeStage: string;
    status: string;
    health: number;
    hunger: number;
    happiness: number;
    bravery: number;
    cunning: number;
    empathy: number;
    ambition: number;
    wisdom: number;
    charisma: number;
    currentAction: string | null;
    description: string | null;
    backstory: string | null;
    clan: { name: string; color: string } | null;
  };
  isCore: boolean;
  compact?: boolean;
  isFollowing?: boolean;
}) {
  const statusColors: Record<string, string> = {
    ALIVE: "success",
    INJURED: "warning",
    SICK: "warning",
    DYING: "danger",
    EXILED: "storm",
  };

  const stats = [
    { label: "Bravery", value: being.bravery },
    { label: "Cunning", value: being.cunning },
    { label: "Empathy", value: being.empathy },
    { label: "Ambition", value: being.ambition },
    { label: "Wisdom", value: being.wisdom },
    { label: "Charisma", value: being.charisma },
  ];

  if (compact) {
    return (
      <Card variant="default" hoverable className="p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs border flex-shrink-0"
            style={{
              borderColor: being.clan?.color ?? "#555",
              background: (being.clan?.color ?? "#555") + "20",
            }}
          >
            {being.name[0]}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-fv-text truncate">{being.name}</div>
            <div className="text-xs text-fv-text-dim truncate">{being.role}</div>
          </div>
        </div>
        <div className="text-xs text-fv-text-dim">{being.clan?.name}</div>
        {being.currentAction && (
          <div className="text-xs text-fv-ember italic mt-1 truncate">{being.currentAction}</div>
        )}
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl border-2"
            style={{
              borderColor: being.clan?.color ?? "#555",
              background: (being.clan?.color ?? "#555") + "20",
            }}
          >
            {isCore ? "★" : being.name[0]}
          </div>
          <div>
            <div className="font-display font-bold text-fv-moon">{being.name}</div>
            <div className="text-xs" style={{ color: being.clan?.color ?? "#888" }}>
              {being.role} · {being.clan?.name}
            </div>
          </div>
        </div>
        <Badge variant={(statusColors[being.status] as "success" | "warning" | "danger" | "storm") ?? "default"} className="text-xs">
          {being.status.toLowerCase()}
        </Badge>
      </div>

      {being.description && (
        <p className="text-sm text-fv-text-muted mb-4 leading-relaxed">
          {being.description}
        </p>
      )}

      <div className="text-xs text-fv-text-dim mb-3">Age {being.age} · {being.lifeStage.toLowerCase().replace("_", " ")}</div>

      {/* Stat bars */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-xs text-fv-text-dim mb-0.5">{s.label}</div>
            <div className="stat-bar">
              <div
                className="stat-bar-fill"
                style={{
                  width: `${s.value}%`,
                  backgroundColor: s.value > 70 ? "var(--fv-ember)" : s.value > 40 ? "var(--fv-gold)" : "var(--fv-storm)",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {being.currentAction && (
        <div className="text-xs text-fv-ember italic mb-3">{being.currentAction}</div>
      )}

      <FollowButton
        targetType="BEING"
        targetId={being.id}
        targetName={being.name}
        initialFollowing={isFollowing}
        size="sm"
        className="w-full"
      />
    </Card>
  );
}

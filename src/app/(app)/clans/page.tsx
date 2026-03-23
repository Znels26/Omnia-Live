import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/world/FollowButton";
import { formatWorldAge } from "@/lib/utils";

export default async function ClansPage() {
  const session = await auth();
  const world = await db.world.findFirst({ where: { slug: "first-valley" } });
  if (!world) return <div className="p-8 text-fv-text-muted">World not found.</div>;

  const follows = session?.user?.id
    ? await db.follow.findMany({
        where: { userId: session.user.id, targetType: "CLAN" },
        select: { clanId: true },
      })
    : [];
  const followedClanIds = new Set(follows.map((f) => f.clanId));

  const clans = await db.clan.findMany({
    where: { worldId: world.id },
    include: {
      region: true,
      settlements: true,
      _count: { select: { beings: true } },
    },
    orderBy: { power: "desc" },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-fv-moon mb-2">Clans of First Valley</h1>
        <p className="text-fv-text-muted">
          Three peoples. One valley. Their story is just beginning.
        </p>
      </div>

      <div className="grid gap-6">
        {clans.map((clan) => {
          const relations = (clan.relations as Record<string, string>) ?? {};
          const resources = (clan.resources as Record<string, number>) ?? {};
          const beliefs = (clan.beliefs as string[]) ?? [];
          const traits = (clan.traits as string[]) ?? [];

          return (
            <Card key={clan.id} variant="elevated" className="overflow-hidden">
              {/* Header with clan color */}
              <div
                className="h-2"
                style={{ background: `linear-gradient(90deg, ${clan.color}, ${clan.color}80)` }}
              />
              <div className="p-6">
                <div className="flex items-start gap-5 mb-5">
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 border-2"
                    style={{ borderColor: clan.color, background: clan.color + "18" }}
                  >
                    {clan.emblem ?? "🛡"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h2 className="font-display text-2xl font-bold text-fv-moon">{clan.name}</h2>
                      <ClanStatusBadge status={clan.status} />
                    </div>
                    <p className="text-fv-text-muted text-sm">{clan.culture}</p>
                    <div className="text-xs text-fv-text-dim mt-1">
                      Region: {clan.region?.name ?? "Unknown"} · {formatWorldAge(clan.age)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-display text-3xl font-bold text-fv-moon">{clan.population}</div>
                    <div className="text-xs text-fv-text-muted">people</div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-5">
                  {/* Power */}
                  <div>
                    <div className="text-xs text-fv-text-dim mb-1">Power</div>
                    <div className="stat-bar">
                      <div
                        className="stat-bar-fill"
                        style={{ width: `${Math.min(clan.power, 100)}%`, backgroundColor: clan.color }}
                      />
                    </div>
                    <div className="text-xs text-fv-text-muted mt-1">{clan.power} / 100</div>
                  </div>

                  {/* Resources */}
                  <div>
                    <div className="text-xs text-fv-text-dim mb-1">Resources</div>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(resources).slice(0, 4).map(([key, val]) => (
                        <div key={key} className="text-xs flex items-center gap-1">
                          <span className="text-fv-text-dim capitalize">{key}</span>
                          <span className="text-fv-text">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Settlements */}
                  <div>
                    <div className="text-xs text-fv-text-dim mb-1">Settlements</div>
                    <div className="flex flex-col gap-1">
                      {clan.settlements.map((s) => (
                        <div key={s.id} className="text-xs text-fv-text-muted">
                          {s.name} ({s.type.toLowerCase()})
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Traits */}
                {traits.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3">
                    {traits.map((t) => (
                      <Badge key={t} variant="default" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                )}

                {/* Beliefs */}
                {beliefs.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-fv-text-dim mb-1.5">Core Beliefs</div>
                    <div className="space-y-1">
                      {beliefs.slice(0, 3).map((belief, i) => (
                        <div key={i} className="text-xs text-fv-text-muted flex items-start gap-1.5">
                          <span className="text-fv-ember mt-0.5">›</span>
                          {belief}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <FollowButton
                    targetType="CLAN"
                    targetId={clan.id}
                    targetName={clan.name}
                    initialFollowing={followedClanIds.has(clan.id)}
                    size="sm"
                  />
                  <Button variant="token" size="sm">Support ⚡</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ClanStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "ember" | "storm" | "forest" | "gold" | "danger" }> = {
    ACTIVE: { label: "Active", variant: "forest" },
    AT_WAR: { label: "At War ⚔️", variant: "ember" },
    IN_ALLIANCE: { label: "Allied", variant: "storm" },
    DOMINANT: { label: "Dominant 👑", variant: "gold" },
    COLLAPSED: { label: "Collapsed", variant: "danger" },
  };
  const config = map[status] ?? { label: status, variant: "forest" as const };
  return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
}

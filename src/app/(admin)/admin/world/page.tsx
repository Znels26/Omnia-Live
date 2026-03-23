import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/layout/Navigation";
import { WorldControls } from "../WorldControls";

export default async function AdminWorldPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") redirect("/watch");

  const world = await db.world.findFirst({
    where: { slug: "first-valley" },
    include: {
      regions: true,
      settlements: true,
      _count: {
        select: { beings: true, clans: true, events: true, votes: true, snapshots: true },
      },
    },
  });

  const recentEvents = world
    ? await db.worldEvent.findMany({
        where: { worldId: world.id },
        orderBy: { tick: "desc" },
        take: 20,
        include: { clan: { select: { name: true, color: true } } },
      })
    : [];

  return (
    <div className="flex min-h-screen bg-fv-base">
      <Sidebar isAdmin />
      <div className="flex-1 ml-[200px] p-6">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-fv-moon mb-2">World Controls</h1>
          <p className="text-fv-text-muted">Manage the First Valley simulation</p>
        </div>

        {!world ? (
          <div className="text-fv-text-muted p-8 border border-fv-border rounded-lg text-center">
            No world found. Run the seed script to initialize First Valley.
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Status + Controls */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card variant="default">
                <CardHeader>
                  <CardTitle>World Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-fv-text-muted">Name</span>
                    <span className="text-fv-text font-medium">{world.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-fv-text-muted">Status</span>
                    <Badge variant={world.paused ? "warning" : "forest"}>
                      {world.paused ? "⏸ Paused" : "▶ Running"}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-fv-text-muted">Age</span>
                    <span className="text-fv-text">{world.age.replace("_", " ")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-fv-text-muted">Tick</span>
                    <span className="text-fv-text font-mono">{world.tick.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-fv-text-muted">World Time</span>
                    <span className="text-fv-text font-mono">{world.worldTime.toFixed(2)}</span>
                  </div>
                  <WorldControls worldId={world.id} isPaused={world.paused} />
                </CardContent>
              </Card>

              <Card variant="default">
                <CardHeader>
                  <CardTitle>Population Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Total Beings", value: world._count.beings },
                    { label: "Active Clans", value: world._count.clans },
                    { label: "Settlements", value: world.settlements.length },
                    { label: "Regions", value: world.regions.length },
                    { label: "Total Events", value: world._count.events },
                    { label: "Active Votes", value: world._count.votes },
                    { label: "Snapshots", value: world._count.snapshots },
                  ].map((stat) => (
                    <div key={stat.label} className="flex justify-between text-sm">
                      <span className="text-fv-text-muted">{stat.label}</span>
                      <span className="text-fv-text font-medium">{stat.value.toLocaleString()}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Regions */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>Regions ({world.regions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {world.regions.map((region) => (
                    <div
                      key={region.id}
                      className="p-3 rounded-lg border border-fv-border bg-fv-card text-xs"
                      style={{ borderLeftColor: region.color, borderLeftWidth: 3 }}
                    >
                      <div className="font-medium text-fv-text mb-1">{region.name}</div>
                      <div className="text-fv-text-dim">{region.type.replace("_", " ")}</div>
                      <div className="text-fv-text-dim mt-1">
                        Fertility {Math.round(region.fertility * 100)}% · Water {Math.round(region.waterAccess * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Events */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>Recent Events (Last 20)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 py-2 border-b border-fv-border last:border-0">
                      <span className="text-xs text-fv-text-dim font-mono flex-shrink-0 mt-0.5">T{event.tick}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm text-fv-text font-medium">{event.title}</span>
                          <Badge
                            variant={event.importance >= 80 ? "ember" : event.importance >= 60 ? "warning" : "default"}
                            className="text-xs flex-shrink-0"
                          >
                            {event.importance}
                          </Badge>
                        </div>
                        <p className="text-xs text-fv-text-muted leading-relaxed">{event.description}</p>
                        {event.clan && (
                          <span className="text-xs mt-1 inline-block" style={{ color: event.clan.color }}>
                            {event.clan.name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-fv-text-dim flex-shrink-0">{event.category}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

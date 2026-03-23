import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/layout/Navigation";
import Link from "next/link";
import { WorldControls } from "./WorldControls";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") {
    redirect("/watch");
  }

  const [world, userCount, subscriberCount, recentEvents] = await Promise.all([
    db.world.findFirst({
      where: { slug: "first-valley" },
      include: {
        _count: { select: { beings: true, clans: true, settlements: true, events: true } },
      },
    }),
    db.user.count(),
    db.user.count({ where: { role: "SUBSCRIBER" } }),
    db.worldEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { clan: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="flex min-h-screen bg-fv-base">
      <Sidebar isAdmin />
      <div className="flex-1 ml-[200px] p-6">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-fv-moon mb-2">Admin Dashboard</h1>
          <p className="text-fv-text-muted">Control panel for First Valley</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Users", value: userCount, icon: "👥" },
            { label: "Subscribers", value: subscriberCount, icon: "⭐", highlight: true },
            { label: "World Tick", value: world?.tick ?? 0, icon: "⏱" },
            { label: "Total Events", value: world?._count.events ?? 0, icon: "📌" },
          ].map((stat) => (
            <Card
              key={stat.label}
              variant={stat.highlight ? "ember" : "default"}
              className="p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{stat.icon}</span>
                <span className="text-xs text-fv-text-muted uppercase tracking-wider font-display">
                  {stat.label}
                </span>
              </div>
              <div className="font-display text-3xl font-bold text-fv-moon">
                {stat.value.toLocaleString()}
              </div>
            </Card>
          ))}
        </div>

        {/* World status & controls */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <Card variant="default">
            <CardHeader>
              <CardTitle>World State</CardTitle>
            </CardHeader>
            <CardContent>
              {world ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-fv-text-muted">Status</span>
                    <Badge variant={world.paused ? "warning" : "forest"}>
                      {world.paused ? "Paused" : "Running"}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-fv-text-muted">Age</span>
                    <span className="text-fv-text">{world.age}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-fv-text-muted">Beings</span>
                    <span className="text-fv-text">{world._count.beings}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-fv-text-muted">Settlements</span>
                    <span className="text-fv-text">{world._count.settlements}</span>
                  </div>
                  <WorldControls worldId={world.id} isPaused={world.paused} />
                </div>
              ) : (
                <div className="text-fv-text-muted">No world found. Run the seed script.</div>
              )}
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentEvents.slice(0, 8).map((e) => (
                  <div key={e.id} className="flex items-start gap-2 text-xs">
                    <span className="text-fv-text-muted flex-shrink-0">T{e.tick}</span>
                    <span className="text-fv-text flex-1 leading-tight">{e.title}</span>
                    <span className="text-fv-text-dim flex-shrink-0">{e.importance}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/admin/world", label: "World Controls", icon: "🌍" },
            { href: "/admin/characters", label: "Characters", icon: "👥" },
            { href: "/admin/tokens", label: "Token Economy", icon: "⚡" },
            { href: "/admin/analytics", label: "Analytics", icon: "📊" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="fv-card-hover p-4 rounded-lg text-center transition-all"
            >
              <div className="text-2xl mb-2">{link.icon}</div>
              <div className="text-sm font-medium text-fv-text">{link.label}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

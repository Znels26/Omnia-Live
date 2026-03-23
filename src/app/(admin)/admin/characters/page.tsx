import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/layout/Navigation";

export default async function AdminCharactersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") redirect("/watch");

  const world = await db.world.findFirst({ where: { slug: "first-valley" } });

  const beings = world
    ? await db.being.findMany({
        where: { worldId: world.id },
        include: { clan: { select: { name: true, color: true } } },
        orderBy: [{ isCore: "desc" }, { status: "asc" }, { charisma: "desc" }],
      })
    : [];

  const alive = beings.filter((b) => b.status !== "DEAD");
  const dead = beings.filter((b) => b.status === "DEAD");
  const core = alive.filter((b) => b.isCore);

  const statusColors: Record<string, string> = {
    ALIVE: "success",
    INJURED: "warning",
    SICK: "warning",
    DYING: "danger",
    EXILED: "storm",
    DEAD: "danger",
  };

  return (
    <div className="flex min-h-screen bg-fv-base">
      <Sidebar isAdmin />
      <div className="flex-1 ml-[200px] p-6">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-fv-moon mb-2">Characters</h1>
          <p className="text-fv-text-muted">
            {alive.length} alive · {dead.length} dead · {core.length} core characters
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Beings", value: beings.length },
            { label: "Alive", value: alive.length, highlight: true },
            { label: "Core Characters", value: core.length },
            { label: "Dead", value: dead.length },
          ].map((stat) => (
            <Card key={stat.label} variant={stat.highlight ? "ember" : "default"} className="p-4">
              <div className="text-xs text-fv-text-muted uppercase tracking-wider mb-1">{stat.label}</div>
              <div className="font-display text-3xl font-bold text-fv-moon">{stat.value}</div>
            </Card>
          ))}
        </div>

        {/* Core characters */}
        {core.length > 0 && (
          <Card variant="default" className="mb-6">
            <CardHeader>
              <CardTitle>Core Characters ({core.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-fv-border text-left">
                      <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Name</th>
                      <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Role</th>
                      <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Clan</th>
                      <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Status</th>
                      <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Age</th>
                      <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Health</th>
                      <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {core.map((being) => (
                      <tr key={being.id} className="border-b border-fv-border last:border-0 hover:bg-fv-card">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full border flex items-center justify-center text-xs flex-shrink-0"
                              style={{ borderColor: being.clan?.color ?? "#555", background: (being.clan?.color ?? "#555") + "20" }}
                            >
                              ★
                            </div>
                            <span className="font-medium text-fv-moon">{being.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-fv-text-muted text-xs">{being.role}</td>
                        <td className="py-2.5 pr-4 text-xs" style={{ color: being.clan?.color ?? "#888" }}>
                          {being.clan?.name ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={(statusColors[being.status] as "success" | "warning" | "danger" | "storm") ?? "default"} className="text-xs">
                            {being.status.toLowerCase()}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-fv-text-muted text-xs">{being.age}</td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1 bg-fv-border rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${being.health}%`,
                                  backgroundColor: being.health > 60 ? "#4ade80" : being.health > 30 ? "#facc15" : "#f87171",
                                }}
                              />
                            </div>
                            <span className="text-xs text-fv-text-dim">{being.health}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-fv-ember text-xs italic max-w-[200px] truncate">
                          {being.currentAction ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All beings table */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>All Living Beings ({alive.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-fv-border text-left">
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Name</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Clan</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Status</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Age</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Stage</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">H/Hg/Hp</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Current</th>
                  </tr>
                </thead>
                <tbody>
                  {alive.map((being) => (
                    <tr key={being.id} className="border-b border-fv-border last:border-0 hover:bg-fv-card">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          {being.isCore && <span className="text-fv-gold text-xs">★</span>}
                          <span className={`text-xs ${being.isCore ? "font-medium text-fv-moon" : "text-fv-text"}`}>{being.name}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-xs" style={{ color: being.clan?.color ?? "#888" }}>
                        {being.clan?.name ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={(statusColors[being.status] as "success" | "warning" | "danger" | "storm") ?? "default"} className="text-xs">
                          {being.status.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-xs text-fv-text-muted">{being.age}</td>
                      <td className="py-2 pr-4 text-xs text-fv-text-dim">{being.lifeStage.replace("_", " ").toLowerCase()}</td>
                      <td className="py-2 pr-4 text-xs text-fv-text-dim font-mono">
                        {being.health}/{being.hunger}/{being.happiness}
                      </td>
                      <td className="py-2 text-fv-ember text-xs italic max-w-[160px] truncate">
                        {being.currentAction ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

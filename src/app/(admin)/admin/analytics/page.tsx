import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/layout/Navigation";

export default async function AdminAnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") redirect("/watch");

  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersLast7,
    newUsersLast30,
    totalSubscribers,
    activeVotes,
    closedVotes,
    totalFollows,
    totalInterventions,
    voteBreakdown,
    recentUsers,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: last7Days } } }),
    db.user.count({ where: { createdAt: { gte: last30Days } } }),
    db.user.count({ where: { role: "SUBSCRIBER" } }),
    db.vote.count({ where: { status: "ACTIVE" } }),
    db.vote.count({ where: { status: "CLOSED" } }),
    db.follow.count(),
    db.intervention.count(),
    db.userVote.groupBy({ by: ["voteId"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5 }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    }),
  ]);

  const conversionRate = totalUsers > 0 ? ((totalSubscribers / totalUsers) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex min-h-screen bg-fv-base">
      <Sidebar isAdmin />
      <div className="flex-1 ml-[200px] p-6">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-fv-moon mb-2">Analytics</h1>
          <p className="text-fv-text-muted">Platform-wide statistics and engagement</p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Users", value: totalUsers.toLocaleString(), icon: "👥" },
            { label: "Subscribers", value: totalSubscribers.toLocaleString(), icon: "⭐", highlight: true },
            { label: "Conversion Rate", value: `${conversionRate}%`, icon: "📈" },
            { label: "Total Follows", value: totalFollows.toLocaleString(), icon: "⭐" },
          ].map((stat) => (
            <Card key={stat.label} variant={stat.highlight ? "ember" : "default"} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span>{stat.icon}</span>
                <span className="text-xs text-fv-text-muted uppercase tracking-wider font-display">{stat.label}</span>
              </div>
              <div className="font-display text-3xl font-bold text-fv-moon">{stat.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Growth */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>User Growth</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "New users (last 7 days)", value: newUsersLast7, icon: "📅" },
                { label: "New users (last 30 days)", value: newUsersLast30, icon: "📆" },
                { label: "Total subscribers", value: totalSubscribers, icon: "⭐" },
                { label: "Subscriber conversion", value: `${conversionRate}%`, icon: "📊" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-fv-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm text-fv-text-muted">{item.label}</span>
                  </div>
                  <span className="font-display font-bold text-fv-moon">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Engagement */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Active votes", value: activeVotes, icon: "🗳️" },
                { label: "Closed votes", value: closedVotes, icon: "✅" },
                { label: "Total follows", value: totalFollows, icon: "⭐" },
                { label: "Interventions purchased", value: totalInterventions, icon: "⚡" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-fv-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm text-fv-text-muted">{item.label}</span>
                  </div>
                  <span className="font-display font-bold text-fv-moon">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent signups */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Recent Signups (Last 15)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-fv-border text-left">
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Email</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Name</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Role</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((u) => (
                    <tr key={u.id} className="border-b border-fv-border last:border-0 hover:bg-fv-card">
                      <td className="py-2.5 pr-4 text-xs text-fv-text">{u.email}</td>
                      <td className="py-2.5 pr-4 text-xs text-fv-text-muted">{u.name ?? "—"}</td>
                      <td className="py-2.5 pr-4">
                        <Badge
                          variant={u.role === "ADMIN" ? "ember" : u.role === "SUBSCRIBER" ? "gold" : "default"}
                          className="text-xs"
                        >
                          {u.role.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-xs text-fv-text-dim whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString()}
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

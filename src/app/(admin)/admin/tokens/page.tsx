import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/layout/Navigation";

export default async function AdminTokensPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") redirect("/watch");

  const [wallets, packs, recentTransactions] = await Promise.all([
    db.tokenWallet.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { balance: "desc" },
      take: 20,
    }),
    db.tokenPack.findMany({ orderBy: { sortOrder: "asc" } }),
    db.tokenTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { wallet: { include: { user: { select: { email: true } } } } },
    }),
  ]);

  const totalTokensInCirculation = wallets.reduce((s, w) => s + w.balance, 0);
  const totalTokensEverIssued = wallets.reduce((s, w) => s + w.totalEarned, 0);
  const totalTokensSpent = wallets.reduce((s, w) => s + w.totalSpent, 0);

  const txTypeColors: Record<string, string> = {
    PURCHASE: "forest",
    VOTE_SPEND: "storm",
    INTERVENTION_SPEND: "ember",
    BONUS: "gold",
    REFUND: "warning",
    ADMIN_GRANT: "gold",
  };

  return (
    <div className="flex min-h-screen bg-fv-base">
      <Sidebar isAdmin />
      <div className="flex-1 ml-[200px] p-6">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-fv-moon mb-2">Token Economy</h1>
          <p className="text-fv-text-muted">Manage Fate Tokens across the platform</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "In Circulation", value: totalTokensInCirculation.toLocaleString(), icon: "⚡", highlight: true },
            { label: "Ever Issued", value: totalTokensEverIssued.toLocaleString(), icon: "📦" },
            { label: "Total Spent", value: totalTokensSpent.toLocaleString(), icon: "💸" },
            { label: "Wallet Count", value: wallets.length.toLocaleString(), icon: "👛" },
          ].map((stat) => (
            <Card key={stat.label} variant={stat.highlight ? "gold" : "default"} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span>{stat.icon}</span>
                <span className="text-xs text-fv-text-muted uppercase tracking-wider">{stat.label}</span>
              </div>
              <div className="font-display text-2xl font-bold text-fv-moon">{stat.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Token packs */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Token Packs</CardTitle>
            </CardHeader>
            <CardContent>
              {packs.length === 0 ? (
                <div className="text-fv-text-muted text-sm">No token packs configured.</div>
              ) : (
                <div className="space-y-3">
                  {packs.map((pack) => (
                    <div key={pack.id} className="flex items-center justify-between p-3 rounded-lg border border-fv-border bg-fv-card">
                      <div>
                        <div className="font-medium text-fv-moon text-sm">{pack.name}</div>
                        <div className="text-xs text-fv-text-muted mt-0.5">
                          ⚡ {pack.tokens} tokens
                          {pack.bonusTokens > 0 && <span className="text-fv-gold ml-1">+{pack.bonusTokens} bonus</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-bold text-fv-moon">${(pack.priceUsd / 100).toFixed(2)}</div>
                        <Badge variant={pack.active ? "forest" : "default"} className="text-xs mt-0.5">
                          {pack.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top wallets */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Top Wallets (by balance)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {wallets.slice(0, 10).map((wallet) => (
                  <div key={wallet.id} className="flex items-center justify-between text-sm py-1.5 border-b border-fv-border last:border-0">
                    <div className="min-w-0">
                      <div className="text-fv-text truncate text-xs">{wallet.user.email}</div>
                      <div className="text-fv-text-dim text-xs">Spent: {wallet.totalSpent.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <span className="text-fv-gold text-xs">⚡</span>
                      <span className="font-display font-bold text-fv-moon">{wallet.balance.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent transactions */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Recent Transactions (Last 30)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-fv-border text-left">
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">User</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Type</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Amount</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Balance After</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Description</th>
                    <th className="pb-2 text-xs text-fv-text-dim uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-fv-border last:border-0 hover:bg-fv-card">
                      <td className="py-2 pr-4 text-xs text-fv-text-muted truncate max-w-[120px]">
                        {tx.wallet.user.email}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge
                          variant={(txTypeColors[tx.type] as "forest" | "storm" | "ember" | "gold" | "warning") ?? "default"}
                          className="text-xs"
                        >
                          {tx.type.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs font-mono font-bold ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs text-fv-text font-mono">{tx.balanceAfter}</td>
                      <td className="py-2 pr-4 text-xs text-fv-text-muted max-w-[200px] truncate">{tx.description}</td>
                      <td className="py-2 text-xs text-fv-text-dim whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString()}
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

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TokenPurchaseButton } from "./TokenPurchaseButton";

export default async function TokensPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [wallet, packs] = await Promise.all([
    db.tokenWallet.findUnique({
      where: { userId: session.user.id },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    }),
    db.tokenPack.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-fv-moon mb-2">Fate Tokens</h1>
        <p className="text-fv-text-muted">
          Use tokens to vote on high-stakes events and intervene in the valley.
        </p>
      </div>

      {/* Wallet balance */}
      <Card variant="gold" className="p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-fv-gold uppercase tracking-wider font-display mb-1">Your Balance</div>
            <div className="font-display text-5xl font-bold text-fv-moon">
              {wallet?.balance ?? 0}
            </div>
            <div className="text-sm text-fv-text-muted mt-1">fate tokens</div>
          </div>
          <div className="text-right text-sm text-fv-text-dim space-y-1">
            <div>Total earned: {wallet?.totalEarned ?? 0}</div>
            <div>Total spent: {wallet?.totalSpent ?? 0}</div>
          </div>
        </div>
      </Card>

      {/* Token packs */}
      <h2 className="font-display text-lg font-bold text-fv-moon mb-4">Purchase Tokens</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {packs.map((pack) => (
          <Card
            key={pack.id}
            variant={pack.badge === "POPULAR" ? "gold" : "default"}
            className="p-5 relative"
          >
            {pack.badge && (
              <div className="absolute -top-3 right-4">
                <Badge variant="gold" className="text-xs">{pack.badge}</Badge>
              </div>
            )}

            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-display font-bold text-fv-moon text-lg">{pack.name}</div>
                <div className="text-fv-text-muted text-sm">
                  {pack.tokens.toLocaleString()} tokens
                  {pack.bonusTokens > 0 && (
                    <span className="text-fv-gold ml-1">+ {pack.bonusTokens} bonus</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-bold text-fv-gold text-xl">
                  ${(pack.priceUsd / 100).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="text-xs text-fv-text-dim mb-4">
              ≈ {Math.round((pack.tokens + pack.bonusTokens) / 50)} votes ·{" "}
              {Math.round((pack.tokens + pack.bonusTokens) / 100)} interventions
            </div>

            <TokenPurchaseButton packId={pack.id} />
          </Card>
        ))}
      </div>

      {/* What tokens do */}
      <h2 className="font-display text-lg font-bold text-fv-moon mb-4">What Tokens Do</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
        {[
          { icon: "🗳️", action: "Cast weighted votes", cost: "1–50 tokens", desc: "More tokens = more influence on the outcome." },
          { icon: "⚡", action: "Inspire a character", cost: "50 tokens", desc: "Boost a being's confidence and performance." },
          { icon: "🎁", action: "Gift food to a clan", cost: "75 tokens", desc: "Send resources to a struggling settlement." },
          { icon: "👑", action: "Back a leader", cost: "100 tokens", desc: "Increase a character's leadership influence." },
          { icon: "⚔️", action: "Gift weapons", cost: "150 tokens", desc: "Improve a clan's combat strength." },
          { icon: "🌟", action: "Trigger a miracle", cost: "500 tokens", desc: "A rare, world-altering event. Use wisely." },
        ].map((item) => (
          <div key={item.action} className="flex gap-3 p-3 fv-card">
            <span className="text-xl flex-shrink-0">{item.icon}</span>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-fv-text">{item.action}</span>
                <Badge variant="gold" className="text-xs">{item.cost}</Badge>
              </div>
              <p className="text-xs text-fv-text-muted">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Transaction history */}
      {wallet?.transactions && wallet.transactions.length > 0 && (
        <>
          <h2 className="font-display text-lg font-bold text-fv-moon mb-4">Transaction History</h2>
          <div className="space-y-2">
            {wallet.transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 fv-card text-sm">
                <div>
                  <div className="text-fv-text">{tx.description}</div>
                  <div className="text-xs text-fv-text-dim">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className={`font-medium ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

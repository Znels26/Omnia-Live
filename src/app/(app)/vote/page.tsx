import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VoteCard } from "./VoteCard";

export default async function VotePage() {
  const world = await db.world.findFirst({ where: { slug: "first-valley" } });
  if (!world) return <div className="p-8 text-fv-text-muted">World not found.</div>;

  const [activeVotes, closedVotes] = await Promise.all([
    db.vote.findMany({
      where: { worldId: world.id, status: "ACTIVE" },
      include: { userVotes: true },
      orderBy: { createdAt: "desc" },
    }),
    db.vote.findMany({
      where: { worldId: world.id, status: "CLOSED" },
      include: { userVotes: true },
      orderBy: { closedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-fv-moon mb-2">Vote & Intervene</h1>
        <p className="text-fv-text-muted">
          The valley listens. Your vote shapes fate.
        </p>
      </div>

      {/* Active votes */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h2 className="font-display text-sm text-fv-ember uppercase tracking-wider">
            Active Votes ({activeVotes.length})
          </h2>
        </div>

        {activeVotes.length === 0 ? (
          <Card variant="default" className="p-8 text-center">
            <div className="text-3xl mb-3">🗳️</div>
            <div className="text-fv-text-muted">No active votes right now.</div>
            <div className="text-xs text-fv-text-dim mt-1">
              The valley is quiet. A new vote will arrive soon.
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeVotes.map((vote) => (
              <VoteCard
                key={vote.id}
                vote={{
                  id: vote.id,
                  title: vote.title,
                  description: vote.description,
                  options: vote.options as Array<{id: string; label: string; description: string; votes: number}>,
                  tokenCost: vote.tokenCost,
                  type: vote.type,
                  endsAt: vote.endsAt.toISOString(),
                  totalVotes: vote.userVotes.length,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Closed votes */}
      {closedVotes.length > 0 && (
        <section>
          <h2 className="font-display text-sm text-fv-text-muted uppercase tracking-wider mb-4">
            Past Votes
          </h2>
          <div className="space-y-3">
            {closedVotes.map((vote) => {
              const options = (vote.options as Array<{id: string; label: string; votes: number}>) ?? [];
              const winner = options.sort((a, b) => b.votes - a.votes)[0];
              return (
                <div key={vote.id} className="fv-card p-4 opacity-70">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-fv-text text-sm">{vote.title}</div>
                      {winner && (
                        <div className="text-xs text-fv-ember mt-0.5">
                          Result: <span className="font-medium">{winner.label}</span>
                        </div>
                      )}
                    </div>
                    <Badge variant="default" className="text-xs">Closed</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* How voting works */}
      <section className="mt-10">
        <h2 className="font-display text-sm text-fv-text-muted uppercase tracking-wider mb-4">
          How It Works
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: "🗳️", title: "Standard votes", desc: "Free with subscription. One vote per decision." },
            { icon: "⚡", title: "Token votes", desc: "Spend tokens for stronger influence on outcomes." },
            { icon: "🌟", title: "Interventions", desc: "Direct actions that affect specific beings or clans." },
            { icon: "📜", title: "Your impact", desc: "All votes are recorded in world history permanently." },
          ].map((item) => (
            <div key={item.title} className="fv-card p-4">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="text-sm font-medium text-fv-text mb-1">{item.title}</div>
              <div className="text-xs text-fv-text-muted">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

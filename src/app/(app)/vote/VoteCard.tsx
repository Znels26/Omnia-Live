"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface VoteOption {
  id: string;
  label: string;
  description: string;
  votes: number;
}

interface VoteProps {
  vote: {
    id: string;
    title: string;
    description: string;
    options: VoteOption[];
    tokenCost: number;
    type: string;
    endsAt: string;
    totalVotes: number;
  };
}

export function VoteCard({ vote }: VoteProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  const totalVotes = vote.options.reduce((s, o) => s + o.votes, 0);

  async function castVote() {
    if (!selected || voted) return;
    setLoading(true);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteId: vote.id, optionId: selected }),
      });

      if (res.ok) {
        setVoted(true);
      }
    } catch (error) {
      console.error("Vote error:", error);
    }

    setLoading(false);
  }

  const timeLeft = (() => {
    const diff = new Date(vote.endsAt).getTime() - Date.now();
    if (diff <= 0) return "Ended";
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d remaining`;
    return `${hours}h remaining`;
  })();

  return (
    <Card variant={vote.type === "PREMIUM" ? "gold" : "elevated"} className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={vote.type === "CLAN_FATE" ? "ember" : vote.type === "CHARACTER_FATE" ? "gold" : "storm"}
            className="text-xs"
          >
            {vote.type.toLowerCase().replace("_", " ")}
          </Badge>
          {vote.tokenCost > 0 && (
            <Badge variant="gold" className="text-xs">⚡ {vote.tokenCost} tokens</Badge>
          )}
        </div>
        <span className="text-xs text-fv-text-dim">{timeLeft}</span>
      </div>

      <h3 className="font-display font-bold text-fv-moon text-lg mb-2">{vote.title}</h3>
      <p className="text-sm text-fv-text-muted mb-4 leading-relaxed">{vote.description}</p>

      {voted ? (
        <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-4 text-center">
          <div className="text-green-400 font-medium text-sm">✓ Your vote has been cast</div>
          <div className="text-xs text-fv-text-dim mt-1">The valley has received your guidance.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {vote.options.map((option) => {
            const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
            const isSelected = selected === option.id;

            return (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={`w-full p-3 rounded-lg text-left transition-all border ${
                  isSelected
                    ? "border-fv-ember bg-fv-ember/10"
                    : "border-fv-border hover:border-fv-border-bright hover:bg-fv-card"
                }`}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "border-fv-ember" : "border-fv-border"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-fv-ember" />}
                    </div>
                    <span className={`text-sm font-medium ${isSelected ? "text-fv-ember" : "text-fv-text"}`}>
                      {option.label}
                    </span>
                  </div>
                  <span className="text-xs text-fv-text-dim">{pct}%</span>
                </div>
                {option.description && (
                  <p className="text-xs text-fv-text-muted ml-6 mb-1.5">{option.description}</p>
                )}
                <div className="ml-6 stat-bar">
                  <div
                    className="stat-bar-fill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isSelected ? "var(--fv-ember)" : "var(--fv-border-bright)",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </button>
            );
          })}

          <Button
            variant="primary"
            className="w-full mt-2"
            disabled={!selected}
            loading={loading}
            onClick={castVote}
          >
            {vote.tokenCost > 0 ? `Cast Vote (⚡ ${vote.tokenCost})` : "Cast Vote"}
          </Button>
        </div>
      )}

      <div className="text-xs text-fv-text-dim text-center mt-3">
        {totalVotes} total votes · {vote.type === "STANDARD" ? "Free vote" : "Premium vote"}
      </div>
    </Card>
  );
}

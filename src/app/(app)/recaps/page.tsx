import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function RecapsPage() {
  const world = await db.world.findFirst({ where: { slug: "first-valley" } });
  if (!world) return <div className="p-8 text-fv-text-muted">World not found.</div>;

  const recaps = await db.recap.findMany({
    where: { worldId: world.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-fv-moon mb-2">Recaps</h1>
        <p className="text-fv-text-muted">
          Previously in First Valley. Every chapter of the story.
        </p>
      </div>

      {recaps.length === 0 ? (
        <Card variant="default" className="p-8 text-center">
          <div className="text-4xl mb-4">📜</div>
          <div className="text-fv-text-muted">
            The valley is young. Recaps are generated daily.
          </div>
          <div className="text-xs text-fv-text-dim mt-2">
            Check back after the first day passes.
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {recaps.map((recap) => {
            const highlights = (recap.highlights as Array<{ title: string; description: string; importance: number }>) ?? [];
            return (
              <Card key={recap.id} variant="elevated">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{recap.title}</CardTitle>
                    <Badge
                      variant={
                        recap.type === "DAILY" ? "storm"
                        : recap.type === "WEEKLY" ? "ember"
                        : recap.type === "ERA" ? "gold"
                        : "default"
                      }
                      className="text-xs"
                    >
                      {recap.type.toLowerCase().replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-fv-text-dim mt-1">
                    Ticks {recap.tickStart}–{recap.tickEnd} ·{" "}
                    {new Date(recap.createdAt).toLocaleDateString()}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-fv-text-muted leading-relaxed mb-4">{recap.summary}</p>

                  {highlights.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs text-fv-text-dim uppercase tracking-wider">Highlights</div>
                      {highlights.slice(0, 4).map((h, i) => (
                        <div key={i} className="pl-3 border-l-2 border-fv-border">
                          <div className="text-sm font-medium text-fv-text">{h.title}</div>
                          <div className="text-xs text-fv-text-muted mt-0.5 leading-relaxed">
                            {h.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {recap.content && recap.content !== recap.summary && (
                    <details className="mt-4">
                      <summary className="text-xs text-fv-ember cursor-pointer hover:text-fv-ember-bright">
                        Read full recap
                      </summary>
                      <p className="text-sm text-fv-text-muted mt-3 leading-relaxed whitespace-pre-wrap">
                        {recap.content}
                      </p>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEventIcon, getEventCategoryColor, formatWorldAge } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function TimelinePage() {
  const world = await db.world.findFirst({ where: { slug: "first-valley" } });
  if (!world) return <div className="p-8 text-fv-text-muted">World not found.</div>;

  const events = await db.worldEvent.findMany({
    where: { worldId: world.id, importance: { gte: 60 } },
    include: {
      clan: { select: { name: true, color: true } },
      being: { select: { name: true } },
    },
    orderBy: { tick: "desc" },
    take: 100,
  });

  // Group by era/age transitions
  const grouped: Array<{
    label: string;
    events: typeof events;
  }> = [{ label: formatWorldAge(world.age), events }];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-fv-moon mb-2">World Timeline</h1>
        <p className="text-fv-text-muted">
          The history of First Valley. Every turning point. Every war. Every discovery.
        </p>
      </div>

      {/* Current world state */}
      <div className="fv-card p-4 mb-8 flex items-center gap-4">
        <div className="text-3xl">🌍</div>
        <div>
          <div className="font-display text-fv-moon font-medium">
            {formatWorldAge(world.age)}
          </div>
          <div className="text-xs text-fv-text-muted">
            Tick {world.tick} · Day {(world.config as Record<string,number>)?.day ?? 1} · Year {(world.config as Record<string,number>)?.year ?? 1}
          </div>
        </div>
        <Badge variant="ember" className="ml-auto">CURRENT ERA</Badge>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-fv-border" />

        <div className="space-y-4 pl-12">
          {events.map((event, i) => {
            const icon = getEventIcon(event.type);
            const categoryColor = getEventCategoryColor(event.category);
            const isHighlighted = event.importance >= 80;

            return (
              <div key={event.id} className={`relative ${isHighlighted ? "animate-fade-in" : ""}`}>
                {/* Timeline dot */}
                <div
                  className={`absolute -left-8 top-3 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    isHighlighted
                      ? "border-fv-gold bg-fv-gold/20"
                      : "border-fv-border bg-fv-surface"
                  }`}
                >
                  {isHighlighted && (
                    <div className="w-1.5 h-1.5 rounded-full bg-fv-gold" />
                  )}
                </div>

                <div
                  className={`fv-card p-4 transition-all ${
                    isHighlighted ? "border-fv-gold/30 bg-fv-gold/5" : "hover:border-fv-border-bright"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-fv-text text-sm">{event.title}</span>
                        {isHighlighted && (
                          <Badge variant="gold" className="text-xs">MAJOR</Badge>
                        )}
                      </div>
                      <p className="text-xs text-fv-text-muted leading-relaxed mb-2">
                        {event.description}
                      </p>
                      {event.impact && (
                        <p className="text-xs text-fv-ember italic">{event.impact}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-xs font-medium ${categoryColor}`}>
                          {event.category.toLowerCase()}
                        </span>
                        {event.clan && (
                          <span
                            className="text-xs"
                            style={{ color: event.clan.color }}
                          >
                            {event.clan.name}
                          </span>
                        )}
                        {event.being && (
                          <span className="text-xs text-fv-text-dim">{event.being.name}</span>
                        )}
                        <span className="text-xs text-fv-text-dim ml-auto">
                          Tick {event.tick}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* World start marker */}
          <div className="relative">
            <div className="absolute -left-8 top-3 w-4 h-4 rounded-full border-2 border-fv-ember bg-fv-ember/20 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-fv-ember" />
            </div>
            <div className="fv-card p-4 border-fv-ember/30">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🌅</span>
                <span className="font-display font-bold text-fv-ember">First Valley Begins</span>
              </div>
              <p className="text-xs text-fv-text-muted">
                Three clans. A virgin valley. The beginning of everything.
              </p>
              <div className="text-xs text-fv-text-dim mt-1">Tick 0 · Year 1, Day 1</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

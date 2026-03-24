import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { Eye, Flame, Users, Globe, Clock } from "lucide-react";

export default async function PreviewPage() {
  const admin = createAdminClient();

  const { data: world } = await admin
    .from("worlds")
    .select("id, name, era, in_game_day, in_game_year, status")
    .eq("slug", "first-valley")
    .single();

  const recentEvents = world
    ? await admin
        .from("public_events")
        .select("id, event_type, title, description, significance_score, is_milestone, in_game_day")
        .eq("world_id", world.id)
        .gte("significance_score", 6)
        .order("created_at", { ascending: false })
        .limit(5)
        .then((r) => r.data ?? [])
    : [];

  const cultures = world
    ? await admin
        .from("cultures")
        .select("id, name, color_hex, population_estimate, description")
        .eq("world_id", world.id)
        .then((r) => r.data ?? [])
    : [];

  const { count: personCount } = world
    ? await admin
        .from("persons")
        .select("*", { count: "exact", head: true })
        .eq("world_id", world.id)
        .eq("is_alive", true)
    : { count: 0 };

  return (
    <div className="min-h-screen bg-fv-void text-fv-text overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-fv-void/90 backdrop-blur-md border-b border-fv-border-subtle">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-fv-ember to-fv-gold flex items-center justify-center">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-fv-moon text-sm tracking-wide">First Valley</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button variant="cinematic" size="sm">Subscribe — $10/mo</Button>
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="pt-24 pb-8 px-6 text-center">
        <Badge variant="ember" className="mb-4 text-xs">
          🔴 LIVE · {world ? `Day ${world.in_game_day}, Year ${world.in_game_year}` : "Loading..."}
        </Badge>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-fv-moon mb-3">
          Free Preview
        </h1>
        <p className="text-fv-text-muted max-w-xl mx-auto">
          A glimpse into the living world. Subscribe to watch everything unfold in real time.
        </p>
      </div>

      {/* World Stats */}
      {world && (
        <div className="max-w-4xl mx-auto px-6 mb-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <Globe className="w-4 h-4" />, label: "Era", value: world.era },
            { icon: <Clock className="w-4 h-4" />, label: "World Day", value: `Day ${world.in_game_day}` },
            { icon: <Users className="w-4 h-4" />, label: "Alive", value: personCount ?? "—" },
            { icon: <Eye className="w-4 h-4" />, label: "Cultures", value: cultures.length },
          ].map((stat) => (
            <div key={stat.label} className="fv-card p-4 text-center">
              <div className="text-fv-ember mb-1 flex justify-center">{stat.icon}</div>
              <div className="text-xl font-bold text-fv-moon font-display">{stat.value}</div>
              <div className="text-xs text-fv-text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Cultures */}
      {cultures.length > 0 && (
        <div className="max-w-4xl mx-auto px-6 mb-8">
          <h2 className="font-display text-lg text-fv-moon mb-4">The Three Clans</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {cultures.map((c) => (
              <div key={c.id} className="fv-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: c.color_hex ?? "#888" }}
                  />
                  <span className="font-display font-semibold text-fv-moon text-sm">{c.name}</span>
                  <span className="ml-auto text-xs text-fv-text-muted">{c.population_estimate} people</span>
                </div>
                <p className="text-xs text-fv-text-muted leading-relaxed line-clamp-3">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Events — blurred/limited */}
      <div className="max-w-4xl mx-auto px-6 mb-10">
        <h2 className="font-display text-lg text-fv-moon mb-4">Recent Events</h2>
        <div className="space-y-2">
          {recentEvents.slice(0, 3).map((event) => (
            <div key={event.id} className="event-feed-item rounded-md">
              <div className="flex items-start gap-3">
                <span className="text-fv-text-dim text-xs mt-0.5 shrink-0">Day {event.in_game_day}</span>
                <div>
                  <div className="text-sm font-medium text-fv-text">{event.title}</div>
                  <div className="text-xs text-fv-text-muted mt-0.5">{event.description}</div>
                </div>
              </div>
            </div>
          ))}
          {/* Blurred teaser events */}
          {recentEvents.slice(3).map((event) => (
            <div key={event.id} className="event-feed-item rounded-md blur-sm select-none pointer-events-none">
              <div className="flex items-start gap-3">
                <span className="text-fv-text-dim text-xs mt-0.5 shrink-0">Day {event.in_game_day}</span>
                <div>
                  <div className="text-sm font-medium text-fv-text">{event.title}</div>
                  <div className="text-xs text-fv-text-muted mt-0.5">{event.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div
        className="relative py-16 px-6 text-center border-t border-fv-border"
        style={{ background: "linear-gradient(to top, rgba(201,113,74,0.08), transparent)" }}
      >
        <h2 className="font-display text-3xl font-bold text-fv-moon mb-3">
          Watch Everything Unfold
        </h2>
        <p className="text-fv-text-muted mb-8 max-w-md mx-auto">
          Follow bloodlines, vote on world events, and watch civilization emerge — in real time.
          Full access for $10/month.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup">
            <Button variant="cinematic" size="lg">Start Watching — $10/month</Button>
          </Link>
          <Link href="/how-it-works">
            <Button variant="outline" size="lg">How It Works</Button>
          </Link>
        </div>
        <p className="text-xs text-fv-text-dim mt-4">Cancel anytime. No hidden fees.</p>
      </div>
    </div>
  );
}

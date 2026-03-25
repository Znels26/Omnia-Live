"use client";

import { SimEvent } from "@/lib/simulation/types";
import { getEventIcon, getEventCategoryColor } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface EventFeedProps {
  events: SimEvent[];
  maxHeight?: string;
  compact?: boolean;
  onEventClick?: (event: SimEvent) => void;
  className?: string;
  autoScroll?: boolean;
}

export function EventFeed({
  events,
  maxHeight = "100%",
  compact = false,
  onEventClick,
  className = "",
  autoScroll: _autoScroll = true,
}: EventFeedProps) {
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const prevEventsRef = useRef<SimEvent[]>([]);

  useEffect(() => {
    const prevIds = new Set(prevEventsRef.current.map((e) => e.id));
    const newIds = new Set(
      events.filter((e) => !prevIds.has(e.id)).map((e) => e.id)
    );
    if (newIds.size > 0) {
      setNewEventIds(newIds);
      const timer = setTimeout(() => setNewEventIds(new Set()), 3000);
      prevEventsRef.current = events;
      return () => clearTimeout(timer);
    }
    prevEventsRef.current = events;
  }, [events]);

  if (events.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <div className="text-3xl mb-3">🌄</div>
        <div className="text-fv-text-muted text-sm">The valley stirs. Events will appear here.</div>
      </div>
    );
  }

  // Newest first
  const sorted = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Insert day separators between events from different in-game days
  type FeedItem = { type: "event"; event: SimEvent } | { type: "separator"; day: number; year: number };
  const items: FeedItem[] = [];
  let lastDay: number | null = null;
  for (const event of sorted) {
    const day = event.tick ?? 0;
    if (lastDay !== null && day !== lastDay) {
      items.push({ type: "separator", day, year: 0 });
    }
    items.push({ type: "event", event });
    lastDay = day;
  }

  return (
    <div
      className={cn("space-y-0", className)}
      style={{ overflowAnchor: "none", maxHeight }}
    >
      {items.map((item, idx) =>
        item.type === "separator" ? (
          <div
            key={`sep-${idx}`}
            className="flex items-center gap-2 px-3 py-1.5"
          >
            <div className="flex-1 h-px bg-fv-border opacity-40" />
            <span className="text-[10px] text-fv-text-dim font-display uppercase tracking-widest flex-shrink-0">
              Day {item.day}
            </span>
            <div className="flex-1 h-px bg-fv-border opacity-40" />
          </div>
        ) : (
          <EventFeedItem
            key={item.event.id}
            event={item.event}
            compact={compact}
            isNew={newEventIds.has(item.event.id)}
            onClick={() => onEventClick?.(item.event)}
          />
        )
      )}
    </div>
  );
}

interface EventFeedItemProps {
  event: SimEvent;
  compact?: boolean;
  isNew?: boolean;
  onClick?: () => void;
}

function EventFeedItem({ event, compact, isNew, onClick }: EventFeedItemProps) {
  const icon = getEventIcon(event.type);
  const categoryColor = getEventCategoryColor(event.category);
  const importance = event.importance ?? 0;

  // Three tiers: MAJOR (≥75), NOTABLE (35-74), MINOR (<35)
  const isMajor = importance >= 75 || event.highlighted;
  const isNotable = !isMajor && importance >= 35;
  // isMinor = !isMajor && !isNotable

  // Extract quoted dialogue from description
  const quoteRegex = /"([^"]+)"/g;
  const description = event.description ?? '';
  const quotes: string[] = [];
  let qm: RegExpExecArray | null;
  while ((qm = quoteRegex.exec(description)) !== null) {
    quotes.push(qm[1]);
  }
  // Strip out quoted text to get the prose portion
  const prosePart = description.replace(/"[^"]+"/g, '').replace(/\s{2,}/g, ' ').trim();

  if (isMajor) {
    return (
      <div
        className={cn(
          "relative mx-2 my-2 rounded-lg cursor-pointer overflow-hidden transition-all duration-300",
          isNew && "animate-slide-in-right"
        )}
        style={{
          background: "linear-gradient(135deg, rgba(212,175,55,0.10) 0%, rgba(30,20,10,0.95) 100%)",
          border: "1px solid rgba(212,175,55,0.45)",
          boxShadow: "0 0 18px rgba(212,175,55,0.12), inset 0 1px 0 rgba(212,175,55,0.2)",
        }}
        onClick={onClick}
      >
        {/* Gold top edge accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-lg" style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.8), transparent)" }} />

        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-fv-gold animate-pulse inline-block" />
            <span className="text-[10px] text-fv-gold font-display uppercase tracking-[0.15em]">Major Event</span>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-sm text-fv-moon leading-snug mb-1">
                {event.title}
              </div>
              {quotes.length > 0 ? (
                <div className="space-y-1">
                  {prosePart && (
                    <p className="text-xs text-fv-text leading-relaxed">{prosePart}</p>
                  )}
                  {quotes.map((q, i) => (
                    <div key={i} className="mt-1.5 pl-2 border-l-2 border-fv-gold/40">
                      <span className="italic text-fv-moon text-xs">&ldquo;{q}&rdquo;</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-fv-text leading-relaxed">
                  {description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className={cn("text-[10px] font-medium uppercase tracking-wide", categoryColor)}>
                  {event.category.toLowerCase()}
                </span>
                <ImportanceDots importance={importance} />
                <span className="text-fv-text-dim text-[10px] ml-auto">Day {event.tick}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isNotable) {
    // Category accent color as left border
    const accentStyle = getCategoryAccent(event.category);
    return (
      <div
        className={cn(
          "relative flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-all duration-200 mx-1 my-0.5 rounded-md",
          "hover:bg-white/[0.03]",
          isNew && "animate-slide-in-right"
        )}
        style={{ borderLeft: `3px solid ${accentStyle}` }}
        onClick={onClick}
      >
        <span className={cn("text-base flex-shrink-0 mt-0.5", compact && "text-sm")}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className={cn("font-medium text-fv-text leading-tight", compact ? "text-xs" : "text-sm")}>
            {event.title}
          </div>
          {!compact && (
            quotes.length > 0 ? (
              <div className="space-y-0.5 mt-0.5">
                {prosePart && (
                  <p className="text-xs text-fv-text-muted leading-relaxed line-clamp-1">{prosePart}</p>
                )}
                {quotes.slice(0, 2).map((q, i) => (
                  <div key={i} className="mt-1 pl-2 border-l-2 border-fv-ember/40">
                    <span className="italic text-fv-moon text-xs line-clamp-1">&ldquo;{q}&rdquo;</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-fv-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                {description}
              </p>
            )
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("text-[10px] font-medium uppercase tracking-wide", categoryColor)}>
              {event.category.toLowerCase()}
            </span>
            {importance > 50 && <ImportanceDots importance={importance} />}
            <span className="text-fv-text-dim text-[10px] ml-auto">Day {event.tick}</span>
          </div>
        </div>
      </div>
    );
  }

  // MINOR — compact single-line chip
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all duration-200 rounded",
        "hover:bg-white/[0.02]",
        isNew && "animate-slide-in-right"
      )}
      onClick={onClick}
    >
      <span className="text-sm flex-shrink-0 opacity-70">{icon}</span>
      <span className="text-xs text-fv-text-muted truncate flex-1 leading-tight">
        {event.title}
      </span>
      <span className="text-[10px] text-fv-text-dim flex-shrink-0 whitespace-nowrap">Day {event.tick}</span>
    </div>
  );
}

function getCategoryAccent(category: string): string {
  switch (category.toUpperCase()) {
    case "CONFLICT":   return "rgba(220,60,60,0.7)";
    case "BIRTH":
    case "LIFE":       return "rgba(80,180,120,0.7)";
    case "DEATH":      return "rgba(100,100,140,0.7)";
    case "SOCIAL":     return "rgba(100,160,220,0.7)";
    case "SPIRITUAL":  return "rgba(180,120,220,0.7)";
    case "ECONOMIC":   return "rgba(212,175,55,0.7)";
    case "NATURE":     return "rgba(80,160,80,0.7)";
    default:           return "rgba(120,120,140,0.5)";
  }
}

function ImportanceDots({ importance }: { importance: number }) {
  const dots = Math.ceil(importance / 25);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-1 h-1 rounded-full",
            i < dots ? "bg-fv-ember" : "bg-fv-border"
          )}
        />
      ))}
    </div>
  );
}

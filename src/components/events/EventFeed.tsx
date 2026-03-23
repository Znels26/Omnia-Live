"use client";

import { SimEvent } from "@/lib/simulation/types";
import { getEventIcon, getEventCategoryColor, formatRelativeTime } from "@/lib/utils";
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
  autoScroll = true,
}: EventFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const prevEventsRef = useRef<SimEvent[]>([]);

  useEffect(() => {
    if (!autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events, autoScroll]);

  useEffect(() => {
    const prevIds = new Set(prevEventsRef.current.map((e) => e.id));
    const newIds = new Set(
      events.filter((e) => !prevIds.has(e.id)).map((e) => e.id)
    );
    if (newIds.size > 0) {
      setNewEventIds(newIds);
      const timer = setTimeout(() => setNewEventIds(new Set()), 3000);
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

  const sorted = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div
      className={cn("overflow-y-auto space-y-0 scrollbar-thin", className)}
      style={{ maxHeight }}
    >
      {sorted.map((event) => (
        <EventFeedItem
          key={event.id}
          event={event}
          compact={compact}
          isNew={newEventIds.has(event.id)}
          onClick={() => onEventClick?.(event)}
        />
      ))}
      <div ref={bottomRef} />
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
  const isHighlighted = event.highlighted || event.importance > 80;

  return (
    <div
      className={cn(
        "event-feed-item cursor-pointer transition-all duration-300",
        isHighlighted && "highlighted",
        isNew && "animate-slide-in-right",
        onClick && "hover:cursor-pointer"
      )}
      onClick={onClick}
    >
      {isHighlighted && (
        <div className="text-xs text-fv-gold font-display uppercase tracking-wider mb-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-fv-gold inline-block animate-pulse" />
          Major Event
        </div>
      )}

      <div className="flex items-start gap-3">
        <span className={cn("text-lg flex-shrink-0 mt-0.5", compact && "text-base")}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "font-medium text-fv-text leading-tight",
              compact ? "text-xs" : "text-sm",
              isHighlighted && "text-fv-moon"
            )}
          >
            {event.title}
          </div>
          {!compact && (
            <p className="text-xs text-fv-text-muted mt-0.5 line-clamp-2 leading-relaxed">
              {event.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("text-xs font-medium", categoryColor)}>
              {event.category.toLowerCase()}
            </span>
            {event.importance > 60 && (
              <ImportanceDots importance={event.importance} />
            )}
            <span className="text-fv-text-dim text-xs ml-auto flex-shrink-0">
              Tick {event.tick}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
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

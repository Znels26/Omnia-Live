import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Mark all as read
  await db.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  const typeIcons: Record<string, string> = {
    FOLLOWED_BEING_EVENT: "⭐",
    FOLLOWED_CLAN_EVENT: "🛡",
    WORLD_MILESTONE: "🌅",
    VOTE_STARTING: "🗳️",
    VOTE_RESULT: "📊",
    SUBSCRIPTION_RENEWED: "✅",
    SUBSCRIPTION_EXPIRING: "⚠️",
    TOKENS_CREDITED: "⚡",
    SYSTEM: "📌",
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-fv-moon mb-2">Notifications</h1>
        <p className="text-fv-text-muted">
          What happened while you were away.
        </p>
      </div>

      {notifications.length === 0 ? (
        <Card variant="default" className="p-8 text-center">
          <div className="text-4xl mb-4">🔔</div>
          <div className="text-fv-text-muted">You are all caught up.</div>
          <div className="text-xs text-fv-text-dim mt-1">
            Follow characters and clans to receive alerts.
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`fv-card p-4 transition-all ${
                !notif.read ? "border-fv-ember/30 bg-fv-ember/5" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">
                  {typeIcons[notif.type] ?? "📌"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-fv-text text-sm">{notif.title}</span>
                    {!notif.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-fv-ember flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-fv-text-muted leading-relaxed">{notif.body}</p>
                  <div className="text-xs text-fv-text-dim mt-1">
                    {formatRelativeTime(notif.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

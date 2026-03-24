import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: notifications } = await admin
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Mark all as read
  await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  const typeIcons: Record<string, string> = {
    follow_event: "⭐",
    vote_opening: "🗳️",
    vote_closing: "📊",
    major_event: "🌅",
    recap_ready: "📜",
    billing: "✅",
    system: "📌",
  };

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8 flex items-center gap-3">
        <Bell className="w-5 h-5 text-fv-gold" />
        <div>
          <h1 className="font-display text-2xl font-bold text-fv-moon">Notifications</h1>
          <p className="text-fv-text-muted text-sm">What happened while you were away.</p>
        </div>
      </div>

      {!notifications?.length ? (
        <div className="fv-card p-10 text-center">
          <div className="text-4xl mb-4">🔔</div>
          <div className="text-fv-text-muted font-medium">You&apos;re all caught up.</div>
          <div className="text-xs text-fv-text-dim mt-1">
            Follow characters and settlements to receive alerts.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`fv-card p-4 transition-all ${
                !notif.is_read ? "border-fv-ember/30 bg-fv-ember/5" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">
                  {typeIcons[notif.type] ?? "📌"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-fv-text text-sm">{notif.title}</span>
                    {!notif.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-fv-ember flex-shrink-0" />
                    )}
                  </div>
                  {notif.body && (
                    <p className="text-xs text-fv-text-muted leading-relaxed">{notif.body}</p>
                  )}
                  <div className="text-xs text-fv-text-dim mt-1">
                    {new Date(notif.created_at).toLocaleString()}
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

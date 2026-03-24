"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, LogOut, Coins } from "lucide-react";
import Link from "next/link";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export default function SettingsPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setDisplayName(user?.user_metadata?.display_name ?? "");
    });
  }, []);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    await supabase.auth.updateUser({ data: { display_name: displayName } });
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!user) return (
    <div className="p-8 flex items-center justify-center">
      <div className="text-fv-text-muted animate-pulse">Loading settings...</div>
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8 flex items-center gap-3">
        <User className="w-5 h-5 text-fv-ember" />
        <h1 className="font-display text-2xl font-bold text-fv-moon">Account Settings</h1>
      </div>

      {/* Profile */}
      <div className="fv-card p-6 mb-6">
        <div className="font-display text-xs uppercase tracking-wider text-fv-text-muted mb-4">Profile</div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-fv-ember to-fv-gold flex items-center justify-center text-2xl font-bold text-white">
            {(displayName || user.email || "?")[0].toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-fv-text">{displayName || "No name set"}</div>
            <div className="text-sm text-fv-text-muted">{user.email}</div>
            <Badge variant="ember" className="text-xs mt-1">Subscriber</Badge>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-fv-text-muted mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-fv-surface border border-fv-border rounded-md px-3 py-2 text-sm text-fv-text focus:outline-none focus:border-fv-ember"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-xs text-fv-text-muted mb-1.5">Email</label>
            <input
              type="email"
              value={user.email ?? ""}
              disabled
              className="w-full bg-fv-void border border-fv-border-subtle rounded-md px-3 py-2 text-sm text-fv-text-dim cursor-not-allowed"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            loading={saving}
            onClick={handleSave}
          >
            {saved ? "✓ Saved" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Quick links */}
      <div className="fv-card p-6 mb-6">
        <div className="font-display text-xs uppercase tracking-wider text-fv-text-muted mb-4">Account</div>
        <div className="space-y-2">
          <Link href="/billing" className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-fv-card transition-colors">
            <span className="text-sm text-fv-text">Billing & Subscription</span>
            <span className="text-fv-text-dim text-xs">→</span>
          </Link>
          <Link href="/tokens" className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-fv-card transition-colors">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-fv-gold" />
              <span className="text-sm text-fv-text">Token Wallet</span>
            </div>
            <span className="text-fv-text-dim text-xs">→</span>
          </Link>
        </div>
      </div>

      {/* Sign out */}
      <div className="fv-card p-6">
        <div className="font-display text-xs uppercase tracking-wider text-fv-text-muted mb-4">Danger Zone</div>
        <Button
          variant="danger"
          size="sm"
          loading={signingOut}
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

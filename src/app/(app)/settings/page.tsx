import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscription: true,
      tokenWallet: true,
    },
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold text-fv-moon mb-8">Account Settings</h1>

      {/* Profile */}
      <Card variant="default" className="mb-6">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-fv-border flex items-center justify-center text-2xl">
                {user?.name?.[0] ?? "?"}
              </div>
              <div>
                <div className="font-medium text-fv-text">{user?.name ?? "No name set"}</div>
                <div className="text-sm text-fv-text-muted">{user?.email}</div>
                <Badge variant={user?.role === "ADMIN" ? "gold" : user?.role === "SUBSCRIBER" ? "forest" : "default"} className="text-xs mt-1">
                  {user?.role?.toLowerCase()}
                </Badge>
              </div>
            </div>
            <div className="text-xs text-fv-text-dim">
              Member since {user?.createdAt ? formatDate(user.createdAt) : "—"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card variant="default" className="mb-6">
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-fv-text font-medium">First Valley — Full Access</div>
              <div className="text-sm text-fv-text-muted">$10.00/month</div>
            </div>
            <Badge
              variant={
                user?.subscription?.status === "ACTIVE" ? "forest"
                : user?.subscription?.status === "PAST_DUE" ? "warning"
                : "danger"
              }
            >
              {user?.subscription?.status?.toLowerCase().replace("_", " ") ?? "inactive"}
            </Badge>
          </div>
          <Link href="/billing">
            <Button variant="outline" size="sm">Manage Billing →</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Token wallet */}
      <Card variant="default" className="mb-6">
        <CardHeader>
          <CardTitle>Token Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-display text-3xl font-bold text-fv-gold">
                {user?.tokenWallet?.balance ?? 0}
              </div>
              <div className="text-sm text-fv-text-muted">fate tokens available</div>
            </div>
          </div>
          <Link href="/tokens">
            <Button variant="token" size="sm">Buy More Tokens →</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Card variant="default">
        <CardContent>
          <form action="/api/auth/signout" method="POST">
            <Button variant="danger" size="sm" type="submit">
              Sign Out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

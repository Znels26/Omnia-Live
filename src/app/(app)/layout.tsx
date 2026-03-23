import { Sidebar, TopBar } from "@/components/layout/Navigation";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get token balance
  const wallet = await db.tokenWallet.findUnique({
    where: { userId: session.user.id },
    select: { balance: true },
  }).catch(() => null);

  // Get unread notification count
  const notifCount = await db.notification.count({
    where: { userId: session.user.id, read: false },
  }).catch(() => 0);

  return (
    <div className="flex min-h-screen bg-fv-base">
      <Sidebar />
      <div className="flex-1 ml-[200px]">
        <TopBar
          tokenBalance={wallet?.balance ?? 0}
          notificationCount={notifCount}
        />
        <main className="pt-12 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "First Valley — Watch Civilization Begin",
  description:
    "An always-on spectator entertainment platform. Watch AI beings form tribes, build civilizations, wage wars, and evolve in real time. Subscribe and influence fate.",
  keywords: ["AI civilization", "simulation", "entertainment", "live world", "strategy"],
  openGraph: {
    title: "First Valley",
    description: "Watch civilization begin. Witness AI evolve in real time.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full bg-fv-base text-fv-text">
        {children}
      </body>
    </html>
  );
}

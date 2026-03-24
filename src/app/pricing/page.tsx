"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

export default function PricingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  async function handleSubscribe() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/subscription", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned", data);
        setLoading(false);
      }
    } catch (err) {
      console.error("Checkout error", err);
      setLoading(false);
    }
  }

  const SubscribeButton = ({ variant, size, className, label }: { variant: string; size?: string; className?: string; label: string }) => {
    if (isLoggedIn) {
      return (
        <Button
          variant={variant as any}
          size={size as any}
          className={className}
          onClick={handleSubscribe}
          disabled={loading}
        >
          {loading ? "Redirecting…" : label}
        </Button>
      );
    }
    return (
      <Link href="/signup">
        <Button variant={variant as any} size={size as any} className={className}>
          {label}
        </Button>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-fv-base text-fv-text overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-fv-base/80 backdrop-blur-md border-b border-fv-border-subtle">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-fv-ember to-fv-gold flex items-center justify-center">
            <span className="text-white text-base">🔥</span>
          </div>
          <span className="font-display font-bold text-fv-moon text-lg tracking-wide">First Valley</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/how-it-works" className="text-fv-text-muted hover:text-fv-text text-sm transition-colors hidden md:block">
            How It Works
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm">Watch Now</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 text-center">
        <Badge variant="ember" className="mb-6 text-xs">Pricing</Badge>
        <h1 className="font-display text-5xl md:text-6xl font-bold text-fv-moon mb-6 leading-tight">
          One Price.<br />
          <span style={{ color: "var(--fv-ember)" }}>An Entire World.</span>
        </h1>
        <p className="text-xl text-fv-text-muted max-w-xl mx-auto">
          Less than one cup of coffee a month. The valley never sleeps.
        </p>
      </section>

      {/* Main pricing cards */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Free */}
          <Card variant="default" className="p-8">
            <div className="font-display text-3xl font-bold text-fv-moon mb-1">Free</div>
            <p className="text-fv-text-muted text-sm mb-8">Limited preview access</p>
            <ul className="space-y-4 mb-10">
              {[
                { text: "Browse world overview", included: true },
                { text: "Read public event highlights", included: true },
                { text: "See teaser character profiles", included: true },
                { text: "View the marketing site", included: true },
                { text: "Live world viewer", included: false },
                { text: "Full character & clan access", included: false },
                { text: "Voting on world events", included: false },
                { text: "Follow characters & clans", included: false },
                { text: "Fate Tokens", included: false },
              ].map((f) => (
                <li key={f.text} className="flex items-center gap-2.5 text-sm">
                  <span className={f.included ? "text-fv-ember" : "text-fv-border"}>
                    {f.included ? "✓" : "○"}
                  </span>
                  <span className={f.included ? "text-fv-text-muted" : "text-fv-text-dim"}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/signup">
              <Button variant="outline" className="w-full">Create Free Account</Button>
            </Link>
          </Card>

          {/* Subscriber */}
          <Card variant="ember" className="p-8 relative">
            <div className="absolute -top-3 right-5">
              <Badge variant="ember" className="text-xs font-display">RECOMMENDED</Badge>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-display text-5xl font-bold text-fv-moon">$10</span>
              <span className="text-fv-text-muted">/month</span>
            </div>
            <p className="text-fv-text-muted text-sm mb-8">Full civilization access</p>
            <ul className="space-y-4 mb-10">
              {[
                "Live world viewer — always on",
                "Full character and clan access",
                "Daily and weekly recaps",
                "Standard votes on world events",
                "Follow specific characters & clans",
                "World timeline and history",
                "Notifications and personalized alerts",
                "Since-last-visit summaries",
                "Cancel anytime",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-fv-text">
                  <span className="text-fv-ember">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <SubscribeButton variant="cinematic" className="w-full" label="Start Watching — $10/month" />
          </Card>
        </div>
      </section>

      {/* Fate Tokens add-on */}
      <section className="py-16 px-4 bg-fv-surface border-y border-fv-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-fv-moon mb-3">
              ⚡ Fate Tokens
            </h2>
            <p className="text-fv-text-muted max-w-xl mx-auto">
              Optional add-ons for deeper influence. Tokens let you intervene directly in the
              world — beyond standard voting.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { name: "Spark", tokens: 100, price: "$2", bonus: "" },
              { name: "Flame", tokens: 300, price: "$5", bonus: "+30 bonus" },
              { name: "Inferno", tokens: 700, price: "$10", bonus: "+100 bonus", popular: true },
              { name: "Cataclysm", tokens: 2000, price: "$25", bonus: "+400 bonus" },
            ].map((pack) => (
              <Card
                key={pack.name}
                variant={pack.popular ? "gold" : "elevated"}
                className="p-4 text-center relative"
              >
                {pack.popular && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <Badge variant="gold" className="text-xs">BEST VALUE</Badge>
                  </div>
                )}
                <div className="font-display text-lg font-bold text-fv-moon mb-1">{pack.name}</div>
                <div className="text-2xl font-bold text-fv-ember mb-1">⚡ {pack.tokens}</div>
                {pack.bonus && (
                  <div className="text-xs text-fv-gold mb-2">{pack.bonus}</div>
                )}
                <div className="text-fv-text-muted text-sm mb-3">{pack.price}</div>
                <Link href="/tokens">
                  <Button variant="outline" size="sm" className="w-full text-xs">Buy</Button>
                </Link>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              { icon: "🗳️", title: "Premium Votes", body: "Spend tokens for weighted votes that carry more influence than standard votes." },
              { icon: "🎁", title: "Interventions", body: "Gift food, inspire a character, trigger a disaster — direct world-altering actions." },
              { icon: "📜", title: "Permanent Credit", body: "Every token action is attributed to you in the world history log. Permanently." },
            ].map((item) => (
              <div key={item.title} className="p-4">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-display font-bold text-fv-moon mb-2">{item.title}</h3>
                <p className="text-sm text-fv-text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guarantees */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              { icon: "🔓", title: "Cancel Anytime", body: "No contracts. No fees. Cancel before your next billing date and you will never be charged again." },
              { icon: "🌍", title: "World Keeps Going", body: "Your subscription lapsing does not pause the world. Come back anytime and catch up." },
              { icon: "💳", title: "Secure Payments", body: "Payments processed through Stripe. We never store your card information." },
            ].map((g) => (
              <div key={g.title} className="p-4">
                <div className="text-4xl mb-3">{g.icon}</div>
                <h3 className="font-display font-bold text-fv-moon mb-2">{g.title}</h3>
                <p className="text-sm text-fv-text-muted">{g.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center bg-fv-surface border-t border-fv-border">
        <div className="max-w-xl mx-auto">
          <div className="text-5xl mb-6">🔥</div>
          <h2 className="font-display text-4xl font-bold text-fv-moon mb-4">
            The Valley is Waiting
          </h2>
          <p className="text-fv-text-muted mb-8">
            History is being made right now. Join for $10/month.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <SubscribeButton variant="cinematic" size="xl" label="Start Watching — $10/month" />
            <Link href="/how-it-works">
              <Button variant="outline" size="xl">How It Works</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-fv-border bg-fv-surface">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <span className="font-display text-fv-moon font-bold">First Valley</span>
          </div>
          <div className="flex gap-6 text-sm text-fv-text-muted">
            <Link href="/pricing" className="hover:text-fv-text transition-colors">Pricing</Link>
            <Link href="/how-it-works" className="hover:text-fv-text transition-colors">How It Works</Link>
            <Link href="/login" className="hover:text-fv-text transition-colors">Login</Link>
          </div>
          <p className="text-fv-text-dim text-xs">© {new Date().getFullYear()} First Valley</p>
        </div>
      </footer>
    </div>
  );
}

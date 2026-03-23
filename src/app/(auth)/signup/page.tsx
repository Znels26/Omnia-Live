"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create account");
        setLoading(false);
        return;
      }

      // Auto sign in after registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but sign in failed. Try logging in.");
        router.push("/login");
      } else {
        router.push("/watch");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-fv-base flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse at center, rgba(201,113,74,0.06) 0%, transparent 70%)"
        }} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-3xl">🔥</span>
            <span className="font-display font-bold text-fv-moon text-2xl">First Valley</span>
          </Link>
          <p className="text-fv-text-muted text-sm mt-2">Join the living world</p>
        </div>

        {/* What you get */}
        <div className="fv-card p-4 mb-4 border-fv-ember/20 bg-fv-ember/5">
          <div className="text-xs text-fv-ember font-display uppercase tracking-wider mb-2">
            With your subscription
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-fv-text-muted">
            {["Live world viewer", "Character follows", "Recaps daily", "Vote on events"].map((f) => (
              <div key={f} className="flex items-center gap-1">
                <span className="text-fv-ember">✓</span> {f}
              </div>
            ))}
          </div>
        </div>

        <div className="fv-card p-6">
          <form onSubmit={handleSignup} className="space-y-4">
            <Input
              label="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              autoComplete="name"
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              hint="Minimum 8 characters"
              autoComplete="new-password"
            />

            {error && (
              <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-800/40 rounded-md py-2 px-3">
                {error}
              </div>
            )}

            <Button
              variant="cinematic"
              size="lg"
              className="w-full"
              type="submit"
              loading={loading}
            >
              🔥 Create Account & Watch
            </Button>
          </form>

          <p className="text-center text-xs text-fv-text-dim mt-4">
            By signing up, you agree to our Terms of Service.
            Subscription billing at $10/month.
          </p>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="fv-divider w-full" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-fv-card px-3 text-xs text-fv-text-dim">or</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => signIn("google", { callbackUrl: "/watch" })}
          >
            Continue with Google
          </Button>
        </div>

        <p className="text-center text-sm text-fv-text-muted mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-fv-ember hover:text-fv-ember-bright transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

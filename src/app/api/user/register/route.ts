import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createStripeCustomer } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create Stripe customer
    const customer = await createStripeCustomer(email, name).catch(() => null);

    // Create user with subscription and wallet
    const user = await db.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        role: "GUEST",
        subscription: {
          create: {
            stripeCustomerId: customer?.id ?? `guest_${Date.now()}`,
            status: "INACTIVE",
          },
        },
        tokenWallet: {
          create: {
            balance: 0,
          },
        },
      },
    });

    return NextResponse.json({ userId: user.id }, { status: 201 });
  } catch (error) {
    console.error("[Register]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

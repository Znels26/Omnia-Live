import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
  typescript: true,
})

export const SUBSCRIPTION_PRICE_ID = process.env.STRIPE_SUBSCRIPTION_PRICE_ID!
export const SUBSCRIPTION_PRICE_CENTS = 1000 // $10/month

export const TOKEN_PACKS = {
  small: {
    id: 'small',
    name: 'Ember Pack',
    tokens: 100,
    priceCents: 499,
    description: '100 influence tokens',
    highlight: false,
  },
  medium: {
    id: 'medium',
    name: 'Valley Pack',
    tokens: 300,
    priceCents: 999,
    description: '300 influence tokens — most popular',
    highlight: true,
  },
  large: {
    id: 'large',
    name: 'Dynasty Pack',
    tokens: 750,
    priceCents: 1999,
    description: '750 influence tokens',
    highlight: false,
  },
  mega: {
    id: 'mega',
    name: 'Empire Pack',
    tokens: 2000,
    priceCents: 4499,
    description: '2000 influence tokens — best value',
    highlight: false,
  },
} as const

export type TokenPackId = keyof typeof TOKEN_PACKS

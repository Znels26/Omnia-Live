import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe, TOKEN_PACKS, type TokenPackId } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packId } = await req.json()
  const pack = TOKEN_PACKS[packId as TokenPackId]
  if (!pack) return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Create order record first
  const { data: order } = await admin.from('token_purchase_orders').insert({
    user_id: user.id,
    token_pack_id: pack.id,
    token_amount: pack.tokens,
    price_cents: pack.priceCents,
    status: 'pending',
  }).select().single()

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `First Valley — ${pack.name}`,
          description: pack.description,
          metadata: { token_amount: pack.tokens.toString() },
        },
        unit_amount: pack.priceCents,
      },
      quantity: 1,
    }],
    success_url: `${appUrl}/tokens?success=true`,
    cancel_url: `${appUrl}/tokens?canceled=true`,
    metadata: {
      supabase_user_id: user.id,
      token_pack_id: pack.id,
      token_amount: pack.tokens.toString(),
      order_id: order?.id ?? '',
    },
  })

  // Update order with session id
  if (order) {
    await admin.from('token_purchase_orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id)
  }

  return NextResponse.json({ url: session.url })
}

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id
        if (!userId) break

        if (session.mode === 'subscription') {
          // Subscription created - will be handled by subscription events
          await admin.from('billing_events').insert({
            user_id: userId,
            event_type: 'subscription_checkout_completed',
            stripe_event_id: event.id,
            stripe_customer_id: session.customer as string,
            amount_cents: session.amount_total,
            metadata: { session_id: session.id },
          })
        } else if (session.mode === 'payment') {
          // Token purchase
          const tokenAmount = parseInt(session.metadata?.token_amount ?? '0')
          const orderId = session.metadata?.order_id

          if (tokenAmount > 0) {
            // Credit tokens
            await admin.rpc('credit_tokens', {
              p_user_id: userId,
              p_amount: tokenAmount,
              p_description: `Token purchase — ${session.metadata?.token_pack_id}`,
            })

            // Update order
            if (orderId) {
              await admin.from('token_purchase_orders')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', orderId)
            }

            await admin.from('billing_events').insert({
              user_id: userId,
              event_type: 'token_purchased',
              stripe_event_id: event.id,
              stripe_customer_id: session.customer as string,
              amount_cents: session.amount_total,
              metadata: { token_amount: tokenAmount, pack_id: session.metadata?.token_pack_id },
            })
          }
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.supabase_user_id

        if (!userId) break

        const isActive = ['active', 'trialing'].includes(sub.status)

        // Upsert subscription
        await admin.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          status: sub.status as 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'unpaid',
          current_period_end: (sub as any).current_period_end != null ? new Date((sub as any).current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end,
        }, { onConflict: 'user_id' })

        // Update profile role
        if (isActive) {
          await admin.from('profiles')
            .update({ role: 'subscriber' })
            .eq('id', userId)
        }

        await admin.from('billing_events').insert({
          user_id: userId,
          event_type: event.type,
          stripe_event_id: event.id,
          stripe_customer_id: sub.customer as string,
          metadata: { subscription_id: sub.id, status: sub.status },
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.supabase_user_id
        if (!userId) break

        await admin.from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', sub.id)

        // Downgrade role
        await admin.from('profiles')
          .update({ role: 'guest' })
          .eq('id', userId)

        await admin.from('billing_events').insert({
          user_id: userId,
          event_type: 'subscription_canceled',
          stripe_event_id: event.id,
          stripe_customer_id: sub.customer as string,
          metadata: { subscription_id: sub.id },
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: profile } = await admin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await admin.from('subscriptions')
            .update({ status: 'past_due' })
            .eq('user_id', profile.id)

          await admin.from('billing_events').insert({
            user_id: profile.id,
            event_type: 'payment_failed',
            stripe_event_id: event.id,
            stripe_customer_id: customerId,
            amount_cents: invoice.amount_due,
            metadata: { invoice_id: invoice.id },
          })
        }
        break
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.type}`)
    }
  } catch (err) {
    console.error('[Webhook] Error processing event:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

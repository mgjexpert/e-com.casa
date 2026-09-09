import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProduct } from '@/lib/catalog';
import { db } from '@/lib/db';
import {
  SHIPPING_OPTIONS,
  FREE_SHIPPING_THRESHOLD,
  PROMO_CODES,
  GIFT_WRAP_PRICE,
  ORDER_NOTES_MAX,
} from '@/lib/constants';

export const dynamic = 'force-dynamic';

const orderItemSchema = z.object({
  slug: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  variantId: z.string().max(60).optional(),
});

const createOrderSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  address: z.string().min(1).max(200),
  address2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(2).max(2),
  phone: z.string().max(40).optional().nullable(),
  shippingMethod: z.enum(['standard', 'express']),
  paymentMethod: z.enum(['card', 'paypal']).default('card'),
  promoCode: z.string().max(40).optional().nullable(),
  giftWrap: z.boolean().default(false),
  notes: z.string().max(ORDER_NOTES_MAX).optional().nullable(),
  items: z.array(orderItemSchema).min(1),
});

/** Strip HTML tags and control characters — notes are plain text. */
function sanitizeNotes(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, ORDER_NOTES_MAX);
}

function generateOrderNumber(): string {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `EC-${random}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid order data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Re-price server-side — never trust client totals
    const slugs = data.items.map((i) => i.slug);
    const resolved = await Promise.all(slugs.map((s) => getProduct(s)));
    const products = resolved.filter((p): p is NonNullable<typeof p> => Boolean(p));
    const missing = slugs.filter((s) => !products.some((p) => p.slug === s));
    if (missing.length > 0) {
      return NextResponse.json({ error: 'One or more products are unavailable' }, { status: 400 });
    }

    // Oversell guard — reject if any requested quantity exceeds remaining stock
    for (const item of data.items) {
      const product = products.find((p) => p.slug === item.slug)!;
      if (product.stock < item.quantity) {
        return NextResponse.json(
          {
            error:
              product.stock <= 0
                ? `Sorry — “${product.name}” has just sold out.`
                : `Sorry — only ${product.stock} × “${product.name}” remain in stock.`,
          },
          { status: 409 },
        );
      }
    }

    let subtotal = 0;
    const lineItems = data.items.map((item) => {
      const product = products.find((p) => p.slug === item.slug)!;
      // Variant deltas are resolved server-side from the catalogue model —
      // client-provided pricing is never trusted.
      let variantDeltaCents = 0;
      let variantLabel: string | undefined;
      if (item.variantId) {
        const v = product.variants.find((x) => x.id === item.variantId);
        if (v) {
          variantDeltaCents = v.priceDeltaCents ?? 0;
          variantLabel = v.name;
        }
      }
      const priceCents = (product.priceCents ?? Math.round(parseFloat(product.price) * 100)) + variantDeltaCents;
      const price = (priceCents / 100).toFixed(2);
      subtotal += (priceCents / 100) * item.quantity;
      return {
        slug: product.slug,
        name: product.name,
        subtitle: product.subtitle,
        price,
        quantity: item.quantity,
        image: product.image,
        variantLabel,
      };
    });

    // Promo
    let discount = 0;
    let appliedPromo: string | null = null;
    if (data.promoCode && PROMO_CODES[data.promoCode.toUpperCase()]) {
      const promo = PROMO_CODES[data.promoCode.toUpperCase()];
      discount = (subtotal * promo.value) / 100;
      appliedPromo = data.promoCode.toUpperCase();
    }

    // Shipping
    const option = SHIPPING_OPTIONS.find((o) => o.id === data.shippingMethod) ?? SHIPPING_OPTIONS[0];
    const shippingCost = subtotal - discount >= FREE_SHIPPING_THRESHOLD && option.id === 'standard' ? 0 : option.price;
    // Gift wrap is a flat service fee — never discounted by promos
    const giftWrapFee = data.giftWrap ? GIFT_WRAP_PRICE : 0;
    const total = subtotal - discount + shippingCost + giftWrapFee;

    // Create the order and decrement stock atomically — one failure rolls back both
    const order = await db.$transaction(async (tx) => {
      for (const item of data.items) {
        await tx.product.update({
          where: { slug: item.slug },
          data: { stock: { decrement: item.quantity } },
        });
      }
      return tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          address: data.address,
          address2: data.address2 || null,
          city: data.city,
          postalCode: data.postalCode,
          country: data.country,
          phone: data.phone || null,
          shippingMethod: data.shippingMethod,
          paymentMethod: data.paymentMethod,
          subtotal: subtotal.toFixed(2),
          shipping: shippingCost.toFixed(2),
          tax: '0.00', // VAT-inclusive pricing — no additional tax line (placeholder for OSS/VAT architecture)
          discount: discount.toFixed(2),
          total: total.toFixed(2),
          promoCode: appliedPromo,
          itemsJson: JSON.stringify(lineItems),
          giftWrap: data.giftWrap,
          notes: sanitizeNotes(data.notes) || null,
          status: 'CONFIRMED',
          paymentStatus: 'PAID', // mock — Stripe integration point
        },
      });
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('POST /api/orders error', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }
    const orders = await db.order.findMany({
      where: { email: { equals: email, }, },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('GET /api/orders error', error);
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}

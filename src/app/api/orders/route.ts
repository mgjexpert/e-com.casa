import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { SHIPPING_OPTIONS, FREE_SHIPPING_THRESHOLD, PROMO_CODES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const orderItemSchema = z.object({
  slug: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
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
  items: z.array(orderItemSchema).min(1),
});

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
    const products = await db.product.findMany({
      where: { slug: { in: slugs }, complianceStatus: { not: 'BLOCKED' } },
    });
    if (products.length !== slugs.length) {
      return NextResponse.json({ error: 'One or more products are unavailable' }, { status: 400 });
    }

    let subtotal = 0;
    const lineItems = data.items.map((item) => {
      const product = products.find((p) => p.slug === item.slug)!;
      const price = parseFloat(product.price);
      subtotal += price * item.quantity;
      return {
        slug: product.slug,
        name: product.name,
        subtitle: product.subtitle,
        price: product.price,
        quantity: item.quantity,
        image: product.image,
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
    const total = subtotal - discount + shippingCost;

    const order = await db.order.create({
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
        status: 'CONFIRMED',
        paymentStatus: 'PAID', // mock — Stripe integration point
      },
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

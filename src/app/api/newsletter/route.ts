import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  source: z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }
    const { email, source } = parsed.data;
    await db.newsletterSubscriber.upsert({
      where: { email },
      update: { source: source ?? 'footer' },
      create: { email, source: source ?? 'footer' },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('POST /api/newsletter error', error);
    return NextResponse.json({ error: 'Subscription failed. Please try again.' }, { status: 500 });
  }
}

/**
 * app/api/auth/register/route.ts
 */
import { NextResponse } from 'next/server'
import { createUser } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { name, email, password } = body as Record<string, unknown>

    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const user = await createUser({
      name:     typeof name === 'string' ? name.trim() : undefined,
      email:    email.toLowerCase().trim(),
      password,
    })

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EMAIL_EXISTS') {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }
    console.error('[register]', err)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
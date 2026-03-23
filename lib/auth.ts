/**
 * lib/auth.ts
 * ─────────────────────────────────────────────────────────────────
 * NextAuth v5 configuration.
 *
 * FIX: Added trustHost: true — required in Next.js production builds
 * (and any non-Vercel deployment) to prevent the UntrustedHost error.
 * Also fine for local dev. Without this, every auth() call throws
 * "UntrustedHost" and sessions can never be read.
 */

import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { verifyUserPassword } from '@/lib/db'

function parseCredentials(raw: unknown): { email: string; password: string } | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { email, password } = raw as Record<string, unknown>
  if (typeof email !== 'string' || !email.includes('@')) return null
  if (typeof password !== 'string' || password.length < 6) return null
  return { email, password }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // trustHost must be true for self-hosted / localhost production builds.
  // It tells NextAuth to trust the Host header from the incoming request.
  trustHost: true,

  pages:   { signIn: '/login' },
  session: { strategy: 'jwt' },

  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (rawCredentials) => {
        const parsed = parseCredentials(rawCredentials)
        if (!parsed) return null
        return await verifyUserPassword(parsed.email, parsed.password)
      },
    }),
  ],

  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) token.id = String(user.id)
      return token
    },
    session: async ({ session, token }) => {
      if (session.user && token.id) session.user.id = String(token.id)
      return session
    },
  },
})
'use client'

export const dynamic = 'force-dynamic'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { registerAction } from '@/lib/actions/auth'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await registerAction(name, email, password)
      if (result?.error) {
        setError(result.error)
        return
      }

      router.push('/login')
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0e17]">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          WEBDO24
        </h1>
        <p className="mb-6 text-center text-sm text-white/50">
          Vytvoření nového účtu
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">
              Jméno
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/30 focus:border-[#00e5ff]/50 focus:outline-none focus:ring-1 focus:ring-[#00e5ff]/30"
              placeholder="Vaše jméno"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/30 focus:border-[#00e5ff]/50 focus:outline-none focus:ring-1 focus:ring-[#00e5ff]/30"
              placeholder="vas@email.cz"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">
              Heslo
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/30 focus:border-[#00e5ff]/50 focus:outline-none focus:ring-1 focus:ring-[#00e5ff]/30"
              placeholder="Min. 6 znaků"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-[#00e5ff] px-4 py-2.5 font-semibold text-[#0a0e17] hover:bg-[#00c8e0] disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Registrace...' : 'Zaregistrovat se'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-white/50">
          Máte účet?{' '}
          <Link href="/login" className="text-[#00e5ff] hover:underline">
            Přihlaste se
          </Link>
        </p>
      </div>
    </div>
  )
}

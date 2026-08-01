"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setLoading(true)

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (loginError) {
      setError(loginError.message)
      setLoading(false)
      return
    }

    router.replace("/")
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f4] px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8">
        <div className="mb-8">
          <p className="text-2xl font-semibold">La Martina</p>
          <p className="text-sm text-slate-500">Fresh Market</p>

          <h1 className="mt-8 text-xl font-semibold">
            Iniciar sesión
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Accede al sistema administrativo del local.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  )
}


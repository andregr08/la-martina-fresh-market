"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Smartphone,
  WalletCards,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type CashSummary = {
  success: boolean
  is_open: boolean
  cash_register_id?: string
  opened_at?: string
  opening_amount?: number
  cash_sales?: number
  card_sales?: number
  transfer_sales?: number
  cash_income?: number
  cash_expenses?: number
  cash_withdrawals?: number
  cash_refunds?: number
  expected_cash?: number
  sales_count?: number
}

function money(value?: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value ?? 0))
}

export default function CajaPage() {
  const supabase = createClient()

  const [summary, setSummary] = useState<CashSummary | null>(null)
  const [openingAmount, setOpeningAmount] = useState("0")
  const [countedAmount, setCountedAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadCashRegister = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: rpcError } = await supabase.rpc(
      "get_open_cash_register",
    )

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    setSummary(data as CashSummary)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadCashRegister()
  }, [loadCashRegister])

  async function openRegister() {
    const amount = Number(openingAmount)

    if (!Number.isFinite(amount) || amount < 0) {
      setError("El fondo inicial no es válido.")
      return
    }

    setSubmitting(true)
    setError("")
    setMessage("")

    const { error: rpcError } = await supabase.rpc(
      "open_cash_register",
      {
        p_opening_amount: amount,
        p_notes: notes.trim() || null,
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }

    setMessage("La caja se abrió correctamente.")
    setNotes("")
    await loadCashRegister()
    setSubmitting(false)
  }

  async function closeRegister() {
    const amount = Number(countedAmount)

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Captura el efectivo contado correctamente.")
      return
    }

    const confirmed = window.confirm(
      "¿Confirmas que deseas cerrar la caja? Después del cierre no se podrán registrar ventas hasta abrir una nueva.",
    )

    if (!confirmed) return

    setSubmitting(true)
    setError("")
    setMessage("")

    const { data, error: rpcError } = await supabase.rpc(
      "close_cash_register",
      {
        p_counted_amount: amount,
        p_notes: notes.trim() || null,
        p_cash_register_id:
          summary?.cash_register_id ?? null,
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }

    const result = data as {
      difference_amount?: number
      difference_status?: string
    }

    const difference = Number(result.difference_amount ?? 0)

    const statusText =
      result.difference_status === "balanced"
        ? "Caja cuadrada"
        : result.difference_status === "surplus"
          ? `Sobrante de ${money(difference)}`
          : `Faltante de ${money(Math.abs(difference))}`

    setMessage(`La caja se cerró correctamente. ${statusText}.`)
    setCountedAmount("")
    setNotes("")
    await loadCashRegister()
    setSubmitting(false)
  }

  return (
    <AppShell
      title="Caja"
      description="Apertura, movimientos y corte diario del local."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
        </div>
      ) : summary?.is_open ? (
        <div className="space-y-6">
          <section className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-800">
                <CircleDollarSign className="h-6 w-6" />
                <h2 className="text-lg font-semibold">
                  Caja abierta
                </h2>
              </div>

              <p className="mt-2 text-sm text-emerald-700">
                Abierta el{" "}
                {summary.opened_at
                  ? new Date(summary.opened_at).toLocaleString(
                      "es-MX",
                    )
                  : "—"}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadCashRegister()}
              disabled={submitting}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <Banknote className="h-5 w-5 text-slate-500" />
              <p className="mt-4 text-sm text-slate-500">
                Fondo inicial
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {money(summary.opening_amount)}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <WalletCards className="h-5 w-5 text-slate-500" />
              <p className="mt-4 text-sm text-slate-500">
                Ventas en efectivo
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {money(summary.cash_sales)}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <CreditCard className="h-5 w-5 text-slate-500" />
              <p className="mt-4 text-sm text-slate-500">
                Ventas con tarjeta
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {money(summary.card_sales)}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <Smartphone className="h-5 w-5 text-slate-500" />
              <p className="mt-4 text-sm text-slate-500">
                Transferencias
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {money(summary.transfer_sales)}
              </p>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">
                Resumen de la caja
              </h2>

              <div className="mt-6 divide-y divide-slate-100">
                <div className="flex justify-between py-3">
                  <span className="text-slate-600">
                    Ventas realizadas
                  </span>
                  <strong>{summary.sales_count ?? 0}</strong>
                </div>

                <div className="flex justify-between py-3">
                  <span className="text-slate-600">
                    Entradas adicionales
                  </span>
                  <strong>{money(summary.cash_income)}</strong>
                </div>

                <div className="flex justify-between py-3">
                  <span className="text-slate-600">
                    Gastos pagados en efectivo
                  </span>
                  <strong>
                    -{money(summary.cash_expenses)}
                  </strong>
                </div>

                <div className="flex justify-between py-3">
                  <span className="text-slate-600">
                    Retiros de efectivo
                  </span>
                  <strong>
                    -{money(summary.cash_withdrawals)}
                  </strong>
                </div>

                <div className="flex justify-between py-4 text-lg">
                  <span className="font-medium">
                    Efectivo esperado
                  </span>
                  <strong>{money(summary.expected_cash)}</strong>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <LockKeyhole className="h-5 w-5" />
                <h2 className="text-lg font-semibold">
                  Cerrar caja
                </h2>
              </div>

              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="countedAmount">
                    Efectivo contado
                  </Label>

                  <Input
                    id="countedAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={countedAmount}
                    onChange={(event) =>
                      setCountedAmount(event.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="closeNotes">
                    Observaciones
                  </Label>

                  <Input
                    id="closeNotes"
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value)
                    }
                    placeholder="Opcional"
                  />
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={closeRegister}
                  disabled={submitting}
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Realizar corte y cerrar
                </Button>
              </div>
            </article>
          </section>
        </div>
      ) : (
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-7">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <Clock3 className="h-6 w-6" />
          </div>

          <h2 className="mt-5 text-xl font-semibold">
            La caja está cerrada
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Debes abrir la caja antes de registrar cualquier venta.
          </p>

          <div className="mt-7 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="openingAmount">
                Fondo inicial
              </Label>

              <Input
                id="openingAmount"
                type="number"
                min="0"
                step="0.01"
                value={openingAmount}
                onChange={(event) =>
                  setOpeningAmount(event.target.value)
                }
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="openingNotes">
                Observaciones
              </Label>

              <Input
                id="openingNotes"
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Opcional"
              />
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={openRegister}
              disabled={submitting}
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Abrir caja
            </Button>
          </div>
        </section>
      )}
    </AppShell>
  )
}

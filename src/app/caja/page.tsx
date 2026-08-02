"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
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
import { createClient } from "@/lib/supabase/client"

type CashRegister = {
  id: string
  opened_at: string
  opened_by_name: string | null
  closed_at: string | null
  opening_amount: number
  expected_amount: number | null
  counted_amount: number | null
  difference_amount: number | null
  status: "open" | "closed"
  notes: string | null
}

type CashMovement = {
  id: string
  movement_type: string
  amount: number
  payment_method: string
  description: string | null
  created_at: string
}

type CashSummary = {
  cash_register_id: string
  opening_amount: number
  cash_sales: number
  card_sales: number
  transfer_sales: number
  cash_expenses: number
  refunds: number
  expected_cash: number
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value ?? 0))
}

function paymentLabel(value: string) {
  if (value === "cash") return "Efectivo"
  if (value === "card") return "Tarjeta"
  if (value === "transfer") return "Transferencia"

  return value
}

function movementLabel(value: string) {
  if (value === "opening") return "Apertura"
  if (value === "sale") return "Venta"
  if (value === "expense") return "Gasto"
  if (value === "refund") return "Devolución"
  if (value === "adjustment") return "Ajuste"

  return value
}

export default function CajaPage() {
  const supabase = useMemo(() => createClient(), [])

  const [register, setRegister] = useState<CashRegister | null>(null)
  const [summary, setSummary] = useState<CashSummary | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])

  const [openingAmount, setOpeningAmount] = useState("")
  const [openingEmployeeName, setOpeningEmployeeName] = useState("")
  const [openingNotes, setOpeningNotes] = useState("")
  const [countedAmount, setCountedAmount] = useState("")
  const [closingNotes, setClosingNotes] = useState("")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadCashRegister = useCallback(async () => {
    setLoading(true)
    setError("")

    const {
      data,
      error: registerError,
    } = await supabase
      .from("cash_registers")
      .select(
        "id, opened_at, opened_by_name, closed_at, opening_amount, expected_amount, counted_amount, difference_amount, status, notes",
      )
      .eq("status", "open")
      .order("opened_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle()

    if (registerError) {
      setError(registerError.message)
      setLoading(false)
      return
    }

    const openRegister =
      (data ?? null) as CashRegister | null

    const hasValidRegister =
      Boolean(openRegister?.id) &&
      openRegister?.id !== "undefined"

    if (!hasValidRegister || !openRegister) {
      setRegister(null)
      setSummary(null)
      setMovements([])
      setLoading(false)
      return
    }

    setRegister(openRegister)

    const [
      movementsResponse,
      salesResponse,
      expensesResponse,
      refundsResponse,
    ] = await Promise.all([
      supabase
        .from("cash_movements")
        .select(`
          id,
          movement_type,
          amount,
          payment_method,
          description,
          created_at
        `)
        .eq("cash_register_id", openRegister.id)
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("sales")
        .select("total, payment_method")
        .eq("cash_register_id", openRegister.id)
        .eq("status", "completed"),

      supabase
        .from("cash_movements")
        .select("amount")
        .eq("cash_register_id", openRegister.id)
        .eq("movement_type", "expense")
        .eq("payment_method", "cash"),

      supabase
        .from("cash_movements")
        .select("amount")
        .eq("cash_register_id", openRegister.id)
        .eq("movement_type", "refund")
        .eq("payment_method", "cash"),
    ])

    const firstError =
      movementsResponse.error ||
      salesResponse.error ||
      expensesResponse.error ||
      refundsResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const sales = salesResponse.data ?? []

    const cashSales = sales
      .filter((sale) => sale.payment_method === "cash")
      .reduce(
        (total, sale) => total + Number(sale.total || 0),
        0,
      )

    const cardSales = sales
      .filter((sale) => sale.payment_method === "card")
      .reduce(
        (total, sale) => total + Number(sale.total || 0),
        0,
      )

    const transferSales = sales
      .filter((sale) => sale.payment_method === "transfer")
      .reduce(
        (total, sale) => total + Number(sale.total || 0),
        0,
      )

    const cashExpenses = (expensesResponse.data ?? []).reduce(
      (total, movement) =>
        total + Number(movement.amount || 0),
      0,
    )

    const refunds = (refundsResponse.data ?? []).reduce(
      (total, movement) =>
        total + Number(movement.amount || 0),
      0,
    )

    const expectedCash =
      Number(openRegister.opening_amount || 0) +
      cashSales -
      cashExpenses -
      refunds

    setSummary({
      cash_register_id: openRegister.id,
      opening_amount: Number(openRegister.opening_amount || 0),
      cash_sales: cashSales,
      card_sales: cardSales,
      transfer_sales: transferSales,
      cash_expenses: cashExpenses,
      refunds,
      expected_cash: expectedCash,
    })

    setMovements(
      (movementsResponse.data ?? []) as CashMovement[],
    )

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCashRegister()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadCashRegister])

  const difference = useMemo(() => {
    if (!summary || countedAmount === "") return 0

    return Number(countedAmount) - summary.expected_cash
  }, [countedAmount, summary])

  async function openRegister() {
    setError("")
    setMessage("")

    const numericAmount = Number(openingAmount)
    const employeeName = openingEmployeeName.trim()

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setError("El fondo inicial no es vÃƒÂ¡lido.")
      return
    }

    if (!employeeName) {
      setError(
        "Escribe el nombre del empleado que abre la caja.",
      )
      return
    }

    setSubmitting(true)

    const { error: rpcError } = await supabase.rpc(
      "open_cash_register",
      {
        p_opening_amount: numericAmount,
        p_notes: openingNotes.trim() || null,
        p_branch_id: null,
        p_employee_name: employeeName,
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }

    setMessage("Caja abierta correctamente.")
    setOpeningAmount("")
    setOpeningEmployeeName("")
    setOpeningNotes("")

    await loadCashRegister()
    setSubmitting(false)
  }

  async function closeRegister() {
    setError("")
    setMessage("")

    if (!register || !summary) return

    const numericCounted = Number(countedAmount)

    if (
      !Number.isFinite(numericCounted) ||
      numericCounted < 0
    ) {
      setError("El efectivo contado no es vÃƒÂ¡lido.")
      return
    }

    const confirmed = window.confirm(
      `Se cerrarÃƒÂ¡ la caja con ${money(
        numericCounted,
      )} contados. Ã‚¿Deseas continuar?`,
    )

    if (!confirmed) return

    setSubmitting(true)

    const { error: rpcError } = await supabase.rpc(
      "close_cash_register_with_name",
      {
        p_counted_amount: numericCounted,
        p_closed_by_name: closingNotes.trim(),
        p_cash_register_id: register.id,
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }

    setMessage("Caja cerrada correctamente.")
    setCountedAmount("")
    setClosingNotes("")

    await loadCashRegister()
    setSubmitting(false)
  }

  return (
    <AppShell
      title="Caja"
      description="Apertura, operación y cierre diario."
    >
      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          {message}
        </div>
      )}

      <div className="mb-6 flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadCashRegister()}
          disabled={loading}
          className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-[520px] items-center justify-center rounded-[24px] border border-[#dde2da] bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#1f6a3a]" />
        </div>
      ) : !register ? (
        <section className="mx-auto max-w-2xl rounded-[24px] border border-[#dde2da] bg-white p-8 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f3eb] text-[#1f6a3a]">
            <LockKeyhole className="h-7 w-7" />
          </div>

          <h2 className="mt-6 text-2xl font-semibold">
            Caja cerrada
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Debes abrir una caja antes de registrar ventas,
            movimientos o devoluciones.
          </p>

          <div className="mt-7 space-y-5">
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Fondo inicial
              </p>

              <Input
                type="number"
                min="0"
                step="0.01"
                value={openingAmount}
                onChange={(event) =>
                  setOpeningAmount(event.target.value)
                }
                placeholder="0.00"
                className="h-12 rounded-xl text-lg"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Nombre del empleado
              </p>

              <Input
                value={openingEmployeeName}
                onChange={(event) =>
                  setOpeningEmployeeName(
                    event.target.value,
                  )
                }
                placeholder="Escribe el nombre completo"
                autoComplete="name"
                className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
              />
            </div>

            <button
              type="button"
              onClick={() => void openRegister()}
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#102019] text-sm font-semibold text-white transition hover:bg-[#174f2d] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <WalletCards className="h-5 w-5" />
              )}

              Abrir caja
            </button>
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          <section className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,#102019,#1f6a3a)] p-6 text-white shadow-lg">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Caja abierta
                </div>

                <h2 className="mt-4 text-2xl font-semibold">
                  Operación activa
                </h2>

                <p className="mt-2 text-sm text-white/75">
                  Abierta por:{" "}
                  <span className="font-semibold text-white">
                    {register.opened_by_name ||
                      "Empleado no registrado"}
                  </span>
                </p>

                <p className="mt-1 text-sm text-white/65">
                  Apertura:{" "}
                  {register.opened_at &&
                  !Number.isNaN(
                    new Date(
                      register.opened_at,
                    ).getTime(),
                  )
                    ? new Date(
                        register.opened_at,
                      ).toLocaleString("es-MX")
                    : "Sin fecha registrada"}
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-4">
                <p className="text-xs text-white/60">
                  Efectivo esperado
                </p>

                <p className="mt-2 text-3xl font-semibold">
                  {money(summary?.expected_cash)}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
              <Banknote className="h-5 w-5 text-[#1f6a3a]" />

              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Ventas en efectivo
              </p>

              <p className="mt-1 text-[24px] font-semibold">
                {money(summary?.cash_sales)}
              </p>
            </article>

            <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
              <CreditCard className="h-5 w-5 text-[#1f6a3a]" />

              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Ventas con tarjeta
              </p>

              <p className="mt-1 text-[24px] font-semibold">
                {money(summary?.card_sales)}
              </p>
            </article>

            <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
              <Smartphone className="h-5 w-5 text-[#1f6a3a]" />

              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Transferencias
              </p>

              <p className="mt-1 text-[24px] font-semibold">
                {money(summary?.transfer_sales)}
              </p>
            </article>

            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <CircleDollarSign className="h-5 w-5 text-amber-700" />

              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-amber-700">
                Fondo inicial
              </p>

              <p className="mt-1 text-[24px] font-semibold text-amber-950">
                {money(summary?.opening_amount)}
              </p>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
            <article className="overflow-hidden rounded-2xl border border-[#dde2da] bg-white shadow-sm">
              <div className="border-b border-[#e6eae4] p-4">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-[#1f6a3a]" />

                  <h2 className="text-lg font-semibold">
                    Movimientos recientes
                  </h2>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="sticky top-0 z-10 bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Fecha</th>
                      <th className="px-5 py-3.5">Movimiento</th>
                      <th className="px-5 py-3.5">Método</th>
                      <th className="px-5 py-3.5">Descripción</th>
                      <th className="px-6 py-4 text-right">
                        Importe
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#edf0eb]">
                    {movements.map((movement) => (
                      <tr
                        key={movement.id}
                        className="transition-colors hover:bg-[#f7f9f5]"
                      >
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {new Date(
                            movement.created_at,
                          ).toLocaleString("es-MX")}
                        </td>

                        <td className="px-6 py-4 text-sm font-medium">
                          {movementLabel(
                            movement.movement_type,
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          {paymentLabel(
                            movement.payment_method,
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-500">
                          {movement.description ?? "Ã¢â‚¬â€"}
                        </td>

                        <td className="px-6 py-4 text-right font-semibold">
                          {money(movement.amount)}
                        </td>
                      </tr>
                    ))}

                    {movements.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-14 text-center text-sm text-slate-500"
                        >
                          TodavÃƒÂ­a no hay movimientos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">
                Cierre de caja
              </h2>

              <div className="mt-6 space-y-5">
                <div className="rounded-2xl bg-[#f5f7f3] p-4">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Fondo inicial</span>
                    <span>{money(summary?.opening_amount)}</span>
                  </div>

                  <div className="mt-2 flex justify-between text-sm text-slate-500">
                    <span>Ventas en efectivo</span>
                    <span>{money(summary?.cash_sales)}</span>
                  </div>

                  <div className="mt-2 flex justify-between text-sm text-slate-500">
                    <span>Gastos en efectivo</span>
                    <span>
                      -{money(summary?.cash_expenses)}
                    </span>
                  </div>

                  <div className="mt-2 flex justify-between text-sm text-slate-500">
                    <span>Devoluciones</span>
                    <span>-{money(summary?.refunds)}</span>
                  </div>

                  <div className="mt-3 flex justify-between border-t border-[#dfe4dc] pt-3 font-semibold">
                    <span>Esperado</span>
                    <span>
                      {money(summary?.expected_cash)}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-500">
                    Efectivo contado
                  </p>

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={countedAmount}
                    onChange={(event) =>
                      setCountedAmount(
                        event.target.value,
                      )
                    }
                    placeholder="0.00"
                    className="h-12 rounded-xl text-lg"
                  />
                </div>

                {countedAmount !== "" && (
                  <div
                    className={`rounded-2xl p-4 ${
                      difference < 0
                        ? "bg-red-50 text-red-800"
                        : difference > 0
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-[#f5f7f3] text-slate-700"
                    }`}
                  >
                    <p className="text-xs font-medium">
                      Diferencia
                    </p>

                    <p className="mt-2 text-2xl font-semibold">
                      {difference > 0 ? "+" : ""}
                      {money(difference)}
                    </p>
                  </div>
                )}

                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-500">
                    Nombre del empleado que cierra
                  </p>

                  <Input
                    value={closingNotes}
                    onChange={(event) =>
                      setClosingNotes(event.target.value)
                    }
                    placeholder="Escribe el nombre completo"
                    autoComplete="name"
                    className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void closeRegister()}
                  disabled={submitting}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#102019] text-sm font-semibold text-white transition hover:bg-[#174f2d] disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <LockKeyhole className="h-5 w-5" />
                  )}

                  Cerrar caja
                </button>
              </div>
            </article>
          </section>
        </div>
      )}
    </AppShell>
  )
}

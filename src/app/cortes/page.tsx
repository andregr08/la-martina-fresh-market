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
  Clock3,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type CashRegister = {
  id: string
  opened_at: string
  closed_at: string | null
  opening_amount: number
  expected_amount: number | null
  counted_amount: number | null
  difference_amount: number | null
  status: "open" | "closed"
  notes: string | null
  opener: {
    full_name: string | null
  } | null
  closer: {
    full_name: string | null
  } | null
}

type CashMovement = {
  id: string
  movement_type: string
  amount: number
  payment_method: string
  description: string | null
  created_at: string
}

function money(value?: number | null) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value ?? 0))
}

function statusLabel(status: string) {
  return status === "open" ? "Abierta" : "Cerrada"
}

function movementLabel(value: string) {
  if (value === "opening") return "Apertura"
  if (value === "sale") return "Venta"
  if (value === "expense") return "Gasto"
  if (value === "refund") return "Devolución"
  if (value === "adjustment") return "Ajuste"

  return value
}

function paymentLabel(value: string) {
  if (value === "cash") return "Efectivo"
  if (value === "card") return "Tarjeta"
  if (value === "transfer") return "Transferencia"

  return value
}

export default function CortesPage() {
  const supabase = useMemo(() => createClient(), [])

  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [selectedRegister, setSelectedRegister] =
    useState<CashRegister | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("Todos")
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState("")

  const loadRegisters = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: registersError } = await supabase
      .from("cash_registers")
      .select(`
        id,
        opened_at,
        closed_at,
        opening_amount,
        expected_amount,
        counted_amount,
        difference_amount,
        status,
        notes,
        opener:profiles!cash_registers_opened_by_fkey (
          full_name
        ),
        closer:profiles!cash_registers_closed_by_fkey (
          full_name
        )
      `)
      .order("opened_at", {
        ascending: false,
      })
      .limit(500)

    if (registersError) {
      setError(registersError.message)
      setLoading(false)
      return
    }

    setRegisters((data ?? []) as unknown as CashRegister[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadRegisters()
  }, [loadRegisters])

  const filteredRegisters = useMemo(() => {
    const value = search.trim().toLowerCase()

    return registers.filter((register) => {
      const matchesSearch =
        !value ||
        register.opener?.full_name?.toLowerCase().includes(value) ||
        register.closer?.full_name?.toLowerCase().includes(value) ||
        register.id.toLowerCase().includes(value)

      const matchesStatus =
        statusFilter === "Todos" ||
        register.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [registers, search, statusFilter])

  const summary = useMemo(() => {
    return registers.reduce(
      (totals, register) => {
        totals.count += 1

        if (register.status === "open") {
          totals.open += 1
        } else {
          totals.closed += 1
        }

        const difference = Number(register.difference_amount ?? 0)

        if (difference > 0) {
          totals.surplus += difference
        }

        if (difference < 0) {
          totals.shortage += Math.abs(difference)
        }

        return totals
      },
      {
        count: 0,
        open: 0,
        closed: 0,
        surplus: 0,
        shortage: 0,
      },
    )
  }, [registers])

  async function openDetail(register: CashRegister) {
    setSelectedRegister(register)
    setMovements([])
    setDetailLoading(true)
    setError("")

    const { data, error: movementsError } = await supabase
      .from("cash_movements")
      .select(`
        id,
        movement_type,
        amount,
        payment_method,
        description,
        created_at
      `)
      .eq("cash_register_id", register.id)
      .order("created_at")

    if (movementsError) {
      setError(movementsError.message)
      setDetailLoading(false)
      return
    }

    setMovements((data ?? []) as CashMovement[])
    setDetailLoading(false)
  }

  return (
    <AppShell
      title="Cortes de caja"
      description="Historial de aperturas, cierres, faltantes y sobrantes."
    >
      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadRegisters()}
          disabled={loading}
          className="rounded-xl"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Actualizar
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[20px] border border-[#dde2da] bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
            <WalletCards className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Cortes registrados
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight">
            {summary.count}
          </p>
        </article>

        <article className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700">
            <Clock3 className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-emerald-700">
            Cajas abiertas
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight text-emerald-950">
            {summary.open}
          </p>
        </article>

        <article className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-emerald-700">
            Sobrantes acumulados
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight text-emerald-950">
            {money(summary.surplus)}
          </p>
        </article>

        <article className="rounded-[20px] border border-red-200 bg-red-50 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-red-700">
            <Banknote className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-red-700">
            Faltantes acumulados
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight text-red-950">
            {money(summary.shortage)}
          </p>
        </article>
      </section>

      <section className="mt-6 overflow-hidden rounded-[24px] border border-[#dde2da] bg-white shadow-sm">
        <div className="border-b border-[#e6eae4] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Historial de cortes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {filteredRegisters.length} resultados
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Buscar usuario o ID"
                  className="h-10 w-full rounded-xl border border-[#dce2d9] bg-[#f8f9f6] pl-9 pr-3 text-sm outline-none focus:border-[#1f6a3a] focus:bg-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none"
              >
                <option value="Todos">Todos</option>
                <option value="open">Abiertas</option>
                <option value="closed">Cerradas</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-96 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#1f6a3a]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left">
              <thead className="bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Apertura</th>
                  <th className="px-6 py-4">Cierre</th>
                  <th className="px-6 py-4">Abrió</th>
                  <th className="px-6 py-4">Cerró</th>
                  <th className="px-6 py-4">Fondo</th>
                  <th className="px-6 py-4">Esperado</th>
                  <th className="px-6 py-4">Contado</th>
                  <th className="px-6 py-4">Diferencia</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#edf0eb]">
                {filteredRegisters.map((register) => {
                  const difference = Number(
                    register.difference_amount ?? 0,
                  )

                  return (
                    <tr
                      key={register.id}
                      className="transition hover:bg-[#fafbf8]"
                    >
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(
                          register.opened_at,
                        ).toLocaleString("es-MX")}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {register.closed_at
                          ? new Date(
                              register.closed_at,
                            ).toLocaleString("es-MX")
                          : "—"}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {register.opener?.full_name ?? "Usuario"}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {register.closer?.full_name ?? "—"}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {money(register.opening_amount)}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {money(register.expected_amount)}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {money(register.counted_amount)}
                      </td>

                      <td
                        className={`px-6 py-4 font-semibold ${
                          difference < 0
                            ? "text-red-700"
                            : difference > 0
                              ? "text-emerald-700"
                              : ""
                        }`}
                      >
                        {difference > 0 ? "+" : ""}
                        {money(difference)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            register.status === "open"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {statusLabel(register.status)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            void openDetail(register)
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#dce2d9] bg-white px-3 text-xs font-medium text-slate-700 hover:bg-[#f5f7f3]"
                        >
                          <Eye className="h-4 w-4" />
                          Movimientos
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {filteredRegisters.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-6 py-20 text-center"
                    >
                      <WalletCards className="mx-auto h-8 w-8 text-slate-300" />

                      <p className="mt-4 text-sm font-medium text-slate-600">
                        No se encontraron cortes
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRegister && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[24px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e6eae4] bg-white px-6 py-5">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Movimientos de caja
                </p>

                <h2 className="mt-1 text-xl font-semibold">
                  {new Date(
                    selectedRegister.opened_at,
                  ).toLocaleString("es-MX")}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {statusLabel(selectedRegister.status)} ·{" "}
                  {selectedRegister.opener?.full_name ?? "Usuario"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedRegister(null)
                  setMovements([])
                }}
                className="rounded-xl border border-[#dce2d9] p-2 text-slate-500 hover:bg-[#f5f7f3]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex min-h-80 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#1f6a3a]" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4">Movimiento</th>
                      <th className="px-6 py-4">Método</th>
                      <th className="px-6 py-4">Descripción</th>
                      <th className="px-6 py-4 text-right">
                        Importe
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#edf0eb]">
                    {movements.map((movement) => (
                      <tr key={movement.id}>
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
                          {movement.description ?? "—"}
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
                          className="px-6 py-20 text-center text-sm text-slate-500"
                        >
                          Esta caja no tiene movimientos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  )
}

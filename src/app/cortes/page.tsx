"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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

export default function CortesPage() {
  const supabase = createClient()

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
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <WalletCards className="h-5 w-5 text-slate-500" />
          <p className="mt-4 text-sm text-slate-500">Cortes registrados</p>
          <p className="mt-2 text-2xl font-semibold">{summary.count}</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <Clock3 className="h-5 w-5 text-slate-500" />
          <p className="mt-4 text-sm text-slate-500">Cajas abiertas</p>
          <p className="mt-2 text-2xl font-semibold">{summary.open}</p>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          <p className="mt-4 text-sm text-emerald-700">Sobrantes acumulados</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-900">
            {money(summary.surplus)}
          </p>
        </article>

        <article className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <Banknote className="h-5 w-5 text-red-700" />
          <p className="mt-4 text-sm text-red-700">Faltantes acumulados</p>
          <p className="mt-2 text-2xl font-semibold text-red-900">
            {money(summary.shortage)}
          </p>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Historial de cortes</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredRegisters.length} resultados
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por usuario o ID"
                className="pl-9"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="Todos">Todos</option>
              <option value="open">Abiertas</option>
              <option value="closed">Cerradas</option>
            </select>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadRegisters()}
              disabled={loading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Actualizar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Apertura</th>
                  <th className="px-5 py-4 font-medium">Cierre</th>
                  <th className="px-5 py-4 font-medium">Abrió</th>
                  <th className="px-5 py-4 font-medium">Cerró</th>
                  <th className="px-5 py-4 font-medium">Fondo inicial</th>
                  <th className="px-5 py-4 font-medium">Esperado</th>
                  <th className="px-5 py-4 font-medium">Contado</th>
                  <th className="px-5 py-4 font-medium">Diferencia</th>
                  <th className="px-5 py-4 font-medium">Estado</th>
                  <th className="px-5 py-4 font-medium">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredRegisters.map((register) => {
                  const difference = Number(
                    register.difference_amount ?? 0,
                  )

                  return (
                    <tr key={register.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm">
                        {new Date(register.opened_at).toLocaleString(
                          "es-MX",
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm">
                        {register.closed_at
                          ? new Date(
                              register.closed_at,
                            ).toLocaleString("es-MX")
                          : "—"}
                      </td>

                      <td className="px-5 py-4">
                        {register.opener?.full_name ?? "Usuario"}
                      </td>

                      <td className="px-5 py-4">
                        {register.closer?.full_name ?? "—"}
                      </td>

                      <td className="px-5 py-4">
                        {money(register.opening_amount)}
                      </td>

                      <td className="px-5 py-4">
                        {money(register.expected_amount)}
                      </td>

                      <td className="px-5 py-4">
                        {money(register.counted_amount)}
                      </td>

                      <td
                        className={`px-5 py-4 font-semibold ${
                          difference < 0
                            ? "text-red-700"
                            : difference > 0
                              ? "text-emerald-700"
                              : ""
                        }`}
                      >
                        {money(difference)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            register.status === "open"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {statusLabel(register.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void openDetail(register)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver movimientos
                        </Button>
                      </td>
                    </tr>
                  )
                })}

                {filteredRegisters.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-5 py-14 text-center text-sm text-slate-500"
                    >
                      No existen cortes con esos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  Movimientos de caja
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Apertura:{" "}
                  {new Date(
                    selectedRegister.opened_at,
                  ).toLocaleString("es-MX")}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedRegister(null)
                  setMovements([])
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {detailLoading ? (
              <div className="flex min-h-56 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[700px] text-left">
                  <thead className="border-b border-slate-200 text-sm text-slate-500">
                    <tr>
                      <th className="py-3 font-medium">Fecha</th>
                      <th className="py-3 font-medium">Movimiento</th>
                      <th className="py-3 font-medium">Método</th>
                      <th className="py-3 font-medium">Descripción</th>
                      <th className="py-3 font-medium">Importe</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {movements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="py-4 text-sm">
                          {new Date(
                            movement.created_at,
                          ).toLocaleString("es-MX")}
                        </td>

                        <td className="py-4">
                          {movement.movement_type}
                        </td>

                        <td className="py-4">
                          {movement.payment_method}
                        </td>

                        <td className="py-4">
                          {movement.description ?? "—"}
                        </td>

                        <td className="py-4 font-semibold">
                          {money(movement.amount)}
                        </td>
                      </tr>
                    ))}

                    {movements.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-14 text-center text-sm text-slate-500"
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

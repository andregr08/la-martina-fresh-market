"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Equal,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type Product = {
  id: string
  sku: string | null
  name: string
  unit: string
  current_stock: number
}

type Adjustment = {
  id: string
  system_quantity: number
  counted_quantity: number
  difference_quantity: number
  adjustment_type: string
  reason: string
  notes: string | null
  adjusted_at: string
  product: {
    name: string
    unit: string
  } | null
  user: {
    full_name: string | null
  } | null
}

function quantity(value: number, unit: string) {
  return `${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} ${unit}`
}

function adjustmentLabel(type: string) {
  if (type === "increase") return "Aumento"
  if (type === "decrease") return "Disminución"

  return "Sin diferencia"
}

function AdjustmentIcon({
  type,
}: {
  type: string
}) {
  if (type === "increase") {
    return <ArrowUpRight className="h-4 w-4" />
  }

  if (type === "decrease") {
    return <ArrowDownRight className="h-4 w-4" />
  }

  return <Equal className="h-4 w-4" />
}

export default function AjustesInventarioPage() {
  const supabase = useMemo(() => createClient(), [])

  const [products, setProducts] = useState<Product[]>([])
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])

  const [productId, setProductId] = useState("")
  const [countedQuantity, setCountedQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("Todos")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [productsResponse, adjustmentsResponse] =
      await Promise.all([
        supabase
          .from("products")
          .select("id, sku, name, unit, current_stock")
          .eq("active", true)
          .order("name"),

        supabase
          .from("stock_adjustments")
          .select(`
            id,
            system_quantity,
            counted_quantity,
            difference_quantity,
            adjustment_type,
            reason,
            notes,
            adjusted_at,
            product:products (
              name,
              unit
            ),
            user:profiles!stock_adjustments_adjusted_by_fkey (
              full_name
            )
          `)
          .order("adjusted_at", {
            ascending: false,
          })
          .limit(300),
      ])

    const firstError =
      productsResponse.error || adjustmentsResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setProducts((productsResponse.data ?? []) as Product[])
    setAdjustments(
      (adjustmentsResponse.data ?? []) as unknown as Adjustment[],
    )
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData])

  const selectedProduct = products.find(
    (product) => product.id === productId,
  )

  const difference =
    selectedProduct && countedQuantity !== ""
      ? Number(countedQuantity) -
        Number(selectedProduct.current_stock)
      : 0

  const filteredAdjustments = useMemo(() => {
    const value = search.trim().toLowerCase()

    return adjustments.filter((adjustment) => {
      const matchesSearch =
        !value ||
        adjustment.product?.name.toLowerCase().includes(value) ||
        adjustment.reason.toLowerCase().includes(value) ||
        adjustment.user?.full_name?.toLowerCase().includes(value)

      const matchesType =
        typeFilter === "Todos" ||
        adjustment.adjustment_type === typeFilter

      return matchesSearch && matchesType
    })
  }, [adjustments, search, typeFilter])

  const summary = useMemo(() => {
    return adjustments.reduce(
      (totals, adjustment) => {
        totals.count += 1

        if (adjustment.adjustment_type === "increase") {
          totals.increases += 1
          totals.increaseQuantity += Number(
            adjustment.difference_quantity || 0,
          )
        }

        if (adjustment.adjustment_type === "decrease") {
          totals.decreases += 1
          totals.decreaseQuantity += Math.abs(
            Number(adjustment.difference_quantity || 0),
          )
        }

        return totals
      },
      {
        count: 0,
        increases: 0,
        decreases: 0,
        increaseQuantity: 0,
        decreaseQuantity: 0,
      },
    )
  }, [adjustments])

  async function registerAdjustment() {
    setError("")
    setMessage("")

    const counted = Number(countedQuantity)

    if (!productId) {
      setError("Selecciona un producto.")
      return
    }

    if (!Number.isFinite(counted) || counted < 0) {
      setError("La cantidad contada no es válida.")
      return
    }

    if (!reason.trim()) {
      setError("Debes indicar el motivo del ajuste.")
      return
    }

    const confirmed = window.confirm(
      `El inventario de ${
        selectedProduct?.name ?? "este producto"
      } cambiará de ${
        selectedProduct?.current_stock ?? 0
      } a ${counted}. ¿Deseas continuar?`,
    )

    if (!confirmed) return

    setSubmitting(true)

    const { data, error: rpcError } = await supabase.rpc(
      "adjust_inventory",
      {
        p_product_id: productId,
        p_counted_quantity: counted,
        p_reason: reason.trim(),
        p_notes: notes.trim() || null,
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }

    const result = data as {
      product?: string
      system_quantity?: number
      counted_quantity?: number
      difference_quantity?: number
    }

    setMessage(
      `${result.product ?? "Producto"} ajustado de ${
        result.system_quantity ?? 0
      } a ${result.counted_quantity ?? counted}. Diferencia: ${
        result.difference_quantity ?? difference
      }.`,
    )

    setProductId("")
    setCountedQuantity("")
    setReason("")
    setNotes("")

    await loadData()
    setSubmitting(false)
  }

  return (
    <AppShell
      title="Ajustes de inventario"
      description="Correcciones por conteo físico con trazabilidad."
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
          onClick={() => void loadData()}
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
            <ClipboardCheck className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Ajustes registrados
          </p>

          <p className="mt-1 text-[24px] font-semibold tracking-tight">
            {summary.count}
          </p>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700">
            <ArrowUpRight className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-emerald-700">
            Aumentos
          </p>

          <p className="mt-1 text-[24px] font-semibold tracking-tight text-emerald-950">
            {summary.increases}
          </p>

          <p className="mt-1 text-xs text-emerald-700">
            +{summary.increaseQuantity.toLocaleString("es-MX", {
              maximumFractionDigits: 3,
            })}
          </p>
        </article>

        <article className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-red-700">
            <ArrowDownRight className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-red-700">
            Disminuciones
          </p>

          <p className="mt-1 text-[24px] font-semibold tracking-tight text-red-950">
            {summary.decreases}
          </p>

          <p className="mt-1 text-xs text-red-700">
            -{summary.decreaseQuantity.toLocaleString("es-MX", {
              maximumFractionDigits: 3,
            })}
          </p>
        </article>

        <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-slate-600">
            <Equal className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Diferencia actual
          </p>

          <p
            className={`mt-2 text-[28px] font-semibold tracking-tight ${
              difference > 0
                ? "text-emerald-700"
                : difference < 0
                  ? "text-red-700"
                  : ""
            }`}
          >
            {difference > 0 ? "+" : ""}
            {Number(difference || 0).toLocaleString("es-MX", {
              maximumFractionDigits: 3,
            })}
          </p>
        </article>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[400px_1fr]">
        <article className="rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-[#1f6a3a]" />

            <h2 className="text-lg font-semibold">
              Nuevo ajuste
            </h2>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Producto
              </p>

              <select
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value)
                  setCountedQuantity("")
                }}
                className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none focus:border-[#1f6a3a]"
              >
                <option value="">
                  Selecciona un producto
                </option>

                {products.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.sku ? `${product.sku} — ` : ""}
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div className="rounded-2xl bg-[#f5f7f3] p-4">
                <p className="text-xs font-medium text-slate-500">
                  Existencia del sistema
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {quantity(
                    selectedProduct.current_stock,
                    selectedProduct.unit,
                  )}
                </p>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Cantidad física contada
              </p>

              <Input
                type="number"
                min="0"
                step="0.001"
                value={countedQuantity}
                onChange={(event) =>
                  setCountedQuantity(event.target.value)
                }
                placeholder="0.000"
                className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
              />
            </div>

            {selectedProduct && countedQuantity !== "" && (
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
                  Diferencia detectada
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {difference > 0 ? "+" : ""}
                  {quantity(
                    difference,
                    selectedProduct.unit,
                  )}
                </p>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Motivo
              </p>

              <Input
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                placeholder="Ej. Diferencia en conteo físico"
                className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Observaciones
              </p>

              <Input
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Opcional"
                className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
              />
            </div>

            <button
              type="button"
              onClick={() => void registerAdjustment()}
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#102019] text-sm font-semibold text-white transition hover:bg-[#174f2d] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ClipboardCheck className="h-5 w-5" />
              )}

              Aplicar ajuste
            </button>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-[#dde2da] bg-white shadow-sm">
          <div className="border-b border-[#e6eae4] p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Historial de ajustes
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredAdjustments.length} registros
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
                    placeholder="Buscar producto, motivo o usuario"
                    className="h-10 w-full rounded-xl border border-[#dce2d9] bg-[#f8f9f6] pl-9 pr-3 text-sm outline-none focus:border-[#1f6a3a] focus:bg-white"
                  />
                </div>

                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value)
                  }
                  className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none"
                >
                  <option value="Todos">Todos</option>
                  <option value="increase">Aumentos</option>
                  <option value="decrease">
                    Disminuciones
                  </option>
                  <option value="no_change">
                    Sin diferencia
                  </option>
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
              <table className="w-full min-w-[1050px] text-left">
                <thead className="sticky top-0 z-10 bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Fecha</th>
                    <th className="px-5 py-3.5">Producto</th>
                    <th className="px-5 py-3.5">Sistema</th>
                    <th className="px-5 py-3.5">Contado</th>
                    <th className="px-5 py-3.5">Diferencia</th>
                    <th className="px-5 py-3.5">Tipo</th>
                    <th className="px-5 py-3.5">Motivo</th>
                    <th className="px-5 py-3.5">Usuario</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf0eb]">
                  {filteredAdjustments.map((adjustment) => (
                    <tr
                      key={adjustment.id}
                      className="transition-colors hover:bg-[#f7f9f5]"
                    >
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(
                          adjustment.adjusted_at,
                        ).toLocaleString("es-MX")}
                      </td>

                      <td className="px-6 py-4 font-medium">
                        {adjustment.product?.name ?? "Producto"}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {quantity(
                          adjustment.system_quantity,
                          adjustment.product?.unit ?? "",
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {quantity(
                          adjustment.counted_quantity,
                          adjustment.product?.unit ?? "",
                        )}
                      </td>

                      <td
                        className={`px-6 py-4 font-semibold ${
                          adjustment.difference_quantity < 0
                            ? "text-red-700"
                            : adjustment.difference_quantity > 0
                              ? "text-emerald-700"
                              : ""
                        }`}
                      >
                        {adjustment.difference_quantity > 0
                          ? "+"
                          : ""}
                        {quantity(
                          adjustment.difference_quantity,
                          adjustment.product?.unit ?? "",
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                            adjustment.adjustment_type ===
                            "increase"
                              ? "bg-emerald-50 text-emerald-700"
                              : adjustment.adjustment_type ===
                                  "decrease"
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <AdjustmentIcon
                            type={adjustment.adjustment_type}
                          />

                          {adjustmentLabel(
                            adjustment.adjustment_type,
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {adjustment.reason}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {adjustment.user?.full_name ?? "Usuario"}
                      </td>
                    </tr>
                  ))}

                  {filteredAdjustments.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-14 text-center"
                      >
                        <ClipboardCheck className="mx-auto h-8 w-8 text-slate-300" />

                        <p className="mt-4 text-sm font-medium text-slate-600">
                          No se encontraron ajustes
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </AppShell>
  )
}

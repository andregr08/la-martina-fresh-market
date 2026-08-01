"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    maximumFractionDigits: 3,
  })} ${unit}`
}

function adjustmentLabel(type: string) {
  if (type === "increase") return "Aumento"
  if (type === "decrease") return "Disminución"
  return "Sin diferencia"
}

export default function AjustesInventarioPage() {
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])

  const [productId, setProductId] = useState("")
  const [countedQuantity, setCountedQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [search, setSearch] = useState("")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [productsResponse, adjustmentsResponse] = await Promise.all([
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
    void loadData()
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

    if (!value) return adjustments

    return adjustments.filter(
      (adjustment) =>
        adjustment.product?.name.toLowerCase().includes(value) ||
        adjustment.reason.toLowerCase().includes(value) ||
        adjustment.user?.full_name?.toLowerCase().includes(value),
    )
  }, [adjustments, search])

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

      <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            <h2 className="text-lg font-semibold">
              Nuevo ajuste
            </h2>
          </div>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label>Producto</Label>

              <select
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value)
                  setCountedQuantity("")
                }}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
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
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">
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

            <div className="space-y-2">
              <Label>Cantidad física contada</Label>

              <Input
                type="number"
                min="0"
                step="0.001"
                value={countedQuantity}
                onChange={(event) =>
                  setCountedQuantity(event.target.value)
                }
                placeholder="0.000"
              />
            </div>

            {selectedProduct && countedQuantity !== "" && (
              <div
                className={`rounded-xl p-4 ${
                  difference < 0
                    ? "bg-red-50 text-red-800"
                    : difference > 0
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-slate-50 text-slate-700"
                }`}
              >
                <p className="text-sm">Diferencia detectada</p>

                <p className="mt-1 text-xl font-semibold">
                  {difference > 0 ? "+" : ""}
                  {quantity(difference, selectedProduct.unit)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo</Label>

              <Input
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                placeholder="Ej. Diferencia en conteo físico"
              />
            </div>

            <div className="space-y-2">
              <Label>Observaciones</Label>

              <Input
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
              onClick={registerAdjustment}
              disabled={submitting}
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Aplicar ajuste
            </Button>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Historial de ajustes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {filteredAdjustments.length} registros
              </p>
            </div>

            <div className="flex gap-3">
              <div className="relative min-w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <Input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Buscar producto o motivo"
                  className="pl-9"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => void loadData()}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    loading ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Fecha</th>
                    <th className="px-5 py-4 font-medium">Producto</th>
                    <th className="px-5 py-4 font-medium">Sistema</th>
                    <th className="px-5 py-4 font-medium">Contado</th>
                    <th className="px-5 py-4 font-medium">Diferencia</th>
                    <th className="px-5 py-4 font-medium">Tipo</th>
                    <th className="px-5 py-4 font-medium">Motivo</th>
                    <th className="px-5 py-4 font-medium">Usuario</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredAdjustments.map((adjustment) => (
                    <tr
                      key={adjustment.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 text-sm">
                        {new Date(
                          adjustment.adjusted_at,
                        ).toLocaleString("es-MX")}
                      </td>

                      <td className="px-5 py-4 font-medium">
                        {adjustment.product?.name ?? "Producto"}
                      </td>

                      <td className="px-5 py-4">
                        {quantity(
                          adjustment.system_quantity,
                          adjustment.product?.unit ?? "",
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {quantity(
                          adjustment.counted_quantity,
                          adjustment.product?.unit ?? "",
                        )}
                      </td>

                      <td
                        className={`px-5 py-4 font-semibold ${
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

                      <td className="px-5 py-4">
                        {adjustmentLabel(
                          adjustment.adjustment_type,
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {adjustment.reason}
                      </td>

                      <td className="px-5 py-4">
                        {adjustment.user?.full_name ?? "Usuario"}
                      </td>
                    </tr>
                  ))}

                  {filteredAdjustments.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        Todavía no existen ajustes.
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

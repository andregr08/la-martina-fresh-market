"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Product = {
  id: string
  name: string
  sku: string | null
  unit: string
  current_stock: number
}

type WasteRecord = {
  id: string
  quantity: number
  total_loss: number
  reason: string
  notes: string | null
  recorded_at: string
  product: {
    name: string
    unit: string
  } | null
}

const reasons = [
  ["spoiled", "Producto echado a perder"],
  ["damaged", "Producto golpeado o dañado"],
  ["overripe", "Maduración excesiva"],
  ["theft", "Robo"],
  ["weighing_error", "Error de pesaje"],
  ["internal_use", "Consumo interno"],
  ["gift", "Regalo"],
  ["inventory_adjustment", "Ajuste de inventario"],
  ["reception_difference", "Diferencia en recepción"],
  ["customer_return", "Devolución"],
  ["other", "Otro"],
]

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0))
}

function reasonLabel(reason: string) {
  return reasons.find(([value]) => value === reason)?.[1] ?? reason
}

export default function MermasPage() {
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [records, setRecords] = useState<WasteRecord[]>([])

  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("spoiled")
  const [notes, setNotes] = useState("")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [productsResponse, recordsResponse] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, unit, current_stock")
        .eq("active", true)
        .gt("current_stock", 0)
        .order("name"),

      supabase
        .from("waste_records")
        .select(`
          id,
          quantity,
          total_loss,
          reason,
          notes,
          recorded_at,
          product:products (
            name,
            unit
          )
        `)
        .order("recorded_at", {
          ascending: false,
        })
        .limit(200),
    ])

    const firstError =
      productsResponse.error || recordsResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setProducts((productsResponse.data ?? []) as Product[])
    setRecords(
      (recordsResponse.data ?? []) as unknown as WasteRecord[],
    )

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const selectedProduct = products.find(
    (product) => product.id === productId,
  )

  const totalLoss = useMemo(
    () =>
      records.reduce(
        (total, record) => total + Number(record.total_loss || 0),
        0,
      ),
    [records],
  )

  async function registerWaste() {
    setError("")
    setMessage("")

    const numericQuantity = Number(quantity)

    if (!productId) {
      setError("Selecciona un producto.")
      return
    }

    if (
      !Number.isFinite(numericQuantity) ||
      numericQuantity <= 0
    ) {
      setError("La cantidad debe ser mayor a cero.")
      return
    }

    if (
      selectedProduct &&
      numericQuantity > Number(selectedProduct.current_stock)
    ) {
      setError("La merma supera la existencia disponible.")
      return
    }

    setSubmitting(true)

    const { data, error: rpcError } = await supabase.rpc(
      "register_waste",
      {
        p_product_id: productId,
        p_quantity: numericQuantity,
        p_reason: reason,
        p_notes: notes.trim() || null,
        p_evidence_url: null,
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }

    const result = data as {
      product?: string
      quantity?: number
      total_loss?: number
    }

    setMessage(
      `Merma registrada: ${result.quantity ?? numericQuantity} kg de ${
        result.product ?? "producto"
      }. Pérdida: ${money(Number(result.total_loss ?? 0))}.`,
    )

    setProductId("")
    setQuantity("")
    setReason("spoiled")
    setNotes("")

    await loadData()
    setSubmitting(false)
  }

  return (
    <AppShell
      title="Mermas"
      description="Pérdidas de producto y ajustes de inventario."
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

      <section className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            <h2 className="text-lg font-semibold">
              Registrar merma
            </h2>
          </div>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label>Producto</Label>

              <select
                value={productId}
                onChange={(event) =>
                  setProductId(event.target.value)
                }
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
                    {product.name} ({product.current_stock}{" "}
                    {product.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Cantidad</Label>

              <Input
                type="number"
                min="0.001"
                step="0.001"
                max={selectedProduct?.current_stock}
                value={quantity}
                onChange={(event) =>
                  setQuantity(event.target.value)
                }
                placeholder="0.000"
              />

              {selectedProduct && (
                <p className="text-sm text-slate-500">
                  Disponible: {selectedProduct.current_stock}{" "}
                  {selectedProduct.unit}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>

              <select
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                {reasons.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
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
              onClick={registerWaste}
              disabled={submitting}
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Registrar merma
            </Button>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-semibold">
                Historial de mermas
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Pérdida acumulada: {money(totalLoss)}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadData()}
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

          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">
                      Fecha
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Producto
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Cantidad
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Motivo
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Pérdida
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Notas
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {new Date(
                          record.recorded_at,
                        ).toLocaleString("es-MX")}
                      </td>

                      <td className="px-5 py-4 font-medium">
                        {record.product?.name ?? "Producto"}
                      </td>

                      <td className="px-5 py-4">
                        {record.quantity}{" "}
                        {record.product?.unit ?? ""}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {reasonLabel(record.reason)}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        {money(record.total_loss)}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {record.notes ?? "—"}
                      </td>
                    </tr>
                  ))}

                  {records.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        Todavía no hay mermas registradas.
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

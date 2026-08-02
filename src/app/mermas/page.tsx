"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PackageOpen,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  WalletCards,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

function quantity(value: number, unit: string) {
  return `${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} ${unit}`
}

function reasonLabel(reason: string) {
  return reasons.find(([value]) => value === reason)?.[1] ?? reason
}

export default function MermasPage() {
  const supabase = useMemo(() => createClient(), [])

  const [products, setProducts] = useState<Product[]>([])
  const [records, setRecords] = useState<WasteRecord[]>([])

  const [productId, setProductId] = useState("")
  const [wasteQuantity, setWasteQuantity] = useState("")
  const [reason, setReason] = useState("spoiled")
  const [notes, setNotes] = useState("")
  const [search, setSearch] = useState("")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [productsResponse, recordsResponse] =
      await Promise.all([
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
          .limit(300),
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
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData])

  const selectedProduct = products.find(
    (product) => product.id === productId,
  )

  const filteredRecords = useMemo(() => {
    const value = search.trim().toLowerCase()

    if (!value) return records

    return records.filter(
      (record) =>
        record.product?.name.toLowerCase().includes(value) ||
        reasonLabel(record.reason).toLowerCase().includes(value) ||
        record.notes?.toLowerCase().includes(value),
    )
  }, [records, search])

  const summary = useMemo(() => {
    return records.reduce(
      (totals, record) => {
        totals.count += 1
        totals.quantity += Number(record.quantity || 0)
        totals.loss += Number(record.total_loss || 0)

        if (record.reason === "spoiled") {
          totals.spoiled += 1
        }

        return totals
      },
      {
        count: 0,
        quantity: 0,
        loss: 0,
        spoiled: 0,
      },
    )
  }, [records])

  async function registerWaste() {
    setError("")
    setMessage("")

    const numericQuantity = Number(wasteQuantity)

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
      `Merma registrada: ${result.quantity ?? numericQuantity} de ${
        result.product ?? "producto"
      }. Pérdida: ${money(Number(result.total_loss ?? 0))}.`,
    )

    setProductId("")
    setWasteQuantity("")
    setReason("spoiled")
    setNotes("")

    await loadData()
    setSubmitting(false)
  }

  return (
    <AppShell
      title="Mermas"
      description="Control de pérdidas, caducidad y producto dañado."
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
            <Trash2 className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Mermas registradas
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight">
            {summary.count}
          </p>
        </article>

        <article className="rounded-[20px] border border-[#dde2da] bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
            <TrendingDown className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Cantidad acumulada
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight">
            {summary.quantity.toLocaleString("es-MX", {
              maximumFractionDigits: 3,
            })}
          </p>
        </article>

        <article className="rounded-[20px] border border-red-200 bg-red-50 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-red-700">
            <WalletCards className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-red-700">
            Pérdida acumulada
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight text-red-950">
            {money(summary.loss)}
          </p>
        </article>

        <article className="rounded-[20px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-700">
            <PackageOpen className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-amber-700">
            Por caducidad
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight text-amber-950">
            {summary.spoiled}
          </p>
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[400px_1fr]">
        <article className="rounded-[24px] border border-[#dde2da] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-700" />

            <h2 className="text-lg font-semibold">
              Registrar merma
            </h2>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Producto
              </p>

              <select
                value={productId}
                onChange={(event) =>
                  setProductId(event.target.value)
                }
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
                  Existencia disponible
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
                Cantidad de merma
              </p>

              <Input
                type="number"
                min="0.001"
                step="0.001"
                max={selectedProduct?.current_stock}
                value={wasteQuantity}
                onChange={(event) =>
                  setWasteQuantity(event.target.value)
                }
                placeholder="0.000"
                className="rounded-xl"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Motivo
              </p>

              <select
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none"
              >
                {reasons.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
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
                className="rounded-xl"
              />
            </div>

            <button
              type="button"
              onClick={() => void registerWaste()}
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#102019] text-sm font-semibold text-white transition hover:bg-[#174f2d] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Trash2 className="h-5 w-5" />
              )}

              Registrar merma
            </button>
          </div>
        </article>

        <article className="overflow-hidden rounded-[24px] border border-[#dde2da] bg-white shadow-sm">
          <div className="border-b border-[#e6eae4] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Historial de mermas
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredRecords.length} registros
                </p>
              </div>

              <div className="relative min-w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Buscar producto o motivo"
                  className="h-10 w-full rounded-xl border border-[#dce2d9] bg-[#f8f9f6] pl-9 pr-3 text-sm outline-none focus:border-[#1f6a3a] focus:bg-white"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-96 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#1f6a3a]" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead className="bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-6 py-4">Cantidad</th>
                    <th className="px-6 py-4">Motivo</th>
                    <th className="px-6 py-4">Pérdida</th>
                    <th className="px-6 py-4">Notas</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf0eb]">
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      className="transition hover:bg-[#fafbf8]"
                    >
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(
                          record.recorded_at,
                        ).toLocaleString("es-MX")}
                      </td>

                      <td className="px-6 py-4 font-medium">
                        {record.product?.name ?? "Producto"}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {quantity(
                          record.quantity,
                          record.product?.unit ?? "",
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {reasonLabel(record.reason)}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-semibold text-red-700">
                        {money(record.total_loss)}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {record.notes ?? "—"}
                      </td>
                    </tr>
                  ))}

                  {filteredRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-20 text-center"
                      >
                        <Trash2 className="mx-auto h-8 w-8 text-slate-300" />

                        <p className="mt-4 text-sm font-medium text-slate-600">
                          No se encontraron mermas
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

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShoppingCart,
  X,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type Purchase = {
  id: string
  folio: string
  purchase_date: string
  merchandise_subtotal: number
  transport_cost: number
  parking_cost: number
  loader_cost: number
  other_costs: number
  total: number
  payment_method: string
  payment_status: string
  notes: string | null
  supplier: {
    name: string
  } | null
}

type PurchaseItem = {
  id: string
  quantity: number
  unit_cost: number
  subtotal: number
  received_quantity: number | null
  product: {
    name: string
    sku: string | null
    unit: string
  } | null
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0))
}

function paymentLabel(value: string) {
  if (value === "cash") return "Efectivo"
  if (value === "card") return "Tarjeta"
  if (value === "transfer") return "Transferencia"
  if (value === "credit") return "Crédito"
  return value
}

export default function ComprasPage() {
  const supabase = createClient()

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [selectedPurchase, setSelectedPurchase] =
    useState<Purchase | null>(null)
  const [selectedItems, setSelectedItems] = useState<PurchaseItem[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState("")

  const loadPurchases = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: purchasesError } = await supabase
      .from("purchases")
      .select(`
        id,
        folio,
        purchase_date,
        merchandise_subtotal,
        transport_cost,
        parking_cost,
        loader_cost,
        other_costs,
        total,
        payment_method,
        payment_status,
        notes,
        supplier:suppliers (
          name
        )
      `)
      .order("purchase_date", {
        ascending: false,
      })
      .limit(500)

    if (purchasesError) {
      setError(purchasesError.message)
      setLoading(false)
      return
    }

    setPurchases((data ?? []) as unknown as Purchase[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadPurchases()
  }, [loadPurchases])

  const filteredPurchases = useMemo(() => {
    const value = search.trim().toLowerCase()

    if (!value) return purchases

    return purchases.filter(
      (purchase) =>
        purchase.folio.toLowerCase().includes(value) ||
        purchase.supplier?.name.toLowerCase().includes(value),
    )
  }, [purchases, search])

  const summary = useMemo(
    () =>
      purchases.reduce(
        (totals, purchase) => {
          totals.merchandise += Number(
            purchase.merchandise_subtotal || 0,
          )
          totals.logistics +=
            Number(purchase.transport_cost || 0) +
            Number(purchase.parking_cost || 0) +
            Number(purchase.loader_cost || 0) +
            Number(purchase.other_costs || 0)
          totals.total += Number(purchase.total || 0)
          totals.count += 1
          return totals
        },
        {
          merchandise: 0,
          logistics: 0,
          total: 0,
          count: 0,
        },
      ),
    [purchases],
  )

  async function openPurchase(purchase: Purchase) {
    setSelectedPurchase(purchase)
    setSelectedItems([])
    setDetailLoading(true)
    setError("")

    const { data, error: itemsError } = await supabase
      .from("purchase_items")
      .select(`
        id,
        quantity,
        unit_cost,
        subtotal,
        received_quantity,
        product:products (
          name,
          sku,
          unit
        )
      `)
      .eq("purchase_id", purchase.id)
      .order("created_at")

    if (itemsError) {
      setError(itemsError.message)
      setDetailLoading(false)
      return
    }

    setSelectedItems((data ?? []) as unknown as PurchaseItem[])
    setDetailLoading(false)
  }

  return (
    <AppShell
      title="Compras"
      description="Historial de entradas y costos de mercancía."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Compras registradas</p>
          <p className="mt-3 text-2xl font-semibold">{summary.count}</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Mercancía</p>
          <p className="mt-3 text-2xl font-semibold">
            {money(summary.merchandise)}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Logística</p>
          <p className="mt-3 text-2xl font-semibold">
            {money(summary.logistics)}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Costo total</p>
          <p className="mt-3 text-2xl font-semibold">
            {money(summary.total)}
          </p>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <h2 className="text-lg font-semibold">
                Historial de compras
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {filteredPurchases.length} resultados
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar folio o proveedor"
                className="pl-9"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadPurchases()}
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
            <table className="w-full min-w-[1000px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Folio</th>
                  <th className="px-5 py-4 font-medium">Fecha</th>
                  <th className="px-5 py-4 font-medium">Proveedor</th>
                  <th className="px-5 py-4 font-medium">Mercancía</th>
                  <th className="px-5 py-4 font-medium">Logística</th>
                  <th className="px-5 py-4 font-medium">Total</th>
                  <th className="px-5 py-4 font-medium">Pago</th>
                  <th className="px-5 py-4 font-medium">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.map((purchase) => {
                  const logistics =
                    Number(purchase.transport_cost || 0) +
                    Number(purchase.parking_cost || 0) +
                    Number(purchase.loader_cost || 0) +
                    Number(purchase.other_costs || 0)

                  return (
                    <tr key={purchase.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-medium">
                        {purchase.folio}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {new Date(
                          purchase.purchase_date,
                        ).toLocaleString("es-MX")}
                      </td>

                      <td className="px-5 py-4">
                        {purchase.supplier?.name ?? "Proveedor"}
                      </td>

                      <td className="px-5 py-4">
                        {money(purchase.merchandise_subtotal)}
                      </td>

                      <td className="px-5 py-4">
                        {money(logistics)}
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        {money(purchase.total)}
                      </td>

                      <td className="px-5 py-4">
                        {paymentLabel(purchase.payment_method)}
                      </td>

                      <td className="px-5 py-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void openPurchase(purchase)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalle
                        </Button>
                      </td>
                    </tr>
                  )
                })}

                {filteredPurchases.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-14 text-center text-sm text-slate-500"
                    >
                      Todavía no existen compras registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {selectedPurchase.folio}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {new Date(
                    selectedPurchase.purchase_date,
                  ).toLocaleString("es-MX")}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedPurchase(null)
                  setSelectedItems([])
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
                <table className="w-full min-w-[650px] text-left">
                  <thead className="border-b border-slate-200 text-sm text-slate-500">
                    <tr>
                      <th className="py-3 font-medium">Producto</th>
                      <th className="py-3 font-medium">Cantidad</th>
                      <th className="py-3 font-medium">Costo unitario</th>
                      <th className="py-3 font-medium">Subtotal</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {selectedItems.map((item) => (
                      <tr key={item.id}>
                        <td className="py-4">
                          <p className="font-medium">
                            {item.product?.name ?? "Producto"}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {item.product?.sku ?? "Sin SKU"}
                          </p>
                        </td>

                        <td className="py-4">
                          {item.quantity} {item.product?.unit ?? ""}
                        </td>

                        <td className="py-4">
                          {money(item.unit_cost)}
                        </td>

                        <td className="py-4 font-semibold">
                          {money(item.subtotal)}
                        </td>
                      </tr>
                    ))}
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

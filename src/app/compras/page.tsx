"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  Banknote,
  CreditCard,
  Eye,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
  ShoppingCart,
  Smartphone,
  Truck,
  WalletCards,
  X,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
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

function statusLabel(value: string) {
  if (value === "paid") return "Pagado"
  if (value === "pending") return "Pendiente"
  if (value === "partial") return "Parcial"

  return value
}

function paymentIcon(method: string) {
  if (method === "cash") return Banknote
  if (method === "card") return CreditCard
  if (method === "transfer") return Smartphone

  return WalletCards
}

export default function ComprasPage() {
  const supabase = useMemo(() => createClient(), [])

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [selectedPurchase, setSelectedPurchase] =
    useState<Purchase | null>(null)
  const [selectedItems, setSelectedItems] =
    useState<PurchaseItem[]>([])

  const [search, setSearch] = useState("")
  const [paymentFilter, setPaymentFilter] = useState("Todos")
  const [statusFilter, setStatusFilter] = useState("Todos")

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
    const timer = window.setTimeout(() => {
      void loadPurchases()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadPurchases])

  const filteredPurchases = useMemo(() => {
    const value = search.trim().toLowerCase()

    return purchases.filter((purchase) => {
      const matchesSearch =
        !value ||
        purchase.folio.toLowerCase().includes(value) ||
        purchase.supplier?.name.toLowerCase().includes(value)

      const matchesPayment =
        paymentFilter === "Todos" ||
        purchase.payment_method === paymentFilter

      const matchesStatus =
        statusFilter === "Todos" ||
        purchase.payment_status === statusFilter

      return matchesSearch && matchesPayment && matchesStatus
    })
  }, [
    purchases,
    search,
    paymentFilter,
    statusFilter,
  ])

  const summary = useMemo(() => {
    return filteredPurchases.reduce(
      (totals, purchase) => {
        totals.count += 1
        totals.merchandise += Number(
          purchase.merchandise_subtotal || 0,
        )

        totals.logistics +=
          Number(purchase.transport_cost || 0) +
          Number(purchase.parking_cost || 0) +
          Number(purchase.loader_cost || 0) +
          Number(purchase.other_costs || 0)

        totals.total += Number(purchase.total || 0)

        if (purchase.payment_status === "pending") {
          totals.pending += Number(purchase.total || 0)
        }

        return totals
      },
      {
        count: 0,
        merchandise: 0,
        logistics: 0,
        total: 0,
        pending: 0,
      },
    )
  }, [filteredPurchases])

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

    setSelectedItems(
      (data ?? []) as unknown as PurchaseItem[],
    )
    setDetailLoading(false)
  }

  return (
    <AppShell
      title="Compras"
      description="Historial de mercancía recibida y costos asociados."
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
          onClick={() => void loadPurchases()}
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
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f3eb] text-[#1f6a3a]">
            <ShoppingCart className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Compras registradas
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight">
            {summary.count}
          </p>
        </article>

        <article className="rounded-[20px] border border-[#dde2da] bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
            <PackageSearch className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Mercancía
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight">
            {money(summary.merchandise)}
          </p>
        </article>

        <article className="rounded-[20px] border border-[#dde2da] bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
            <Truck className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Costos logísticos
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight">
            {money(summary.logistics)}
          </p>
        </article>

        <article className="rounded-[20px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-700">
            <WalletCards className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-amber-700">
            Pendiente de pago
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight text-amber-950">
            {money(summary.pending)}
          </p>
        </article>
      </section>

      <section className="mt-6 overflow-hidden rounded-[24px] border border-[#dde2da] bg-white shadow-sm">
        <div className="border-b border-[#e6eae4] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Historial de compras
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {filteredPurchases.length} resultados
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
                  placeholder="Buscar folio o proveedor"
                  className="h-10 w-full rounded-xl border border-[#dce2d9] bg-[#f8f9f6] pl-9 pr-3 text-sm outline-none focus:border-[#1f6a3a] focus:bg-white"
                />
              </div>

              <select
                value={paymentFilter}
                onChange={(event) =>
                  setPaymentFilter(event.target.value)
                }
                className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none"
              >
                <option value="Todos">
                  Todos los métodos
                </option>
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">
                  Transferencia
                </option>
                <option value="credit">Crédito</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none"
              >
                <option value="Todos">
                  Todos los estados
                </option>
                <option value="paid">Pagado</option>
                <option value="pending">Pendiente</option>
                <option value="partial">Parcial</option>
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
            <table className="w-full min-w-[1150px] text-left">
              <thead className="bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Compra</th>
                  <th className="px-6 py-4">Proveedor</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Mercancía</th>
                  <th className="px-6 py-4">Logística</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Pago</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#edf0eb]">
                {filteredPurchases.map((purchase) => {
                  const PaymentIcon = paymentIcon(
                    purchase.payment_method,
                  )

                  const logistics =
                    Number(purchase.transport_cost || 0) +
                    Number(purchase.parking_cost || 0) +
                    Number(purchase.loader_cost || 0) +
                    Number(purchase.other_costs || 0)

                  return (
                    <tr
                      key={purchase.id}
                      className="transition hover:bg-[#fafbf8]"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium">
                          {purchase.folio}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {purchase.id.slice(0, 8)}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {purchase.supplier?.name ??
                          "Sin proveedor"}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(
                          purchase.purchase_date,
                        ).toLocaleString("es-MX")}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {money(
                          purchase.merchandise_subtotal,
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {money(logistics)}
                      </td>

                      <td className="px-6 py-4 font-semibold">
                        {money(purchase.total)}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#eef3ed] px-3 py-1.5 text-xs font-medium text-[#1f6a3a]">
                          <PaymentIcon className="h-3.5 w-3.5" />
                          {paymentLabel(
                            purchase.payment_method,
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            purchase.payment_status ===
                            "paid"
                              ? "bg-emerald-50 text-emerald-700"
                              : purchase.payment_status ===
                                  "pending"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-sky-50 text-sky-700"
                          }`}
                        >
                          {statusLabel(
                            purchase.payment_status,
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            void openPurchase(purchase)
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#dce2d9] bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-[#f5f7f3]"
                        >
                          <Eye className="h-4 w-4" />
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {filteredPurchases.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-20 text-center"
                    >
                      <ShoppingCart className="mx-auto h-8 w-8 text-slate-300" />

                      <p className="mt-4 text-sm font-medium text-slate-600">
                        No se encontraron compras
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#e6eae4] bg-[#fafbf8] px-5 py-3">
          <p className="text-xs text-slate-500">
            Costo total filtrado
          </p>

          <p className="text-sm font-semibold">
            {money(summary.total)}
          </p>
        </div>
      </section>

      {selectedPurchase && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[24px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e6eae4] bg-white px-6 py-5">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Detalle de compra
                </p>

                <h2 className="mt-1 text-xl font-semibold">
                  {selectedPurchase.folio}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedPurchase.supplier?.name ??
                    "Sin proveedor"}{" "}
                  ·{" "}
                  {new Date(
                    selectedPurchase.purchase_date,
                  ).toLocaleString("es-MX")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedPurchase(null)
                  setSelectedItems([])
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
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead className="bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      <tr>
                        <th className="px-6 py-4">
                          Producto
                        </th>
                        <th className="px-6 py-4">
                          Cantidad
                        </th>
                        <th className="px-6 py-4">
                          Costo unitario
                        </th>
                        <th className="px-6 py-4 text-right">
                          Subtotal
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#edf0eb]">
                      {selectedItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-6 py-4">
                            <p className="font-medium">
                              {item.product?.name ??
                                "Producto"}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {item.product?.sku ??
                                "Sin SKU"}
                            </p>
                          </td>

                          <td className="px-6 py-4 text-sm">
                            {Number(
                              item.quantity,
                            ).toLocaleString("es-MX", {
                              maximumFractionDigits: 3,
                            })}{" "}
                            {item.product?.unit ?? ""}
                          </td>

                          <td className="px-6 py-4 text-sm">
                            {money(item.unit_cost)}
                          </td>

                          <td className="px-6 py-4 text-right font-semibold">
                            {money(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-4 border-t border-[#e6eae4] bg-[#fafbf8] p-6 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs text-slate-500">
                      Transporte
                    </p>

                    <p className="mt-2 font-semibold">
                      {money(
                        selectedPurchase.transport_cost,
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs text-slate-500">
                      Estacionamiento
                    </p>

                    <p className="mt-2 font-semibold">
                      {money(
                        selectedPurchase.parking_cost,
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs text-slate-500">
                      Diablero
                    </p>

                    <p className="mt-2 font-semibold">
                      {money(
                        selectedPurchase.loader_cost,
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#102019] p-4 text-white">
                    <p className="text-xs text-white/60">
                      Total de compra
                    </p>

                    <p className="mt-2 text-xl font-semibold">
                      {money(selectedPurchase.total)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </AppShell>
  )
}

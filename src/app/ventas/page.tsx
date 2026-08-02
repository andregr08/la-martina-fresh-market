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
  CreditCard,
  Eye,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Smartphone,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import {
  TicketBranding,
  TicketFooter,
} from "@/components/tickets/ticket-branding"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBusinessSettings } from "@/hooks/use-business-settings"
import { createClient } from "@/lib/supabase/client"

type Sale = {
  id: string
  folio: string
  subtotal: number
  discount: number
  total: number
  payment_method: "cash" | "card" | "transfer"
  status: string
  payment_status: string
  sold_at: string
  ticket: {
    ticket_number: string
  } | null
}

type SaleItem = {
  id: string
  quantity: number
  unit_price: number
  subtotal: number
  product: {
    name: string
    unit: string
  } | null
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0))
}

function formatQuantity(value: number) {
  return Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

function paymentLabel(method: string) {
  if (method === "cash") return "Efectivo"
  if (method === "card") return "Tarjeta"
  if (method === "transfer") return "Transferencia"

  return method
}

function statusLabel(status: string) {
  if (status === "completed") return "Completada"
  if (status === "refunded") return "Devuelta"
  if (status === "cancelled") return "Cancelada"
  if (status === "draft") return "Borrador"

  return status
}

function PaymentIcon({
  method,
}: {
  method: string
}) {
  if (method === "cash") {
    return <Banknote className="h-3.5 w-3.5" />
  }

  if (method === "card") {
    return <CreditCard className="h-3.5 w-3.5" />
  }

  return <Smartphone className="h-3.5 w-3.5" />
}

export default function VentasPage() {
  const supabase = useMemo(() => createClient(), [])
  const { settings } = useBusinessSettings()

  const [sales, setSales] = useState<Sale[]>([])
  const [selectedSale, setSelectedSale] =
    useState<Sale | null>(null)
  const [selectedItems, setSelectedItems] =
    useState<SaleItem[]>([])
  const [refundSale, setRefundSale] =
    useState<Sale | null>(null)

  const [search, setSearch] = useState("")
  const [paymentFilter, setPaymentFilter] =
    useState("Todos")
  const [statusFilter, setStatusFilter] =
    useState("Todos")

  const [refundReason, setRefundReason] = useState("")
  const [refundNotes, setRefundNotes] = useState("")

  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] =
    useState(false)
  const [refunding, setRefunding] = useState(false)

  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadSales = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: salesError } = await supabase
      .from("sales")
      .select(`
        id,
        folio,
        subtotal,
        discount,
        total,
        payment_method,
        status,
        payment_status,
        sold_at,
        ticket:tickets (
          ticket_number
        )
      `)
      .order("sold_at", {
        ascending: false,
      })
      .limit(500)

    if (salesError) {
      setError(salesError.message)
      setLoading(false)
      return
    }

    setSales((data ?? []) as unknown as Sale[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSales()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadSales])

  const filteredSales = useMemo(() => {
    const value = search.trim().toLowerCase()

    return sales.filter((sale) => {
      const matchesSearch =
        !value ||
        sale.folio.toLowerCase().includes(value) ||
        sale.ticket?.ticket_number
          .toLowerCase()
          .includes(value)

      const matchesPayment =
        paymentFilter === "Todos" ||
        sale.payment_method === paymentFilter

      const matchesStatus =
        statusFilter === "Todos" ||
        sale.status === statusFilter

      return (
        matchesSearch &&
        matchesPayment &&
        matchesStatus
      )
    })
  }, [
    sales,
    search,
    paymentFilter,
    statusFilter,
  ])

  const summary = useMemo(() => {
    return filteredSales.reduce(
      (totals, sale) => {
        if (sale.status === "completed") {
          totals.count += 1
          totals.sales += Number(sale.total || 0)
          totals.discounts += Number(
            sale.discount || 0,
          )

          if (sale.payment_method === "cash") {
            totals.cash += Number(sale.total || 0)
          }

          if (sale.payment_method === "card") {
            totals.card += Number(sale.total || 0)
          }

          if (sale.payment_method === "transfer") {
            totals.transfer += Number(
              sale.total || 0,
            )
          }
        }

        if (sale.status === "refunded") {
          totals.refundCount += 1
          totals.refunds += Number(sale.total || 0)
        }

        return totals
      },
      {
        count: 0,
        sales: 0,
        discounts: 0,
        cash: 0,
        card: 0,
        transfer: 0,
        refunds: 0,
        refundCount: 0,
      },
    )
  }, [filteredSales])

  const averageTicket =
    summary.count > 0
      ? summary.sales / summary.count
      : 0

  async function openSale(sale: Sale) {
    setSelectedSale(sale)
    setSelectedItems([])
    setDetailLoading(true)
    setError("")

    const { data, error: itemsError } = await supabase
      .from("sale_items")
      .select(`
        id,
        quantity,
        unit_price,
        subtotal,
        product:products (
          name,
          unit
        )
      `)
      .eq("sale_id", sale.id)
      .order("created_at")

    if (itemsError) {
      setError(itemsError.message)
      setDetailLoading(false)
      return
    }

    setSelectedItems(
      (data ?? []) as unknown as SaleItem[],
    )
    setDetailLoading(false)
  }

  function closeTicket() {
    setSelectedSale(null)
    setSelectedItems([])
  }

  function openRefund(sale: Sale) {
    setRefundSale(sale)
    setRefundReason("")
    setRefundNotes("")
    setError("")
    setMessage("")
  }

  function closeRefund() {
    if (refunding) return

    setRefundSale(null)
    setRefundReason("")
    setRefundNotes("")
  }

  async function submitRefund() {
    if (!refundSale) return

    setError("")
    setMessage("")

    if (!refundReason.trim()) {
      setError(
        "Debes indicar el motivo de la devolución.",
      )
      return
    }

    const confirmed = window.confirm(
      `Se devolverá la venta ${
        refundSale.folio
      } por ${money(
        refundSale.total,
      )}. ¿Deseas continuar?`,
    )

    if (!confirmed) return

    setRefunding(true)

    const { data, error: refundError } =
      await supabase.rpc("refund_sale", {
        p_sale_id: refundSale.id,
        p_reason: refundReason.trim(),
        p_notes: refundNotes.trim() || null,
      })

    if (refundError) {
      setError(refundError.message)
      setRefunding(false)
      return
    }

    const result = data as {
      folio?: string
      amount?: number
    }

    setMessage(
      `La venta ${
        result.folio ?? refundSale.folio
      } fue devuelta por ${money(
        Number(
          result.amount ?? refundSale.total,
        ),
      )}.`,
    )

    setRefundSale(null)
    setRefundReason("")
    setRefundNotes("")

    await loadSales()
    setRefunding(false)
  }

  return (
    <AppShell
      title="Ventas"
      description="Historial, tickets, pagos y devoluciones."
    >
      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 print:hidden">
          <CheckCircle2 className="h-5 w-5" />
          {message}
        </div>
      )}

      <div className="mb-6 flex justify-end print:hidden">
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadSales()}
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f3eb] text-[#1f6a3a]">
            <TrendingUp className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Total vendido
          </p>

          <p className="mt-1 text-[24px] font-semibold tracking-tight">
            {money(summary.sales)}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {summary.count} ventas completadas
          </p>
        </article>

        <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
            <ReceiptText className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Ticket promedio
          </p>

          <p className="mt-1 text-[24px] font-semibold tracking-tight">
            {money(averageTicket)}
          </p>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-700">
            <WalletCards className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-amber-700">
            Descuentos aplicados
          </p>

          <p className="mt-1 text-[24px] font-semibold tracking-tight text-amber-950">
            {money(summary.discounts)}
          </p>
        </article>

        <article className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-red-700">
            <RotateCcw className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-red-700">
            Devoluciones
          </p>

          <p className="mt-1 text-[24px] font-semibold tracking-tight text-red-950">
            {money(summary.refunds)}
          </p>

          <p className="mt-1 text-xs text-red-700">
            {summary.refundCount} operaciones
          </p>
        </article>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#dde2da] bg-white shadow-sm print:hidden">
        <div className="border-b border-[#e6eae4] p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-[#1f6a3a]" />

                <h2 className="text-lg font-semibold">
                  Historial de ventas
                </h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {filteredSales.length} resultados
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
                  placeholder="Buscar folio o ticket"
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
                  Todos los pagos
                </option>
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">
                  Transferencia
                </option>
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
                <option value="completed">
                  Completadas
                </option>
                <option value="refunded">
                  Devueltas
                </option>
                <option value="cancelled">
                  Canceladas
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
            <table className="w-full min-w-[1180px] text-left">
              <thead className="sticky top-0 z-10 bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Venta</th>
                  <th className="px-5 py-3.5">Fecha</th>
                  <th className="px-5 py-3.5">Ticket</th>
                  <th className="px-5 py-3.5">Método</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5">Subtotal</th>
                  <th className="px-5 py-3.5">Descuento</th>
                  <th className="px-5 py-3.5">Total</th>
                  <th className="px-5 py-3.5">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#edf0eb]">
                {filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="transition-colors hover:bg-[#f7f9f5]"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium">
                        {sale.folio}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {sale.id.slice(0, 8)}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(
                        sale.sold_at,
                      ).toLocaleString("es-MX")}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      {sale.ticket?.ticket_number ??
                        "Sin ticket"}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#eef3ed] px-3 py-1.5 text-xs font-medium text-[#1f6a3a]">
                        <PaymentIcon
                          method={sale.payment_method}
                        />
                        {paymentLabel(
                          sale.payment_method,
                        )}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          sale.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : sale.status === "refunded"
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {statusLabel(sale.status)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm">
                      {money(sale.subtotal)}
                    </td>

                    <td className="px-6 py-4 text-sm text-amber-700">
                      {money(sale.discount)}
                    </td>

                    <td className="px-6 py-4 font-semibold">
                      {money(sale.total)}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void openSale(sale)
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#dce2d9] bg-white px-3 text-xs font-medium text-slate-700 hover:bg-[#f5f7f3]"
                        >
                          <Eye className="h-4 w-4" />
                          Ticket
                        </button>

                        {sale.status === "completed" && (
                          <button
                            type="button"
                            onClick={() =>
                              openRefund(sale)
                            }
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Devolver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredSales.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-14 text-center"
                    >
                      <ReceiptText className="mx-auto h-8 w-8 text-slate-300" />

                      <p className="mt-4 text-sm font-medium text-slate-600">
                        No se encontraron ventas
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-3 border-t border-[#e6eae4] bg-[#fafbf8] px-5 py-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">
              Efectivo
            </p>
            <p className="mt-1 font-semibold">
              {money(summary.cash)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">
              Tarjeta
            </p>
            <p className="mt-1 font-semibold">
              {money(summary.card)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">
              Transferencia
            </p>
            <p className="mt-1 font-semibold">
              {money(summary.transfer)}
            </p>
          </div>
        </div>
      </section>

      {selectedSale && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm print:static print:block print:bg-white print:p-0">
          <section className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 text-black shadow-2xl print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:p-0">
            <div className="mb-4 flex justify-end print:hidden">
              <button
                type="button"
                onClick={closeTicket}
                className="rounded-xl border border-[#dce2d9] p-2 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <TicketBranding settings={settings} />

            <div className="my-5 border-y border-dashed border-black py-3 text-sm">
              <p>
                Ticket:{" "}
                {selectedSale.ticket?.ticket_number ??
                  "Sin ticket"}
              </p>

              <p>Venta: {selectedSale.folio}</p>

              <p>
                Estado:{" "}
                {statusLabel(selectedSale.status)}
              </p>

              <p>
                Fecha:{" "}
                {new Date(
                  selectedSale.sold_at,
                ).toLocaleString("es-MX")}
              </p>
            </div>

            {detailLoading ? (
              <div className="flex min-h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {selectedItems.map((item) => (
                  <div key={item.id}>
                    <p className="font-medium">
                      {item.product?.name ?? "Producto"}
                    </p>

                    <div className="flex justify-between gap-4">
                      <span>
                        {formatQuantity(item.quantity)}{" "}
                        {item.product?.unit ?? ""} ×{" "}
                        {money(item.unit_price)}
                      </span>

                      <span>
                        {money(item.subtotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="my-5 space-y-2 border-y border-dashed border-black py-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>
                  {money(selectedSale.subtotal)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Descuento</span>
                <span>
                  -{money(selectedSale.discount)}
                </span>
              </div>

              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>
                  {money(selectedSale.total)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Método</span>
                <span>
                  {paymentLabel(
                    selectedSale.payment_method,
                  )}
                </span>
              </div>
            </div>

            <TicketFooter settings={settings} />

            <button
              type="button"
              onClick={() => window.print()}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#102019] text-sm font-semibold text-white print:hidden"
            >
              <Printer className="h-4 w-4" />
              Reimprimir ticket
            </button>
          </section>
        </div>
      )}

      {refundSale && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Devolución completa
                </p>

                <h2 className="mt-1 text-xl font-semibold">
                  {refundSale.folio}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Total a devolver:{" "}
                  {money(refundSale.total)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeRefund}
                disabled={refunding}
                className="rounded-xl border border-[#dce2d9] p-2 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              Se restaurará todo el inventario vendido y se
              registrará el reembolso en la caja abierta.
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Motivo
                </p>

                <Input
                  value={refundReason}
                  onChange={(event) =>
                    setRefundReason(
                      event.target.value,
                    )
                  }
                  placeholder="Ej. Error en el cobro"
                  className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Observaciones
                </p>

                <Input
                  value={refundNotes}
                  onChange={(event) =>
                    setRefundNotes(
                      event.target.value,
                    )
                  }
                  placeholder="Opcional"
                  className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
                />
              </div>

              <button
                type="button"
                onClick={() => void submitRefund()}
                disabled={refunding}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-700 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
              >
                {refunding ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RotateCcw className="h-5 w-5" />
                )}

                Confirmar devolución
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  )
}

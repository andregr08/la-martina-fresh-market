"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Banknote,
  CreditCard,
  Eye,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Smartphone,
  X,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TicketBranding, TicketFooter } from "@/components/tickets/ticket-branding"
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

function saleStatusLabel(status: string) {
  if (status === "completed") return "Completada"
  if (status === "refunded") return "Devuelta"
  if (status === "cancelled") return "Cancelada"
  if (status === "draft") return "Borrador"
  return status
}

export default function VentasPage() {
  const supabase = createClient()
  const { settings } = useBusinessSettings()

  const [sales, setSales] = useState<Sale[]>([])
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([])
  const [refundSale, setRefundSale] = useState<Sale | null>(null)

  const [search, setSearch] = useState("")
  const [paymentFilter, setPaymentFilter] = useState("Todos")
  const [statusFilter, setStatusFilter] = useState("Todos")

  const [refundReason, setRefundReason] = useState("")
  const [refundNotes, setRefundNotes] = useState("")

  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
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
    void loadSales()
  }, [loadSales])

  const filteredSales = useMemo(() => {
    const value = search.trim().toLowerCase()

    return sales.filter((sale) => {
      const matchesSearch =
        !value ||
        sale.folio.toLowerCase().includes(value) ||
        sale.ticket?.ticket_number.toLowerCase().includes(value)

      const matchesPayment =
        paymentFilter === "Todos" ||
        sale.payment_method === paymentFilter

      const matchesStatus =
        statusFilter === "Todos" ||
        sale.status === statusFilter

      return matchesSearch && matchesPayment && matchesStatus
    })
  }, [sales, search, paymentFilter, statusFilter])

  const summary = useMemo(() => {
    return filteredSales.reduce(
      (totals, sale) => {
        if (sale.status === "completed") {
          totals.total += Number(sale.total || 0)
          totals.count += 1

          if (sale.payment_method === "cash") {
            totals.cash += Number(sale.total || 0)
          }

          if (sale.payment_method === "card") {
            totals.card += Number(sale.total || 0)
          }

          if (sale.payment_method === "transfer") {
            totals.transfer += Number(sale.total || 0)
          }
        }

        if (sale.status === "refunded") {
          totals.refunded += Number(sale.total || 0)
          totals.refundedCount += 1
        }

        return totals
      },
      {
        total: 0,
        count: 0,
        cash: 0,
        card: 0,
        transfer: 0,
        refunded: 0,
        refundedCount: 0,
      },
    )
  }, [filteredSales])

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

    setSelectedItems((data ?? []) as unknown as SaleItem[])
    setDetailLoading(false)
  }

  function closeDetail() {
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
      setError("Debes indicar el motivo de la devolución.")
      return
    }

    const confirmed = window.confirm(
      `Se devolverá completamente la venta ${refundSale.folio} por ${money(
        refundSale.total,
      )}. El inventario será restaurado. ¿Deseas continuar?`,
    )

    if (!confirmed) return

    setRefunding(true)

    const { data, error: refundError } = await supabase.rpc(
      "refund_sale",
      {
        p_sale_id: refundSale.id,
        p_reason: refundReason.trim(),
        p_notes: refundNotes.trim() || null,
      },
    )

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
      `La venta ${result.folio ?? refundSale.folio} fue devuelta por ${money(
        Number(result.amount ?? refundSale.total),
      )}.`,
    )

    setRefundSale(null)
    setRefundReason("")
    setRefundNotes("")
    await loadSales()
    setRefunding(false)
  }

  function printTicket() {
    window.print()
  }

  return (
    <AppShell
      title="Ventas"
      description="Historial, tickets y devoluciones del local."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 print:hidden">
          {message}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Ventas completadas
          </p>

          <p className="mt-3 text-2xl font-semibold">
            {summary.count}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Total vendido
          </p>

          <p className="mt-3 text-2xl font-semibold">
            {money(summary.total)}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Ventas en efectivo
          </p>

          <p className="mt-3 text-2xl font-semibold">
            {money(summary.cash)}
          </p>
        </article>

        <article className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">
            Ventas devueltas
          </p>

          <p className="mt-3 text-2xl font-semibold text-red-900">
            {summary.refundedCount}
          </p>

          <p className="mt-2 text-sm text-red-700">
            {money(summary.refunded)}
          </p>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white print:hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5" />

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

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar folio o ticket"
                className="pl-9"
              />
            </div>

            <select
              value={paymentFilter}
              onChange={(event) =>
                setPaymentFilter(event.target.value)
              }
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="Todos">Todos los pagos</option>
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="Todos">Todos los estados</option>
              <option value="completed">Completadas</option>
              <option value="refunded">Devueltas</option>
              <option value="cancelled">Canceladas</option>
            </select>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadSales()}
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
                  <th className="px-5 py-4 font-medium">Venta</th>
                  <th className="px-5 py-4 font-medium">Fecha</th>
                  <th className="px-5 py-4 font-medium">Ticket</th>
                  <th className="px-5 py-4 font-medium">Pago</th>
                  <th className="px-5 py-4 font-medium">Estado</th>
                  <th className="px-5 py-4 font-medium">Subtotal</th>
                  <th className="px-5 py-4 font-medium">Descuento</th>
                  <th className="px-5 py-4 font-medium">Total</th>
                  <th className="px-5 py-4 font-medium">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium">
                      {sale.folio}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {new Date(sale.sold_at).toLocaleString("es-MX")}
                    </td>

                    <td className="px-5 py-4 text-sm">
                      {sale.ticket?.ticket_number ?? "Sin ticket"}
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs">
                        {sale.payment_method === "cash" && (
                          <Banknote className="h-3.5 w-3.5" />
                        )}

                        {sale.payment_method === "card" && (
                          <CreditCard className="h-3.5 w-3.5" />
                        )}

                        {sale.payment_method === "transfer" && (
                          <Smartphone className="h-3.5 w-3.5" />
                        )}

                        {paymentLabel(sale.payment_method)}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          sale.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : sale.status === "refunded"
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {saleStatusLabel(sale.status)}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {money(sale.subtotal)}
                    </td>

                    <td className="px-5 py-4">
                      {money(sale.discount)}
                    </td>

                    <td className="px-5 py-4 font-semibold">
                      {money(sale.total)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void openSale(sale)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ticket
                        </Button>

                        {sale.status === "completed" && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openRefund(sale)}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Devolver
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredSales.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-14 text-center text-sm text-slate-500"
                    >
                      Todavía no existen ventas con esos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:static print:block print:bg-white print:p-0">
          <section className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 text-black print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:p-0">
            <div className="flex justify-end print:hidden">
              <Button
                type="button"
                variant="outline"
                onClick={closeDetail}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <TicketBranding settings={settings} />

            <div className="my-5 border-y border-dashed border-black py-3 text-sm">
              <p>
                Ticket:{" "}
                {selectedSale.ticket?.ticket_number ?? "Sin ticket"}
              </p>

              <p>Venta: {selectedSale.folio}</p>

              <p>
                Estado: {saleStatusLabel(selectedSale.status)}
              </p>

              <p>
                Fecha:{" "}
                {new Date(selectedSale.sold_at).toLocaleString(
                  "es-MX",
                )}
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

                      <span>{money(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="my-5 space-y-2 border-y border-dashed border-black py-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(selectedSale.subtotal)}</span>
              </div>

              <div className="flex justify-between">
                <span>Descuento</span>
                <span>-{money(selectedSale.discount)}</span>
              </div>

              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{money(selectedSale.total)}</span>
              </div>

              <div className="flex justify-between">
                <span>Método</span>
                <span>
                  {paymentLabel(selectedSale.payment_method)}
                </span>
              </div>
            </div>

            <TicketFooter settings={settings} />

            <Button
              type="button"
              className="mt-5 w-full print:hidden"
              onClick={printTicket}
            >
              <Printer className="mr-2 h-4 w-4" />
              Reimprimir ticket
            </Button>
          </section>
        </div>
      )}

      {refundSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <section className="w-full max-w-lg rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  Devolver venta
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {refundSale.folio} · {money(refundSale.total)}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={closeRefund}
                disabled={refunding}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-6 space-y-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                La devolución será completa. Se restaurará todo el
                inventario vendido y se registrará el reembolso en la
                caja actualmente abierta.
              </div>

              <div className="space-y-2">
                <Label htmlFor="refundReason">
                  Motivo de la devolución
                </Label>

                <Input
                  id="refundReason"
                  value={refundReason}
                  onChange={(event) =>
                    setRefundReason(event.target.value)
                  }
                  placeholder="Ej. Error en el cobro"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refundNotes">
                  Observaciones
                </Label>

                <Input
                  id="refundNotes"
                  value={refundNotes}
                  onChange={(event) =>
                    setRefundNotes(event.target.value)
                  }
                  placeholder="Opcional"
                />
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={submitRefund}
                disabled={refunding}
              >
                {refunding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Confirmar devolución completa
              </Button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  )
}


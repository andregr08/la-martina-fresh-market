"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  Banknote,
  Clock3,
  CreditCard,
  Landmark,
  Loader2,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Utensils,
  X,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"
import WaiterRequests from "@/components/orders/waiter-requests"

type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "delivered"
  | "paid"
  | "cancelled"

type FruitSelection = {
  product_id: string
  name?: string
  grams?: number
}

type OrderItem = {
  id: string
  order_id: string
  product_id: string | null
  variant_id: string | null
  product_name: string
  variant_name: string | null
  quantity: number
  unit_price: number
  line_total: number
  fruit_selections: FruitSelection[]
}

type RestaurantOrder = {
  id: string
  order_number: number
  order_type: "table" | "takeaway"
  table_number: string | null
  notes: string | null
  status: OrderStatus
  subtotal: number
  total: number
  payment_method: string | null
  paid_at: string | null
  sale_id: string | null
  created_at: string
  updated_at: string
  items: OrderItem[]
}

type OrderGroup = {
  key: string
  label: string
  orderType: "table" | "takeaway"
  orders: RestaurantOrder[]
  total: number
  createdAt: string
}

type SaleResult = {
  success: boolean
  sale_id: string
  folio: string
  total: number
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

function time(value: string) {
  return new Date(value).toLocaleTimeString(
    "es-MX",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  )
}

function statusLabel(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "Pendiente"
    case "preparing":
      return "Preparando"
    case "ready":
      return "Listo"
    case "delivered":
      return "Entregado"
    case "paid":
      return "Pagado"
    case "cancelled":
      return "Cancelado"
    default:
      return status
  }
}

function statusClasses(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "preparing":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "ready":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "delivered":
      return "bg-slate-50 text-slate-700 border-slate-200"
    case "paid":
      return "bg-green-50 text-green-700 border-green-200"
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200"
    default:
      return "bg-slate-50 text-slate-600 border-slate-200"
  }
}

export default function PedidosPage() {
  const supabase = useMemo(() => createClient(), [])

  const [orders, setOrders] =
    useState<RestaurantOrder[]>([])

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState("")

  const [checkoutKey, setCheckoutKey] =
    useState<string | null>(null)

  const [paymentMethod, setPaymentMethod] =
    useState<"cash" | "card" | "transfer">(
      "cash",
    )

  const [cashReceived, setCashReceived] =
    useState("")

  const [charging, setCharging] =
    useState(false)

  const loadOrders = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setError("")

      const {
        data,
        error: ordersError,
      } = await supabase.rpc(
        "get_restaurant_active_orders",
      )

      if (ordersError) {
        setError(ordersError.message)
        setLoading(false)
        setRefreshing(false)
        return
      }

      const rawOrders =
        Array.isArray(data)
          ? (data as RestaurantOrder[])
          : []

      const normalized =
        rawOrders.map((order) => ({
          ...order,
          subtotal:
            Number(order.subtotal || 0),
          total:
            Number(order.total || 0),
          items:
            Array.isArray(order.items)
              ? order.items.map((item) => ({
                  ...item,
                  quantity:
                    Number(
                      item.quantity || 0,
                    ),
                  unit_price:
                    Number(
                      item.unit_price || 0,
                    ),
                  line_total:
                    Number(
                      item.line_total || 0,
                    ),
                  fruit_selections:
                    Array.isArray(
                      item.fruit_selections,
                    )
                      ? item.fruit_selections
                      : [],
                }))
              : [],
        }))

      setOrders(normalized)
      setLoading(false)
      setRefreshing(false)
    },
    [supabase],
  )

  useEffect(() => {
    void loadOrders()

    const interval =
      window.setInterval(() => {
        void loadOrders(true)
      }, 10000)

    return () =>
      window.clearInterval(interval)
  }, [loadOrders])

  const groups = useMemo(() => {
    const map =
      new Map<string, OrderGroup>()

    for (const order of orders) {
      const key =
        order.order_type === "table"
          ? `table:${order.table_number}`
          : `takeaway:${order.id}`

      const label =
        order.order_type === "table"
          ? `Mesa ${order.table_number}`
          : `Para llevar #${order.order_number}`

      const existing =
        map.get(key)

      if (existing) {
        existing.orders.push(order)
        existing.total +=
          Number(order.total || 0)
      } else {
        map.set(key, {
          key,
          label,
          orderType:
            order.order_type,
          orders: [order],
          total:
            Number(order.total || 0),
          createdAt:
            order.created_at,
        })
      }
    }

    return Array.from(
      map.values(),
    ).sort(
      (a, b) =>
        new Date(
          a.createdAt,
        ).getTime() -
        new Date(
          b.createdAt,
        ).getTime(),
    )
  }, [orders])

  const checkoutGroup =
    groups.find(
      (group) =>
        group.key === checkoutKey,
    ) ?? null

  const cashAmount =
    Number(cashReceived) || 0

  const change =
    checkoutGroup &&
    paymentMethod === "cash"
      ? Math.max(
          0,
          cashAmount -
            checkoutGroup.total,
        )
      : 0

  async function updateStatus(
    orderId: string,
    status: OrderStatus,
  ) {
    setError("")

    const { error: updateError } =
      await supabase.rpc(
        "update_restaurant_order_status",
        {
          p_order_id: orderId,
          p_status: status,
        },
      )

    if (updateError) {
      setError(
        updateError.message,
      )
      return
    }

    await loadOrders(true)
  }

  function openCheckout(
    group: OrderGroup,
  ) {
    setCheckoutKey(group.key)
    setPaymentMethod("cash")
    setCashReceived("")
    setError("")
  }

  async function chargeGroup() {
    if (
      !checkoutGroup ||
      charging
    ) {
      return
    }

    if (
      paymentMethod === "cash" &&
      cashAmount <
        checkoutGroup.total
    ) {
      setError(
        "El efectivo recibido es menor al total.",
      )
      return
    }

    const allItems =
      checkoutGroup.orders.flatMap(
        (order) => order.items,
      )

    if (allItems.length === 0) {
      setError(
        "Este pedido no tiene productos.",
      )
      return
    }

    setCharging(true)
    setError("")

    const {
      data,
      error: saleError,
    } = await supabase.rpc(
      "register_restaurant_sale",
      {
        p_items: allItems.map(
          (item) => ({
            variant_id:
              item.variant_id,
            quantity:
              item.quantity,
            fruit_selections:
              (
                item.fruit_selections ??
                []
              ).map(
                (fruit) =>
                  fruit.product_id,
              ),
          }),
        ),
        p_payment_method:
          paymentMethod,
        p_discount: 0,
        p_notes:
          checkoutGroup.orderType ===
          "table"
            ? `${checkoutGroup.label} · Pedidos ${checkoutGroup.orders
                .map(
                  (order) =>
                    `#${order.order_number}`,
                )
                .join(", ")}`
            : `Pedido ${checkoutGroup.label}`,
      },
    )

    if (saleError) {
      setError(saleError.message)
      setCharging(false)
      return
    }

    const sale =
      data as SaleResult

    const orderIds =
      checkoutGroup.orders.map(
        (order) => order.id,
      )

    const {
      error: orderUpdateError,
    } = await supabase.rpc(
      "close_restaurant_orders",
      {
        p_order_ids: orderIds,
        p_payment_method:
          paymentMethod,
        p_sale_id:
          sale.sale_id,
      },
    )

    if (orderUpdateError) {
      setError(
        `La venta se registró, pero no se pudieron cerrar los pedidos: ${orderUpdateError.message}`,
      )
      setCharging(false)
      return
    }

    setCheckoutKey(null)
    setCashReceived("")
    setPaymentMethod("cash")
    setCharging(false)

    await loadOrders(true)
  }

  return (
    <AppShell
      title="Pedidos"
      description="Pedidos del restaurante, mesas y cobros"
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-[24px] border border-[#dfe4dc] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef3ed] text-[#1f6a3a]">
                <ReceiptText className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold text-[#172018]">
                  Pedidos activos
                </h2>

                <p className="text-sm text-slate-500">
                  {groups.length} mesas o pedidos abiertos
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadOrders(true)
            }
            disabled={refreshing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#dce2d9] bg-white px-4 text-sm font-semibold text-slate-600"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing
                  ? "animate-spin"
                  : ""
              }`}
            />
            Actualizar
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-[24px] border border-[#dfe4dc] bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-[#1f6a3a]" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-[24px] border border-[#dfe4dc] bg-white px-6 text-center shadow-sm">
            <PackageCheck className="mb-4 h-10 w-10 text-slate-300" />

            <h2 className="font-semibold text-[#172018]">
              No hay pedidos pendientes
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Los pedidos nuevos del restaurante aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {groups.map(
              (group) => (
                <section
                  key={group.key}
                  className="overflow-hidden rounded-[24px] border border-[#dfe4dc] bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4 border-b border-[#e4e8e1] p-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <Utensils className="h-5 w-5 text-[#1f6a3a]" />

                        <h2 className="text-xl font-semibold text-[#172018]">
                          {group.label}
                        </h2>
                      </div>

                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        Primer pedido {time(group.createdAt)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Pendiente
                      </p>

                      <p className="text-xl font-bold text-[#172018]">
                        {money(group.total)}
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-[#edf0eb]">
                    {group.orders.map(
                      (order) => (
                        <div
                          key={order.id}
                          className="p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[#172018]">
                                Pedido #{order.order_number}
                              </p>

                              <p className="text-xs text-slate-500">
                                {time(order.created_at)}
                              </p>
                            </div>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                                order.status,
                              )}`}
                            >
                              {statusLabel(
                                order.status,
                              )}
                            </span>
                          </div>

                          <div className="mt-4 space-y-3">
                            {order.items.map(
                              (item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start justify-between gap-4"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-[#172018]">
                                      {item.quantity} × {item.product_name}
                                    </p>

                                    {item.variant_name && (
                                      <p className="text-xs text-slate-500">
                                        {item.variant_name}
                                      </p>
                                    )}

                                    {item.fruit_selections.length > 0 && (
                                      <p className="mt-1 text-xs text-[#1f6a3a]">
                                        {item.fruit_selections
                                          .map(
                                            (fruit) =>
                                              fruit.name ||
                                              fruit.product_id,
                                          )
                                          .join(" · ")}
                                      </p>
                                    )}
                                  </div>

                                  <span className="text-sm font-semibold">
                                    {money(
                                      item.line_total,
                                    )}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>

                          {order.notes && (
                            <div className="mt-4 rounded-xl bg-[#f6f8f4] px-3 py-2 text-sm text-slate-600">
                              Nota: {order.notes}
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            {order.status === "pending" && (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateStatus(
                                    order.id,
                                    "preparing",
                                  )
                                }
                                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
                              >
                                Preparando
                              </button>
                            )}

                            {(order.status === "pending" ||
                              order.status === "preparing") && (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateStatus(
                                    order.id,
                                    "ready",
                                  )
                                }
                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                              >
                                Listo
                              </button>
                            )}


                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  <div className="border-t border-[#e4e8e1] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="font-semibold text-[#172018]">
                        Total a cobrar
                      </span>

                      <span className="text-2xl font-bold text-[#172018]">
                        {money(group.total)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openCheckout(group)
                      }
                      className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#102019] px-4 py-3 text-sm font-semibold text-white"
                    >
                      <Banknote className="h-5 w-5" />
                      Cobrar {group.label}
                    </button>
                  </div>
                </section>
              ),
            )}
          </div>
        )}
      </div>

      {checkoutGroup && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1f6a3a]">
                  Cobro
                </p>

                <h2 className="mt-1 text-2xl font-semibold text-[#172018]">
                  {checkoutGroup.label}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {checkoutGroup.orders.length} pedido(s)
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCheckoutKey(null)
                }
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#f6f8f4] p-4">
              <span className="font-semibold">
                Total
              </span>

              <span className="text-2xl font-bold">
                {money(
                  checkoutGroup.total,
                )}
              </span>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Método de pago
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  setPaymentMethod("cash")
                }
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold ${
                  paymentMethod === "cash"
                    ? "border-[#102019] bg-[#102019] text-white"
                    : "border-[#dce2d9] text-slate-600"
                }`}
              >
                <Banknote className="h-5 w-5" />
                Efectivo
              </button>

              <button
                type="button"
                onClick={() =>
                  setPaymentMethod("card")
                }
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold ${
                  paymentMethod === "card"
                    ? "border-[#102019] bg-[#102019] text-white"
                    : "border-[#dce2d9] text-slate-600"
                }`}
              >
                <CreditCard className="h-5 w-5" />
                Tarjeta
              </button>

              <button
                type="button"
                onClick={() =>
                  setPaymentMethod(
                    "transfer",
                  )
                }
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold ${
                  paymentMethod === "transfer"
                    ? "border-[#102019] bg-[#102019] text-white"
                    : "border-[#dce2d9] text-slate-600"
                }`}
              >
                <Landmark className="h-5 w-5" />
                Transfer.
              </button>
            </div>

            {paymentMethod === "cash" && (
              <div className="mt-5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Efectivo recibido
                </label>

                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    $
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(event) =>
                      setCashReceived(
                        event.target.value,
                      )
                    }
                    className="h-12 w-full rounded-xl border border-[#dce2d9] pl-7 pr-3 outline-none focus:border-[#1f6a3a]"
                  />
                </div>

                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-slate-500">
                    Cambio
                  </span>

                  <span className="font-semibold text-[#1f6a3a]">
                    {money(change)}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={charging}
              onClick={() =>
                void chargeGroup()
              }
              className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#102019] font-semibold text-white disabled:opacity-40"
            >
              {charging ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Cobrando...
                </>
              ) : (
                <>
                  <Banknote className="h-5 w-5" />
                  Confirmar pago
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  )
}


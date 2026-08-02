"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  CreditCard,
  Loader2,
  PackageOpen,
  ReceiptText,
  RefreshCw,
  Smartphone,
  TrendingUp,
  WalletCards,
} from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Period = "today" | "week" | "month"

type Sale = {
  id: string
  folio: string
  total: number
  discount: number
  payment_method: string
  sold_at: string
  status: string
}

type SaleItem = {
  quantity: number
  subtotal: number
  profit: number
  product: {
    id: string
    name: string
    unit: string
  } | null
}

type Expense = {
  amount: number
  expense_date: string
}

type Waste = {
  total_loss: number
  recorded_at: string
}

type Product = {
  id: string
  name: string
  unit: string
  current_stock: number
  minimum_stock: number
  purchase_price: number
}

type TopProduct = {
  id: string
  name: string
  unit: string
  quantity: number
  amount: number
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function preciseMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0))
}

function quantity(value: number, unit: string) {
  return `${Number(value || 0).toLocaleString("es-MX", {
    maximumFractionDigits: 3,
  })} ${unit}`
}

function getStartDate(period: Period, previous = false) {
  const now = new Date()
  const start = new Date(now)

  if (period === "today") {
    start.setHours(0, 0, 0, 0)

    if (previous) {
      start.setDate(start.getDate() - 1)
    }
  }

  if (period === "week") {
    start.setDate(now.getDate() - (previous ? 13 : 6))
    start.setHours(0, 0, 0, 0)
  }

  if (period === "month") {
    if (previous) {
      start.setMonth(now.getMonth() - 1, 1)
    } else {
      start.setDate(1)
    }

    start.setHours(0, 0, 0, 0)
  }

  return start
}

function getPreviousEndDate(period: Period) {
  const now = new Date()
  const end = new Date(now)

  if (period === "today") {
    end.setDate(now.getDate() - 1)
    end.setHours(23, 59, 59, 999)
  }

  if (period === "week") {
    end.setDate(now.getDate() - 7)
    end.setHours(23, 59, 59, 999)
  }

  if (period === "month") {
    end.setDate(0)
    end.setHours(23, 59, 59, 999)
  }

  return end
}

function chartLabel(dateValue: string, period: Period) {
  const date = new Date(dateValue)

  if (period === "today") {
    return date.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  })
}

function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }

  return ((current - previous) / previous) * 100
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  change,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  change?: number
}) {
  const positive = Number(change ?? 0) >= 0

  return (
    <article className="rounded-[20px] border border-[#dde2da] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,18,0.04),0_8px_24px_rgba(16,24,18,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f3eb] text-[#1f6a3a]">
          <Icon className="h-5 w-5" />
        </div>

        {typeof change === "number" && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              positive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {positive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}

            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>

      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <p className="mt-1 text-[24px] font-semibold tracking-tight text-[#172018]">
        {value}
      </p>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500">
          {subtitle}
        </p>
      )}
    </article>
  )
}

export default function DashboardPage() {
  const supabase = createClient()

  const [period, setPeriod] = useState<Period>("week")
  const [sales, setSales] = useState<Sale[]>([])
  const [previousSales, setPreviousSales] = useState<Sale[]>([])
  const [saleItems, setSaleItems] = useState<SaleItem[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [waste, setWaste] = useState<Waste[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError("")

    const startDate = getStartDate(period).toISOString()
    const previousStart = getStartDate(period, true).toISOString()
    const previousEnd = getPreviousEndDate(period).toISOString()

    const [
      salesResponse,
      previousSalesResponse,
      itemsResponse,
      expensesResponse,
      wasteResponse,
      productsResponse,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select(`
          id,
          folio,
          total,
          discount,
          payment_method,
          sold_at,
          status
        `)
        .eq("status", "completed")
        .gte("sold_at", startDate)
        .order("sold_at"),

      supabase
        .from("sales")
        .select(`
          id,
          folio,
          total,
          discount,
          payment_method,
          sold_at,
          status
        `)
        .eq("status", "completed")
        .gte("sold_at", previousStart)
        .lte("sold_at", previousEnd),

      supabase
        .from("sale_items")
        .select(`
          quantity,
          subtotal,
          profit,
          product:products (
            id,
            name,
            unit
          ),
          sale:sales!inner (
            sold_at,
            status
          )
        `)
        .eq("sale.status", "completed")
        .gte("sale.sold_at", startDate),

      supabase
        .from("expenses")
        .select("amount, expense_date")
        .gte("expense_date", startDate),

      supabase
        .from("waste_records")
        .select("total_loss, recorded_at")
        .gte("recorded_at", startDate),

      supabase
        .from("products")
        .select(`
          id,
          name,
          unit,
          current_stock,
          minimum_stock,
          purchase_price
        `)
        .eq("active", true)
        .order("name"),
    ])

    const firstError =
      salesResponse.error ||
      previousSalesResponse.error ||
      itemsResponse.error ||
      expensesResponse.error ||
      wasteResponse.error ||
      productsResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setSales((salesResponse.data ?? []) as Sale[])
    setPreviousSales(
      (previousSalesResponse.data ?? []) as Sale[],
    )
    setSaleItems(
      (itemsResponse.data ?? []) as unknown as SaleItem[],
    )
    setExpenses((expensesResponse.data ?? []) as Expense[])
    setWaste((wasteResponse.data ?? []) as Waste[])
    setProducts((productsResponse.data ?? []) as Product[])
    setLoading(false)
  }, [period, supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const salesTotal = useMemo(
    () =>
      sales.reduce(
        (total, sale) => total + Number(sale.total || 0),
        0,
      ),
    [sales],
  )

  const previousSalesTotal = useMemo(
    () =>
      previousSales.reduce(
        (total, sale) => total + Number(sale.total || 0),
        0,
      ),
    [previousSales],
  )

  const grossProfit = useMemo(
    () =>
      saleItems.reduce(
        (total, item) => total + Number(item.profit || 0),
        0,
      ),
    [saleItems],
  )

  const expenseTotal = useMemo(
    () =>
      expenses.reduce(
        (total, expense) => total + Number(expense.amount || 0),
        0,
      ),
    [expenses],
  )

  const wasteTotal = useMemo(
    () =>
      waste.reduce(
        (total, item) => total + Number(item.total_loss || 0),
        0,
      ),
    [waste],
  )

  const netProfit = grossProfit - expenseTotal - wasteTotal

  const averageTicket =
    sales.length > 0 ? salesTotal / sales.length : 0

  const previousAverageTicket =
    previousSales.length > 0
      ? previousSalesTotal / previousSales.length
      : 0

  const inventoryValue = useMemo(
    () =>
      products.reduce(
        (total, product) =>
          total +
          Number(product.current_stock || 0) *
            Number(product.purchase_price || 0),
        0,
      ),
    [products],
  )

  const lowStockProducts = useMemo(
    () =>
      products
        .filter((product) => {
          const stock = Number(product.current_stock || 0)
          const minimum = Number(product.minimum_stock || 0)

          return stock <= 0 || (minimum > 0 && stock <= minimum)
        })
        .sort(
          (a, b) =>
            Number(a.current_stock) -
            Number(b.current_stock),
        )
        .slice(0, 6),
    [products],
  )

  const topProducts = useMemo(() => {
    const totals = new Map<string, TopProduct>()

    saleItems.forEach((item) => {
      if (!item.product) return

      const current = totals.get(item.product.id) ?? {
        id: item.product.id,
        name: item.product.name,
        unit: item.product.unit,
        quantity: 0,
        amount: 0,
      }

      current.quantity += Number(item.quantity || 0)
      current.amount += Number(item.subtotal || 0)

      totals.set(item.product.id, current)
    })

    return Array.from(totals.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [saleItems])

  const chartData = useMemo(() => {
    const grouped = new Map<string, number>()

    sales.forEach((sale) => {
      const date = new Date(sale.sold_at)

      const key =
        period === "today"
          ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`
          : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

      grouped.set(
        key,
        (grouped.get(key) ?? 0) + Number(sale.total || 0),
      )
    })

    return Array.from(grouped.entries()).map(
      ([key, value]) => {
        const parts = key.split("-").map(Number)

        const date =
          period === "today"
            ? new Date(
                parts[0],
                parts[1],
                parts[2],
                parts[3],
                0,
                0,
              )
            : new Date(parts[0], parts[1], parts[2])

        return {
          label: chartLabel(date.toISOString(), period),
          sales: Number(value.toFixed(2)),
        }
      },
    )
  }, [sales, period])

  const paymentSummary = useMemo(() => {
    return sales.reduce(
      (totals, sale) => {
        const amount = Number(sale.total || 0)

        if (sale.payment_method === "cash") {
          totals.cash += amount
        }

        if (sale.payment_method === "card") {
          totals.card += amount
        }

        if (sale.payment_method === "transfer") {
          totals.transfer += amount
        }

        return totals
      },
      {
        cash: 0,
        card: 0,
        transfer: 0,
      },
    )
  }, [sales])

  return (
    <AppShell
      title="Dashboard"
      description="Resumen ejecutivo de la operación del local."
    >
      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-xl border border-[#dde2da] bg-white p-1 shadow-sm">
          {[
            ["today", "Hoy"],
            ["week", "7 días"],
            ["month", "Este mes"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value as Period)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                period === value
                  ? "bg-[#102019] text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadDashboard()}
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

      {loading ? (
        <div className="flex min-h-[520px] items-center justify-center rounded-[24px] border border-[#dde2da] bg-white">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#1f6a3a]" />
            <p className="text-sm text-slate-500">
              Calculando indicadores...
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Ventas del periodo"
              value={money(salesTotal)}
              subtitle={`${sales.length} ventas registradas`}
              icon={TrendingUp}
              change={percentChange(
                salesTotal,
                previousSalesTotal,
              )}
            />

            <StatCard
              title="Utilidad neta"
              value={money(netProfit)}
              subtitle={`Gastos ${money(
                expenseTotal,
              )} · Mermas ${money(wasteTotal)}`}
              icon={WalletCards}
            />

            <StatCard
              title="Ticket promedio"
              value={money(averageTicket)}
              subtitle="Promedio por operación"
              icon={ReceiptText}
              change={percentChange(
                averageTicket,
                previousAverageTicket,
              )}
            />

            <StatCard
              title="Valor de inventario"
              value={money(inventoryValue)}
              subtitle={`${products.length} productos activos`}
              icon={Boxes}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.55fr_0.75fr]">
            <article className="rounded-[24px] border border-[#dde2da] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,18,0.04),0_8px_24px_rgba(16,24,18,0.04)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Rendimiento
                  </p>

                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#172018]">
                    Evolución de ventas
                  </h2>
                </div>

                <div className="rounded-xl bg-[#e8f3eb] px-3 py-2 text-sm font-semibold text-[#1f6a3a]">
                  {preciseMoney(salesTotal)}
                </div>
              </div>

              <div className="mt-6 h-[330px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="4 4"
                        vertical={false}
                        stroke="#e6ebe3"
                      />

                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{
                          fill: "#7a857b",
                          fontSize: 12,
                        }}
                      />

                      <YAxis
                        tickFormatter={(value) =>
                          `$${Number(value).toLocaleString(
                            "es-MX",
                          )}`
                        }
                        tickLine={false}
                        axisLine={false}
                        tick={{
                          fill: "#7a857b",
                          fontSize: 12,
                        }}
                      />

                      <Tooltip
                        contentStyle={{
                          borderRadius: "14px",
                          border: "1px solid #dde2da",
                          boxShadow:
                            "0 12px 30px rgba(16,24,18,.10)",
                        }}
                        formatter={(value) => [
                          preciseMoney(Number(value)),
                          "Ventas",
                        ]}
                      />

                      <Line
                        type="monotone"
                        dataKey="sales"
                        stroke="#1f6a3a"
                        strokeWidth={3}
                        dot={{
                          r: 4,
                          fill: "#ffffff",
                          strokeWidth: 3,
                        }}
                        activeDot={{
                          r: 6,
                          fill: "#1f6a3a",
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef1eb] text-slate-400">
                      <TrendingUp className="h-6 w-6" />
                    </div>

                    <p className="mt-4 text-sm font-medium text-slate-700">
                      Sin ventas en este periodo
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      La gráfica aparecerá al registrar operaciones.
                    </p>
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-[24px] border border-[#dde2da] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,18,0.04),0_8px_24px_rgba(16,24,18,0.04)]">
              <p className="text-sm font-medium text-slate-500">
                Distribución
              </p>

              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                Métodos de pago
              </h2>

              <div className="mt-4 space-y-3">
                {[
                  {
                    name: "Efectivo",
                    value: paymentSummary.cash,
                    icon: Banknote,
                  },
                  {
                    name: "Tarjeta",
                    value: paymentSummary.card,
                    icon: CreditCard,
                  },
                  {
                    name: "Transferencia",
                    value: paymentSummary.transfer,
                    icon: Smartphone,
                  },
                ].map((item) => {
                  const Icon = item.icon
                  const percentage =
                    salesTotal > 0
                      ? (item.value / salesTotal) * 100
                      : 0

                  return (
                    <div
                      key={item.name}
                      className="rounded-2xl border border-[#e6eae4] p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef3ed] text-[#1f6a3a]">
                            <Icon className="h-5 w-5" />
                          </div>

                          <div>
                            <p className="text-sm font-medium">
                              {item.name}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {percentage.toFixed(1)}% del total
                            </p>
                          </div>
                        </div>

                        <p className="font-semibold">
                          {money(item.value)}
                        </p>
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf0eb]">
                        <div
                          className="h-full rounded-full bg-[#1f6a3a]"
                          style={{
                            width: `${Math.min(
                              percentage,
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-[24px] border border-[#dde2da] bg-white shadow-[0_1px_2px_rgba(16,24,18,0.04),0_8px_24px_rgba(16,24,18,0.04)]">
              <div className="border-b border-[#e6eae4] px-5 py-4">
                <p className="text-sm font-medium text-slate-500">
                  Rendimiento comercial
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  Productos más vendidos
                </h2>
              </div>

              <div className="divide-y divide-[#edf0eb] px-6">
                {topProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef3ed] text-sm font-semibold text-[#1f6a3a]">
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {product.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {quantity(
                            product.quantity,
                            product.unit,
                          )}{" "}
                          vendidos
                        </p>
                      </div>
                    </div>

                    <p className="shrink-0 font-semibold">
                      {money(product.amount)}
                    </p>
                  </div>
                ))}

                {topProducts.length === 0 && (
                  <div className="flex min-h-56 flex-col items-center justify-center text-center">
                    <PackageOpen className="h-7 w-7 text-slate-300" />

                    <p className="mt-3 text-sm text-slate-500">
                      Todavía no hay productos vendidos.
                    </p>
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-[24px] border border-[#dde2da] bg-white shadow-[0_1px_2px_rgba(16,24,18,0.04),0_8px_24px_rgba(16,24,18,0.04)]">
              <div className="border-b border-[#e6eae4] px-5 py-4">
                <p className="text-sm font-medium text-slate-500">
                  Atención requerida
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  Alertas de inventario
                </h2>
              </div>

              <div className="divide-y divide-[#edf0eb] px-6">
                {lowStockProducts.map((product) => {
                  const isOut =
                    Number(product.current_stock || 0) <= 0

                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-4 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            isOut
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {isOut ? (
                            <PackageOpen className="h-5 w-5" />
                          ) : (
                            <AlertTriangle className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {product.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Existencia:{" "}
                            {quantity(
                              product.current_stock,
                              product.unit,
                            )}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                          isOut
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {isOut ? "Agotado" : "Stock bajo"}
                      </span>
                    </div>
                  )
                })}

                {lowStockProducts.length === 0 && (
                  <div className="flex min-h-56 flex-col items-center justify-center text-center">
                    <Boxes className="h-7 w-7 text-slate-300" />

                    <p className="mt-3 text-sm text-slate-500">
                      No hay alertas de inventario.
                    </p>
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className="rounded-[24px] border border-[#dde2da] bg-white shadow-[0_1px_2px_rgba(16,24,18,0.04),0_8px_24px_rgba(16,24,18,0.04)]">
            <div className="flex items-center justify-between border-b border-[#e6eae4] px-6 py-5">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Actividad reciente
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  Últimas ventas
                </h2>
              </div>

              <span className="rounded-full bg-[#eef3ed] px-3 py-1 text-xs font-medium text-[#1f6a3a]">
                {sales.length} operaciones
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Folio</th>
                    <th className="px-5 py-3.5">Fecha</th>
                    <th className="px-5 py-3.5">Método</th>
                    <th className="px-5 py-3.5">Descuento</th>
                    <th className="px-6 py-4 text-right">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf0eb]">
                  {[...sales]
                    .reverse()
                    .slice(0, 8)
                    .map((sale) => (
                      <tr
                        key={sale.id}
                        className="transition hover:bg-[#fafbf8]"
                      >
                        <td className="px-6 py-4 font-medium">
                          {sale.folio}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-500">
                          {new Date(
                            sale.sold_at,
                          ).toLocaleString("es-MX")}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          {sale.payment_method === "cash"
                            ? "Efectivo"
                            : sale.payment_method === "card"
                              ? "Tarjeta"
                              : "Transferencia"}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-500">
                          {preciseMoney(sale.discount)}
                        </td>

                        <td className="px-6 py-4 text-right font-semibold">
                          {preciseMoney(sale.total)}
                        </td>
                      </tr>
                    ))}

                  {sales.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-16 text-center text-sm text-slate-500"
                      >
                        Todavía no existen ventas en este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  )
}

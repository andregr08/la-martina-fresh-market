"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Boxes,
  Loader2,
  PackageOpen,
  ReceiptText,
  RefreshCw,
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
  total: number
  discount: number
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

type Product = {
  id: string
  name: string
  unit: string
  current_stock: number
  minimum_stock: number
  purchase_price: number
  active: boolean
}

type ChartPoint = {
  label: string
  sales: number
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
  }).format(Number(value || 0))
}

function quantity(value: number, unit: string) {
  return `${Number(value || 0).toLocaleString("es-MX", {
    maximumFractionDigits: 3,
  })} ${unit}`
}

function getStartDate(period: Period) {
  const now = new Date()
  const start = new Date(now)

  if (period === "today") {
    start.setHours(0, 0, 0, 0)
  }

  if (period === "week") {
    start.setDate(now.getDate() - 6)
    start.setHours(0, 0, 0, 0)
  }

  if (period === "month") {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  }

  return start
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

export default function DashboardPage() {
  const supabase = createClient()

  const [period, setPeriod] = useState<Period>("week")
  const [sales, setSales] = useState<Sale[]>([])
  const [saleItems, setSaleItems] = useState<SaleItem[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError("")

    const startDate = getStartDate(period).toISOString()

    const [
      salesResponse,
      itemsResponse,
      expensesResponse,
      productsResponse,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("id, total, discount, sold_at, status")
        .eq("status", "completed")
        .gte("sold_at", startDate)
        .order("sold_at"),

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
        .from("products")
        .select(`
          id,
          name,
          unit,
          current_stock,
          minimum_stock,
          purchase_price,
          active
        `)
        .eq("active", true)
        .order("name"),
    ])

    const firstError =
      salesResponse.error ||
      itemsResponse.error ||
      expensesResponse.error ||
      productsResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setSales((salesResponse.data ?? []) as Sale[])
    setSaleItems(
      (itemsResponse.data ?? []) as unknown as SaleItem[],
    )
    setExpenses((expensesResponse.data ?? []) as Expense[])
    setProducts((productsResponse.data ?? []) as Product[])
    setLoading(false)
  }, [period, supabase])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const salesTotal = useMemo(
    () =>
      sales.reduce(
        (total, sale) => total + Number(sale.total || 0),
        0,
      ),
    [sales],
  )

  const salesCount = sales.length

  const averageTicket =
    salesCount > 0 ? salesTotal / salesCount : 0

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

  const netProfit = grossProfit - expenseTotal

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
            Number(a.current_stock) - Number(b.current_stock),
        )
        .slice(0, 8),
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

    const rows: ChartPoint[] = Array.from(grouped.entries()).map(
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

    return rows
  }, [sales, period])

  return (
    <AppShell
      title="Dashboard"
      description="Resumen general de La Martina Fresh Market."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            ["today", "Hoy"],
            ["week", "7 días"],
            ["month", "Este mes"],
          ].map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={period === value ? "default" : "outline"}
              onClick={() => setPeriod(value as Period)}
            >
              {label}
            </Button>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadDashboard()}
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
        <div className="flex min-h-96 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <TrendingUp className="h-5 w-5 text-slate-500" />

              <p className="mt-4 text-sm text-slate-500">
                Total vendido
              </p>

              <p className="mt-2 text-2xl font-semibold">
                {money(salesTotal)}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <ReceiptText className="h-5 w-5 text-slate-500" />

              <p className="mt-4 text-sm text-slate-500">
                Ventas realizadas
              </p>

              <p className="mt-2 text-2xl font-semibold">
                {salesCount}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Ticket promedio: {money(averageTicket)}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <WalletCards className="h-5 w-5 text-slate-500" />

              <p className="mt-4 text-sm text-slate-500">
                Utilidad estimada
              </p>

              <p
                className={`mt-2 text-2xl font-semibold ${
                  netProfit < 0 ? "text-red-700" : ""
                }`}
              >
                {money(netProfit)}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Gastos: {money(expenseTotal)}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <Boxes className="h-5 w-5 text-slate-500" />

              <p className="mt-4 text-sm text-slate-500">
                Valor del inventario
              </p>

              <p className="mt-2 text-2xl font-semibold">
                {money(inventoryValue)}
              </p>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div>
              <h2 className="text-lg font-semibold">
                Evolución de ventas
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Ventas del periodo seleccionado
              </p>
            </div>

            <div className="mt-6 h-80">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                    />

                    <YAxis
                      tickFormatter={(value) =>
                        `$${Number(value).toLocaleString("es-MX")}`
                      }
                      tickLine={false}
                      axisLine={false}
                    />

                    <Tooltip
                      formatter={(value) => [
                        money(Number(value)),
                        "Ventas",
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="currentColor"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No existen ventas en este periodo.
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">
                Productos más vendidos
              </h2>

              <div className="mt-5 divide-y divide-slate-100">
                {topProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>

                      <p className="mt-1 text-sm text-slate-500">
                        {quantity(product.quantity, product.unit)}
                      </p>
                    </div>

                    <p className="font-semibold">
                      {money(product.amount)}
                    </p>
                  </div>
                ))}

                {topProducts.length === 0 && (
                  <div className="flex min-h-44 items-center justify-center text-sm text-slate-500">
                    Todavía no existen ventas.
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">
                Alertas de inventario
              </h2>

              <div className="mt-5 divide-y divide-slate-100">
                {lowStockProducts.map((product) => {
                  const isOut =
                    Number(product.current_stock || 0) <= 0

                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-4 py-4"
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>

                        <p className="mt-1 text-sm text-slate-500">
                          Existencia:{" "}
                          {quantity(
                            product.current_stock,
                            product.unit,
                          )}
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
                          isOut
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {isOut ? (
                          <PackageOpen className="h-3.5 w-3.5" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}

                        {isOut ? "Agotado" : "Stock bajo"}
                      </span>
                    </div>
                  )
                })}

                {lowStockProducts.length === 0 && (
                  <div className="flex min-h-44 items-center justify-center text-sm text-slate-500">
                    No existen alertas de inventario.
                  </div>
                )}
              </div>
            </article>
          </section>
        </div>
      )}
    </AppShell>
  )
}

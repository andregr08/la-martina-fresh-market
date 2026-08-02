"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  BarChart3,
  Boxes,
  Download,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type Sale = {
  id: string
  folio: string
  total: number
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

type Purchase = {
  total: number
  purchase_date: string
}

type Product = {
  id: string
  name: string
  unit: string
  current_stock: number
  purchase_price: number
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

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`).toISOString()
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString()
}

function escapeCsv(value: string | number) {
  const text = String(value ?? "")

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  tone?: "default" | "green" | "red" | "amber"
}) {
  const classes = {
    default: {
      card: "border-[#dde2da] bg-white",
      icon: "bg-[#eef3ed] text-[#1f6a3a]",
      text: "text-[#172018]",
      subtitle: "text-slate-400",
    },
    green: {
      card: "border-emerald-200 bg-emerald-50",
      icon: "bg-white text-emerald-700",
      text: "text-emerald-950",
      subtitle: "text-emerald-700",
    },
    red: {
      card: "border-red-200 bg-red-50",
      icon: "bg-white text-red-700",
      text: "text-red-950",
      subtitle: "text-red-700",
    },
    amber: {
      card: "border-amber-200 bg-amber-50",
      icon: "bg-white text-amber-700",
      text: "text-amber-950",
      subtitle: "text-amber-700",
    },
  }[tone]

  return (
    <article
      className={`rounded-[20px] border p-5 shadow-sm ${classes.card}`}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${classes.icon}`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <p
        className={`mt-2 text-[28px] font-semibold tracking-tight ${classes.text}`}
      >
        {value}
      </p>

      {subtitle && (
        <p className={`mt-2 text-xs ${classes.subtitle}`}>
          {subtitle}
        </p>
      )}
    </article>
  )
}

export default function ReportesPage() {
  const supabase = useMemo(() => createClient(), [])

  const today = useMemo(() => new Date(), [])
  const firstDay = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today],
  )

  const [startDate, setStartDate] = useState(
    toDateInputValue(firstDay),
  )
  const [endDate, setEndDate] = useState(
    toDateInputValue(today),
  )

  const [sales, setSales] = useState<Sale[]>([])
  const [saleItems, setSaleItems] = useState<SaleItem[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [waste, setWaste] = useState<Waste[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError("")

    const start = startOfDay(startDate)
    const end = endOfDay(endDate)

    const [
      salesResponse,
      itemsResponse,
      expensesResponse,
      wasteResponse,
      purchasesResponse,
      productsResponse,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("id, folio, total, sold_at, status")
        .eq("status", "completed")
        .gte("sold_at", start)
        .lte("sold_at", end)
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
        .gte("sale.sold_at", start)
        .lte("sale.sold_at", end),

      supabase
        .from("expenses")
        .select("amount, expense_date")
        .gte("expense_date", start)
        .lte("expense_date", end),

      supabase
        .from("waste_records")
        .select("total_loss, recorded_at")
        .gte("recorded_at", start)
        .lte("recorded_at", end),

      supabase
        .from("purchases")
        .select("total, purchase_date")
        .gte("purchase_date", start)
        .lte("purchase_date", end),

      supabase
        .from("products")
        .select(`
          id,
          name,
          unit,
          current_stock,
          purchase_price
        `)
        .eq("active", true)
        .order("name"),
    ])

    const firstError =
      salesResponse.error ||
      itemsResponse.error ||
      expensesResponse.error ||
      wasteResponse.error ||
      purchasesResponse.error ||
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
    setWaste((wasteResponse.data ?? []) as Waste[])
    setPurchases((purchasesResponse.data ?? []) as Purchase[])
    setProducts((productsResponse.data ?? []) as Product[])

    setLoading(false)
  }, [endDate, startDate, supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReport()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadReport])

  const salesTotal = useMemo(
    () =>
      sales.reduce(
        (total, sale) => total + Number(sale.total || 0),
        0,
      ),
    [sales],
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
        (total, item) => total + Number(item.amount || 0),
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

  const purchaseTotal = useMemo(
    () =>
      purchases.reduce(
        (total, item) => total + Number(item.total || 0),
        0,
      ),
    [purchases],
  )

  const netProfit =
    grossProfit - expenseTotal - wasteTotal

  const averageTicket =
    sales.length > 0 ? salesTotal / sales.length : 0

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

  const chartData = useMemo(() => {
    const grouped = new Map<string, number>()

    sales.forEach((sale) => {
      const date = new Date(sale.sold_at)
      const key = date.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
      })

      grouped.set(
        key,
        (grouped.get(key) ?? 0) + Number(sale.total || 0),
      )
    })

    return Array.from(grouped.entries()).map(
      ([label, amount]) => ({
        label,
        sales: Number(amount.toFixed(2)),
      }),
    ) as ChartPoint[]
  }, [sales])

  const topProducts = useMemo(() => {
    const grouped = new Map<string, TopProduct>()

    saleItems.forEach((item) => {
      if (!item.product) return

      const current = grouped.get(item.product.id) ?? {
        id: item.product.id,
        name: item.product.name,
        unit: item.product.unit,
        quantity: 0,
        amount: 0,
      }

      current.quantity += Number(item.quantity || 0)
      current.amount += Number(item.subtotal || 0)

      grouped.set(item.product.id, current)
    })

    return Array.from(grouped.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
  }, [saleItems])

  function exportCsv() {
    const rows = [
      ["Reporte La Martina Fresh Market"],
      ["Desde", startDate],
      ["Hasta", endDate],
      [],
      ["Indicador", "Valor"],
      ["Ventas", salesTotal],
      ["Utilidad bruta", grossProfit],
      ["Gastos", expenseTotal],
      ["Mermas", wasteTotal],
      ["Utilidad neta", netProfit],
      ["Compras", purchaseTotal],
      ["Ticket promedio", averageTicket],
      ["Valor inventario", inventoryValue],
      [],
      ["Productos más vendidos"],
      ["Producto", "Cantidad", "Unidad", "Ventas"],
      ...topProducts.map((product) => [
        product.name,
        product.quantity,
        product.unit,
        product.amount,
      ]),
    ]

    const csv = rows
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n")

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    })

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    anchor.href = url
    anchor.download = `reporte-la-martina-${startDate}-${endDate}.csv`
    anchor.click()

    URL.revokeObjectURL(url)
  }

  return (
    <AppShell
      title="Reportes"
      description="Resultados financieros y operativos por periodo."
    >
      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mb-6 rounded-[24px] border border-[#dde2da] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Desde
              </p>

              <Input
                type="date"
                value={startDate}
                onChange={(event) =>
                  setStartDate(event.target.value)
                }
                className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Hasta
              </p>

              <Input
                type="date"
                value={endDate}
                onChange={(event) =>
                  setEndDate(event.target.value)
                }
                className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
              />
            </div>

            <Button
              type="button"
              onClick={() => void loadReport()}
              disabled={loading}
              className="h-10 self-end rounded-xl bg-[#102019] text-white"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Actualizar
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={exportCsv}
            className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-[520px] items-center justify-center rounded-[24px] border border-[#dde2da] bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#1f6a3a]" />
        </div>
      ) : (
        <div className="space-y-4">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Ventas"
              value={money(salesTotal)}
              subtitle={`${sales.length} operaciones`}
              icon={TrendingUp}
              tone="green"
            />

            <StatCard
              title="Utilidad bruta"
              value={money(grossProfit)}
              subtitle="Antes de gastos y mermas"
              icon={WalletCards}
            />

            <StatCard
              title="Utilidad neta"
              value={money(netProfit)}
              subtitle={`Gastos ${money(
                expenseTotal,
              )} · Mermas ${money(wasteTotal)}`}
              icon={TrendingUp}
              tone={netProfit >= 0 ? "green" : "red"}
            />

            <StatCard
              title="Ticket promedio"
              value={money(averageTicket)}
              subtitle="Promedio por venta"
              icon={ReceiptText}
            />

            <StatCard
              title="Compras"
              value={money(purchaseTotal)}
              subtitle={`${purchases.length} registros`}
              icon={ShoppingCart}
              tone="amber"
            />

            <StatCard
              title="Gastos"
              value={money(expenseTotal)}
              subtitle={`${expenses.length} registros`}
              icon={TrendingDown}
              tone="red"
            />

            <StatCard
              title="Mermas"
              value={money(wasteTotal)}
              subtitle={`${waste.length} registros`}
              icon={TrendingDown}
              tone="red"
            />

            <StatCard
              title="Valor de inventario"
              value={money(inventoryValue)}
              subtitle={`${products.length} productos activos`}
              icon={Boxes}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.45fr_0.8fr]">
            <article className="rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#1f6a3a]" />

                <div>
                  <h2 className="text-lg font-semibold">
                    Ventas por día
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Evolución dentro del rango seleccionado
                  </p>
                </div>
              </div>

              <div className="mt-6 h-[360px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart data={chartData}>
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
                        formatter={(value) => [
                          money(Number(value)),
                          "Ventas",
                        ]}
                        contentStyle={{
                          borderRadius: "14px",
                          border: "1px solid #dde2da",
                          boxShadow:
                            "0 12px 30px rgba(16,24,18,.10)",
                        }}
                      />

                      <Bar
                        dataKey="sales"
                        fill="#1f6a3a"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <BarChart3 className="h-8 w-8 text-slate-300" />

                    <p className="mt-4 text-sm font-medium text-slate-600">
                      Sin ventas en este periodo
                    </p>
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                Rentabilidad
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                Resumen financiero
              </h2>

              <div className="mt-6 space-y-4">
                {[
                  {
                    label: "Ventas",
                    value: salesTotal,
                    tone: "text-[#1f6a3a]",
                  },
                  {
                    label: "Utilidad bruta",
                    value: grossProfit,
                    tone: "text-[#1f6a3a]",
                  },
                  {
                    label: "Gastos",
                    value: -expenseTotal,
                    tone: "text-red-700",
                  },
                  {
                    label: "Mermas",
                    value: -wasteTotal,
                    tone: "text-red-700",
                  },
                  {
                    label: "Utilidad neta",
                    value: netProfit,
                    tone:
                      netProfit >= 0
                        ? "text-emerald-700"
                        : "text-red-700",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-2xl border border-[#e4e8e1] px-4 py-3"
                  >
                    <span className="text-sm text-slate-500">
                      {item.label}
                    </span>

                    <span
                      className={`font-semibold ${item.tone}`}
                    >
                      {money(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#dde2da] bg-white shadow-sm">
            <div className="border-b border-[#e6eae4] px-5 py-4">
              <h2 className="text-lg font-semibold">
                Productos más vendidos
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Ranking por importe vendido
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="sticky top-0 z-10 bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Posición</th>
                    <th className="px-5 py-3.5">Producto</th>
                    <th className="px-5 py-3.5">Cantidad</th>
                    <th className="px-6 py-4 text-right">
                      Ventas
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf0eb]">
                  {topProducts.map((product, index) => (
                    <tr
                      key={product.id}
                      className="transition-colors hover:bg-[#f7f9f5]"
                    >
                      <td className="px-5 py-3.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eef3ed] text-sm font-semibold text-[#1f6a3a]">
                          {index + 1}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-medium">
                        {product.name}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {quantity(
                          product.quantity,
                          product.unit,
                        )}
                      </td>

                      <td className="px-6 py-4 text-right font-semibold">
                        {money(product.amount)}
                      </td>
                    </tr>
                  ))}

                  {topProducts.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        No existen productos vendidos en este periodo.
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

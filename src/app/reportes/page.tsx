"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  Boxes,
  Download,
  Loader2,
  PackagePlus,
  RefreshCw,
  ShoppingCart,
  Trash2,
  TrendingUp,
  WalletCards,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Sale = {
  id: string
  folio: string
  subtotal: number
  discount: number
  total: number
  payment_method: string
  sold_at: string
}

type SaleItem = {
  quantity: number
  subtotal: number
  profit: number
  product: {
    name: string
    unit: string
  } | null
  sale: {
    sold_at: string
    status: string
  } | null
}

type Purchase = {
  id: string
  folio: string
  merchandise_subtotal: number
  transport_cost: number
  parking_cost: number
  loader_cost: number
  other_costs: number
  total: number
  purchase_date: string
}

type Expense = {
  id: string
  amount: number
  payment_method: string
  description: string
  expense_date: string
  category: {
    name: string
  } | null
}

type WasteRecord = {
  id: string
  quantity: number
  total_loss: number
  reason: string
  recorded_at: string
  product: {
    name: string
    unit: string
  } | null
}

type Product = {
  id: string
  name: string
  unit: string
  current_stock: number
  purchase_price: number
}

type TopProduct = {
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

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function csvValue(value: unknown) {
  const text = String(value ?? "")
  return `"${text.replaceAll('"', '""')}"`
}

export default function ReportesPage() {
  const supabase = createClient()

  const initialStart = new Date()
  initialStart.setDate(1)

  const [startDate, setStartDate] = useState(
    dateInputValue(initialStart),
  )
  const [endDate, setEndDate] = useState(
    dateInputValue(new Date()),
  )

  const [sales, setSales] = useState<Sale[]>([])
  const [saleItems, setSaleItems] = useState<SaleItem[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [waste, setWaste] = useState<WasteRecord[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError("")

    const start = new Date(`${startDate}T00:00:00`)
    const end = new Date(`${endDate}T23:59:59.999`)

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start > end
    ) {
      setError("El rango de fechas no es válido.")
      setLoading(false)
      return
    }

    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const [
      salesResponse,
      saleItemsResponse,
      purchasesResponse,
      expensesResponse,
      wasteResponse,
      productsResponse,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select(`
          id,
          folio,
          subtotal,
          discount,
          total,
          payment_method,
          sold_at
        `)
        .eq("status", "completed")
        .gte("sold_at", startIso)
        .lte("sold_at", endIso)
        .order("sold_at"),

      supabase
        .from("sale_items")
        .select(`
          quantity,
          subtotal,
          profit,
          product:products (
            name,
            unit
          ),
          sale:sales!inner (
            sold_at,
            status
          )
        `)
        .eq("sale.status", "completed")
        .gte("sale.sold_at", startIso)
        .lte("sale.sold_at", endIso),

      supabase
        .from("purchases")
        .select(`
          id,
          folio,
          merchandise_subtotal,
          transport_cost,
          parking_cost,
          loader_cost,
          other_costs,
          total,
          purchase_date
        `)
        .gte("purchase_date", startIso)
        .lte("purchase_date", endIso)
        .order("purchase_date"),

      supabase
        .from("expenses")
        .select(`
          id,
          amount,
          payment_method,
          description,
          expense_date,
          category:expense_categories (
            name
          )
        `)
        .gte("expense_date", startIso)
        .lte("expense_date", endIso)
        .order("expense_date"),

      supabase
        .from("waste_records")
        .select(`
          id,
          quantity,
          total_loss,
          reason,
          recorded_at,
          product:products (
            name,
            unit
          )
        `)
        .gte("recorded_at", startIso)
        .lte("recorded_at", endIso)
        .order("recorded_at"),

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
      saleItemsResponse.error ||
      purchasesResponse.error ||
      expensesResponse.error ||
      wasteResponse.error ||
      productsResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setSales((salesResponse.data ?? []) as Sale[])

    setSaleItems(
      (saleItemsResponse.data ?? []) as unknown as SaleItem[],
    )

    setPurchases(
      (purchasesResponse.data ?? []) as Purchase[],
    )

    setExpenses(
      (expensesResponse.data ?? []) as unknown as Expense[],
    )

    setWaste(
      (wasteResponse.data ?? []) as unknown as WasteRecord[],
    )

    setProducts((productsResponse.data ?? []) as Product[])
    setLoading(false)
  }, [supabase, startDate, endDate])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const summary = useMemo(() => {
    const totalSales = sales.reduce(
      (total, sale) => total + Number(sale.total || 0),
      0,
    )

    const grossProfit = saleItems.reduce(
      (total, item) => total + Number(item.profit || 0),
      0,
    )

    const totalPurchases = purchases.reduce(
      (total, purchase) => total + Number(purchase.total || 0),
      0,
    )

    const totalExpenses = expenses.reduce(
      (total, expense) => total + Number(expense.amount || 0),
      0,
    )

    const totalWaste = waste.reduce(
      (total, record) => total + Number(record.total_loss || 0),
      0,
    )

    const inventoryValue = products.reduce(
      (total, product) =>
        total +
        Number(product.current_stock || 0) *
          Number(product.purchase_price || 0),
      0,
    )

    const netProfit =
      grossProfit - totalExpenses - totalWaste

    return {
      totalSales,
      grossProfit,
      totalPurchases,
      totalExpenses,
      totalWaste,
      inventoryValue,
      netProfit,
      salesCount: sales.length,
      averageTicket:
        sales.length > 0 ? totalSales / sales.length : 0,
    }
  }, [sales, saleItems, purchases, expenses, waste, products])

  const topProducts = useMemo(() => {
    const grouped = new Map<string, TopProduct>()

    saleItems.forEach((item) => {
      if (!item.product) return

      const current = grouped.get(item.product.name) ?? {
        name: item.product.name,
        unit: item.product.unit,
        quantity: 0,
        amount: 0,
      }

      current.quantity += Number(item.quantity || 0)
      current.amount += Number(item.subtotal || 0)

      grouped.set(item.product.name, current)
    })

    return Array.from(grouped.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
  }, [saleItems])

  function exportCsv() {
    const rows: string[][] = [
      ["REPORTE LA MARTINA FRESH MARKET"],
      ["Desde", startDate],
      ["Hasta", endDate],
      [],
      ["RESUMEN"],
      ["Concepto", "Importe"],
      ["Ventas", summary.totalSales.toFixed(2)],
      ["Utilidad bruta", summary.grossProfit.toFixed(2)],
      ["Gastos", summary.totalExpenses.toFixed(2)],
      ["Mermas", summary.totalWaste.toFixed(2)],
      ["Utilidad neta", summary.netProfit.toFixed(2)],
      ["Compras", summary.totalPurchases.toFixed(2)],
      ["Valor actual inventario", summary.inventoryValue.toFixed(2)],
      ["Número de ventas", String(summary.salesCount)],
      ["Ticket promedio", summary.averageTicket.toFixed(2)],
      [],
      ["VENTAS"],
      [
        "Folio",
        "Fecha",
        "Método",
        "Subtotal",
        "Descuento",
        "Total",
      ],
      ...sales.map((sale) => [
        sale.folio,
        new Date(sale.sold_at).toLocaleString("es-MX"),
        sale.payment_method,
        Number(sale.subtotal).toFixed(2),
        Number(sale.discount).toFixed(2),
        Number(sale.total).toFixed(2),
      ]),
      [],
      ["COMPRAS"],
      ["Folio", "Fecha", "Mercancía", "Logística", "Total"],
      ...purchases.map((purchase) => {
        const logistics =
          Number(purchase.transport_cost || 0) +
          Number(purchase.parking_cost || 0) +
          Number(purchase.loader_cost || 0) +
          Number(purchase.other_costs || 0)

        return [
          purchase.folio,
          new Date(purchase.purchase_date).toLocaleString("es-MX"),
          Number(purchase.merchandise_subtotal).toFixed(2),
          logistics.toFixed(2),
          Number(purchase.total).toFixed(2),
        ]
      }),
      [],
      ["GASTOS"],
      ["Fecha", "Categoría", "Descripción", "Método", "Importe"],
      ...expenses.map((expense) => [
        new Date(expense.expense_date).toLocaleString("es-MX"),
        expense.category?.name ?? "",
        expense.description,
        expense.payment_method,
        Number(expense.amount).toFixed(2),
      ]),
      [],
      ["MERMAS"],
      ["Fecha", "Producto", "Cantidad", "Unidad", "Motivo", "Pérdida"],
      ...waste.map((record) => [
        new Date(record.recorded_at).toLocaleString("es-MX"),
        record.product?.name ?? "",
        Number(record.quantity).toFixed(3),
        record.product?.unit ?? "",
        record.reason,
        Number(record.total_loss).toFixed(2),
      ]),
      [],
      ["PRODUCTOS MÁS VENDIDOS"],
      ["Producto", "Cantidad", "Unidad", "Ventas"],
      ...topProducts.map((product) => [
        product.name,
        product.quantity.toFixed(3),
        product.unit,
        product.amount.toFixed(2),
      ]),
      [],
      ["INVENTARIO ACTUAL"],
      ["Producto", "Existencia", "Unidad", "Costo promedio", "Valor"],
      ...products.map((product) => [
        product.name,
        Number(product.current_stock).toFixed(3),
        product.unit,
        Number(product.purchase_price).toFixed(2),
        (
          Number(product.current_stock) *
          Number(product.purchase_price)
        ).toFixed(2),
      ]),
    ]

    const csv = rows
      .map((row) => row.map(csvValue).join(","))
      .join("\r\n")

    const blob = new Blob(
      ["\uFEFF", csv],
      {
        type: "text/csv;charset=utf-8;",
      },
    )

    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download =
      `reporte-la-martina-${startDate}-a-${endDate}.csv`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell
      title="Reportes"
      description="Resultados financieros y operativos por periodo."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_auto] xl:items-end">
          <div className="space-y-2">
            <Label htmlFor="startDate">Fecha inicial</Label>

            <div className="flex w-full min-w-0 rounded-xl border px-3 py-2">
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(event) =>
                  setStartDate(event.target.value)
                }
                className="block w-full min-w-0 border-0 bg-transparent p-0 text-base"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">Fecha final</Label>

            <div className="flex w-full min-w-0 rounded-xl border px-3 py-2">
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(event) =>
                  setEndDate(event.target.value)
                }
                className="block w-full min-w-0 border-0 bg-transparent p-0 text-base"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void loadReports()}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Generar
          </Button>

          <Button
            type="button"
            onClick={exportCsv}
            disabled={loading}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </section>

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
                Ventas
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {money(summary.totalSales)}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {summary.salesCount} tickets · Promedio{" "}
                {money(summary.averageTicket)}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <WalletCards className="h-5 w-5 text-slate-500" />
              <p className="mt-4 text-sm text-slate-500">
                Utilidad bruta
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {money(summary.grossProfit)}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <BarChart3 className="h-5 w-5 text-slate-500" />
              <p className="mt-4 text-sm text-slate-500">
                Utilidad neta
              </p>
              <p
                className={`mt-2 text-2xl font-semibold ${
                  summary.netProfit < 0 ? "text-red-700" : ""
                }`}
              >
                {money(summary.netProfit)}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Después de gastos y mermas
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <Boxes className="h-5 w-5 text-slate-500" />
              <p className="mt-4 text-sm text-slate-500">
                Valor del inventario
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {money(summary.inventoryValue)}
              </p>
            </article>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <ShoppingCart className="h-5 w-5 text-slate-500" />
              <p className="mt-4 text-sm text-slate-500">
                Compras
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {money(summary.totalPurchases)}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <PackagePlus className="h-5 w-5 text-slate-500" />
              <p className="mt-4 text-sm text-slate-500">
                Gastos operativos
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {money(summary.totalExpenses)}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <Trash2 className="h-5 w-5 text-slate-500" />
              <p className="mt-4 text-sm text-slate-500">
                Pérdida por mermas
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {money(summary.totalWaste)}
              </p>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold">
                Productos más vendidos
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">
                      Producto
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Cantidad
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Ventas
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {topProducts.map((product) => (
                    <tr key={product.name}>
                      <td className="px-5 py-4 font-medium">
                        {product.name}
                      </td>

                      <td className="px-5 py-4">
                        {product.quantity.toLocaleString("es-MX", {
                          maximumFractionDigits: 3,
                        })}{" "}
                        {product.unit}
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        {money(product.amount)}
                      </td>
                    </tr>
                  ))}

                  {topProducts.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        No existen ventas en el periodo.
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

"use client"

import Link from "next/link"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  AlertTriangle,
  ArrowDownToLine,
  Boxes,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  Search,
  Snowflake,
  WalletCards,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type InventoryProduct = {
  id: string
  sku: string | null
  name: string
  unit: string
  purchase_price: number
  sale_price: number
  current_stock: number
  minimum_stock: number
  ideal_stock: number
  shelf_life_days: number | null
  refrigerated: boolean
  category: {
    name: string
  } | null
}

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

export default function InventarioPage() {
  const supabase = useMemo(() => createClient(), [])

  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Todas")
  const [status, setStatus] = useState("Todos")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadInventory = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: productsError } = await supabase
      .from("products")
      .select(`
        id,
        sku,
        name,
        unit,
        purchase_price,
        sale_price,
        current_stock,
        minimum_stock,
        ideal_stock,
        shelf_life_days,
        refrigerated,
        category:categories (
          name
        )
      `)
      .eq("active", true)
      .order("name")

    if (productsError) {
      setError(productsError.message)
      setLoading(false)
      return
    }

    setProducts((data ?? []) as unknown as InventoryProduct[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadInventory()
  }, [loadInventory])

  const categories = useMemo(() => {
    const values = new Set(
      products
        .map((product) => product.category?.name)
        .filter((value): value is string => Boolean(value)),
    )

    return ["Todas", ...Array.from(values).sort()]
  }, [products])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return products.filter((product) => {
      const stock = Number(product.current_stock || 0)
      const minimum = Number(product.minimum_stock || 0)

      const isOut = stock <= 0
      const isLow =
        !isOut && minimum > 0 && stock <= minimum

      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.sku?.toLowerCase().includes(normalizedSearch)

      const matchesCategory =
        category === "Todas" ||
        product.category?.name === category

      const matchesStatus =
        status === "Todos" ||
        (status === "Disponibles" && !isOut && !isLow) ||
        (status === "Stock bajo" && isLow) ||
        (status === "Agotados" && isOut)

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [products, search, category, status])

  const summary = useMemo(() => {
    return products.reduce(
      (totals, product) => {
        const stock = Number(product.current_stock || 0)
        const cost = Number(product.purchase_price || 0)
        const minimum = Number(product.minimum_stock || 0)

        totals.value += stock * cost
        totals.stock += stock

        if (stock <= 0) {
          totals.out += 1
        } else if (minimum > 0 && stock <= minimum) {
          totals.low += 1
        } else {
          totals.available += 1
        }

        return totals
      },
      {
        value: 0,
        stock: 0,
        out: 0,
        low: 0,
        available: 0,
      },
    )
  }, [products])

  return (
    <AppShell
      title="Inventario"
      description="Existencias, costos, disponibilidad y alertas."
    >
      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/entradas"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#102019] px-4 text-sm font-medium text-white"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Registrar entrada
          </Link>

          <Link
            href="/ajustes-inventario"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#dce2d9] bg-white px-4 text-sm font-medium text-slate-700"
          >
            <ClipboardCheck className="h-4 w-4" />
            Ajustar inventario
          </Link>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadInventory()}
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
            <WalletCards className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Valor del inventario
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight">
            {money(summary.value)}
          </p>
        </article>

        <article className="rounded-[20px] border border-[#dde2da] bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
            <PackageCheck className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Productos disponibles
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight">
            {summary.available}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            Con existencia suficiente
          </p>
        </article>

        <article className="rounded-[20px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-amber-700">
            Stock bajo
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight text-amber-950">
            {summary.low}
          </p>
        </article>

        <article className="rounded-[20px] border border-red-200 bg-red-50 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-red-700">
            <PackageOpen className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-red-700">
            Productos agotados
          </p>

          <p className="mt-2 text-[28px] font-semibold tracking-tight text-red-950">
            {summary.out}
          </p>
        </article>
      </section>

      <section className="mt-6 overflow-hidden rounded-[24px] border border-[#dde2da] bg-white shadow-sm">
        <div className="border-b border-[#e6eae4] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-[#1f6a3a]" />

                <h2 className="text-lg font-semibold">
                  Existencias actuales
                </h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {filteredProducts.length} de {products.length} productos
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
                  placeholder="Buscar producto o SKU"
                  className="h-10 w-full rounded-xl border border-[#dce2d9] bg-[#f8f9f6] pl-9 pr-3 text-sm outline-none focus:border-[#1f6a3a] focus:bg-white"
                />
              </div>

              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
                className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none"
              >
                <option value="Todos">Todos</option>
                <option value="Disponibles">Disponibles</option>
                <option value="Stock bajo">Stock bajo</option>
                <option value="Agotados">Agotados</option>
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
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4">Existencia</th>
                  <th className="px-6 py-4">Costo</th>
                  <th className="px-6 py-4">Precio</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Conservación</th>
                  <th className="px-6 py-4">Estado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#edf0eb]">
                {filteredProducts.map((product) => {
                  const stock = Number(product.current_stock || 0)
                  const minimum = Number(product.minimum_stock || 0)
                  const cost = Number(product.purchase_price || 0)

                  const isOut = stock <= 0
                  const isLow =
                    !isOut && minimum > 0 && stock <= minimum

                  return (
                    <tr
                      key={product.id}
                      className="transition hover:bg-[#fafbf8]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef3ed] text-[#1f6a3a]">
                            <Boxes className="h-5 w-5" />
                          </div>

                          <div>
                            <p className="font-medium">
                              {product.name}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {product.sku ?? "Sin SKU"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {product.category?.name ?? "Sin categoría"}
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-semibold">
                          {quantity(stock, product.unit)}
                        </p>

                        {minimum > 0 && (
                          <p className="mt-1 text-xs text-slate-400">
                            Mínimo {quantity(minimum, product.unit)}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {money(cost)}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium">
                        {money(product.sale_price)}
                      </td>

                      <td className="px-6 py-4 font-semibold">
                        {money(stock * cost)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          {product.refrigerated && (
                            <Snowflake className="h-4 w-4 text-sky-600" />
                          )}

                          <span>
                            {product.shelf_life_days
                              ? `${product.shelf_life_days} días`
                              : "Sin definir"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                            <PackageOpen className="h-3.5 w-3.5" />
                            Agotado
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Stock bajo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                            <PackageCheck className="h-3.5 w-3.5" />
                            Disponible
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-20 text-center"
                    >
                      <PackageOpen className="mx-auto h-8 w-8 text-slate-300" />

                      <p className="mt-4 text-sm font-medium text-slate-600">
                        No se encontraron productos
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Cambia los filtros o la búsqueda.
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
            Existencia acumulada: {quantity(summary.stock, "kg")}
          </p>

          <Link
            href="/productos"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#1f6a3a]"
          >
            Administrar productos
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </AppShell>
  )
}

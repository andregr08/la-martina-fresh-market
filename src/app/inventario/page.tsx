"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Boxes,
  Loader2,
  RefreshCw,
  Search,
  Snowflake,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const supabase = createClient()

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
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.sku?.toLowerCase().includes(normalizedSearch)

      const matchesCategory =
        category === "Todas" ||
        product.category?.name === category

      const isOut = Number(product.current_stock) <= 0

      const isLow =
        !isOut &&
        Number(product.minimum_stock) > 0 &&
        Number(product.current_stock) <=
          Number(product.minimum_stock)

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

        totals.inventoryValue += stock * cost

        if (stock <= 0) {
          totals.outOfStock += 1
        } else if (minimum > 0 && stock <= minimum) {
          totals.lowStock += 1
        }

        totals.totalStock += stock

        return totals
      },
      {
        inventoryValue: 0,
        totalStock: 0,
        lowStock: 0,
        outOfStock: 0,
      },
    )
  }, [products])

  return (
    <AppShell
      title="Inventario"
      description="Existencias, costos y alertas de producto del local."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Valor del inventario
          </p>

          <p className="mt-3 text-2xl font-semibold">
            {money(summary.inventoryValue)}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Calculado con costo promedio
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Existencia acumulada
          </p>

          <p className="mt-3 text-2xl font-semibold">
            {quantity(summary.totalStock, "kg")}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Total de todos los productos
          </p>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-700">
            Productos con stock bajo
          </p>

          <p className="mt-3 text-2xl font-semibold text-amber-900">
            {summary.lowStock}
          </p>

          <p className="mt-2 text-sm text-amber-700">
            Requieren reposición
          </p>
        </article>

        <article className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">
            Productos agotados
          </p>

          <p className="mt-3 text-2xl font-semibold text-red-900">
            {summary.outOfStock}
          </p>

          <p className="mt-2 text-sm text-red-700">
            Sin existencia disponible
          </p>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />

              <h2 className="text-lg font-semibold">
                Existencias actuales
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {filteredProducts.length} productos encontrados
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto o SKU"
                className="pl-9"
              />
            </div>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="Todos">Todos</option>
              <option value="Disponibles">Disponibles</option>
              <option value="Stock bajo">Stock bajo</option>
              <option value="Agotados">Agotados</option>
            </select>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadInventory()}
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
                  <th className="px-5 py-4 font-medium">Producto</th>
                  <th className="px-5 py-4 font-medium">Categoría</th>
                  <th className="px-5 py-4 font-medium">Existencia</th>
                  <th className="px-5 py-4 font-medium">Costo promedio</th>
                  <th className="px-5 py-4 font-medium">Precio de venta</th>
                  <th className="px-5 py-4 font-medium">Valor</th>
                  <th className="px-5 py-4 font-medium">Vida útil</th>
                  <th className="px-5 py-4 font-medium">Estado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => {
                  const stock = Number(product.current_stock || 0)
                  const minimum = Number(product.minimum_stock || 0)
                  const cost = Number(product.purchase_price || 0)

                  const isOut = stock <= 0
                  const isLow =
                    !isOut && minimum > 0 && stock <= minimum

                  return (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-medium">{product.name}</p>

                        <p className="mt-1 text-sm text-slate-500">
                          {product.sku ?? "Sin SKU"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {product.category?.name ?? "Sin categoría"}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {quantity(stock, product.unit)}
                        </p>

                        {minimum > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            Mínimo: {quantity(minimum, product.unit)}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {money(cost)}
                      </td>

                      <td className="px-5 py-4">
                        {money(Number(product.sale_price || 0))}
                      </td>

                      <td className="px-5 py-4 font-medium">
                        {money(stock * cost)}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          {product.refrigerated && (
                            <Snowflake className="h-4 w-4" />
                          )}

                          {product.shelf_life_days
                            ? `${product.shelf_life_days} días`
                            : "Sin definir"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs text-red-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Agotado
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Stock bajo
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
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
                      className="px-5 py-14 text-center text-sm text-slate-500"
                    >
                      No se encontraron productos con esos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  )
}

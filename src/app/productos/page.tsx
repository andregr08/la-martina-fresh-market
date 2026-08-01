"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Tags,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type Product = {
  id: string
  sku: string | null
  name: string
  unit: string
  purchase_price: number
  sale_price: number
  current_stock: number
  minimum_stock: number
  ideal_stock: number
  category: {
    name: string
  } | null
}

type EditableProduct = Product & {
  salePriceInput: string
  minimumStockInput: string
  idealStockInput: string
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0))
}

export default function ProductosPage() {
  const supabase = createClient()

  const [products, setProducts] = useState<EditableProduct[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadProducts = useCallback(async () => {
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

    setProducts(
      ((data ?? []) as unknown as Product[]).map((product) => ({
        ...product,
        salePriceInput: String(Number(product.sale_price || 0)),
        minimumStockInput: String(Number(product.minimum_stock || 0)),
        idealStockInput: String(Number(product.ideal_stock || 0)),
      })),
    )

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const filteredProducts = useMemo(() => {
    const value = search.trim().toLowerCase()

    if (!value) return products

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(value) ||
        product.sku?.toLowerCase().includes(value) ||
        product.category?.name.toLowerCase().includes(value),
    )
  }, [products, search])

  function updateInput(
    productId: string,
    field:
      | "salePriceInput"
      | "minimumStockInput"
      | "idealStockInput",
    value: string,
  ) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              [field]: value,
            }
          : product,
      ),
    )
  }

  async function saveProduct(product: EditableProduct) {
    setError("")
    setMessage("")

    const salePrice = Number(product.salePriceInput)
    const minimumStock = Number(product.minimumStockInput)
    const idealStock = Number(product.idealStockInput)

    if (
      !Number.isFinite(salePrice) ||
      salePrice < 0 ||
      !Number.isFinite(minimumStock) ||
      minimumStock < 0 ||
      !Number.isFinite(idealStock) ||
      idealStock < 0
    ) {
      setError(`Revisa los valores de ${product.name}.`)
      return
    }

    if (idealStock > 0 && idealStock < minimumStock) {
      setError(
        `El stock ideal de ${product.name} no puede ser menor al stock mínimo.`,
      )
      return
    }

    setSavingId(product.id)

    const { error: updateError } = await supabase
      .from("products")
      .update({
        sale_price: salePrice,
        minimum_stock: minimumStock,
        ideal_stock: idealStock,
      })
      .eq("id", product.id)

    if (updateError) {
      setError(updateError.message)
      setSavingId(null)
      return
    }

    setProducts((current) =>
      current.map((item) =>
        item.id === product.id
          ? {
              ...item,
              sale_price: salePrice,
              minimum_stock: minimumStock,
              ideal_stock: idealStock,
            }
          : item,
      ),
    )

    setMessage(`${product.name} se actualizó correctamente.`)
    setSavingId(null)
  }

  return (
    <AppShell
      title="Productos"
      description="Precios de venta y niveles de inventario."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              <h2 className="text-lg font-semibold">
                Catálogo de productos
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {filteredProducts.length} productos
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto, SKU o categoría"
                className="pl-9"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadProducts()}
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
                  <th className="px-5 py-4 font-medium">Costo promedio</th>
                  <th className="px-5 py-4 font-medium">Existencia</th>
                  <th className="px-5 py-4 font-medium">Precio de venta</th>
                  <th className="px-5 py-4 font-medium">Stock mínimo</th>
                  <th className="px-5 py-4 font-medium">Stock ideal</th>
                  <th className="px-5 py-4 font-medium">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => {
                  const margin =
                    Number(product.salePriceInput || 0) -
                    Number(product.purchase_price || 0)

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
                        <p>{money(product.purchase_price)}</p>
                        <p
                          className={`mt-1 text-xs ${
                            margin >= 0
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          Margen unitario: {money(margin)}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {Number(product.current_stock).toLocaleString(
                          "es-MX",
                          {
                            maximumFractionDigits: 3,
                          },
                        )}{" "}
                        {product.unit}
                      </td>

                      <td className="px-5 py-4">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={product.salePriceInput}
                          onChange={(event) =>
                            updateInput(
                              product.id,
                              "salePriceInput",
                              event.target.value,
                            )
                          }
                          className="w-32"
                        />
                      </td>

                      <td className="px-5 py-4">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={product.minimumStockInput}
                          onChange={(event) =>
                            updateInput(
                              product.id,
                              "minimumStockInput",
                              event.target.value,
                            )
                          }
                          className="w-32"
                        />
                      </td>

                      <td className="px-5 py-4">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={product.idealStockInput}
                          onChange={(event) =>
                            updateInput(
                              product.id,
                              "idealStockInput",
                              event.target.value,
                            )
                          }
                          className="w-32"
                        />
                      </td>

                      <td className="px-5 py-4">
                        <Button
                          type="button"
                          onClick={() => void saveProduct(product)}
                          disabled={savingId === product.id}
                        >
                          {savingId === product.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Guardar
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  )
}

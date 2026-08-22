"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Equal,
  Loader2,
  RefreshCw,
  Search,
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
  current_stock: number
  sale_price: number
}

type Adjustment = {
  id: string
  system_quantity: number
  counted_quantity: number
  difference_quantity: number
  adjustment_type: string
  adjusted_at: string
  product: {
    name: string
    unit: string
  } | null
  user: {
    full_name: string | null
  } | null
}

function quantity(value: number, unit: string) {
  return `${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} ${unit}`
}

function adjustmentLabel(type: string) {
  if (type === "increase") return "Aumento"
  if (type === "decrease") return "DisminuciÃ³n"

  return "Sin diferencia"
}

function AdjustmentIcon({
  type,
}: {
  type: string
}) {
  if (type === "increase") {
    return <ArrowUpRight className="h-4 w-4" />
  }

  if (type === "decrease") {
    return <ArrowDownRight className="h-4 w-4" />
  }

  return <Equal className="h-4 w-4" />
}

export default function AjustesInventarioPage() {
  const supabase = useMemo(() => createClient(), [])

  const [products, setProducts] = useState<Product[]>([])
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])

  const [productId, setProductId] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [salePrice, setSalePrice] = useState("")
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("Todos")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [productsResponse, adjustmentsResponse] =
      await Promise.all([
        supabase
          .from("products")
          .select("id, sku, name, unit, current_stock, sale_price")
          .eq("active", true)
          .order("name"),

        supabase
          .from("stock_adjustments")
          .select(`
            id,
            system_quantity,
            counted_quantity,
            difference_quantity,
            adjustment_type,
            adjusted_at,
            product:products (
              name,
              unit
            ),
            user:profiles!stock_adjustments_adjusted_by_fkey (
              full_name
            )
          `)
          .order("adjusted_at", {
            ascending: false,
          })
          .limit(300),
      ])

    const firstError =
      productsResponse.error || adjustmentsResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setProducts((productsResponse.data ?? []) as Product[])
    setAdjustments(
      (adjustmentsResponse.data ?? []) as unknown as Adjustment[],
    )
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData])

  const selectedProduct = products.find(
    (product) => product.id === productId,
  )


  const difference = adjustments.reduce(
    (total, adjustment) =>
      total +
      Number(
        adjustment.difference_quantity || 0,
      ),
    0,
  )
  const filteredAdjustments = useMemo(() => {
    const value = search.trim().toLowerCase()

    return adjustments.filter((adjustment) => {
      const matchesSearch =
        !value ||
        adjustment.product?.name.toLowerCase().includes(value) ||
        adjustment.user?.full_name?.toLowerCase().includes(value)

      const matchesType =
        typeFilter === "Todos" ||
        adjustment.adjustment_type === typeFilter

      return matchesSearch && matchesType
    })
  }, [adjustments, search, typeFilter])

  const summary = useMemo(() => {
    return adjustments.reduce(
      (totals, adjustment) => {
        totals.count += 1

        if (adjustment.adjustment_type === "increase") {
          totals.increases += 1
          totals.increaseQuantity += Number(
            adjustment.difference_quantity || 0,
          )
        }

        if (adjustment.adjustment_type === "decrease") {
          totals.decreases += 1
          totals.decreaseQuantity += Math.abs(
            Number(adjustment.difference_quantity || 0),
          )
        }

        return totals
      },
      {
        count: 0,
        increases: 0,
        decreases: 0,
        increaseQuantity: 0,
        decreaseQuantity: 0,
      },
    )
  }, [adjustments])

  function selectProductForEditing(
    product: Product,
  ) {
    setProductId(product.id)
    setProductSearch(product.name)
    setSalePrice(
      String(Number(product.sale_price || 0)),
    )
    setError("")
    setMessage("")
  }

  async function saveSalePrice() {
    setError("")
    setMessage("")

    if (!productId) {
      setError("Selecciona un producto.")
      return
    }

    const price = Number(salePrice)

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      setError(
        "Escribe un precio de venta vÃ¡lido.",
      )
      return
    }

    setSubmitting(true)

    const { error: updateError } =
      await supabase
        .from("products")
        .update({
          sale_price: Number(
            price.toFixed(2),
          ),
        })
        .eq("id", productId)

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              sale_price: Number(
                price.toFixed(2),
              ),
            }
          : product,
      ),
    )

    setMessage(
      "Precio de venta actualizado correctamente.",
    )

    setSubmitting(false)
  }

  async function deleteSelectedProduct() {
    setError("")
    setMessage("")

    if (!productId) {
      setError("Selecciona un producto.")
      return
    }

    const product = products.find(
      (item) => item.id === productId,
    )

    const confirmed = window.confirm(
      `Â¿Deseas eliminar ${
        product?.name ?? "este producto"
      }?`,
    )

    if (!confirmed) {
      return
    }

    setSubmitting(true)

    const { error: deleteError } =
      await supabase
        .from("products")
        .update({
          active: false,
        })
        .eq("id", productId)

    if (deleteError) {
      setError(deleteError.message)
      setSubmitting(false)
      return
    }

    setProducts((current) =>
      current.filter(
        (item) => item.id !== productId,
      ),
    )

    setProductId("")
    setProductSearch("")
    setSalePrice("")

    setMessage(
      "Producto eliminado correctamente.",
    )

    setSubmitting(false)
  }


  return (
    <AppShell
      title="Ajustes de inventario"
      description="Correcciones por conteo fÃ­sico con trazabilidad."
    >
      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          {message}
        </div>
      )}

      <div className="mb-6 flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadData()}
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
            <ClipboardCheck className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Ajustes registrados
          </p>

          <p className="mt-1 text-[24px] font-semibold tracking-tight">
            {summary.count}
          </p>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700">
            <ArrowUpRight className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-emerald-700">
            Aumentos
          </p>

          <p className="mt-1 text-[24px] font-semibold tracking-tight text-emerald-950">
            {summary.increases}
          </p>

          <p className="mt-1 text-xs text-emerald-700">
            +{summary.increaseQuantity.toLocaleString("es-MX", {
              maximumFractionDigits: 3,
            })}
          </p>
        </article>

        <article className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-red-700">
            <ArrowDownRight className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-red-700">
            Disminuciones
          </p>

          <p className="mt-1 text-[24px] font-semibold tracking-tight text-red-950">
            {summary.decreases}
          </p>

          <p className="mt-1 text-xs text-red-700">
            -{summary.decreaseQuantity.toLocaleString("es-MX", {
              maximumFractionDigits: 3,
            })}
          </p>
        </article>

        <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-slate-600">
            <Equal className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Diferencia actual
          </p>

          <p
            className={`mt-2 text-[28px] font-semibold tracking-tight ${
              difference > 0
                ? "text-emerald-700"
                : difference < 0
                  ? "text-red-700"
                  : ""
            }`}
          >
            {difference > 0 ? "+" : ""}
            {Number(difference || 0).toLocaleString("es-MX", {
              maximumFractionDigits: 3,
            })}
          </p>
        </article>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[400px_1fr]">
        <article className="rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-[#1f6a3a]" />

            <h2 className="text-lg font-semibold">
              Editar producto
            </h2>
          </div>

          <div className="mt-6 space-y-5">
            <div className="relative">
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Producto
              </p>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={productSearch}
                  onChange={(event) => {
                    setProductSearch(
                      event.target.value,
                    )
                    setProductId("")
                    setSalePrice("")
                  }}
                  placeholder="Escribe el nombre del producto"
                  className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#1f6a3a] focus:ring-4 focus:ring-[#1f6a3a]/10"
                />
              </div>

              {productSearch.trim() &&
                !productId && (
                  <div className="absolute left-0 right-0 top-[72px] z-30 max-h-64 overflow-y-auto rounded-xl border border-[#dce2d9] bg-white p-1 shadow-xl">
                    {products
                      .filter((product) => {
                        const term =
                          productSearch
                            .toLowerCase()
                            .trim()

                        return (
                          product.name
                            .toLowerCase()
                            .includes(term) ||
                          product.sku
                            ?.toLowerCase()
                            .includes(term)
                        )
                      })
                      .slice(0, 10)
                      .map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() =>
                            selectProductForEditing(
                              product,
                            )
                          }
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-[#f5f7f3]"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {product.name}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-400">
                              {product.sku ??
                                "Sin SKU"}
                            </p>
                          </div>

                          <span className="text-xs font-medium text-[#1f6a3a]">
                            {new Intl.NumberFormat(
                              "es-MX",
                              {
                                style:
                                  "currency",
                                currency:
                                  "MXN",
                              },
                            ).format(
                              Number(
                                product.sale_price ||
                                  0,
                              ),
                            )}
                          </span>
                        </button>
                      ))}

                    {products.filter(
                      (product) => {
                        const term =
                          productSearch
                            .toLowerCase()
                            .trim()

                        return (
                          product.name
                            .toLowerCase()
                            .includes(term) ||
                          product.sku
                            ?.toLowerCase()
                            .includes(term)
                        )
                      },
                    ).length === 0 && (
                      <p className="px-3 py-4 text-center text-sm text-slate-400">
                        No se encontraron productos.
                      </p>
                    )}
                  </div>
                )}
            </div>

            {selectedProduct && (
              <div className="rounded-2xl bg-[#f5f7f3] p-4">
                <p className="font-semibold">
                  {selectedProduct.name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {selectedProduct.sku ??
                    "Sin SKU"}{" "}
                  Â· {selectedProduct.unit}
                </p>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Precio de venta
              </p>

              <Input
                type="number"
                min="0"
                step="0.01"
                value={salePrice}
                disabled={!productId}
                onChange={(event) =>
                  setSalePrice(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void saveSalePrice()
                  }
                }}
                placeholder="0.00"
                className="h-11 rounded-xl"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                void saveSalePrice()
              }
              disabled={
                submitting || !productId
              }
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#102019] text-sm font-semibold text-white hover:bg-[#174f2d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Guardando..."
                : "Guardar precio"}
            </button>

            <button
              type="button"
              onClick={() =>
                void deleteSelectedProduct()
              }
              disabled={
                submitting || !productId
              }
              className="flex h-11 w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Eliminar producto
            </button>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-[#dde2da] bg-white shadow-sm">
          <div className="border-b border-[#e6eae4] p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Historial de ajustes
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredAdjustments.length} registros
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
                    placeholder="Buscar producto, motivo o usuario"
                    className="h-10 w-full rounded-xl border border-[#dce2d9] bg-[#f8f9f6] pl-9 pr-3 text-sm outline-none focus:border-[#1f6a3a] focus:bg-white"
                  />
                </div>

                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value)
                  }
                  className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none"
                >
                  <option value="Todos">Todos</option>
                  <option value="increase">Aumentos</option>
                  <option value="decrease">
                    Disminuciones
                  </option>
                  <option value="no_change">
                    Sin diferencia
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
              <table className="w-full min-w-[1050px] text-left">
                <thead className="sticky top-0 z-10 bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Fecha</th>
                    <th className="px-5 py-3.5">Producto</th>
                    <th className="px-5 py-3.5">Sistema</th>
                    <th className="px-5 py-3.5">Contado</th>
                    <th className="px-5 py-3.5">Diferencia</th>
                    <th className="px-5 py-3.5">Tipo</th>
                    <th className="px-5 py-3.5">Motivo</th>
                    <th className="px-5 py-3.5">Usuario</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf0eb]">
                  {filteredAdjustments.map((adjustment) => (
                    <tr
                      key={adjustment.id}
                      className="transition-colors hover:bg-[#f7f9f5]"
                    >
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(
                          adjustment.adjusted_at,
                        ).toLocaleString("es-MX")}
                      </td>

                      <td className="px-6 py-4 font-medium">
                        {adjustment.product?.name ?? "Producto"}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {quantity(
                          adjustment.system_quantity,
                          adjustment.product?.unit ?? "",
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {quantity(
                          adjustment.counted_quantity,
                          adjustment.product?.unit ?? "",
                        )}
                      </td>

                      <td
                        className={`px-6 py-4 font-semibold ${
                          adjustment.difference_quantity < 0
                            ? "text-red-700"
                            : adjustment.difference_quantity > 0
                              ? "text-emerald-700"
                              : ""
                        }`}
                      >
                        {adjustment.difference_quantity > 0
                          ? "+"
                          : ""}
                        {quantity(
                          adjustment.difference_quantity,
                          adjustment.product?.unit ?? "",
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                            adjustment.adjustment_type ===
                            "increase"
                              ? "bg-emerald-50 text-emerald-700"
                              : adjustment.adjustment_type ===
                                  "decrease"
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <AdjustmentIcon
                            type={adjustment.adjustment_type}
                          />

                          {adjustmentLabel(
                            adjustment.adjustment_type,
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm">
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {adjustment.user?.full_name ?? "Usuario"}
                      </td>
                    </tr>
                  ))}

                  {filteredAdjustments.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-14 text-center"
                      >
                        <ClipboardCheck className="mx-auto h-8 w-8 text-slate-300" />

                        <p className="mt-4 text-sm font-medium text-slate-600">
                          No se encontraron ajustes
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </AppShell>
  )
}

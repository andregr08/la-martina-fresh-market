"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  CheckCircle2,
  Loader2,
  Minus,
  PackagePlus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBasket,
  Trash2,
  Truck,
  WalletCards,
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
  category: {
    name: string
  } | null
}

type Supplier = {
  id: string
  name: string
}

type PurchaseItem = {
  product_id: string
  name: string
  sku: string | null
  unit: string
  quantity: number
  unit_cost: number
}

type PurchaseResult = {
  success: boolean
  purchase_id: string
  folio: string
  merchandise_subtotal: number
  logistics_total: number
  total: number
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

export default function EntradasPage() {
  const supabase = useMemo(() => createClient(), [])

  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [items, setItems] = useState<PurchaseItem[]>([])

  const [search, setSearch] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentStatus, setPaymentStatus] = useState("paid")

  const [transportCost, setTransportCost] = useState("0")
  const [parkingCost, setParkingCost] = useState("0")
  const [loaderCost, setLoaderCost] = useState("0")
  const [otherCosts, setOtherCosts] = useState("0")
  const [notes, setNotes] = useState("")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [productsResponse, suppliersResponse] =
      await Promise.all([
        supabase
          .from("products")
          .select(`
            id,
            sku,
            name,
            unit,
            purchase_price,
            category:categories (
              name
            )
          `)
          .eq("active", true)
          .order("name"),

        supabase
          .from("suppliers")
          .select("id, name")
          .eq("active", true)
          .order("name"),
      ])

    const firstError =
      productsResponse.error || suppliersResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const loadedProducts =
      (productsResponse.data ?? []) as unknown as Product[]

    const loadedSuppliers =
      (suppliersResponse.data ?? []) as Supplier[]

    setProducts(loadedProducts)
    setSuppliers(loadedSuppliers)

    const defaultSupplier = loadedSuppliers.find((supplier) =>
      supplier.name
        .toLowerCase()
        .includes("la martina distribuidora"),
    )

    if (defaultSupplier) {
      setSupplierId(defaultSupplier.id)
    } else if (loadedSuppliers.length > 0) {
      setSupplierId(loadedSuppliers[0].id)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

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

  const merchandiseSubtotal = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total + item.quantity * item.unit_cost,
        0,
      ),
    [items],
  )

  const logisticsTotal =
    Math.max(Number(transportCost || 0), 0) +
    Math.max(Number(parkingCost || 0), 0) +
    Math.max(Number(loaderCost || 0), 0) +
    Math.max(Number(otherCosts || 0), 0)

  const total = merchandiseSubtotal + logisticsTotal

  function addProduct(product: Product) {
    setError("")
    setMessage("")

    setItems((current) => {
      const existing = current.find(
        (item) => item.product_id === product.id,
      )

      if (existing) return current

      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          quantity: 1,
          unit_cost: Number(product.purchase_price || 0),
        },
      ]
    })

    setSearch("")
  }

  function updateQuantity(
    productId: string,
    value: number,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity: Math.max(
                Number(value.toFixed(3)),
                0.001,
              ),
            }
          : item,
      ),
    )
  }

  function updateCost(
    productId: string,
    value: number,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              unit_cost: Math.max(value, 0),
            }
          : item,
      ),
    )
  }

  function removeItem(productId: string) {
    setItems((current) =>
      current.filter(
        (item) => item.product_id !== productId,
      ),
    )
  }

  function clearForm() {
    setItems([])
    setTransportCost("0")
    setParkingCost("0")
    setLoaderCost("0")
    setOtherCosts("0")
    setNotes("")
    setPaymentMethod("cash")
    setPaymentStatus("paid")
  }

  async function registerPurchase() {
    setError("")
    setMessage("")

    if (!supplierId) {
      setError("Selecciona un proveedor.")
      return
    }

    if (items.length === 0) {
      setError("Agrega al menos un producto.")
      return
    }

    const invalidItem = items.find(
      (item) =>
        item.quantity <= 0 ||
        item.unit_cost < 0,
    )

    if (invalidItem) {
      setError(
        `Revisa cantidad y costo de ${invalidItem.name}.`,
      )
      return
    }

    setSubmitting(true)

    const { data, error: rpcError } = await supabase.rpc(
      "register_purchase",
      {
        p_items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
        })),
        p_transport_cost: Number(transportCost || 0),
        p_parking_cost: Number(parkingCost || 0),
        p_loader_cost: Number(loaderCost || 0),
        p_other_costs: Number(otherCosts || 0),
        p_payment_method: paymentMethod,
        p_payment_status: paymentStatus,
        p_notes: notes.trim() || null,
        p_supplier_id: supplierId,
        p_branch_id: null,
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }

    const result = data as PurchaseResult

    setMessage(
      `Entrada ${result.folio} registrada por ${money(
        result.total,
      )}.`,
    )

    clearForm()
    setSubmitting(false)
  }

  return (
    <AppShell
      title="Entradas"
      description="Recepción de mercancía, costos y actualización de inventario."
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

      <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
        <section className="overflow-hidden rounded-[24px] border border-[#dde2da] bg-white shadow-sm">
          <div className="border-b border-[#e6eae4] p-5">
            <div className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-[#1f6a3a]" />

              <h2 className="text-lg font-semibold">
                Agregar productos
              </h2>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar producto, SKU o categoría"
                className="h-12 w-full rounded-2xl border border-[#dce2d9] bg-[#f8f9f6] pl-12 pr-4 text-sm outline-none focus:border-[#1f6a3a] focus:bg-white focus:ring-4 focus:ring-[#1f6a3a]/10"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[460px] items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#1f6a3a]" />
            </div>
          ) : (
            <div className="grid max-h-[650px] gap-3 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => {
                const added = items.some(
                  (item) =>
                    item.product_id === product.id,
                )

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    disabled={added}
                    className="rounded-2xl border border-[#e0e5dd] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#9db4a3] hover:shadow-md disabled:cursor-not-allowed disabled:bg-[#f7f8f5] disabled:opacity-60"
                  >
                    <p className="font-semibold">
                      {product.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {product.sku ?? "Sin SKU"} ·{" "}
                      {product.category?.name ??
                        "Sin categoría"}
                    </p>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[#1f6a3a]">
                          {money(product.purchase_price)}
                        </p>

                        <p className="text-xs text-slate-400">
                          costo actual / {product.unit}
                        </p>
                      </div>

                      {added && (
                        <span className="rounded-full bg-[#e8f3eb] px-3 py-1 text-xs font-medium text-[#1f6a3a]">
                          Agregado
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full flex min-h-80 flex-col items-center justify-center text-center">
                  <ShoppingBasket className="h-8 w-8 text-slate-300" />

                  <p className="mt-4 text-sm font-medium text-slate-600">
                    No se encontraron productos.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="flex flex-col overflow-hidden rounded-[24px] border border-[#dde2da] bg-white shadow-sm">
          <div className="border-b border-[#e6eae4] px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  Entrada actual
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {items.length} productos
                </p>
              </div>

              <button
                type="button"
                onClick={clearForm}
                className="rounded-xl px-3 py-2 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-700"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="max-h-[420px] flex-1 divide-y divide-[#edf0eb] overflow-y-auto">
            {items.map((item) => (
              <article
                key={item.product_id}
                className="p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {item.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {item.sku ?? "Sin SKU"} · {item.unit}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeItem(item.product_id)
                    }
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Cantidad
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.product_id,
                            item.quantity - 0.1,
                          )
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe4dc]"
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={item.quantity}
                        onChange={(event) =>
                          updateQuantity(
                            item.product_id,
                            Number(event.target.value),
                          )
                        }
                        className="h-9 min-w-0 flex-1 rounded-xl border border-[#dfe4dc] px-2 text-center text-sm"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.product_id,
                            item.quantity + 0.1,
                          )
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe4dc]"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Costo por {item.unit}
                    </p>

                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_cost}
                      onChange={(event) =>
                        updateCost(
                          item.product_id,
                          Number(event.target.value),
                        )
                      }
                      className="h-9 rounded-xl"
                    />
                  </div>
                </div>

                <p className="mt-3 text-right font-semibold">
                  {money(
                    item.quantity * item.unit_cost,
                  )}
                </p>
              </article>
            ))}

            {items.length === 0 && (
              <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
                <ShoppingBasket className="h-8 w-8 text-slate-300" />

                <p className="mt-4 font-medium">
                  Entrada vacía
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Agrega productos para continuar.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-[#e6eae4] p-5">
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Proveedor
              </p>

              <select
                value={supplierId}
                onChange={(event) =>
                  setSupplierId(event.target.value)
                }
                className="h-10 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
              >
                <option value="">
                  Selecciona un proveedor
                </option>

                {suppliers.map((supplier) => (
                  <option
                    key={supplier.id}
                    value={supplier.id}
                  >
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Método de pago
                </p>

                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value)
                  }
                  className="h-10 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
                >
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">
                    Transferencia
                  </option>
                  <option value="credit">Crédito</option>
                </select>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Estado
                </p>

                <select
                  value={paymentStatus}
                  onChange={(event) =>
                    setPaymentStatus(event.target.value)
                  }
                  className="h-10 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
                >
                  <option value="paid">Pagado</option>
                  <option value="pending">Pendiente</option>
                  <option value="partial">Parcial</option>
                </select>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[#e1e6de] bg-[#f8f9f6] p-4">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-[#1f6a3a]" />

                <p className="text-sm font-semibold">
                  Costos logísticos
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-xs text-slate-500">
                    Transporte
                  </p>

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={transportCost}
                    onChange={(event) =>
                      setTransportCost(
                        event.target.value,
                      )
                    }
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs text-slate-500">
                    Estacionamiento
                  </p>

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={parkingCost}
                    onChange={(event) =>
                      setParkingCost(
                        event.target.value,
                      )
                    }
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs text-slate-500">
                    Diablero
                  </p>

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={loaderCost}
                    onChange={(event) =>
                      setLoaderCost(event.target.value)
                    }
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs text-slate-500">
                    Otros
                  </p>

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={otherCosts}
                    onChange={(event) =>
                      setOtherCosts(event.target.value)
                    }
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Observaciones
              </p>

              <Input
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Opcional"
                className="rounded-xl"
              />
            </div>

            <div className="mt-4 rounded-2xl bg-[#f5f7f3] p-4">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Mercancía</span>
                <span>{money(merchandiseSubtotal)}</span>
              </div>

              <div className="mt-2 flex justify-between text-sm text-slate-500">
                <span>Logística</span>
                <span>{money(logisticsTotal)}</span>
              </div>

              <div className="mt-3 flex items-end justify-between border-t border-[#dfe4dc] pt-3">
                <span className="font-medium">
                  Total
                </span>

                <span className="text-3xl font-semibold tracking-tight">
                  {money(total)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void registerPurchase()}
              disabled={
                submitting || items.length === 0
              }
              className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#102019] text-sm font-semibold text-white transition hover:bg-[#174f2d] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ReceiptText className="h-5 w-5" />
              )}

              Registrar entrada
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  )
}

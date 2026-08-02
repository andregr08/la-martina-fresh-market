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
  Plus,
  ReceiptText,
  Search,
  ShoppingBasket,
  Trash2,
  Truck,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
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

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value ?? 0))
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export default function EntradasPage() {
  const supabase = useMemo(() => createClient(), [])

  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [items, setItems] = useState<PurchaseItem[]>([])

  const [search, setSearch] = useState("")
  const [selectedProductId, setSelectedProductId] =
    useState("")
  const [draftQuantity, setDraftQuantity] = useState("")
  const [draftCost, setDraftCost] = useState("")

  const [supplierId, setSupplierId] = useState("")
  const [paymentMethod, setPaymentMethod] =
    useState("cash")
  const [paymentStatus, setPaymentStatus] =
    useState("paid")

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

    if (!supplierId && loadedSuppliers.length > 0) {
      setSupplierId(loadedSuppliers[0].id)
    }

    setLoading(false)
  }, [supabase, supplierId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData])

  const productMatches = useMemo(() => {
    const term = normalizeText(search)

    if (!term || selectedProductId) {
      return []
    }

    return products
      .filter((product) => {
        const searchable = normalizeText(
          [
            product.name,
            product.sku ?? "",
            product.category?.name ?? "",
          ].join(" "),
        )

        return searchable.includes(term)
      })
      .slice(0, 10)
  }, [products, search, selectedProductId])

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

  function selectProduct(product: Product) {
    setSelectedProductId(product.id)
    setSearch(product.name)
    setDraftCost(
      Number(product.purchase_price || 0) > 0
        ? String(Number(product.purchase_price))
        : "",
    )
    setError("")
    setMessage("")
  }

  function addDraftProduct() {
    setError("")
    setMessage("")

    const product =
      products.find(
        (item) => item.id === selectedProductId,
      ) ??
      products.find(
        (item) =>
          normalizeText(item.name) ===
          normalizeText(search),
      )

    if (!product) {
      setError("Selecciona un producto de la lista.")
      return
    }

    const quantity = Number(draftQuantity)
    const unitCost = Number(draftCost)

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Escribe una cantidad válida de kilos.")
      return
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setError("Escribe un costo válido por kilo.")
      return
    }

    setItems((current) => {
      const existing = current.find(
        (item) => item.product_id === product.id,
      )

      if (existing) {
        return current.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: Number(
                  (
                    item.quantity + quantity
                  ).toFixed(3),
                ),
                unit_cost: unitCost,
              }
            : item,
        )
      }

      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          quantity: Number(quantity.toFixed(3)),
          unit_cost: unitCost,
        },
      ]
    })

    setSearch("")
    setSelectedProductId("")
    setDraftQuantity("")
    setDraftCost("")
  }

  function updateQuantity(
    productId: string,
    value: number,
  ) {
    if (!Number.isFinite(value)) return

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
    if (!Number.isFinite(value)) return

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
    setSearch("")
    setSelectedProductId("")
    setDraftQuantity("")
    setDraftCost("")
    setTransportCost("0")
    setParkingCost("0")
    setLoaderCost("0")
    setOtherCosts("0")
    setNotes("")
    setPaymentMethod("cash")
    setPaymentStatus("paid")
    setError("")
    setMessage("")
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

    const { error: rpcError } = await supabase.rpc(
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

    clearForm()
    setMessage("Entrada registrada correctamente.")
    setSubmitting(false)
    await loadData()
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

      <section className="overflow-hidden rounded-2xl border border-[#dde2da] bg-white shadow-sm">
        <div className="border-b border-[#e6eae4] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">
                Entrada actual
              </h2>
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

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(280px,1fr)_150px_180px_130px]">
            <div className="relative">
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Producto
              </p>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  disabled={loading}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setSelectedProductId("")
                  }}
                  placeholder="Escribe papa, limón, cebolla..."
                  className="h-11 w-full rounded-xl border border-[#dce2d9] pl-10 pr-3 text-sm outline-none focus:border-[#1f6a3a] focus:ring-4 focus:ring-[#1f6a3a]/10"
                />
              </div>

              {productMatches.length > 0 && (
                <div className="absolute left-0 right-0 top-[72px] z-30 max-h-64 overflow-y-auto rounded-xl border border-[#dce2d9] bg-white p-1 shadow-xl">
                  {productMatches.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() =>
                        selectProduct(product)
                      }
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-[#f5f7f3]"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {product.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {product.sku ?? "Sin SKU"}
                        </p>
                      </div>

                      <span className="text-xs text-slate-400">
                        {money(product.purchase_price)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Kilos
              </p>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={draftQuantity}
                onChange={(event) =>
                  setDraftQuantity(event.target.value)
                }
                placeholder="0.000"
                className="h-11 rounded-xl"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Costo por kilo
              </p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={draftCost}
                onChange={(event) =>
                  setDraftCost(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addDraftProduct()
                  }
                }}
                placeholder="0.00"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={addDraftProduct}
                className="h-11 w-full rounded-xl bg-[#102019] text-sm font-semibold text-white hover:bg-[#174f2d]"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-[#edf0eb]">
          {items.map((item) => (
            <article
              key={item.product_id}
              className="grid gap-4 p-4 md:grid-cols-[minmax(180px,1fr)_220px_180px_130px_42px] md:items-end"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {item.sku ?? "Sin SKU"} · {item.unit}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-xs text-slate-500">
                  Kilos
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(
                        item.product_id,
                        item.quantity - 1,
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <Input
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
                    className="h-10 text-center"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(
                        item.product_id,
                        item.quantity + 1,
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs text-slate-500">
                  Costo por kilo
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
                  className="h-10"
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs text-slate-500">
                  Importe
                </p>
                <div className="flex h-10 items-center rounded-xl bg-[#f5f7f3] px-3 font-semibold">
                  {money(
                    item.quantity * item.unit_cost,
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  removeItem(item.product_id)
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </article>
          ))}

          {items.length === 0 && (
            <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
              <ShoppingBasket className="h-8 w-8 text-slate-300" />
              <p className="mt-4 font-medium">
                Entrada vacía
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Busca un producto y agrégalo arriba.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-[#e6eae4] p-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <p className="mb-1.5 text-xs text-slate-500">
                Proveedor
              </p>
              <select
                value={supplierId}
                onChange={(event) =>
                  setSupplierId(event.target.value)
                }
                className="h-11 w-full rounded-xl border px-3 text-sm"
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

            <div>
              <p className="mb-1.5 text-xs text-slate-500">
                Método de pago
              </p>
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value)
                }
                className="h-11 w-full rounded-xl border px-3 text-sm"
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
              <p className="mb-1.5 text-xs text-slate-500">
                Estado
              </p>
              <select
                value={paymentStatus}
                onChange={(event) =>
                  setPaymentStatus(event.target.value)
                }
                className="h-11 w-full rounded-xl border px-3 text-sm"
              >
                <option value="paid">Pagado</option>
                <option value="pending">Pendiente</option>
              </select>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border bg-[#f8f9f6] p-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-[#1f6a3a]" />
              <p className="text-sm font-semibold">
                Costos logísticos
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                type="number"
                min="0"
                value={transportCost}
                onChange={(event) =>
                  setTransportCost(event.target.value)
                }
                placeholder="Transporte"
              />
              <Input
                type="number"
                min="0"
                value={parkingCost}
                onChange={(event) =>
                  setParkingCost(event.target.value)
                }
                placeholder="Estacionamiento"
              />
              <Input
                type="number"
                min="0"
                value={loaderCost}
                onChange={(event) =>
                  setLoaderCost(event.target.value)
                }
                placeholder="Diablero"
              />
              <Input
                type="number"
                min="0"
                value={otherCosts}
                onChange={(event) =>
                  setOtherCosts(event.target.value)
                }
                placeholder="Otros"
              />
            </div>
          </div>

          <Input
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="Observaciones opcionales"
            className="mt-4"
          />

          <div className="mt-5 rounded-2xl bg-[#f5f7f3] p-4">
            <div className="flex justify-between text-sm">
              <span>Mercancía</span>
              <span>{money(merchandiseSubtotal)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span>Logística</span>
              <span>{money(logisticsTotal)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t pt-3">
              <span className="font-medium">Total</span>
              <span className="text-2xl font-semibold">
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
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#102019] text-sm font-semibold text-white hover:bg-[#174f2d] disabled:opacity-50"
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
    </AppShell>
  )
}

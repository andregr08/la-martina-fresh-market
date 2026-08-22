"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  Banknote,
  CreditCard,
  Landmark,
  Loader2,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import {
  TicketBranding,
  TicketFooter,
} from "@/components/tickets/ticket-branding"
import { useBusinessSettings } from "@/hooks/use-business-settings"
import { createClient } from "@/lib/supabase/client"

type RestaurantVariant = {
  id: string
  restaurant_product_id: string
  name: string
  sale_price: number
  sort_order: number
}

type RestaurantProduct = {
  id: string
  name: string
  category: string
  description: string | null
  sort_order: number
  variants: RestaurantVariant[]
}

type CartItem = {
  variant_id: string
  restaurant_product_id: string
  product_name: string
  variant_name: string
  quantity: number
  unit_price: number
}

type SaleResult = {
  success: boolean
  sale_type: string
  sale_id: string
  folio: string
  ticket_id: string
  ticket_number: string
  subtotal: number
  discount: number
  total: number
  total_cost: number
  profit: number
  payment_method: string
  items_count: number
  cash_register_id: string
  sold_at: string
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatQuantity(value: number) {
  const number = Number(value || 0)

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(2)
}

export default function RestaurantePage() {
  const supabase = useMemo(() => createClient(), [])
  const { settings } = useBusinessSettings()

  const [products, setProducts] = useState<RestaurantProduct[]>([])
  const [cart, setCart] = useState<CartItem[]>([])

  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Todos")

  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "card" | "transfer"
  >("cash")

  const [discount, setDiscount] = useState("0")
  const [cashReceived, setCashReceived] = useState("")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const [lastSale, setLastSale] =
    useState<SaleResult | null>(null)

  const [lastSaleItems, setLastSaleItems] =
    useState<CartItem[]>([])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError("")

    const [
      productsResponse,
      variantsResponse,
    ] = await Promise.all([
      supabase
        .from("restaurant_products")
        .select(`
          id,
          name,
          category,
          description,
          sort_order
        `)
        .eq("active", true)
        .order("sort_order")
        .order("name"),

      supabase
        .from("restaurant_variants")
        .select(`
          id,
          restaurant_product_id,
          name,
          sale_price,
          sort_order
        `)
        .eq("active", true)
        .order("sort_order")
        .order("name"),
    ])

    const firstError =
      productsResponse.error ||
      variantsResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const rawProducts =
      (productsResponse.data ?? []) as Omit<
        RestaurantProduct,
        "variants"
      >[]

    const rawVariants =
      (variantsResponse.data ?? []) as RestaurantVariant[]

    const variantsByProduct = new Map<
      string,
      RestaurantVariant[]
    >()

    rawVariants.forEach((variant) => {
      const current =
        variantsByProduct.get(
          variant.restaurant_product_id,
        ) ?? []

      current.push({
        ...variant,
        sale_price: Number(
          variant.sale_price || 0,
        ),
      })

      variantsByProduct.set(
        variant.restaurant_product_id,
        current,
      )
    })

    const normalized =
      rawProducts.map((product) => ({
        ...product,
        variants:
          variantsByProduct.get(product.id) ??
          [],
      }))

    setProducts(normalized)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadProducts])

  const categories = useMemo(() => {
    return [
      "Todos",
      ...Array.from(
        new Set(
          products
            .map((product) =>
              product.category.trim(),
            )
            .filter(Boolean),
        ),
      ).sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    ]
  }, [products])

  const filteredProducts = useMemo(() => {
    const term = search
      .trim()
      .toLowerCase()

    return products.filter((product) => {
      const categoryMatches =
        category === "Todos" ||
        product.category === category

      const textMatches =
        !term ||
        product.name
          .toLowerCase()
          .includes(term) ||
        product.category
          .toLowerCase()
          .includes(term) ||
        (product.description ?? "")
          .toLowerCase()
          .includes(term)

      return categoryMatches && textMatches
    })
  }, [products, search, category])

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (total, item) =>
          total +
          item.quantity *
            item.unit_price,
        0,
      ),
    [cart],
  )

  const discountAmount = useMemo(() => {
    const value = Number(discount)

    if (!Number.isFinite(value)) return 0
    if (value < 0) return 0

    return Math.min(value, subtotal)
  }, [discount, subtotal])

  const total = useMemo(
    () =>
      Math.max(
        0,
        subtotal - discountAmount,
      ),
    [subtotal, discountAmount],
  )

  const cashAmount =
    Number(cashReceived) || 0

  const change =
    paymentMethod === "cash"
      ? Math.max(0, cashAmount - total)
      : 0

  function addVariant(
    product: RestaurantProduct,
    variant: RestaurantVariant,
  ) {
    setError("")
    setMessage("")

    setCart((current) => {
      const existing =
        current.find(
          (item) =>
            item.variant_id === variant.id,
        )

      if (existing) {
        return current.map((item) =>
          item.variant_id === variant.id
            ? {
                ...item,
                quantity:
                  item.quantity + 1,
              }
            : item,
        )
      }

      return [
        ...current,
        {
          variant_id: variant.id,
          restaurant_product_id:
            product.id,
          product_name: product.name,
          variant_name: variant.name,
          quantity: 1,
          unit_price: Number(
            variant.sale_price || 0,
          ),
        },
      ]
    })
  }

  function changeQuantity(
    variantId: string,
    difference: number,
  ) {
    setCart((current) =>
      current
        .map((item) =>
          item.variant_id === variantId
            ? {
                ...item,
                quantity:
                  item.quantity +
                  difference,
              }
            : item,
        )
        .filter(
          (item) =>
            item.quantity > 0,
        ),
    )
  }

  function removeItem(variantId: string) {
    setCart((current) =>
      current.filter(
        (item) =>
          item.variant_id !== variantId,
      ),
    )
  }

  function clearSale() {
    if (cart.length === 0) return

    const confirmed =
      window.confirm(
        "¿Deseas limpiar la venta actual?",
      )

    if (!confirmed) return

    setCart([])
    setDiscount("0")
    setCashReceived("")
    setPaymentMethod("cash")
    setError("")
    setMessage("")
  }

  async function completeSale() {
    setError("")
    setMessage("")

    if (submitting) return

    if (cart.length === 0) {
      setError(
        "Agrega al menos un platillo.",
      )
      return
    }

    if (
      discountAmount >
      subtotal
    ) {
      setError(
        "El descuento no puede ser mayor al subtotal.",
      )
      return
    }

    if (
      paymentMethod === "cash" &&
      cashAmount < total
    ) {
      setError(
        "El efectivo recibido es menor al total.",
      )
      return
    }

    setSubmitting(true)

    const itemsAtSale =
      cart.map((item) => ({
        ...item,
      }))

    const {
      data,
      error: saleError,
    } = await supabase.rpc(
      "register_restaurant_sale",
      {
        p_items: cart.map(
          (item) => ({
            variant_id:
              item.variant_id,
            quantity:
              item.quantity,
          }),
        ),
        p_payment_method:
          paymentMethod,
        p_discount:
          discountAmount,
        p_notes:
          "Venta de restaurante",
      },
    )

    if (saleError) {
      setError(saleError.message)
      setSubmitting(false)
      return
    }

    const result =
      data as SaleResult

    setLastSale(result)
    setLastSaleItems(itemsAtSale)

    setCart([])
    setDiscount("0")
    setCashReceived("")
    setPaymentMethod("cash")

    setMessage(
      `Venta ${result.folio} registrada correctamente.`,
    )

    setSubmitting(false)
  }

  return (
    <AppShell
      title="Restaurante"
      description="Venta de platillos y consumo automático de ingredientes"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0 space-y-5">
          <div className="rounded-[24px] border border-[#dfe4dc] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef3ed] text-[#1f6a3a]">
                    <UtensilsCrossed className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-[#172018]">
                      Carta del restaurante
                    </h2>

                    <p className="text-sm text-slate-500">
                      Selecciona el platillo y su tamaño.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Buscar platillo..."
                  className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white pl-10 pr-4 text-sm outline-none transition focus:border-[#1f6a3a]"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {categories.map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      setCategory(item)
                    }
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                      category === item
                        ? "bg-[#102019] text-white"
                        : "border border-[#dce2d9] bg-white text-slate-600 hover:bg-[#f6f8f4]"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-64 items-center justify-center rounded-[24px] border border-[#dfe4dc] bg-white">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando carta...
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-[24px] border border-[#dfe4dc] bg-white px-6 text-center">
              <UtensilsCrossed className="mb-4 h-9 w-9 text-slate-300" />

              <p className="font-medium text-[#172018]">
                No hay platillos
              </p>

              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Los platillos que agreguemos desde Ajustes aparecerán aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {filteredProducts.map(
                (product) => (
                  <article
                    key={product.id}
                    className="rounded-[22px] border border-[#dfe4dc] bg-white p-5 shadow-sm"
                  >
                    <div className="min-h-[92px]">
                      <span className="inline-flex rounded-full bg-[#eef3ed] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#1f6a3a]">
                        {product.category}
                      </span>

                      <h3 className="mt-3 text-lg font-semibold tracking-tight text-[#172018]">
                        {product.name}
                      </h3>

                      {product.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                          {product.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 space-y-2">
                      {product.variants.length === 0 ? (
                        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          Sin tamaños configurados
                        </div>
                      ) : (
                        product.variants.map(
                          (variant) => (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() =>
                                addVariant(
                                  product,
                                  variant,
                                )
                              }
                              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[#dce2d9] px-3 py-2 text-left transition hover:border-[#1f6a3a] hover:bg-[#f6f8f4]"
                            >
                              <div>
                                <p className="text-sm font-medium text-[#172018]">
                                  {variant.name}
                                </p>

                                <p className="text-xs text-slate-400">
                                  Agregar
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[#1f6a3a]">
                                  {money(
                                    variant.sale_price,
                                  )}
                                </span>

                                <Plus className="h-4 w-4" />
                              </div>
                            </button>
                          ),
                        )
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <aside className="min-w-0">
          <div className="sticky top-[102px] overflow-hidden rounded-[24px] border border-[#dfe4dc] bg-white shadow-sm">
            <div className="border-b border-[#e4e8e1] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#102019] text-white">
                    <ShoppingBag className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="font-semibold text-[#172018]">
                      Venta actual
                    </h2>

                    <p className="text-xs text-slate-500">
                      {cart.reduce(
                        (totalItems, item) =>
                          totalItems +
                          item.quantity,
                        0,
                      )}{" "}
                      platillos
                    </p>
                  </div>
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSale}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    title="Limpiar venta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[350px] overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
                  <ShoppingBag className="mb-3 h-8 w-8 text-slate-200" />

                  <p className="text-sm font-medium text-slate-500">
                    Venta vacía
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Selecciona un tamaño para agregarlo.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#edf0eb]">
                  {cart.map(
                    (item) => (
                      <div
                        key={item.variant_id}
                        className="p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#172018]">
                              {item.product_name}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {item.variant_name} ·{" "}
                              {money(
                                item.unit_price,
                              )}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeItem(
                                item.variant_id,
                              )
                            }
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center rounded-xl border border-[#dce2d9]">
                            <button
                              type="button"
                              onClick={() =>
                                changeQuantity(
                                  item.variant_id,
                                  -1,
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>

                            <span className="min-w-8 text-center text-sm font-semibold">
                              {formatQuantity(
                                item.quantity,
                              )}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                changeQuantity(
                                  item.variant_id,
                                  1,
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <span className="text-sm font-semibold text-[#172018]">
                            {money(
                              item.quantity *
                                item.unit_price,
                            )}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-[#e4e8e1] p-5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Descuento
              </label>

              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(event) =>
                    setDiscount(
                      event.target.value,
                    )
                  }
                  className="h-11 w-full rounded-xl border border-[#dce2d9] pl-7 pr-3 text-sm outline-none focus:border-[#1f6a3a]"
                />
              </div>

              <div className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>

                <div className="flex justify-between text-slate-500">
                  <span>Descuento</span>
                  <span>
                    -{money(discountAmount)}
                  </span>
                </div>

                <div className="flex justify-between border-t border-[#e4e8e1] pt-3 text-xl font-semibold text-[#172018]">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Método de pago
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentMethod(
                        "cash",
                      )
                    }
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition ${
                      paymentMethod ===
                      "cash"
                        ? "border-[#102019] bg-[#102019] text-white"
                        : "border-[#dce2d9] text-slate-600"
                    }`}
                  >
                    <Banknote className="h-5 w-5" />
                    Efectivo
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPaymentMethod(
                        "card",
                      )
                    }
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition ${
                      paymentMethod ===
                      "card"
                        ? "border-[#102019] bg-[#102019] text-white"
                        : "border-[#dce2d9] text-slate-600"
                    }`}
                  >
                    <CreditCard className="h-5 w-5" />
                    Tarjeta
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPaymentMethod(
                        "transfer",
                      )
                    }
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition ${
                      paymentMethod ===
                      "transfer"
                        ? "border-[#102019] bg-[#102019] text-white"
                        : "border-[#dce2d9] text-slate-600"
                    }`}
                  >
                    <Landmark className="h-5 w-5" />
                    Transfer.
                  </button>
                </div>
              </div>

              {paymentMethod === "cash" && (
                <div className="mt-4">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Efectivo recibido
                  </label>

                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      $
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashReceived}
                      onChange={(event) =>
                        setCashReceived(
                          event.target.value,
                        )
                      }
                      className="h-11 w-full rounded-xl border border-[#dce2d9] pl-7 pr-3 text-sm outline-none focus:border-[#1f6a3a]"
                    />
                  </div>

                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-slate-500">
                      Cambio
                    </span>

                    <span className="font-semibold text-[#1f6a3a]">
                      {money(change)}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={
                  submitting ||
                  cart.length === 0
                }
                onClick={() =>
                  void completeSale()
                }
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#102019] text-sm font-semibold text-white transition hover:bg-[#173426] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <UtensilsCrossed className="h-5 w-5" />
                    Cobrar {money(total)}
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {lastSale && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm print:static print:block print:bg-white print:p-0">
          <section className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 text-black shadow-2xl print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:p-0">
            <div className="mb-4 flex justify-end print:hidden">
              <button
                type="button"
                onClick={() =>
                  setLastSale(null)
                }
                className="rounded-xl border border-[#dfe4dc] p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <TicketBranding
              settings={settings}
            />

            <div className="my-5 border-y border-dashed border-black py-3 text-sm">
              <p>
                Ticket:{" "}
                {lastSale.ticket_number}
              </p>

              <p>
                Venta: {lastSale.folio}
              </p>

              <p>Área: Restaurante</p>

              <p>
                Fecha:{" "}
                {new Date(
                  lastSale.sold_at,
                ).toLocaleString(
                  "es-MX",
                )}
              </p>
            </div>

            <div className="space-y-3 text-sm">
              {lastSaleItems.map(
                (item) => (
                  <div
                    key={
                      item.variant_id
                    }
                  >
                    <p className="font-medium">
                      {item.product_name}
                    </p>

                    <p className="text-xs">
                      {item.variant_name}
                    </p>

                    <div className="flex justify-between">
                      <span>
                        {formatQuantity(
                          item.quantity,
                        )}{" "}
                        ×{" "}
                        {money(
                          item.unit_price,
                        )}
                      </span>

                      <span>
                        {money(
                          item.quantity *
                            item.unit_price,
                        )}
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>

            <div className="my-5 space-y-2 border-y border-dashed border-black py-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>
                  {money(
                    lastSale.subtotal,
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Descuento</span>
                <span>
                  -
                  {money(
                    lastSale.discount,
                  )}
                </span>
              </div>

              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>
                  {money(lastSale.total)}
                </span>
              </div>
            </div>

            <TicketFooter
              settings={settings}
            />

            <button
              type="button"
              onClick={() =>
                window.print()
              }
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#102019] text-sm font-semibold text-white print:hidden"
            >
              <Printer className="h-4 w-4" />
              Imprimir ticket
            </button>
          </section>
        </div>
      )}
    </AppShell>
  )
}
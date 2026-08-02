"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingBasket,
  Smartphone,
  Trash2,
  X,
  Zap,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import {
  TicketBranding,
  TicketFooter,
} from "@/components/tickets/ticket-branding"
import { Input } from "@/components/ui/input"
import { useBusinessSettings } from "@/hooks/use-business-settings"
import { createClient } from "@/lib/supabase/client"

type Product = {
  id: string
  sku: string | null
  name: string
  unit: string
  sale_price: number
  current_stock: number
  category: {
    name: string
  } | null
}

type CartItem = {
  product_id: string
  name: string
  unit: string
  quantity: number
  unit_price: number
  available_stock: number
}

type SaleResult = {
  success: boolean
  sale_id: string
  folio: string
  ticket_number: string
  subtotal: number
  discount: number
  total: number
  payment_method: string
  sold_at: string
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


type WeightMode = "kg" | "g"

type ProductSaleCardProps = {
  product: Product
  inCartQuantity: number
  onAdd: (product: Product, quantityKg: number) => void
}

function ProductSaleCard({
  product,
  inCartQuantity,
  onAdd,
}: ProductSaleCardProps) {
  const [mode, setMode] = useState<WeightMode>("kg")
  const [amount, setAmount] = useState("1")

  const stock = Number(product.current_stock || 0)
  const price = Number(product.sale_price || 0)
  const numericAmount = Math.max(Number(amount || 0), 0)

  const quantityKg =
    mode === "g"
      ? numericAmount / 1000
      : numericAmount

  const increment = mode === "g" ? 50 : 1
  const minimum = mode === "g" ? 50 : 0.001

  const unavailable =
    stock <= 0 ||
    price <= 0

  const exceedsStock =
    quantityKg > stock

  function changeMode(nextMode: WeightMode) {
    setMode(nextMode)
    setAmount(nextMode === "g" ? "50" : "1")
  }

  function changeAmount(nextAmount: number) {
    setAmount(
      String(
        Math.max(
          nextAmount,
          minimum,
        ),
      ),
    )
  }

  function addToCart() {
    if (
      unavailable ||
      quantityKg <= 0 ||
      exceedsStock
    ) {
      return
    }

    onAdd(
      product,
      Number(quantityKg.toFixed(3)),
    )

    setAmount(mode === "g" ? "50" : "1")
  }

  return (
    <article className="relative rounded-xl border border-[#e0e5dd] bg-white p-3 transition hover:border-[#9db4a3] hover:shadow-sm">
      {inCartQuantity > 0 && (
        <span className="absolute right-3 top-3 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#1f6a3a] px-2 text-xs font-semibold text-white">
          {formatQuantity(inCartQuantity)}
        </span>
      )}

      <div className="pr-10">
        <p className="font-semibold leading-5 text-[#172018]">
          {product.name}
        </p>

        <p className="mt-1 text-xs text-slate-400">
          {product.sku ?? "Sin SKU"} ?{" "}
          {product.category?.name ??
            "Sin categor?a"}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-[#1f6a3a]">
            {money(price)}
          </p>

          <p className="mt-0.5 text-xs text-slate-400">
            por {product.unit}
          </p>
        </div>

        <p
          className={
            stock > 0
              ? "text-xs text-slate-500"
              : "text-xs font-medium text-red-600"
          }
        >
          {stock > 0
            ? `${formatQuantity(stock)} ${product.unit}`
            : "Agotado"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#f5f7f3] p-1">
        <button
          type="button"
          onClick={() => changeMode("kg")}
          className={`h-9 rounded-lg text-sm font-semibold transition ${
            mode === "kg"
              ? "bg-[#102019] text-white shadow-sm"
              : "text-slate-500 hover:bg-white"
          }`}
        >
          Kilogramos
        </button>

        <button
          type="button"
          onClick={() => changeMode("g")}
          className={`h-9 rounded-lg text-sm font-semibold transition ${
            mode === "g"
              ? "bg-[#102019] text-white shadow-sm"
              : "text-slate-500 hover:bg-white"
          }`}
        >
          Gramos
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            changeAmount(
              numericAmount - increment,
            )
          }
          disabled={unavailable}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dfe4dc] bg-white hover:bg-[#f5f7f3] disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="relative min-w-0 flex-1">
          <input
            type="number"
            min={minimum}
            step={mode === "g" ? 50 : 0.001}
            value={amount}
            disabled={unavailable}
            onChange={(event) =>
              setAmount(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addToCart()
              }
            }}
            className="h-10 w-full rounded-xl border border-[#dfe4dc] bg-white px-3 pr-12 text-center text-sm font-semibold outline-none focus:border-[#1f6a3a] focus:ring-4 focus:ring-[#1f6a3a]/10 disabled:bg-slate-50"
          />

          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
            {mode}
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            changeAmount(
              numericAmount + increment,
            )
          }
          disabled={unavailable}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dfe4dc] bg-white hover:bg-[#f5f7f3] disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {mode === "g" &&
        numericAmount > 0 && (
          <p className="mt-2 text-center text-xs text-slate-400">
            {formatQuantity(numericAmount)} g ={" "}
            {formatQuantity(quantityKg)} kg
          </p>
        )}

      {exceedsStock && (
        <p className="mt-2 text-xs font-medium text-red-600">
          La cantidad supera la existencia disponible.
        </p>
      )}

      <button
        type="button"
        onClick={addToCart}
        disabled={
          unavailable ||
          quantityKg <= 0 ||
          exceedsStock
        }
        className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-[#102019] text-sm font-semibold text-white hover:bg-[#174f2d] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {stock <= 0
          ? "Producto agotado"
          : price <= 0
            ? "Sin precio de venta"
            : "Agregar al carrito"}
      </button>
    </article>
  )
}

export default function PuntoDeVentaPage() {
  const supabase = useMemo(() => createClient(), [])
  const { settings } = useBusinessSettings()

  const searchRef = useRef<HTMLInputElement | null>(null)

  const [products, setProducts] = useState<Product[]>([])
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
  const [lastSale, setLastSale] = useState<SaleResult | null>(null)
  const [lastSaleItems, setLastSaleItems] = useState<CartItem[]>([])

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
        sale_price,
        current_stock,
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

    setProducts((data ?? []) as unknown as Product[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadProducts])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault()
        searchRef.current?.focus()
      }

      if (event.key === "F8") {
        event.preventDefault()
        void completeSale()
      }

      if (event.key === "Escape") {
        setLastSale(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  })

  const categories = useMemo(() => {
    const values = new Set(
      products
        .map((product) => product.category?.name)
        .filter((value): value is string => Boolean(value)),
    )

    return ["Todos", ...Array.from(values).sort()]
  }, [products])

  const filteredProducts = useMemo(() => {
    const value = search.trim().toLowerCase()

    return products.filter((product) => {
      const matchesSearch =
        !value ||
        product.name.toLowerCase().includes(value) ||
        product.sku?.toLowerCase().includes(value)

      const matchesCategory =
        category === "Todos" ||
        product.category?.name === category

      return matchesSearch && matchesCategory
    })
  }, [products, search, category])

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (total, item) =>
          total + item.quantity * item.unit_price,
        0,
      ),
    [cart],
  )

  const discountAmount = Math.max(
    Number(discount || 0),
    0,
  )

  const total = Math.max(subtotal - discountAmount, 0)
  const received = Math.max(
    Number(cashReceived || 0),
    0,
  )

  const change =
    paymentMethod === "cash"
      ? Math.max(received - total, 0)
      : 0

  function addProduct(
    product: Product,
    quantityKg: number,
  ) {
    setError("")
    setMessage("")
    setLastSale(null)

    const stock =
      Number(product.current_stock || 0)

    const price =
      Number(product.sale_price || 0)

    if (stock <= 0) {
      setError(
        `${product.name} est? agotado.`,
      )
      return
    }

    if (price <= 0) {
      setError(
        `${product.name} no tiene precio de venta.`,
      )
      return
    }

    if (
      !Number.isFinite(quantityKg) ||
      quantityKg <= 0
    ) {
      setError(
        "La cantidad debe ser mayor a cero.",
      )
      return
    }

    let quantityExceeded = false

    setCart((current) => {
      const existing = current.find(
        (item) =>
          item.product_id === product.id,
      )

      const currentQuantity =
        existing?.quantity ?? 0

      const nextQuantity =
        Number(
          (
            currentQuantity +
            quantityKg
          ).toFixed(3),
        )

      if (nextQuantity > stock) {
        quantityExceeded = true
        return current
      }

      if (existing) {
        return current.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: nextQuantity,
              }
            : item,
        )
      }

      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          unit: product.unit,
          quantity: Number(
            quantityKg.toFixed(3),
          ),
          unit_price: price,
          available_stock: stock,
        },
      ]
    })

    window.setTimeout(() => {
      if (quantityExceeded) {
        setError(
          `No puedes agregar m?s de ${formatQuantity(
            stock,
          )} ${product.unit} de ${product.name}.`,
        )
        return
      }

      setMessage(
        `${formatQuantity(
          quantityKg,
        )} kg de ${product.name} agregado a la venta.`,
      )
    }, 0)
  }

  function updateQuantity(
    productId: string,
    value: number,
  ) {
    setCart((current) =>
      current.map((item) => {
        if (item.product_id !== productId) return item

        const safeValue = Math.max(
          0.001,
          Math.min(value, item.available_stock),
        )

        return {
          ...item,
          quantity: Number(safeValue.toFixed(3)),
        }
      }),
    )
  }

  function removeProduct(productId: string) {
    setCart((current) =>
      current.filter(
        (item) => item.product_id !== productId,
      ),
    )
  }

  function clearSale() {
    if (cart.length === 0) return

    const confirmed = window.confirm(
      "¿Deseas limpiar la venta actual?",
    )

    if (!confirmed) return

    setCart([])
    setDiscount("0")
    setCashReceived("")
    setPaymentMethod("cash")
  }

  async function completeSale() {
    setError("")
    setMessage("")

    if (submitting) return

    if (cart.length === 0) {
      setError("Agrega al menos un producto.")
      return
    }

    if (discountAmount > subtotal) {
      setError(
        "El descuento no puede superar el subtotal.",
      )
      return
    }

    if (
      paymentMethod === "cash" &&
      received < total
    ) {
      setError(
        "El efectivo recibido es menor al total.",
      )
      return
    }

    setSubmitting(true)

    const { data, error: saleError } =
      await supabase.rpc("register_sale", {
        p_items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        p_payment_method: paymentMethod,
        p_discount: discountAmount,
        p_notes: null,
      })

    if (saleError) {
      setError(saleError.message)
      setSubmitting(false)
      return
    }

    const result = data as SaleResult

    setLastSale(result)
    setLastSaleItems([...cart])
    setMessage(
      `Venta ${result.folio} registrada correctamente.`,
    )

    setCart([])
    setDiscount("0")
    setCashReceived("")
    setPaymentMethod("cash")
    setSubmitting(false)

    await loadProducts()

    if (settings.auto_print_ticket) {
      window.setTimeout(() => {
        window.print()
      }, 350)
    }
  }

  return (
    <AppShell
      title="Punto de venta"
      description="Venta rápida al público general."
    >
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 print:hidden">
          <CheckCircle2 className="h-5 w-5" />
          {message}
        </div>
      )}

      <div className="grid min-h-[calc(100vh-150px)] gap-5 xl:grid-cols-[1fr_430px] print:hidden">
        <section className="flex min-h-0 flex-col rounded-2xl border border-[#dde2da] bg-white shadow-sm">
          <div className="border-b border-[#e6eae4] p-4 sm:p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                ref={searchRef}
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar producto o SKU..."
                className="h-12 w-full rounded-2xl border border-[#d9dfd6] bg-[#f8f9f6] pl-12 pr-20 text-sm outline-none transition focus:border-[#1f6a3a] focus:bg-white focus:ring-4 focus:ring-[#1f6a3a]/10"
              />

              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-[#dce1d9] bg-white px-2 py-1 text-[10px] font-semibold text-slate-400">
                F2
              </span>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
                    category === item
                      ? "bg-[#102019] text-white"
                      : "border border-[#dfe4dc] bg-white text-slate-600 hover:bg-[#f5f7f3]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {loading ? (
              <div className="flex min-h-96 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#1f6a3a]" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {filteredProducts.map(
                  (product) => {
                    const inCart =
                      cart.find(
                        (item) =>
                          item.product_id ===
                          product.id,
                      )

                    return (
                      <ProductSaleCard
                        key={product.id}
                        product={product}
                        inCartQuantity={
                          inCart?.quantity ?? 0
                        }
                        onAdd={addProduct}
                      />
                    )
                  },
                )}

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
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-2xl border border-[#dde2da] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e6eae4] px-5 py-4">
            <div>
              <p className="text-sm font-semibold">
                Venta actual
              </p>

              <p className="mt-0.5 text-xs text-slate-400">
                {cart.length} productos
              </p>
            </div>

            <button
              type="button"
              onClick={clearSale}
              disabled={cart.length === 0}
              className="rounded-xl px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
            >
              Limpiar
            </button>
          </div>

          <div className="min-h-48 flex-1 divide-y divide-[#edf0eb] overflow-y-auto">
            {cart.map((item) => (
              <article
                key={item.product_id}
                className="p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {item.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Disponible:{" "}
                      {formatQuantity(
                        item.available_stock,
                      )}{" "}
                      {item.unit}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeProduct(item.product_id)
                    }
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
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
                        max={item.available_stock}
                        step="0.001"
                        value={item.quantity}
                        onChange={(event) =>
                          updateQuantity(
                            item.product_id,
                            Number(event.target.value),
                          )
                        }
                        className="h-9 min-w-0 flex-1 rounded-xl border border-[#dfe4dc] px-3 text-center text-sm outline-none focus:border-[#1f6a3a]"
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

                  <div className="pb-1 text-right">
                    <p className="text-xs text-slate-400">
                      {money(item.unit_price)} / {item.unit}
                    </p>

                    <p className="mt-1 font-semibold">
                      {money(
                        item.quantity * item.unit_price,
                      )}
                    </p>
                  </div>
                </div>
              </article>
            ))}

            {cart.length === 0 && (
              <div className="flex h-full min-h-64 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#eef3ed] text-[#1f6a3a]">
                  <ShoppingBasket className="h-7 w-7" />
                </div>

                <p className="mt-4 font-medium">
                  Venta vacía
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Selecciona productos para comenzar.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-[#e6eae4] bg-white p-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  value: "cash",
                  label: "Efectivo",
                  icon: Banknote,
                },
                {
                  value: "card",
                  label: "Tarjeta",
                  icon: CreditCard,
                },
                {
                  value: "transfer",
                  label: "Transferencia",
                  icon: Smartphone,
                },
              ].map((method) => {
                const Icon = method.icon
                const active =
                  paymentMethod === method.value

                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() =>
                      setPaymentMethod(
                        method.value as
                          | "cash"
                          | "card"
                          | "transfer",
                      )
                    }
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition ${
                      active
                        ? "border-[#1f6a3a] bg-[#e8f3eb] text-[#1f6a3a]"
                        : "border-[#dfe4dc] text-slate-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {method.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Descuento
                </p>

                <Input
                  type="number"
                  min="0"
                  max={subtotal}
                  step="0.01"
                  value={discount}
                  onChange={(event) =>
                    setDiscount(event.target.value)
                  }
                  className="rounded-xl"
                />
              </div>

              {paymentMethod === "cash" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-500">
                    Recibido
                  </p>

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(event) =>
                      setCashReceived(
                        event.target.value,
                      )
                    }
                    className="rounded-xl"
                  />
                </div>
              )}
            </div>

            <div className="mt-3 rounded-xl bg-[#f5f7f3] p-3">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>

              <div className="mt-2 flex justify-between text-sm text-slate-500">
                <span>Descuento</span>
                <span>-{money(discountAmount)}</span>
              </div>

              <div className="mt-3 flex items-end justify-between border-t border-[#dfe4dc] pt-3">
                <span className="font-medium">
                  Total
                </span>

                <span className="text-3xl font-semibold tracking-tight text-[#172018]">
                  {money(total)}
                </span>
              </div>

              {paymentMethod === "cash" && (
                <div className="mt-3 flex justify-between rounded-xl bg-white px-3 py-2 text-sm">
                  <span className="text-slate-500">
                    Cambio
                  </span>

                  <span className="font-semibold text-[#1f6a3a]">
                    {money(change)}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void completeSale()}
              disabled={
                submitting || cart.length === 0
              }
              className="mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#102019] text-sm font-semibold text-white transition hover:bg-[#174f2d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Zap className="h-5 w-5" />
              )}

              Cobrar {money(total)}

              <span className="ml-auto mr-4 rounded-lg bg-white/10 px-2 py-1 text-[10px]">
                F8
              </span>
            </button>
          </div>
        </section>
      </div>

      {lastSale && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm print:static print:block print:bg-white print:p-0">
          <section className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 text-black shadow-2xl print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:p-0">
            <div className="mb-4 flex justify-end print:hidden">
              <button
                type="button"
                onClick={() => setLastSale(null)}
                className="rounded-xl border border-[#dfe4dc] p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <TicketBranding settings={settings} />

            <div className="my-5 border-y border-dashed border-black py-3 text-sm">
              <p>Ticket: {lastSale.ticket_number}</p>
              <p>Venta: {lastSale.folio}</p>
              <p>
                Fecha:{" "}
                {new Date(
                  lastSale.sold_at,
                ).toLocaleString("es-MX")}
              </p>
            </div>

            <div className="space-y-3 text-sm">
              {lastSaleItems.map((item) => (
                <div key={item.product_id}>
                  <p className="font-medium">
                    {item.name}
                  </p>

                  <div className="flex justify-between">
                    <span>
                      {formatQuantity(item.quantity)}{" "}
                      {item.unit} ×{" "}
                      {money(item.unit_price)}
                    </span>

                    <span>
                      {money(
                        item.quantity *
                          item.unit_price,
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="my-5 space-y-2 border-y border-dashed border-black py-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(lastSale.subtotal)}</span>
              </div>

              <div className="flex justify-between">
                <span>Descuento</span>
                <span>-{money(lastSale.discount)}</span>
              </div>

              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{money(lastSale.total)}</span>
              </div>
            </div>

            <TicketFooter settings={settings} />

            <button
              type="button"
              onClick={() => window.print()}
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

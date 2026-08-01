"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TicketBranding, TicketFooter } from "@/components/tickets/ticket-branding"
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

export default function PuntoDeVentaPage() {
  const supabase = createClient()
  const { settings } = useBusinessSettings()

  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState("")
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
      .gt("current_stock", 0)
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

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (total, item) => total + item.quantity * item.unit_price,
        0,
      ),
    [cart],
  )

  const discountAmount = Math.max(Number(discount || 0), 0)
  const total = Math.max(subtotal - discountAmount, 0)
  const received = Math.max(Number(cashReceived || 0), 0)
  const change =
    paymentMethod === "cash" ? Math.max(received - total, 0) : 0

  function addProduct(product: Product) {
    setError("")
    setMessage("")
    setLastSale(null)

    if (Number(product.sale_price) <= 0) {
      setError(
        `${product.name} todavía no tiene precio de venta configurado.`,
      )
      return
    }

    setCart((current) => {
      const existing = current.find(
        (item) => item.product_id === product.id,
      )

      if (existing) return current

      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          unit: product.unit,
          quantity: 1,
          unit_price: Number(product.sale_price),
          available_stock: Number(product.current_stock),
        },
      ]
    })
  }

  function updateQuantity(productId: string, value: number) {
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

  function updatePrice(productId: string, value: number) {
    setCart((current) =>
      current.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              unit_price: Math.max(value, 0),
            }
          : item,
      ),
    )
  }

  function removeProduct(productId: string) {
    setCart((current) =>
      current.filter((item) => item.product_id !== productId),
    )
  }

  async function completeSale() {
    setError("")
    setMessage("")

    if (cart.length === 0) {
      setError("Agrega por lo menos un producto a la venta.")
      return
    }

    if (discountAmount > subtotal) {
      setError("El descuento no puede superar el subtotal.")
      return
    }

    if (paymentMethod === "cash" && received < total) {
      setError("El efectivo recibido es menor al total de la venta.")
      return
    }

    const invalidItem = cart.find(
      (item) =>
        item.quantity <= 0 ||
        item.quantity > item.available_stock ||
        item.unit_price < 0,
    )

    if (invalidItem) {
      setError(`Revisa cantidad y precio de ${invalidItem.name}.`)
      return
    }

    setSubmitting(true)

    const saleItems = cart.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))

    const { data, error: saleError } = await supabase.rpc(
      "register_sale",
      {
        p_items: saleItems,
        p_payment_method: paymentMethod,
        p_discount: discountAmount,
        p_notes: null,
      },
    )

    if (saleError) {
      setError(saleError.message)
      setSubmitting(false)
      return
    }

    const result = data as SaleResult

    setLastSale(result)
    setLastSaleItems([...cart])

    if (settings.auto_print_ticket) {
      window.setTimeout(() => {
        window.print()
      }, 300)
    }
    setMessage(
      `Venta ${result.folio} registrada correctamente. Ticket ${result.ticket_number}.`,
    )

    setCart([])
    setDiscount("0")
    setCashReceived("")
    setSubmitting(false)

    await loadProducts()
  }

  function printTicket() {
    window.print()
  }

  return (
    <AppShell
      title="Punto de venta"
      description="Cobro rápido al público general y generación de tickets."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 print:hidden">
          <CheckCircle2 className="h-5 w-5" />
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] print:hidden">
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto, SKU o categoría"
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-96 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="grid max-h-[650px] gap-3 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => {
                const alreadyAdded = cart.some(
                  (item) => item.product_id === product.id,
                )

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    disabled={alreadyAdded}
                    className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <p className="font-medium">{product.name}</p>

                    <p className="mt-1 text-xs text-slate-500">
                      {product.sku ?? "Sin SKU"} ·{" "}
                      {product.category?.name ?? "Sin categoría"}
                    </p>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-lg font-semibold">
                          {money(Number(product.sale_price))}
                        </p>

                        <p className="text-xs text-slate-500">
                          por {product.unit}
                        </p>
                      </div>

                      <p className="text-xs text-slate-500">
                        {formatQuantity(product.current_stock)}{" "}
                        {product.unit}
                      </p>
                    </div>
                  </button>
                )
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-16 text-center text-sm text-slate-500">
                  No hay productos disponibles con esa búsqueda.
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 p-5">
            <ShoppingCart className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Venta actual</h2>
          </div>

          <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
            {cart.map((item) => (
              <article key={item.product_id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Disponible: {formatQuantity(item.available_stock)}{" "}
                      {item.unit}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeProduct(item.product_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cantidad en {item.unit}</Label>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          updateQuantity(
                            item.product_id,
                            item.quantity - 0.1,
                          )
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </Button>

                      <Input
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
                      />

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          updateQuantity(
                            item.product_id,
                            item.quantity + 0.1,
                          )
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Precio por {item.unit}</Label>

                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(event) =>
                        updatePrice(
                          item.product_id,
                          Number(event.target.value),
                        )
                      }
                    />
                  </div>
                </div>

                <p className="mt-4 text-right font-semibold">
                  {money(item.quantity * item.unit_price)}
                </p>
              </article>
            ))}

            {cart.length === 0 && (
              <div className="py-16 text-center text-sm text-slate-500">
                Agrega productos para iniciar la venta.
              </div>
            )}
          </div>

          <div className="space-y-5 border-t border-slate-200 p-5">
            <div className="space-y-2">
              <Label>Método de pago</Label>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={
                    paymentMethod === "cash" ? "default" : "outline"
                  }
                  onClick={() => setPaymentMethod("cash")}
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  Efectivo
                </Button>

                <Button
                  type="button"
                  variant={
                    paymentMethod === "card" ? "default" : "outline"
                  }
                  onClick={() => setPaymentMethod("card")}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Tarjeta
                </Button>

                <Button
                  type="button"
                  variant={
                    paymentMethod === "transfer"
                      ? "default"
                      : "outline"
                  }
                  onClick={() => setPaymentMethod("transfer")}
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  Transferencia
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descuento en pesos</Label>

              <Input
                type="number"
                min="0"
                max={subtotal}
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
              />
            </div>

            {paymentMethod === "cash" && (
              <div className="space-y-2">
                <Label>Efectivo recibido</Label>

                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashReceived}
                  onChange={(event) =>
                    setCashReceived(event.target.value)
                  }
                  placeholder="0.00"
                />

                <p className="text-sm text-slate-500">
                  Cambio: {money(change)}
                </p>
              </div>
            )}

            <div className="space-y-3 rounded-xl bg-slate-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Descuento</span>
                <span>-{money(discountAmount)}</span>
              </div>

              <div className="flex justify-between border-t border-slate-200 pt-3 text-xl font-semibold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={completeSale}
              disabled={submitting || cart.length === 0}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="mr-2 h-4 w-4" />
              )}
              Cobrar y generar ticket
            </Button>
          </div>
        </section>
      </div>

      {lastSale && (
        <section className="mx-auto mt-6 max-w-sm bg-white p-6 text-black print:mt-0 print:max-w-none print:p-0">
          <TicketBranding settings={settings} />

          <div className="my-5 border-y border-dashed border-black py-3 text-sm">
            <p>Ticket: {lastSale.ticket_number}</p>
            <p>Venta: {lastSale.folio}</p>
            <p>
              Fecha:{" "}
              {new Date(lastSale.sold_at).toLocaleString("es-MX")}
            </p>
          </div>

          <div className="space-y-3 text-sm">
            {lastSaleItems.map((item) => (
              <div key={item.product_id}>
                <p className="font-medium">{item.name}</p>

                <div className="flex justify-between">
                  <span>
                    {formatQuantity(item.quantity)} {item.unit} ×{" "}
                    {money(item.unit_price)}
                  </span>

                  <span>
                    {money(item.quantity * item.unit_price)}
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

            <div className="flex justify-between">
              <span>Método</span>
              <span>
                {lastSale.payment_method === "cash"
                  ? "Efectivo"
                  : lastSale.payment_method === "card"
                    ? "Tarjeta"
                    : "Transferencia"}
              </span>
            </div>
          </div>

          <TicketFooter settings={settings} />

          <Button
            type="button"
            className="mt-5 w-full print:hidden"
            onClick={printTicket}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir ticket
          </Button>
        </section>
      )}
    </AppShell>
  )
}


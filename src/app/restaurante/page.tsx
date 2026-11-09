"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"

type RestaurantVariant = {
  id: string
  restaurant_product_id: string
  name: string
  sale_price: number
  sort_order: number
  fruit_total_grams: number | null
}

type RestaurantProduct = {
  id: string
  name: string
  category: string
  description: string | null
  sort_order: number
  variants: RestaurantVariant[]
}

type FruitOption = {
  id: string
  name: string
  unit: string
  current_stock: number
}

type FruitSelection = {
  product_id: string
  name: string
  grams: number
}

type CartItem = {
  cart_key: string
  variant_id: string
  restaurant_product_id: string
  product_name: string
  variant_name: string
  quantity: number
  unit_price: number
  fruit_selections: FruitSelection[]
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

  const [products, setProducts] = useState<RestaurantProduct[]>([])
  const [cart, setCart] = useState<CartItem[]>([])

  const [fruitOptions, setFruitOptions] =
    useState<FruitOption[]>([])

  const [fruitModal, setFruitModal] = useState<{
    product: RestaurantProduct
    variant: RestaurantVariant
  } | null>(null)

  const [selectedFruitIds, setSelectedFruitIds] =
    useState<string[]>([])

  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")

  const [tableNumber, setTableNumber] = useState("")
  const [takeaway, setTakeaway] = useState(false)
  const [notes, setNotes] = useState("")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError("")

    const [
      productsResponse,
      variantsResponse,
      fruitOptionsResponse,
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
          sort_order,
          fruit_total_grams
        `)
        .eq("active", true)
        .order("sort_order")
        .order("name"),

      supabase
        .from("products")
        .select("id, name, unit, current_stock")
        .eq("active", true)
        .eq("restaurant_fruit_option", true)
        .order("name"),
    ])

    const firstError =
      productsResponse.error ||
      variantsResponse.error ||
      fruitOptionsResponse.error

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

    const rawFruitOptions =
      (fruitOptionsResponse.data ?? []) as FruitOption[]

    setFruitOptions(
      rawFruitOptions.map((fruit) => ({
        ...fruit,
        current_stock: Number(fruit.current_stock || 0),
      })),
    )

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
        fruit_total_grams:
          variant.fruit_total_grams == null
            ? null
            : Number(variant.fruit_total_grams),
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
          variantsByProduct.get(product.id) ?? [],
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
        !category || product.category === category

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

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          item.quantity *
            item.unit_price,
        0,
      ),
    [cart],
  )

  function addVariant(
    product: RestaurantProduct,
    variant: RestaurantVariant,
  ) {
    setError("")
    setMessage("")

    if (
      product.category
        .trim()
        .toLowerCase() === "fruta picada"
    ) {
      if (
        !variant.fruit_total_grams ||
        variant.fruit_total_grams <= 0
      ) {
        setError(
          "Este tamaño no tiene configurados los gramos de fruta.",
        )
        return
      }

      if (fruitOptions.length === 0) {
        setError(
          "No hay frutas configuradas para Fruta picada.",
        )
        return
      }

      setFruitModal({
        product,
        variant,
      })

      setSelectedFruitIds([])
      return
    }

    addCartItem(
      product,
      variant,
      [],
    )
  }

  function addCartItem(
    product: RestaurantProduct,
    variant: RestaurantVariant,
    fruitSelections: FruitSelection[],
  ) {
    const selectionKey =
      fruitSelections
        .map((fruit) => fruit.product_id)
        .join("-")

    const cartKey =
      selectionKey
        ? `${variant.id}:${selectionKey}`
        : variant.id

    setCart((current) => {
      const existing =
        current.find(
          (item) =>
            item.cart_key === cartKey,
        )

      if (existing) {
        return current.map((item) =>
          item.cart_key === cartKey
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
          cart_key: cartKey,
          variant_id: variant.id,
          restaurant_product_id:
            product.id,
          product_name: product.name,
          variant_name: variant.name,
          quantity: 1,
          unit_price: Number(
            variant.sale_price || 0,
          ),
          fruit_selections:
            fruitSelections,
        },
      ]
    })
  }

  function toggleFruit(productId: string) {
    setSelectedFruitIds((current) => {
      if (current.includes(productId)) {
        return current.filter(
          (id) => id !== productId,
        )
      }

      if (current.length >= 4) {
        return current
      }

      return [
        ...current,
        productId,
      ]
    })
  }

  function selectedFruitGrams(index: number) {
    if (
      !fruitModal ||
      selectedFruitIds.length === 0
    ) {
      return 0
    }

    const totalGrams =
      Math.round(
        Number(
          fruitModal.variant
            .fruit_total_grams || 0,
        ),
      )

    const base =
      Math.floor(
        totalGrams /
          selectedFruitIds.length,
      )

    const remainder =
      totalGrams %
      selectedFruitIds.length

    return (
      base +
      (index < remainder ? 1 : 0)
    )
  }

  function confirmFruitSelection() {
    if (!fruitModal) return

    if (
      selectedFruitIds.length < 1 ||
      selectedFruitIds.length > 4
    ) {
      setError(
        "Selecciona entre 1 y 4 frutas.",
      )
      return
    }

    const selections =
      selectedFruitIds
        .map((productId, index) => {
          const fruit =
            fruitOptions.find(
              (option) =>
                option.id === productId,
            )

          if (!fruit) {
            return null
          }

          return {
            product_id: fruit.id,
            name: fruit.name,
            grams:
              selectedFruitGrams(index),
          }
        })
        .filter(
          (
            fruit,
          ): fruit is FruitSelection =>
            fruit !== null,
        )

    addCartItem(
      fruitModal.product,
      fruitModal.variant,
      selections,
    )

    setFruitModal(null)
    setSelectedFruitIds([])
    setError("")
  }

  function changeQuantity(
    cartKey: string,
    difference: number,
  ) {
    setCart((current) =>
      current
        .map((item) =>
          item.cart_key === cartKey
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

  function removeItem(cartKey: string) {
    setCart((current) =>
      current.filter(
        (item) =>
          item.cart_key !== cartKey,
      ),
    )
  }

  function clearOrder() {
    if (cart.length === 0) return

    const confirmed =
      window.confirm(
        "¿Deseas limpiar el pedido actual?",
      )

    if (!confirmed) return

    setCart([])
    setTableNumber("")
    setTakeaway(false)
    setNotes("")
    setError("")
    setMessage("")
  }

  async function submitOrder() {
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
      !takeaway &&
      !tableNumber.trim()
    ) {
      setError(
        "Escribe tu número de mesa.",
      )
      return
    }

    setSubmitting(true)

    const { data, error: orderError } =
      await supabase.rpc(
        "create_restaurant_order",
        {
          p_order_type:
            takeaway ? "takeaway" : "table",
          p_table_number:
            takeaway
              ? null
              : tableNumber.trim(),
          p_notes:
            notes.trim() || null,
          p_items:
            cart.map((item) => ({
              variant_id:
                item.variant_id,
              quantity:
                item.quantity,
              fruit_selections:
                item.fruit_selections.map(
                  (fruit) => ({
                    product_id:
                      fruit.product_id,
                    name:
                      fruit.name,
                    grams:
                      fruit.grams,
                  }),
                ),
            })),
        },
      )

    if (orderError) {
      setError(orderError.message)
      setSubmitting(false)
      return
    }

    const result = data as {
      order_id: string
      order_number: number
      total: number
    }

    setCart([])
    setTableNumber("")
    setTakeaway(false)
    setNotes("")

    setMessage(
      `Pedido #${result.order_number} enviado correctamente.`,
    )

    setSubmitting(false)
  }

  return (
    <AppShell
      title="Restaurante"
      description="Haz tu pedido desde la mesa"
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
                      Selecciona lo que quieras pedir.
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
              <button
                type="button"
                onClick={() =>
                  setCategory("")
                }
                className={`inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-[13px] font-medium ${
                  category === ""
                    ? "bg-[#102019] text-white"
                    : "border border-[#dce2d9] bg-white text-slate-600"
                }`}
              >
                Todos
              </button>

              {categories.map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      setCategory(item)
                    }
                    className={`inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-[13px] font-medium ${
                      category === item
                        ? "bg-[#102019] text-white"
                        : "border border-[#dce2d9] bg-white text-slate-600"
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
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {filteredProducts.map(
                (product) => (
                  <article
                    key={product.id}
                    className="rounded-[22px] border border-[#dfe4dc] bg-white p-5 shadow-sm"
                  >
                    <span className="inline-flex rounded-full bg-[#eef3ed] px-3 py-1 text-[11px] font-semibold uppercase text-[#1f6a3a]">
                      {product.category}
                    </span>

                    <h3 className="mt-3 text-lg font-semibold">
                      {product.name}
                    </h3>

                    {product.description && (
                      <p className="mt-1 text-sm text-slate-500">
                        {product.description}
                      </p>
                    )}

                    <div className="mt-5 space-y-2">
                      {product.variants.map(
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
                            className="flex min-h-12 w-full items-center justify-between rounded-xl border border-[#dce2d9] px-3 py-2"
                          >
                            <span>
                              {variant.name}
                            </span>

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
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <aside>
          <div className="sticky top-[102px] overflow-hidden rounded-[24px] border border-[#dfe4dc] bg-white shadow-sm">
            <div className="border-b border-[#e4e8e1] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">
                    Tu pedido
                  </h2>
                  <p className="text-xs text-slate-500">
                    {cart.reduce(
                      (sum, item) =>
                        sum + item.quantity,
                      0,
                    )}{" "}
                    productos
                  </p>
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearOrder}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[350px] overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.cart_key}
                  className="border-b p-4"
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.variant_name}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeItem(
                          item.cart_key,
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex justify-between">
                    <div className="flex items-center border rounded-xl">
                      <button
                        type="button"
                        onClick={() =>
                          changeQuantity(
                            item.cart_key,
                            -1,
                          )
                        }
                        className="h-9 w-9"
                      >
                        <Minus className="mx-auto h-4 w-4" />
                      </button>

                      <span className="px-2">
                        {formatQuantity(
                          item.quantity,
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          changeQuantity(
                            item.cart_key,
                            1,
                          )
                        }
                        className="h-9 w-9"
                      >
                        <Plus className="mx-auto h-4 w-4" />
                      </button>
                    </div>

                    <span className="font-semibold">
                      {money(
                        item.quantity *
                          item.unit_price,
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t p-5 space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={takeaway}
                  onChange={(event) =>
                    setTakeaway(
                      event.target.checked,
                    )
                  }
                />
                <span className="text-sm font-semibold">
                  Para llevar
                </span>
              </label>

              {!takeaway && (
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Número de mesa
                  </label>

                  <input
                    value={tableNumber}
                    onChange={(event) =>
                      setTableNumber(
                        event.target.value,
                      )
                    }
                    placeholder="Ej. 3"
                    className="mt-2 h-11 w-full rounded-xl border border-[#dce2d9] px-3"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Notas
                </label>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value,
                    )
                  }
                  placeholder="Sin cebolla, aderezo aparte..."
                  className="mt-2 min-h-20 w-full rounded-xl border border-[#dce2d9] p-3"
                />
              </div>

              <div className="flex justify-between border-t pt-4 text-xl font-semibold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>

              <button
                type="button"
                disabled={
                  submitting ||
                  cart.length === 0
                }
                onClick={() =>
                  void submitOrder()
                }
                className="flex h-14 w-full items-center justify-center rounded-xl bg-[#102019] font-semibold text-white disabled:opacity-40"
              >
                {submitting
                  ? "Enviando..."
                  : `Hacer pedido ${money(total)}`}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {fruitModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-[24px] bg-white p-5">
            <div className="flex justify-between">
              <h2 className="text-xl font-semibold">
                Selecciona las frutas
              </h2>

              <button
                type="button"
                onClick={() => {
                  setFruitModal(null)
                  setSelectedFruitIds([])
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {fruitOptions.map((fruit) => {
                const selected =
                  selectedFruitIds.includes(
                    fruit.id,
                  )

                return (
                  <button
                    key={fruit.id}
                    type="button"
                    onClick={() =>
                      toggleFruit(fruit.id)
                    }
                    className={
                      selected
                        ? "rounded-xl border border-[#1f6a3a] bg-[#eef3ed] px-4 py-3 text-left"
                        : "rounded-xl border px-4 py-3 text-left"
                    }
                  >
                    {fruit.name}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={confirmFruitSelection}
              className="mt-5 h-12 w-full rounded-xl bg-[#102019] font-semibold text-white"
            >
              Agregar al pedido
            </button>
          </div>
        </div>
      )}
    </AppShell>
  )
}

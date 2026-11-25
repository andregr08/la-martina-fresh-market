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
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react"

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

type SaladCustomization = {
  base: string
  protein: string[]
  ingredients: string[]
  toppings: string[]
  dressing: string
}

const SALAD_BASES = [
  "Lechuga",
  "Lechuga romana",
  "Mix de hojas",
  "Espinaca",
]

const SALAD_PROTEINS = [
  "Pollo",
]

const SALAD_INGREDIENTS = [
  "Aguacate",
  "Cebolla morada",
  "Elote",
  "Jitomate",
  "Jitomate cherry",
  "Pepino",
  "Perejil",
]

const SALAD_TOPPINGS = [
  "Fresa",
  "Manzana",
  "Zarzamora",
]

const SALAD_DRESSINGS = [
  "Aderezo César",
  "Aderezo cilantro limón",
  "Aderezo italiano",
  "Vinagreta miel limón",
  "Vinagreta limón orégano",
  "Vinagreta de hierbas",
  "Aderezo chipotle",
]

type CartItem = {
  cart_key: string
  variant_id: string
  restaurant_product_id: string
  product_name: string
  variant_name: string
  quantity: number
  unit_price: number
  fruit_selections: FruitSelection[]
  customization: SaladCustomization | null
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
  const [cartOpen, setCartOpen] = useState(false)

  const [fruitOptions, setFruitOptions] =
    useState<FruitOption[]>([])

  const [fruitModal, setFruitModal] = useState<{
    product: RestaurantProduct
    variant: RestaurantVariant
  } | null>(null)

  const [selectedFruitIds, setSelectedFruitIds] =
    useState<string[]>([])

  const [saladModal, setSaladModal] = useState<{
    product: RestaurantProduct
    variant: RestaurantVariant
  } | null>(null)

  const [saladBase, setSaladBase] =
    useState("")

  const [saladProtein, setSaladProtein] =
    useState<string[]>([])

  const [saladIngredients, setSaladIngredients] =
    useState<string[]>([])

  const [saladToppings, setSaladToppings] =
    useState<string[]>([])

  const [saladDressing, setSaladDressing] =
    useState("")

  const [category, setCategory] = useState("Baguettes")

  const [tableNumber, setTableNumber] = useState("")
  const [takeaway, setTakeaway] = useState(false)
  const [notes, setNotes] = useState("")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [callingWaiter, setCallingWaiter] = useState(false)
  const [waiterMessage, setWaiterMessage] = useState("")

  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const callWaiter = async (
    tableOverride?: string,
  ) => {
    const requestedTable = (
      tableOverride ?? tableNumber
    ).trim()

    if (!requestedTable) {
      setWaiterMessage(
        "Escribe tu número de mesa.",
      )
      return
    }

    setCallingWaiter(true)
    setWaiterMessage("")
    setMessage("")
    setError("")

    const { data, error: waiterError } =
      await supabase.rpc("call_waiter", {
        p_table_number: requestedTable,
      })

    if (waiterError) {
      const text =
        "No se pudo enviar la solicitud. Intenta de nuevo."

      setWaiterMessage(text)
      setError(text)
      setCallingWaiter(false)
      return
    }

    const result = data as {
      success?: boolean
      already_pending?: boolean
      table_number?: string
    }

    const text =
      result?.already_pending
        ? `Ya hay una solicitud activa para la Mesa ${requestedTable}.`
        : `Solicitud enviada. Enseguida atendemos la Mesa ${requestedTable}.`

    setWaiterMessage(text)
    setMessage(text)
    setCallingWaiter(false)
  }

  const callWaiterFromMenu = () => {
    let requestedTable =
      tableNumber.trim()

    if (!requestedTable) {
      requestedTable =
        window.prompt(
          "¿Cuál es tu número de mesa?",
        )?.trim() ?? ""
    }

    if (!requestedTable) return

    setTableNumber(requestedTable)

    void callWaiter(requestedTable)
  }
  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError("")

    const {
      data,
      error: menuError,
    } = await supabase.rpc(
      "get_public_restaurant_menu",
    )

    if (menuError) {
      setError(menuError.message)
      setLoading(false)
      return
    }

    const menu = data as {
      products?: RestaurantProduct[]
      fruit_options?: FruitOption[]
    }

    setProducts(
      Array.isArray(menu?.products)
        ? menu.products.map((product) => ({
            ...product,
            variants:
              Array.isArray(product.variants)
                ? product.variants.map(
                    (variant) => ({
                      ...variant,
                      sale_price:
                        Number(
                          variant.sale_price || 0,
                        ),
                      fruit_total_grams:
                        variant.fruit_total_grams == null
                          ? null
                          : Number(
                              variant.fruit_total_grams,
                            ),
                    }),
                  )
                : [],
          }))
        : [],
    )

    setFruitOptions(
      Array.isArray(menu?.fruit_options)
        ? menu.fruit_options
        : [],
    )

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadProducts])

  const categories = useMemo(() => {
    const availableCategories = Array.from(
      new Set(
        products
          .map((product) =>
            product.category.trim(),
          )
          .filter(Boolean),
      ),
    )

    const preferredOrder = [
      "Baguettes",
      "sandwiches",
      "Wraps",
      "Ensaladas",
      "Toast",
      "Jugos",
      "Smoothies",
      "Inmune Shot",
      "helados",
      "Fruta picada",
    ]

    return preferredOrder.filter(
      (categoryName) =>
        availableCategories.includes(
          categoryName,
        ),
    )
  }, [products])

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          !category ||
          product.category === category,
      ),
    [products, category],
  )

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

  const cartItemCount = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + item.quantity,
        0,
      ),
    [cart],
  )

  function decrementVariant(
    variantId: string,
  ) {
    setCart((current) => {
      const matchingItems =
        current.filter(
          (item) =>
            item.variant_id === variantId,
        )

      if (matchingItems.length === 0) {
        return current
      }

      const itemToChange =
        matchingItems[
          matchingItems.length - 1
        ]

      return current
        .map((item) =>
          item.cart_key ===
          itemToChange.cart_key
            ? {
                ...item,
                quantity:
                  item.quantity - 1,
              }
            : item,
        )
        .filter(
          (item) =>
            item.quantity > 0,
        )
    })
  }

  function variantQuantity(
    variantId: string,
  ) {
    return cart
      .filter(
        (item) =>
          item.variant_id === variantId,
      )
      .reduce(
        (total, item) =>
          total + item.quantity,
        0,
      )
  }

  function addVariant(
    product: RestaurantProduct,
    variant: RestaurantVariant,
  ) {
    setError("")
    setMessage("")

    if (
      product.name
        .trim()
        .toLowerCase() === "arma tu ensalada"
    ) {
      setSaladModal({
        product,
        variant,
      })

      setSaladBase("")
      setSaladProtein([])
      setSaladIngredients([])
      setSaladToppings([])
      setSaladDressing("")
      return
    }

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
    customization: SaladCustomization | null = null,
  ) {
    const selectionKey =
      fruitSelections
        .map((fruit) => fruit.product_id)
        .join("-")

    const customizationKey =
      customization
        ? JSON.stringify(customization)
        : ""

    const cartKey =
      [
        variant.id,
        selectionKey,
        customizationKey,
      ]
        .filter(Boolean)
        .join(":")

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
          customization,
        },
      ]
    })
  }

  function toggleProtein(value: string) {
    setSaladProtein((current) =>
      current.includes(value)
        ? current.filter(
            (item) => item !== value,
          )
        : [...current, value],
    )
  }

  function toggleIngredient(value: string) {
    setSaladIngredients((current) => {
      if (current.includes(value)) {
        return current.filter(
          (item) => item !== value,
        )
      }

      if (current.length >= 3) {
        setError(
          "Solo puedes elegir hasta 3 ingredientes.",
        )
        return current
      }

      setError("")
      return [...current, value]
    })
  }

  function toggleTopping(value: string) {
    setSaladToppings((current) => {
      if (current.includes(value)) {
        return current.filter(
          (item) => item !== value,
        )
      }

      if (current.length >= 2) {
        setError(
          "Solo puedes elegir hasta 2 toppings.",
        )
        return current
      }

      setError("")
      return [...current, value]
    })
  }

  function confirmSalad() {
    if (!saladModal) return

    if (!saladBase) {
      setError("Selecciona una base.")
      return
    }

    if (!saladDressing) {
      setError("Selecciona un aderezo.")
      return
    }

    addCartItem(
      saladModal.product,
      saladModal.variant,
      [],
      {
        base: saladBase,
        protein: saladProtein,
        ingredients: saladIngredients,
        toppings: saladToppings,
        dressing: saladDressing,
      },
    )

    setSaladModal(null)
    setSaladBase("")
    setSaladProtein([])
    setSaladIngredients([])
    setSaladToppings([])
    setSaladDressing("")
    setError("")
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
              customization:
                item.customization,
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

    setCartOpen(false)
    setSubmitting(false)
  }

  return (
    <main className="min-h-screen bg-[#f4f5f1] p-4 sm:p-6 lg:p-8">
      <div className="grid gap-6">
        <section className="min-w-0 space-y-5">
          <div className="rounded-[24px] border border-[#dfe4dc] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center justify-between gap-3">
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

                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  aria-label="Abrir carrito"
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#dce2d9] bg-white text-[#102019] shadow-sm"
                >
                  <ShoppingCart className="h-5 w-5" />

                  {cartItemCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#1f6a3a] px-1.5 text-xs font-bold text-white">
                      {cartItemCount > 99
                        ? "99+"
                        : cartItemCount}
                    </span>
                  )}
                </button>
              </div>

              <button
                type="button"
                disabled={callingWaiter}
                onClick={callWaiterFromMenu}
                className="flex h-11 w-full items-center justify-center rounded-xl border border-[#102019] bg-white px-4 text-sm font-semibold text-[#102019] transition hover:bg-[#f3f6f2] disabled:opacity-50 lg:max-w-sm"
              >
                {callingWaiter
                  ? "Enviando solicitud..."
                  : "🔔 Llamar al mesero"}
              </button>
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

                              {variantQuantity(variant.id) > 0 && (
                                <>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      decrementVariant(
                                        variant.id,
                                      )
                                    }}
                                    onKeyDown={(event) => {
                                      if (
                                        event.key === "Enter" ||
                                        event.key === " "
                                      ) {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        decrementVariant(
                                          variant.id,
                                        )
                                      }
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#dce2d9] bg-white text-lg font-semibold text-[#172018]"
                                  >
                                    −
                                  </span>

                                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[#1f6a3a] px-1.5 text-xs font-bold text-white">
                                    {variantQuantity(variant.id)}
                                  </span>
                                </>
                              )}

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

        {cartOpen && (
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
            onClick={() => setCartOpen(false)}
          >
            <div
              className="max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-t-[24px] border border-[#dfe4dc] bg-white shadow-xl sm:max-w-lg sm:rounded-[24px]"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
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

                <div className="flex items-center gap-3">
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={clearOrder}
                      aria-label="Vaciar pedido"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setCartOpen(false)
                    }
                    aria-label="Cerrar carrito"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dce2d9]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[34vh] overflow-y-auto">
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

                      {item.customization && (
                        <div className="mt-2 text-xs text-[#1f6a3a]">
                          <p>
                            Base: {item.customization.base}
                          </p>

                          {item.customization.protein.length > 0 && (
                            <p>
                              Proteína: {item.customization.protein.join(", ")}
                            </p>
                          )}

                          {item.customization.ingredients.length > 0 && (
                            <p>
                              Ingredientes: {item.customization.ingredients.join(", ")}
                            </p>
                          )}

                          {item.customization.toppings.length > 0 && (
                            <p>
                              Toppings: {item.customization.toppings.join(", ")}
                            </p>
                          )}

                          <p>
                            Aderezo: {item.customization.dressing}
                          </p>
                        </div>
                      )}
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
                    onChange={(event) => {
                      setTableNumber(
                        event.target.value,
                      )
                      setWaiterMessage("")
                    }}
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
          </div>
        )}
      </div>

      {saladModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl">

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[#172018]">
                  Arma tu ensalada
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {saladModal.variant.name} · {money(saladModal.variant.sale_price)}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSaladModal(null)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dce2d9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <section className="mt-6">
              <h3 className="mb-3 font-semibold">
                1. Elige tu base
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {SALAD_BASES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      setSaladBase(item)
                    }
                    className={
                      saladBase === item
                        ? "rounded-xl border border-[#1f6a3a] bg-[#eef3ed] p-3 text-sm font-semibold text-[#1f6a3a]"
                        : "rounded-xl border border-[#dce2d9] p-3 text-sm"
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="mb-3 font-semibold">
                2. Proteína
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {SALAD_PROTEINS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      toggleProtein(item)
                    }
                    className={
                      saladProtein.includes(item)
                        ? "rounded-xl border border-[#1f6a3a] bg-[#eef3ed] p-3 text-sm font-semibold text-[#1f6a3a]"
                        : "rounded-xl border border-[#dce2d9] p-3 text-sm"
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="mb-3 font-semibold">
                3. Ingredientes
              </h3>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SALAD_INGREDIENTS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      toggleIngredient(item)
                    }
                    className={
                      saladIngredients.includes(item)
                        ? "rounded-xl border border-[#1f6a3a] bg-[#eef3ed] p-3 text-sm font-semibold text-[#1f6a3a]"
                        : "rounded-xl border border-[#dce2d9] p-3 text-sm"
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="mb-3 font-semibold">
                4. Toppings
              </h3>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SALAD_TOPPINGS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      toggleTopping(item)
                    }
                    className={
                      saladToppings.includes(item)
                        ? "rounded-xl border border-[#1f6a3a] bg-[#eef3ed] p-3 text-sm font-semibold text-[#1f6a3a]"
                        : "rounded-xl border border-[#dce2d9] p-3 text-sm"
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="mb-3 font-semibold">
                5. Aderezo
              </h3>

              <div className="grid gap-2 sm:grid-cols-2">
                {SALAD_DRESSINGS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      setSaladDressing(item)
                    }
                    className={
                      saladDressing === item
                        ? "rounded-xl border border-[#1f6a3a] bg-[#eef3ed] p-3 text-sm font-semibold text-[#1f6a3a]"
                        : "rounded-xl border border-[#dce2d9] p-3 text-sm"
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={confirmSalad}
              className="mt-6 h-14 w-full rounded-xl bg-[#102019] font-semibold text-white"
            >
              Agregar al pedido
            </button>

          </div>
        </div>
      )}

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
    </main>
  )
}






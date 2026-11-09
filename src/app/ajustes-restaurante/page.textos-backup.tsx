"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  ChevronLeft,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  UtensilsCrossed,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"

type Product = {
  id: string
  name: string
  sku: string | null
  unit: string
  current_stock: number
}

type RestaurantProduct = {
  id: string
  name: string
  category: string
  description: string | null
  active: boolean
  sort_order: number
}

type RestaurantVariant = {
  id: string
  restaurant_product_id: string
  name: string
  sale_price: number
  active: boolean
  sort_order: number
}

type RecipeItem = {
  id: string
  restaurant_variant_id: string
  product_id: string
  quantity: number
  unit: string
  inventory_quantity: number
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0))
}

export default function AjustesRestaurantePage() {
  const supabase = useMemo(() => createClient(), [])

  const [products, setProducts] = useState<Product[]>([])
  const [restaurantProducts, setRestaurantProducts] =
    useState<RestaurantProduct[]>([])
  const [variants, setVariants] =
    useState<RestaurantVariant[]>([])
  const [recipes, setRecipes] =
    useState<RecipeItem[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const [dishSearch, setDishSearch] = useState("")
  const [selectedDishId, setSelectedDishId] = useState("")

  const [dishName, setDishName] = useState("")
  const [dishCategory, setDishCategory] = useState("")
  const [dishDescription, setDishDescription] = useState("")
  const [dishActive, setDishActive] = useState(true)

  const [selectedVariantId, setSelectedVariantId] = useState("")

  const [newVariantName, setNewVariantName] = useState("")
  const [newVariantPrice, setNewVariantPrice] = useState("")

  const [ingredientSearch, setIngredientSearch] = useState("")
  const [ingredientProductId, setIngredientProductId] = useState("")
  const [recipeQuantity, setRecipeQuantity] = useState("")
  const [recipeUnit, setRecipeUnit] = useState("")
  const [inventoryQuantity, setInventoryQuantity] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [
      productsResponse,
      dishesResponse,
      variantsResponse,
      recipesResponse,
    ] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, unit, current_stock")
        .eq("active", true)
        .order("name"),

      supabase
        .from("restaurant_products")
        .select(`
          id,
          name,
          category,
          description,
          active,
          sort_order
        `)
        .order("name"),

      supabase
        .from("restaurant_variants")
        .select(`
          id,
          restaurant_product_id,
          name,
          sale_price,
          active,
          sort_order
        `)
        .order("sort_order")
        .order("name"),

      supabase
        .from("restaurant_recipe_items")
        .select(`
          id,
          restaurant_variant_id,
          product_id,
          quantity,
          unit,
          inventory_quantity
        `),
    ])

    const firstError =
      productsResponse.error ||
      dishesResponse.error ||
      variantsResponse.error ||
      recipesResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setProducts(
      ((productsResponse.data ?? []) as Product[]).map(
        (item) => ({
          ...item,
          current_stock: Number(item.current_stock || 0),
        }),
      ),
    )

    setRestaurantProducts(
      (dishesResponse.data ?? []) as RestaurantProduct[],
    )

    setVariants(
      ((variantsResponse.data ?? []) as RestaurantVariant[]).map(
        (item) => ({
          ...item,
          sale_price: Number(item.sale_price || 0),
        }),
      ),
    )

    setRecipes(
      ((recipesResponse.data ?? []) as RecipeItem[]).map(
        (item) => ({
          ...item,
          quantity: Number(item.quantity || 0),
          inventory_quantity: Number(
            item.inventory_quantity || 0,
          ),
        }),
      ),
    )

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData])

  const selectedDish = restaurantProducts.find(
    (item) => item.id === selectedDishId,
  )

  const selectedVariant = variants.find(
    (item) => item.id === selectedVariantId,
  )

  const dishVariants = variants.filter(
    (item) =>
      item.restaurant_product_id === selectedDishId,
  )

  const variantRecipes = recipes.filter(
    (item) =>
      item.restaurant_variant_id === selectedVariantId,
  )

  const selectedIngredient = products.find(
    (item) => item.id === ingredientProductId,
  )

  function clearMessages() {
    setError("")
    setMessage("")
  }

  function selectDish(dish: RestaurantProduct) {
    clearMessages()

    setSelectedDishId(dish.id)
    setDishSearch(dish.name)
    setDishName(dish.name)
    setDishCategory(dish.category)
    setDishDescription(dish.description ?? "")
    setDishActive(dish.active)
    setSelectedVariantId("")

    setIngredientProductId("")
    setIngredientSearch("")
    setRecipeQuantity("")
    setRecipeUnit("")
    setInventoryQuantity("")
  }

  function newDish() {
    clearMessages()

    setSelectedDishId("")
    setDishSearch("")
    setDishName("")
    setDishCategory("")
    setDishDescription("")
    setDishActive(true)
    setSelectedVariantId("")

    setNewVariantName("")
    setNewVariantPrice("")

    setIngredientProductId("")
    setIngredientSearch("")
    setRecipeQuantity("")
    setRecipeUnit("")
    setInventoryQuantity("")
  }

  async function saveDish() {
    clearMessages()

    const name = dishName.trim()
    const category = dishCategory.trim()

    if (!name) {
      setError("Escribe el nombre del platillo.")
      return
    }

    if (!category) {
      setError("Escribe la categorÃ­a del platillo.")
      return
    }

    setSaving(true)

    if (selectedDishId) {
      const { error: updateError } = await supabase
        .from("restaurant_products")
        .update({
          name,
          category,
          description: dishDescription.trim() || null,
          active: dishActive,
        })
        .eq("id", selectedDishId)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      setMessage("Platillo actualizado correctamente.")
    } else {
      const { data, error: insertError } = await supabase
        .from("restaurant_products")
        .insert({
          name,
          category,
          description: dishDescription.trim() || null,
          active: dishActive,
        })
        .select(`
          id,
          name,
          category,
          description,
          active,
          sort_order
        `)
        .single()

      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }

      const created = data as RestaurantProduct

      setSelectedDishId(created.id)
      setDishSearch(created.name)

      setMessage("Platillo creado correctamente.")
    }

    await loadData()
    setSaving(false)
  }

  async function deactivateDish() {
    if (!selectedDishId || !selectedDish) return

    const confirmed = window.confirm(
      `Â¿Deseas desactivar "${selectedDish.name}"?`,
    )

    if (!confirmed) return

    setSaving(true)
    clearMessages()

    const { error: updateError } = await supabase
      .from("restaurant_products")
      .update({
        active: false,
      })
      .eq("id", selectedDishId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    newDish()
    await loadData()

    setMessage("Platillo desactivado.")
    setSaving(false)
  }

  async function createVariant() {
    clearMessages()

    if (!selectedDishId) {
      setError("Primero guarda o selecciona un platillo.")
      return
    }

    const name = newVariantName.trim()
    const price = Number(newVariantPrice)

    if (!name) {
      setError("Escribe el nombre del tamaÃ±o.")
      return
    }

    if (!Number.isFinite(price) || price < 0) {
      setError("Escribe un precio vÃ¡lido.")
      return
    }

    setSaving(true)

    const { data, error: insertError } = await supabase
      .from("restaurant_variants")
      .insert({
        restaurant_product_id: selectedDishId,
        name,
        sale_price: price,
        active: true,
      })
      .select(`
        id,
        restaurant_product_id,
        name,
        sale_price,
        active,
        sort_order
      `)
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    const created = data as RestaurantVariant

    setNewVariantName("")
    setNewVariantPrice("")
    setSelectedVariantId(created.id)

    await loadData()

    setMessage("TamaÃ±o agregado correctamente.")
    setSaving(false)
  }


  async function saveAllVariantPrices() {
    clearMessages()

    if (!selectedDishId) return

    const priceInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        '[data-restaurant-variant-price="true"]',
      ),
    )

    const nameInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        '[data-restaurant-variant-name="true"]',
      ),
    )

    setSaving(true)

    for (const variant of dishVariants) {
      const priceInput = priceInputs.find(
        (input) => input.dataset.variantId === variant.id,
      )

      const nameInput = nameInputs.find(
        (input) => input.dataset.variantId === variant.id,
      )

      const price = Number(priceInput?.value ?? variant.sale_price)
      const name = (nameInput?.value ?? variant.name).trim()

      if (!name) {
        setError("El nombre del tamaño no puede estar vacío.")
        setSaving(false)
        return
      }

      if (!Number.isFinite(price) || price < 0) {
        setError(`Precio inválido para ${name}.`)
        setSaving(false)
        return
      }

      const { error: updateError } = await supabase
        .from("restaurant_variants")
        .update({
          name,
          sale_price: price,
        })
        .eq("id", variant.id)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }
    }

    setMessage("Tamaños y precios actualizados correctamente.")

    await loadData()
    setSaving(false)
  }

  async function updateVariant(
    variantId: string,
    name: string,
    price: number,
    active: boolean,
  ) {
    clearMessages()

    if (!name.trim()) {
      setError("El tamaÃ±o necesita un nombre.")
      return
    }

    if (!Number.isFinite(price) || price < 0) {
      setError("El precio no es vÃ¡lido.")
      return
    }

    setSaving(true)

    const { error: updateError } = await supabase
      .from("restaurant_variants")
      .update({
        name: name.trim(),
        sale_price: price,
        active,
      })
      .eq("id", variantId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    await loadData()

    setMessage("TamaÃ±o actualizado.")
    setSaving(false)
  }

  async function deleteVariant(variant: RestaurantVariant) {
    const confirmed = window.confirm(
      `Â¿Eliminar el tamaÃ±o "${variant.name}" y su receta?`,
    )

    if (!confirmed) return

    setSaving(true)
    clearMessages()

    const { error: deleteError } = await supabase
      .from("restaurant_variants")
      .delete()
      .eq("id", variant.id)

    if (deleteError) {
      setError(deleteError.message)
      setSaving(false)
      return
    }

    if (selectedVariantId === variant.id) {
      setSelectedVariantId("")
    }

    await loadData()

    setMessage("TamaÃ±o eliminado.")
    setSaving(false)
  }

  function selectIngredient(product: Product) {
    setIngredientProductId(product.id)
    setIngredientSearch(product.name)

    if (!recipeUnit) {
      setRecipeUnit(product.unit)
    }
  }

  async function addVariant() {
    clearMessages()

    if (!selectedDishId) {
      setError("Primero guarda el platillo.")
      return
    }

    const name = newVariantName.trim()
    const price = Number(newVariantPrice)

    if (!name) {
      setError("Escribe el nombre del tamaño.")
      return
    }

    if (!Number.isFinite(price) || price < 0) {
      setError("Escribe un precio válido.")
      return
    }

    const duplicated = dishVariants.some(
      (item) =>
        item.name.trim().toLowerCase() ===
        name.toLowerCase(),
    )

    if (duplicated) {
      setError("Ese tamaño ya existe en este platillo.")
      return
    }

    setSaving(true)

    const { data, error: insertError } = await supabase
      .from("restaurant_variants")
      .insert({
        restaurant_product_id: selectedDishId,
        name,
        sale_price: price,
        active: true,
        sort_order: dishVariants.length + 1,
      })
      .select(`
        id,
        restaurant_product_id,
        name,
        sale_price,
        active,
        sort_order
      `)
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    const created = data as RestaurantVariant

    setNewVariantName("")
    setNewVariantPrice("")
    setSelectedVariantId(created.id)

    setMessage(
      `Tamaño "${created.name}" agregado correctamente.`,
    )

    await loadData()
    setSaving(false)
  }
  async function addRecipeIngredient() {
    clearMessages()

    if (!selectedVariantId) {
      setError("Selecciona un tamaÃ±o.")
      return
    }

    if (!ingredientProductId) {
      setError("Selecciona un ingrediente del inventario.")
      return
    }

    const visibleQuantity = Number(recipeQuantity)
    const stockQuantity = Number(inventoryQuantity)

    if (
      !Number.isFinite(visibleQuantity) ||
      visibleQuantity <= 0
    ) {
      setError("La cantidad de la receta debe ser mayor a cero.")
      return
    }

    if (!recipeUnit.trim()) {
      setError("Indica la unidad de la receta.")
      return
    }

    if (
      !Number.isFinite(stockQuantity) ||
      stockQuantity <= 0
    ) {
      setError(
        "Indica cuÃ¡nto debe descontarse realmente del inventario.",
      )
      return
    }

    setSaving(true)

    const existing = recipes.find(
      (item) =>
        item.restaurant_variant_id === selectedVariantId &&
        item.product_id === ingredientProductId,
    )

    let recipeError = null

    if (existing) {
      const response = await supabase
        .from("restaurant_recipe_items")
        .update({
          quantity: visibleQuantity,
          unit: recipeUnit.trim(),
          inventory_quantity: stockQuantity,
        })
        .eq("id", existing.id)

      recipeError = response.error
    } else {
      const response = await supabase
        .from("restaurant_recipe_items")
        .insert({
          restaurant_variant_id: selectedVariantId,
          product_id: ingredientProductId,
          quantity: visibleQuantity,
          unit: recipeUnit.trim(),
          inventory_quantity: stockQuantity,
        })

      recipeError = response.error
    }

    if (recipeError) {
      setError(recipeError.message)
      setSaving(false)
      return
    }

    setIngredientProductId("")
    setIngredientSearch("")
    setRecipeQuantity("")
    setRecipeUnit("")
    setInventoryQuantity("")

    await loadData()

    setMessage("Ingrediente guardado en la receta.")
    setSaving(false)
  }

  function editRecipeItem(item: RecipeItem) {
    const product = products.find(
      (candidate) => candidate.id === item.product_id,
    )

    setIngredientProductId(item.product_id)
    setIngredientSearch(product?.name ?? "Ingrediente")
    setRecipeQuantity(String(item.quantity))
    setRecipeUnit(item.unit)
    setInventoryQuantity(String(item.inventory_quantity))
  }

  async function deleteRecipeItem(item: RecipeItem) {
    const product = products.find(
      (candidate) => candidate.id === item.product_id,
    )

    const confirmed = window.confirm(
      `Â¿Quitar "${product?.name ?? "ingrediente"}" de esta receta?`,
    )

    if (!confirmed) return

    setSaving(true)
    clearMessages()

    const { error: deleteError } = await supabase
      .from("restaurant_recipe_items")
      .delete()
      .eq("id", item.id)

    if (deleteError) {
      setError(deleteError.message)
      setSaving(false)
      return
    }

    await loadData()

    setMessage("Ingrediente eliminado de la receta.")
    setSaving(false)
  }

  if (loading) {
    return (
      <AppShell
        title="Ajustes de restaurante"
        description="Platillos, tamaÃ±os, precios y recetas"
      >
        <div className="flex min-h-72 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#1f6a3a]" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      title="Ajustes de restaurante"
      description="Platillos, tamaÃ±os, precios y recetas"
    >
      <div className="mb-5 flex flex-wrap gap-2">
        <a
          href="/ajustes-inventario"
          className="rounded-xl border border-[#dce2d9] bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
        >
          Inventario
        </a>

        <a
          href="/ajustes-restaurante"
          className="rounded-xl bg-[#102019] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Restaurante
        </a>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[370px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <article className="rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-[#1f6a3a]" />

                <h2 className="text-lg font-semibold">
                  Platillos
                </h2>
              </div>

              <button
                type="button"
                onClick={newDish}
                className="flex h-9 items-center gap-1 rounded-lg bg-[#eef3ed] px-3 text-xs font-semibold text-[#1f6a3a]"
              >
                <Plus className="h-4 w-4" />
                Nuevo
              </button>
            </div>

            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={dishSearch}
                onChange={(event) => {
                  setDishSearch(event.target.value)
                  setSelectedDishId("")
                }}
                placeholder="Buscar platillo..."
                className="h-11 w-full rounded-xl border border-[#dce2d9] pl-10 pr-3 text-sm outline-none focus:border-[#1f6a3a]"
              />
            </div>

            {dishSearch.trim() && !selectedDishId && (
              <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-[#dce2d9] p-1">
                {restaurantProducts
                  .filter((dish) => {
                    const term = dishSearch.toLowerCase().trim()

                    return (
                      dish.name.toLowerCase().includes(term) ||
                      dish.category.toLowerCase().includes(term)
                    )
                  })
                  .slice(0, 20)
                  .map((dish) => (
                    <button
                      key={dish.id}
                      type="button"
                      onClick={() => selectDish(dish)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-[#f5f7f3]"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {dish.name}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-400">
                          {dish.category}
                        </p>
                      </div>

                      {!dish.active && (
                        <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600">
                          Inactivo
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Nombre
                </label>

                <input
                  value={dishName}
                  onChange={(event) =>
                    setDishName(event.target.value)
                  }
                  placeholder="Ej. Ensalada CÃ©sar"
                  className="h-11 w-full rounded-xl border border-[#dce2d9] px-3 text-sm outline-none focus:border-[#1f6a3a]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  CategorÃ­a
                </label>

                <input
                  value={dishCategory}
                  onChange={(event) =>
                    setDishCategory(event.target.value)
                  }
                  placeholder="Ej. Ensaladas"
                  className="h-11 w-full rounded-xl border border-[#dce2d9] px-3 text-sm outline-none focus:border-[#1f6a3a]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  DescripciÃ³n
                </label>

                <textarea
                  value={dishDescription}
                  onChange={(event) =>
                    setDishDescription(event.target.value)
                  }
                  rows={3}
                  placeholder="DescripciÃ³n opcional"
                  className="w-full resize-none rounded-xl border border-[#dce2d9] p-3 text-sm outline-none focus:border-[#1f6a3a]"
                />
              </div>

              <label className="flex items-center justify-between rounded-xl border border-[#dce2d9] px-3 py-3">
                <span>
                  <span className="block text-sm font-medium">
                    Platillo activo
                  </span>

                  <span className="text-xs text-slate-400">
                    Aparece en Restaurante
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={dishActive}
                  onChange={(event) =>
                    setDishActive(event.target.checked)
                  }
                  className="h-5 w-5"
                />
              </label>

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDish()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#102019] text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                {selectedDishId
                  ? "Guardar cambios"
                  : "Crear platillo"}
              </button>

              {selectedDishId && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void deactivateDish()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Desactivar platillo
                </button>
              )}
            </div>
          </article>
        </aside>

        <div className="min-w-0 space-y-5">
          {!selectedDishId ? (
            <article className="flex min-h-96 flex-col items-center justify-center rounded-2xl border border-[#dde2da] bg-white p-8 text-center shadow-sm">
              <UtensilsCrossed className="h-10 w-10 text-slate-300" />

              <h2 className="mt-4 text-lg font-semibold">
                Selecciona o crea un platillo
              </h2>

              <p className="mt-2 max-w-md text-sm text-slate-500">
                DespuÃ©s podrÃ¡s configurar tamaÃ±os, precios e ingredientes diferentes para cada presentaciÃ³n.
              </p>
            </article>
          ) : (
            <>
              <article className="rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-lg font-semibold">
                    TamaÃ±os y precios
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Captura el precio de cada medida y guarda todos los precios de una sola vez.
                  </p>
                </div>

                <div className="mt-5 rounded-2xl border border-[#dce2d9] bg-[#f8faf7] p-4">
                  <p className="text-sm font-semibold text-[#172018]">
                    Agregar tamaño
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Nombre del tamaño
                      </label>

                      <input
                        type="text"
                        value={newVariantName}
                        onChange={(event) =>
                          setNewVariantName(event.target.value)
                        }
                        placeholder="Ej. Chico, Mediano, Grande"
                        className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none focus:border-[#1f6a3a]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Precio
                      </label>

                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#1f6a3a]">
                          $
                        </span>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newVariantPrice}
                          onChange={(event) =>
                            setNewVariantPrice(event.target.value)
                          }
                          placeholder="0.00"
                          className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white pl-8 pr-3 text-sm font-semibold outline-none focus:border-[#1f6a3a]"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void addVariant()}
                      className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1f6a3a] px-5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {dishVariants.map((variant) => (
                    <div
                      key={variant.id}
                      className="rounded-2xl border border-[#dce2d9] bg-white p-4"
                    >
                      <div className="grid gap-3 sm:grid-cols-[1fr_220px] sm:items-end">
                        <div>
                          <p className="mb-1 text-xs font-medium text-slate-400">
                            TamaÃ±o
                          </p>

                          <input
                            type="text"
                            defaultValue={variant.name}
                            data-restaurant-variant-name="true"
                            data-variant-id={variant.id}
                            className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white px-4 text-sm font-semibold text-[#172018] outline-none focus:border-[#1f6a3a]"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-400">
                            Precio
                          </label>

                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#1f6a3a]">
                              $
                            </span>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={variant.sale_price}
                              data-restaurant-variant-price="true"
                              data-variant-id={variant.id}
                              className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white pl-8 pr-3 text-sm font-semibold outline-none focus:border-[#1f6a3a]"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedVariantId(variant.id)
                        }
                        className="mt-3 text-sm font-semibold text-[#1f6a3a]"
                      >
                        {selectedVariantId === variant.id
                          ? "Editando receta"
                          : "Editar receta"}
                      </button>
                    </div>
                  ))}

                  {dishVariants.length === 0 && (
                    <div className="rounded-xl bg-[#f5f7f3] px-4 py-4 text-sm text-slate-500">
                      Este platillo todavÃ­a no tiene tamaÃ±os.
                    </div>
                  )}

                  {dishVariants.length > 0 && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void saveAllVariantPrices()
                      }
                      className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#102019] px-5 text-sm font-semibold text-white transition hover:bg-[#173126] disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {saving
                        ? "Guardando..."
                        : "Guardar precios"}
                    </button>
                  )}
                </div>

                
              </article>

              <article className="rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Receta
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedVariant
                        ? `${selectedDish?.name} Â· ${selectedVariant.name}`
                        : "Selecciona un tamaÃ±o arriba."}
                    </p>
                  </div>

                  {selectedVariant && (
                    <span className="rounded-full bg-[#eef3ed] px-3 py-1.5 text-sm font-semibold text-[#1f6a3a]">
                      {money(selectedVariant.sale_price)}
                    </span>
                  )}
                </div>

                {!selectedVariant ? (
                  <div className="mt-5 rounded-xl bg-[#f5f7f3] p-5 text-sm text-slate-500">
                    Selecciona uno de los tamaÃ±os para editar su receta.
                  </div>
                ) : (
                  <>
                    <div className="mt-5 overflow-x-auto rounded-xl border border-[#e2e6df]">
                      <table className="w-full min-w-[680px]">
                        <thead className="bg-[#f6f8f4]">
                          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="px-4 py-3">
                              Ingrediente
                            </th>
                            <th className="px-4 py-3">
                              Receta
                            </th>
                            <th className="px-4 py-3">
                              Descuenta
                            </th>
                            <th className="px-4 py-3">
                              Stock actual
                            </th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-[#edf0eb]">
                          {variantRecipes.map((item) => {
                            const product = products.find(
                              (candidate) =>
                                candidate.id === item.product_id,
                            )

                            return (
                              <tr key={item.id}>
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      editRecipeItem(item)
                                    }
                                    className="text-left"
                                  >
                                    <p className="text-sm font-medium text-[#172018]">
                                      {product?.name ??
                                        "Producto"}
                                    </p>

                                    <p className="text-xs text-slate-400">
                                      {product?.sku ??
                                        "Sin SKU"}
                                    </p>
                                  </button>
                                </td>

                                <td className="px-4 py-3 text-sm">
                                  {item.quantity} {item.unit}
                                </td>

                                <td className="px-4 py-3 text-sm font-medium">
                                  {item.inventory_quantity}{" "}
                                  {product?.unit}
                                </td>

                                <td className="px-4 py-3 text-sm">
                                  {product?.current_stock ?? 0}{" "}
                                  {product?.unit}
                                </td>

                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void deleteRecipeItem(item)
                                    }
                                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}

                          {variantRecipes.length === 0 && (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-4 py-10 text-center text-sm text-slate-400"
                              >
                                TodavÃ­a no hay ingredientes en esta receta.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-6 rounded-2xl bg-[#f6f8f4] p-4">
                      <h3 className="font-semibold">
                        Agregar o editar ingrediente
                      </h3>

                      <div className="relative mt-4">
                        <label className="mb-1.5 block text-xs font-medium text-slate-500">
                          Ingrediente del inventario
                        </label>

                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                          <input
                            value={ingredientSearch}
                            onChange={(event) => {
                              setIngredientSearch(
                                event.target.value,
                              )
                              setIngredientProductId("")
                            }}
                            placeholder="Buscar lechuga, pollo, limÃ³n..."
                            className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#1f6a3a]"
                          />
                        </div>

                        {ingredientSearch.trim() &&
                          !ingredientProductId && (
                            <div className="absolute left-0 right-0 top-[72px] z-30 max-h-64 overflow-y-auto rounded-xl border border-[#dce2d9] bg-white p-1 shadow-xl">
                              {products
                                .filter((product) => {
                                  const term =
                                    ingredientSearch
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
                                .slice(0, 15)
                                .map((product) => (
                                  <button
                                    key={product.id}
                                    type="button"
                                    onClick={() =>
                                      selectIngredient(product)
                                    }
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-[#f5f7f3]"
                                  >
                                    <div>
                                      <p className="text-sm font-medium">
                                        {product.name}
                                      </p>

                                      <p className="text-xs text-slate-400">
                                        Stock:{" "}
                                        {product.current_stock}{" "}
                                        {product.unit}
                                      </p>
                                    </div>

                                    <span className="text-xs font-medium text-[#1f6a3a]">
                                      {product.unit}
                                    </span>
                                  </button>
                                ))}
                            </div>
                          )}
                      </div>

                      {selectedIngredient && (
                        <div className="mt-3 rounded-xl border border-[#dce2d9] bg-white p-3 text-sm">
                          <span className="font-medium">
                            {selectedIngredient.name}
                          </span>

                          <span className="ml-2 text-slate-400">
                            Inventario en{" "}
                            {selectedIngredient.unit}
                          </span>
                        </div>
                      )}

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-500">
                            Cantidad en receta
                          </label>

                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={recipeQuantity}
                            onChange={(event) =>
                              setRecipeQuantity(
                                event.target.value,
                              )
                            }
                            placeholder="200"
                            className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none focus:border-[#1f6a3a]"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-500">
                            Unidad de receta
                          </label>

                          <input
                            value={recipeUnit}
                            onChange={(event) =>
                              setRecipeUnit(event.target.value)
                            }
                            placeholder="g, ml, pieza..."
                            className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none focus:border-[#1f6a3a]"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-500">
                            Descuento de inventario
                          </label>

                          <input
                            type="number"
                            min="0"
                            step="0.000001"
                            value={inventoryQuantity}
                            onChange={(event) =>
                              setInventoryQuantity(
                                event.target.value,
                              )
                            }
                            placeholder={
                              selectedIngredient
                                ? `Cantidad en ${selectedIngredient.unit}`
                                : "0.200"
                            }
                            className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm outline-none focus:border-[#1f6a3a]"
                          />
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-xs text-blue-700">
                        Ejemplo: si la receta usa 200 g de lechuga y en Inventario la lechuga se maneja en kg, escribe 200 g y en "Descuento de inventario" escribe 0.200.
                      </div>

                      <button
                        type="button"
                        disabled={
                          saving ||
                          !ingredientProductId
                        }
                        onClick={() =>
                          void addRecipeIngredient()
                        }
                        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#102019] text-sm font-semibold text-white disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        Guardar ingrediente
                      </button>
                    </div>
                  </>
                )}
              </article>
            </>
          )}
        </div>
      </section>
    </AppShell>
  )
}

function VariantRow({
  variant,
  selected,
  saving,
  onSelect,
  onSave,
  onDelete,
}: {
  variant: RestaurantVariant
  selected: boolean
  saving: boolean
  onSelect: () => void
  onSave: (
    id: string,
    name: string,
    price: number,
    active: boolean,
  ) => Promise<void>
  onDelete: (
    variant: RestaurantVariant,
  ) => Promise<void>
}) {
  const [name, setName] = useState(variant.name)
  const [price, setPrice] = useState(
    String(variant.sale_price),
  )
  const [active, setActive] = useState(variant.active)

  useEffect(() => {
    setName(variant.name)
    setPrice(String(variant.sale_price))
    setActive(variant.active)
  }, [variant])

  return (
    <div
      className={`rounded-xl border p-3 ${
        selected
          ? "border-[#1f6a3a] bg-[#f3f7f2]"
          : "border-[#dce2d9]"
      }`}
    >
      <div className="grid gap-3 md:grid-cols-[1fr_150px_auto]">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 text-left"
        >
          <p className="text-xs font-medium text-slate-400">
            TamaÃ±o
          </p>

          <input
            value={name}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-[#dce2d9] bg-white px-3 text-sm"
          />
        </button>

        <div>
          <p className="text-xs font-medium text-slate-400">
            Precio
          </p>

          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-[#dce2d9] bg-white px-3 text-sm"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void onSave(
                variant.id,
                name,
                Number(price),
                active,
              )
            }
            className="flex h-10 items-center justify-center rounded-lg bg-[#102019] px-3 text-white disabled:opacity-50"
            title="Guardar tamaÃ±o"
          >
            <Save className="h-4 w-4" />
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void onDelete(variant)}
            className="flex h-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 text-red-600 disabled:opacity-50"
            title="Eliminar tamaÃ±o"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onSelect}
          className="text-xs font-semibold text-[#1f6a3a]"
        >
          {selected
            ? "Editando receta"
            : "Editar receta"}
        </button>

        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) =>
              setActive(event.target.checked)
            }
          />
          Activo
        </label>
      </div>
    </div>
  )
}


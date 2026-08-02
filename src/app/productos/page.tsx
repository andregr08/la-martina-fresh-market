"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  CheckCircle2,
  Edit3,
  Loader2,
  PackagePlus,
  RefreshCw,
  Save,
  Search,
  Snowflake,
  Tags,
  X,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type Category = {
  id: string
  name: string
}

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
  shelf_life_days: number | null
  refrigerated: boolean
  active: boolean
  category_id: string | null
  category: {
    name: string
  } | null
}

type ProductForm = {
  sku: string
  name: string
  unit: string
  categoryId: string
  purchasePrice: string
  salePrice: string
  minimumStock: string
  idealStock: string
  shelfLifeDays: string
  refrigerated: boolean
  active: boolean
}

const emptyForm: ProductForm = {
  sku: "",
  name: "",
  unit: "kg",
  categoryId: "",
  purchasePrice: "0",
  salePrice: "0",
  minimumStock: "0",
  idealStock: "0",
  shelfLifeDays: "",
  refrigerated: false,
  active: true,
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0))
}

function quantity(value: number, unit: string) {
  return `${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} ${unit}`
}

function marginPercent(
  purchasePrice: number,
  salePrice: number,
) {
  if (salePrice <= 0) return 0

  return ((salePrice - purchasePrice) / salePrice) * 100
}

export default function ProductosPage() {
  const supabase = useMemo(() => createClient(), [])

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] =
    useState("Todas")
  const [statusFilter, setStatusFilter] =
    useState("Todos")

  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [productsResponse, categoriesResponse] =
      await Promise.all([
        supabase
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
            shelf_life_days,
            refrigerated,
            active,
            category_id,
            category:categories (
              name
            )
          `)
          .order("name"),

        supabase
          .from("categories")
          .select("id, name")
          .order("name"),
      ])

    const firstError =
      productsResponse.error ||
      categoriesResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setProducts(
      (productsResponse.data ?? []) as unknown as Product[],
    )

    setCategories(
      (categoriesResponse.data ?? []) as Category[],
    )

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredProducts = useMemo(() => {
    const value = search.trim().toLowerCase()

    return products.filter((product) => {
      const matchesSearch =
        !value ||
        product.name.toLowerCase().includes(value) ||
        product.sku?.toLowerCase().includes(value)

      const matchesCategory =
        categoryFilter === "Todas" ||
        product.category?.name === categoryFilter

      const matchesStatus =
        statusFilter === "Todos" ||
        (statusFilter === "Activos" && product.active) ||
        (statusFilter === "Inactivos" && !product.active)

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus
      )
    })
  }, [
    products,
    search,
    categoryFilter,
    statusFilter,
  ])

  const summary = useMemo(() => {
    return products.reduce(
      (totals, product) => {
        totals.total += 1

        if (product.active) {
          totals.active += 1
        } else {
          totals.inactive += 1
        }

        totals.value +=
          Number(product.current_stock || 0) *
          Number(product.purchase_price || 0)

        totals.margin += marginPercent(
          Number(product.purchase_price || 0),
          Number(product.sale_price || 0),
        )

        return totals
      },
      {
        total: 0,
        active: 0,
        inactive: 0,
        value: 0,
        margin: 0,
      },
    )
  }, [products])

  const averageMargin =
    summary.total > 0
      ? summary.margin / summary.total
      : 0

  function openNewProduct() {
    setEditingProduct(null)
    setForm(emptyForm)
    setError("")
    setMessage("")
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product)

    setForm({
      sku: product.sku ?? "",
      name: product.name,
      unit: product.unit,
      categoryId: product.category_id ?? "",
      purchasePrice: String(product.purchase_price ?? 0),
      salePrice: String(product.sale_price ?? 0),
      minimumStock: String(product.minimum_stock ?? 0),
      idealStock: String(product.ideal_stock ?? 0),
      shelfLifeDays:
        product.shelf_life_days !== null
          ? String(product.shelf_life_days)
          : "",
      refrigerated: product.refrigerated,
      active: product.active,
    })

    setError("")
    setMessage("")
  }

  function closeForm() {
    setEditingProduct(null)
    setForm(emptyForm)
  }

  async function saveProduct() {
    setError("")
    setMessage("")

    if (!form.name.trim()) {
      setError("El nombre del producto es obligatorio.")
      return
    }

    if (!form.unit.trim()) {
      setError("La unidad es obligatoria.")
      return
    }

    const purchasePrice = Number(form.purchasePrice)
    const salePrice = Number(form.salePrice)
    const minimumStock = Number(form.minimumStock)
    const idealStock = Number(form.idealStock)
    const shelfLifeDays =
      form.shelfLifeDays.trim() === ""
        ? null
        : Number(form.shelfLifeDays)

    if (
      [purchasePrice, salePrice, minimumStock, idealStock].some(
        (value) =>
          !Number.isFinite(value) || value < 0,
      )
    ) {
      setError("Revisa precios y niveles de inventario.")
      return
    }

    if (
      shelfLifeDays !== null &&
      (!Number.isFinite(shelfLifeDays) ||
        shelfLifeDays < 0)
    ) {
      setError("La vida útil no es válida.")
      return
    }

    setSaving(true)

    const payload = {
      sku: form.sku.trim() || null,
      name: form.name.trim(),
      unit: form.unit.trim(),
      category_id: form.categoryId || null,
      purchase_price: purchasePrice,
      sale_price: salePrice,
      minimum_stock: minimumStock,
      ideal_stock: idealStock,
      shelf_life_days: shelfLifeDays,
      refrigerated: form.refrigerated,
      active: form.active,
      updated_at: new Date().toISOString(),
    }

    let productError

    if (editingProduct) {
      const response = await supabase
        .from("products")
        .update(payload)
        .eq("id", editingProduct.id)

      productError = response.error
    } else {
      const response = await supabase
        .from("products")
        .insert({
          ...payload,
          current_stock: 0,
        })

      productError = response.error
    }

    if (productError) {
      setError(productError.message)
      setSaving(false)
      return
    }

    setMessage(
      editingProduct
        ? "Producto actualizado correctamente."
        : "Producto creado correctamente.",
    )

    closeForm()
    await loadData()
    setSaving(false)
  }

  return (
    <AppShell
      title="Productos"
      description="Catálogo, precios, márgenes y niveles de inventario."
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

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={openNewProduct}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#102019] px-4 text-sm font-medium text-white"
        >
          <PackagePlus className="h-4 w-4" />
          Nuevo producto
        </button>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadData()}
          disabled={loading}
          className="rounded-xl"
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
        <article className="rounded-[20px] border border-[#dde2da] bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f3eb] text-[#1f6a3a]">
            <Tags className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Productos registrados
          </p>

          <p className="mt-2 text-[28px] font-semibold">
            {summary.total}
          </p>
        </article>

        <article className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-emerald-700">
            Productos activos
          </p>

          <p className="mt-2 text-[28px] font-semibold text-emerald-950">
            {summary.active}
          </p>
        </article>

        <article className="rounded-[20px] border border-[#dde2da] bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
            <PackagePlus className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Valor del inventario
          </p>

          <p className="mt-2 text-[28px] font-semibold">
            {money(summary.value)}
          </p>
        </article>

        <article className="rounded-[20px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-700">
            <Tags className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-amber-700">
            Margen promedio
          </p>

          <p className="mt-2 text-[28px] font-semibold text-amber-950">
            {averageMargin.toFixed(1)}%
          </p>
        </article>
      </section>

      <section className="mt-6 overflow-hidden rounded-[24px] border border-[#dde2da] bg-white shadow-sm">
        <div className="border-b border-[#e6eae4] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Catálogo de productos
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {filteredProducts.length} resultados
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
                  placeholder="Buscar producto o SKU"
                  className="h-10 w-full rounded-xl border border-[#dce2d9] bg-[#f8f9f6] pl-9 pr-3 text-sm outline-none focus:border-[#1f6a3a] focus:bg-white"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
                className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
              >
                <option value="Todas">
                  Todas las categorías
                </option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.name}
                  >
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
              >
                <option value="Todos">
                  Todos los estados
                </option>
                <option value="Activos">Activos</option>
                <option value="Inactivos">Inactivos</option>
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
            <table className="w-full min-w-[1300px] text-left">
              <thead className="bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4">Existencia</th>
                  <th className="px-6 py-4">Compra</th>
                  <th className="px-6 py-4">Venta</th>
                  <th className="px-6 py-4">Margen</th>
                  <th className="px-6 py-4">Mínimo</th>
                  <th className="px-6 py-4">Ideal</th>
                  <th className="px-6 py-4">Conservación</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#edf0eb]">
                {filteredProducts.map((product) => {
                  const margin = marginPercent(
                    Number(product.purchase_price || 0),
                    Number(product.sale_price || 0),
                  )

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-[#fafbf8]"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium">
                          {product.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {product.sku ?? "Sin SKU"} · {product.unit}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {product.category?.name ??
                          "Sin categoría"}
                      </td>

                      <td className="px-6 py-4 font-semibold">
                        {quantity(
                          product.current_stock,
                          product.unit,
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {money(product.purchase_price)}
                      </td>

                      <td className="px-6 py-4 font-medium">
                        {money(product.sale_price)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            margin >= 30
                              ? "bg-emerald-50 text-emerald-700"
                              : margin >= 15
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                          }`}
                        >
                          {margin.toFixed(1)}%
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {quantity(
                          product.minimum_stock,
                          product.unit,
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {quantity(
                          product.ideal_stock,
                          product.unit,
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          {product.refrigerated && (
                            <Snowflake className="h-4 w-4 text-sky-600" />
                          )}

                          <span>
                            {product.shelf_life_days !== null
                              ? `${product.shelf_life_days} días`
                              : "Sin definir"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            product.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {product.active
                            ? "Activo"
                            : "Inactivo"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            openEditProduct(product)
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#dce2d9] px-3 text-xs font-medium text-slate-700 hover:bg-[#f5f7f3]"
                        >
                          <Edit3 className="h-4 w-4" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-6 py-20 text-center text-sm text-slate-500"
                    >
                      No se encontraron productos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(editingProduct !== null ||
        form !== emptyForm) && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[24px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#e6eae4] bg-white px-6 py-5">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {editingProduct
                    ? "Editar producto"
                    : "Nuevo producto"}
                </p>

                <h2 className="mt-1 text-xl font-semibold">
                  {editingProduct?.name ??
                    "Crear producto"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-[#dce2d9] p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Nombre
                </p>

                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="rounded-xl"
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  SKU
                </p>

                <Input
                  value={form.sku}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sku: event.target.value,
                    }))
                  }
                  className="rounded-xl"
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Categoría
                </p>

                <select
                  value={form.categoryId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      categoryId: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-[#dce2d9] px-3 text-sm"
                >
                  <option value="">
                    Sin categoría
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Unidad
                </p>

                <select
                  value={form.unit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unit: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-[#dce2d9] px-3 text-sm"
                >
                  <option value="kg">kg</option>
                  <option value="pieza">pieza</option>
                  <option value="manojo">manojo</option>
                  <option value="caja">caja</option>
                  <option value="paquete">paquete</option>
                  <option value="litro">litro</option>
                </select>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Precio de compra
                </p>

                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      purchasePrice: event.target.value,
                    }))
                  }
                  className="rounded-xl"
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Precio de venta
                </p>

                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.salePrice}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      salePrice: event.target.value,
                    }))
                  }
                  className="rounded-xl"
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Stock mínimo
                </p>

                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.minimumStock}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      minimumStock: event.target.value,
                    }))
                  }
                  className="rounded-xl"
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Stock ideal
                </p>

                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.idealStock}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      idealStock: event.target.value,
                    }))
                  }
                  className="rounded-xl"
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Vida útil en días
                </p>

                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.shelfLifeDays}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      shelfLifeDays: event.target.value,
                    }))
                  }
                  className="rounded-xl"
                />
              </div>

              <div className="flex items-center gap-6 pt-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.refrigerated}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        refrigerated:
                          event.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />

                  Refrigerado
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        active: event.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />

                  Activo
                </label>
              </div>
            </div>

            <div className="border-t border-[#e6eae4] p-6">
              <button
                type="button"
                onClick={() => void saveProduct()}
                disabled={saving}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#102019] text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}

                Guardar producto
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  )
}

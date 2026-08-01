"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Loader2,
  PackagePlus,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Product = {
  id: string
  name: string
  sku: string | null
  unit: string
}

type EntryItem = {
  product_id: string
  quantity: string
  unit_cost: string
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value)
}

export default function EntradasPage() {
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<EntryItem[]>([
    {
      product_id: "",
      quantity: "",
      unit_cost: "",
    },
  ])

  const [transportCost, setTransportCost] = useState("232")
  const [parkingCost, setParkingCost] = useState("20")
  const [loaderCost, setLoaderCost] = useState("")
  const [otherCosts, setOtherCosts] = useState("")
  const [notes, setNotes] = useState("")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: productsError } = await supabase
      .from("products")
      .select("id, name, sku, unit")
      .eq("active", true)
      .order("name")

    if (productsError) {
      setError(productsError.message)
      setLoading(false)
      return
    }

    setProducts((data ?? []) as Product[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const merchandiseSubtotal = useMemo(() => {
    return items.reduce((total, item) => {
      const quantity = Number(item.quantity)
      const cost = Number(item.unit_cost)

      if (!Number.isFinite(quantity) || !Number.isFinite(cost)) {
        return total
      }

      return total + quantity * cost
    }, 0)
  }, [items])

  const logisticsTotal =
    Number(transportCost || 0) +
    Number(parkingCost || 0) +
    Number(loaderCost || 0) +
    Number(otherCosts || 0)

  const total = merchandiseSubtotal + logisticsTotal

  function addItem() {
    setItems((current) => [
      ...current,
      {
        product_id: "",
        quantity: "",
        unit_cost: "",
      },
    ])
  }

  function removeItem(index: number) {
    setItems((current) => {
      if (current.length === 1) {
        return current
      }

      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  function updateItem(
    index: number,
    field: keyof EntryItem,
    value: string,
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    )
  }

  async function registerEntry() {
    setError("")
    setMessage("")

    const normalizedItems = items.map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity),
      unit_cost: Number(item.unit_cost),
    }))

    const invalidItem = normalizedItems.some(
      (item) =>
        !item.product_id ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unit_cost) ||
        item.unit_cost < 0,
    )

    if (invalidItem) {
      setError(
        "Completa correctamente producto, cantidad y costo de cada renglón.",
      )
      return
    }

    setSubmitting(true)

    const { data, error: rpcError } = await supabase.rpc(
      "register_purchase",
      {
        p_items: normalizedItems,
        p_transport_cost: Number(transportCost || 0),
        p_parking_cost: Number(parkingCost || 0),
        p_loader_cost: Number(loaderCost || 0),
        p_other_costs: Number(otherCosts || 0),
        p_payment_method: "cash",
        p_payment_status: "paid",
        p_notes: notes.trim() || null,
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }

    const result = data as {
      folio?: string
      total?: number
    }

    setMessage(
      `Entrada ${result.folio ?? ""} registrada correctamente por ${money(
        Number(result.total ?? total),
      )}.`,
    )

    setItems([
      {
        product_id: "",
        quantity: "",
        unit_cost: "",
      },
    ])
    setLoaderCost("")
    setOtherCosts("")
    setNotes("")
    setSubmitting(false)
  }

  return (
    <AppShell
      title="Entradas"
      description="Registro de mercancía recibida de La Martina Distribuidora."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5" />
              <h2 className="text-lg font-semibold">
                Nueva entrada
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Proveedor: La Martina Distribuidora
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void loadProducts()}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar productos
          </Button>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-[1.4fr_0.7fr_0.7fr_auto]"
                >
                  <div className="space-y-2">
                    <Label>Producto</Label>

                    <select
                      value={item.product_id}
                      onChange={(event) =>
                        updateItem(
                          index,
                          "product_id",
                          event.target.value,
                        )
                      }
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="">
                        Selecciona un producto
                      </option>

                      {products.map((product) => (
                        <option
                          key={product.id}
                          value={product.id}
                        >
                          {product.sku
                            ? `${product.sku} — `
                            : ""}
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Cantidad</Label>

                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(
                          index,
                          "quantity",
                          event.target.value,
                        )
                      }
                      placeholder="0.000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Costo por kg</Label>

                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_cost}
                      onChange={(event) =>
                        updateItem(
                          index,
                          "unit_cost",
                          event.target.value,
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addItem}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar producto
            </Button>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Transporte</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={transportCost}
                  onChange={(event) =>
                    setTransportCost(event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Estacionamiento</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={parkingCost}
                  onChange={(event) =>
                    setParkingCost(event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Diablero</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={loaderCost}
                  onChange={(event) =>
                    setLoaderCost(event.target.value)
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Otros gastos</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={otherCosts}
                  onChange={(event) =>
                    setOtherCosts(event.target.value)
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-3">
              <div>
                <p className="text-sm text-slate-500">
                  Mercancía
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {money(merchandiseSubtotal)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Logística
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {money(logisticsTotal)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Total de entrada
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {money(total)}
                </p>
              </div>
            </div>

            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={registerEntry}
              disabled={submitting}
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Registrar entrada
            </Button>
          </div>
        )}
      </section>
    </AppShell>
  )
}

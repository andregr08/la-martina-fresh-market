"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  PlusCircle,
  RefreshCw,
  Smartphone,
  WalletCards,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type ExpenseCategory = {
  id: string
  name: string
}

type Expense = {
  id: string
  amount: number
  payment_method: string
  description: string
  expense_date: string
  category: {
    name: string
  } | null
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0))
}

function paymentLabel(method: string) {
  if (method === "cash") return "Efectivo"
  if (method === "card") return "Tarjeta"
  if (method === "transfer") return "Transferencia"
  if (method === "credit") return "Crédito"
  return method
}

export default function GastosPage() {
  const supabase = createClient()

  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])

  const [categoryId, setCategoryId] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [description, setDescription] = useState("")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [categoriesResponse, expensesResponse] = await Promise.all([
      supabase
        .from("expense_categories")
        .select("id, name")
        .eq("active", true)
        .order("name"),

      supabase
        .from("expenses")
        .select(`
          id,
          amount,
          payment_method,
          description,
          expense_date,
          category:expense_categories (
            name
          )
        `)
        .order("expense_date", {
          ascending: false,
        })
        .limit(200),
    ])

    const firstError =
      categoriesResponse.error || expensesResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setCategories(
      (categoriesResponse.data ?? []) as ExpenseCategory[],
    )

    setExpenses(
      (expensesResponse.data ?? []) as unknown as Expense[],
    )

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const totalExpenses = useMemo(
    () =>
      expenses.reduce(
        (total, expense) => total + Number(expense.amount || 0),
        0,
      ),
    [expenses],
  )

  async function registerExpense() {
    setError("")
    setMessage("")

    const numericAmount = Number(amount)

    if (!categoryId) {
      setError("Selecciona una categoría.")
      return
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("El importe debe ser mayor a cero.")
      return
    }

    if (!description.trim()) {
      setError("Captura una descripción.")
      return
    }

    setSubmitting(true)

    const { data, error: rpcError } = await supabase.rpc(
      "register_expense",
      {
        p_category_id: categoryId,
        p_amount: numericAmount,
        p_payment_method: paymentMethod,
        p_description: description.trim(),
        p_receipt_url: null,
        p_expense_date: new Date().toISOString(),
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }

    const result = data as {
      category?: string
      amount?: number
    }

    setMessage(
      `Gasto de ${money(
        Number(result.amount ?? numericAmount),
      )} registrado en ${result.category ?? "la categoría seleccionada"}.`,
    )

    setCategoryId("")
    setAmount("")
    setPaymentMethod("cash")
    setDescription("")

    await loadData()
    setSubmitting(false)
  }

  return (
    <AppShell
      title="Gastos"
      description="Registro de gastos operativos del local."
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

      <section className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">
              Registrar gasto
            </h2>
          </div>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label>Categoría</Label>

              <select
                value={categoryId}
                onChange={(event) =>
                  setCategoryId(event.target.value)
                }
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">
                  Selecciona una categoría
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

            <div className="space-y-2">
              <Label>Importe</Label>

              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Método de pago</Label>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={
                    paymentMethod === "cash"
                      ? "default"
                      : "outline"
                  }
                  onClick={() => setPaymentMethod("cash")}
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  Efectivo
                </Button>

                <Button
                  type="button"
                  variant={
                    paymentMethod === "card"
                      ? "default"
                      : "outline"
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

                <Button
                  type="button"
                  variant={
                    paymentMethod === "credit"
                      ? "default"
                      : "outline"
                  }
                  onClick={() => setPaymentMethod("credit")}
                >
                  <WalletCards className="mr-2 h-4 w-4" />
                  Crédito
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>

              <Input
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Ej. Compra de bolsas"
              />
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={registerExpense}
              disabled={submitting}
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Registrar gasto
            </Button>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-semibold">
                Historial de gastos
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Total registrado: {money(totalExpenses)}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Actualizar
            </Button>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">
                      Fecha
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Categoría
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Descripción
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Método
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Importe
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {new Date(
                          expense.expense_date,
                        ).toLocaleString("es-MX")}
                      </td>

                      <td className="px-5 py-4">
                        {expense.category?.name ?? "Sin categoría"}
                      </td>

                      <td className="px-5 py-4">
                        {expense.description}
                      </td>

                      <td className="px-5 py-4">
                        {paymentLabel(expense.payment_method)}
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        {money(expense.amount)}
                      </td>
                    </tr>
                  ))}

                  {expenses.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        Todavía no hay gastos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </AppShell>
  )
}

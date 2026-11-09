"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  TrendingDown,
  WalletCards,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type ExpenseCategory = {
  id: string
  name: string
}

type Expense = {
  id: string
  amount: number
  description: string
  payment_method: string
  expense_date: string
  notes: string | null
  category: {
    name: string
  } | null
  user: {
    full_name: string | null
  } | null
}

type RecurringExpense = {
  id: string
  amount: number
  description: string
  payment_method: string
  frequency_type: string
  last_paid_date: string
  next_due_date: string
  notes: string | null
  active: boolean
  category: {
    name: string
  } | null
}

const frequencyLabels: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
}

function formatDate(value: string) {
  if (!value) return "—"

  const [year, month, day] = value.slice(0, 10).split("-").map(Number)

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

function recurringStatus(nextDueDate: string) {
  const today = new Date().toISOString().slice(0, 10)

  if (nextDueDate < today) return "Vencido"
  if (nextDueDate === today) return "Pagar hoy"
  return "Al corriente"
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0))
}

function paymentLabel(value: string) {
  if (value === "cash") return "Efectivo"
  if (value === "card") return "Tarjeta"
  if (value === "transfer") return "Transferencia"

  return value
}

function PaymentIcon({
  method,
}: {
  method: string
}) {
  if (method === "cash") {
    return <Banknote className="h-3.5 w-3.5" />
  }

  if (method === "card") {
    return <CreditCard className="h-3.5 w-3.5" />
  }

  return <Smartphone className="h-3.5 w-3.5" />
}

export default function GastosPage() {
  const supabase = useMemo(() => createClient(), [])

  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])

  const [categoryId, setCategoryId] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [notes, setNotes] = useState("")
  const [expenseType, setExpenseType] = useState<"single" | "recurring">("single")
  const [frequencyType, setFrequencyType] = useState("monthly")

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("Todas")
  const [paymentFilter, setPaymentFilter] = useState("Todos")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [payingRecurringId, setPayingRecurringId] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const [categoriesResponse, expensesResponse] =
      await Promise.all([
        supabase
          .from("expense_categories")
          .select("id, name")
          .order("name"),

        supabase
          .from("expenses")
          .select(`
            id,
            amount,
            description,
            payment_method,
            expense_date,
            notes,
            category:expense_categories (
              name
            ),
            user:profiles!expenses_created_by_fkey (
              full_name
            )
          `)
          .order("expense_date", {
            ascending: false,
          })
          .limit(500),
      ])

    const firstError =
      categoriesResponse.error ||
      expensesResponse.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const loadedCategories =
      (categoriesResponse.data ?? []) as ExpenseCategory[]

    setCategories(loadedCategories)
    setExpenses(
      (expensesResponse.data ?? []) as unknown as Expense[],
    )

    if (!categoryId && loadedCategories.length > 0) {
      setCategoryId(loadedCategories[0].id)
    }

    setLoading(false)
  }, [categoryId, supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData])


  const loadRecurringExpenses = useCallback(async () => {
    const { data, error: recurringError } = await supabase
      .from("recurring_expenses")
      .select(`
        id,
        amount,
        description,
        payment_method,
        frequency_type,
        last_paid_date,
        next_due_date,
        notes,
        active,
        category:expense_categories (
          name
        )
      `)
      .eq("active", true)
      .order("next_due_date", { ascending: true })

    if (recurringError) {
      setError(recurringError.message)
      return
    }

    setRecurringExpenses(
      (data ?? []) as unknown as RecurringExpense[],
    )
  }, [supabase])

  useEffect(() => {
    void loadRecurringExpenses()
  }, [loadRecurringExpenses])
  const filteredExpenses = useMemo(() => {
    const value = search.trim().toLowerCase()

    return expenses.filter((expense) => {
      const matchesSearch =
        !value ||
        expense.description.toLowerCase().includes(value) ||
        expense.category?.name.toLowerCase().includes(value) ||
        expense.notes?.toLowerCase().includes(value)

      const matchesCategory =
        categoryFilter === "Todas" ||
        expense.category?.name === categoryFilter

      const matchesPayment =
        paymentFilter === "Todos" ||
        expense.payment_method === paymentFilter

      return matchesSearch && matchesCategory && matchesPayment
    })
  }, [expenses, search, categoryFilter, paymentFilter])

  const summary = useMemo(() => {
    return filteredExpenses.reduce(
      (totals, expense) => {
        totals.count += 1
        totals.total += Number(expense.amount || 0)

        if (expense.payment_method === "cash") {
          totals.cash += Number(expense.amount || 0)
        }

        if (expense.payment_method === "card") {
          totals.card += Number(expense.amount || 0)
        }

        if (expense.payment_method === "transfer") {
          totals.transfer += Number(expense.amount || 0)
        }

        return totals
      },
      {
        count: 0,
        total: 0,
        cash: 0,
        card: 0,
        transfer: 0,
      },
    )
  }, [filteredExpenses])
  async function registerExpense() {
    setError("")
    setMessage("")

    const numericAmount = Number(amount)

    if (!categoryId) {
      setError("Selecciona una categoría.")
      return
    }

    if (!description.trim()) {
      setError("La descripción es obligatoria.")
      return
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("El importe debe ser mayor a cero.")
      return
    }

    setSubmitting(true)

    if (expenseType === "recurring") {
      const { data, error: recurringError } = await supabase.rpc(
        "register_recurring_expense",
        {
          p_category_id: categoryId,
          p_amount: numericAmount,
          p_payment_method: paymentMethod,
          p_description: description.trim(),
          p_frequency_type: frequencyType,
          p_last_paid_date: expenseDate,
          p_notes: notes.trim() || null,
        },
      )

      if (recurringError) {
        setError(recurringError.message)
        setSubmitting(false)
        return
      }

      const result = data as { next_due_date?: string }

      setMessage(
        `Gasto recurrente registrado. Próximo pago: ${formatDate(
          result.next_due_date ?? "",
        )}.`,
      )
    } else {
      const dateValue = new Date(
        `${expenseDate}T12:00:00`,
      ).toISOString()

      const { data, error: rpcError } = await supabase.rpc(
        "register_expense",
        {
          p_category_id: categoryId,
          p_amount: numericAmount,
          p_description: description.trim(),
          p_payment_method: paymentMethod,
          p_notes: notes.trim() || null,
          p_expense_date: dateValue,
        },
      )

      if (rpcError) {
        setError(rpcError.message)
        setSubmitting(false)
        return
      }

      const result = data as {
        description?: string
        amount?: number
      }

      setMessage(
        `Gasto ${result.description ?? description} registrado por ${money(
          Number(result.amount ?? numericAmount),
        )}.`,
      )
    }

    setAmount("")
    setDescription("")
    setPaymentMethod("cash")
    setExpenseDate(new Date().toISOString().slice(0, 10))
    setNotes("")
    setExpenseType("single")
    setFrequencyType("monthly")

    await loadData()
    await loadRecurringExpenses()
    setSubmitting(false)
  }

  async function payRecurringExpense(item: RecurringExpense) {
    setError("")
    setMessage("")
    setPayingRecurringId(item.id)

    const { data, error: rpcError } = await supabase.rpc(
      "pay_recurring_expense",
      {
        p_recurring_expense_id: item.id,
        p_payment_date: new Date().toISOString().slice(0, 10),
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      setPayingRecurringId("")
      return
    }

    const result = data as { next_due_date?: string }

    setMessage(
      `${item.description} pagado. Próximo pago: ${formatDate(
        result.next_due_date ?? "",
      )}.`,
    )

    await loadData()
    await loadRecurringExpenses()
    setPayingRecurringId("")
  }

  return (
    <AppShell
      title="Gastos"
      description="Registro y seguimiento de egresos operativos."
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

      <div className="mb-6 flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadData()}
          disabled={loading}
          className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
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
        <article className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-red-700">
            <TrendingDown className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-red-700">
            Total de gastos
          </p>

          <p className="mt-1 text-[24px] font-semibold text-red-950">
            {money(summary.total)}
          </p>

          <p className="mt-1 text-xs text-red-700">
            {summary.count} registros
          </p>
        </article>

        <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
          <Banknote className="h-5 w-5 text-[#1f6a3a]" />

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Efectivo
          </p>

          <p className="mt-1 text-[24px] font-semibold">
            {money(summary.cash)}
          </p>
        </article>

        <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
          <CreditCard className="h-5 w-5 text-[#1f6a3a]" />

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Tarjeta
          </p>

          <p className="mt-1 text-[24px] font-semibold">
            {money(summary.card)}
          </p>
        </article>

        <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
          <Smartphone className="h-5 w-5 text-[#1f6a3a]" />

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Transferencia
          </p>

          <p className="mt-1 text-[24px] font-semibold">
            {money(summary.transfer)}
          </p>
        </article>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[390px_1fr]">
        <article className="rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-[#1f6a3a]" />

            <h2 className="text-lg font-semibold">
              Registrar gasto
            </h2>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Tipo de gasto
              </p>

              <select
                value={expenseType}
                onChange={(event) =>
                  setExpenseType(event.target.value as "single" | "recurring")
                }
                className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
              >
                <option value="single">Único</option>
                <option value="recurring">Recurrente</option>
              </select>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                CategorÃ­a
              </p>

              <select
                value={categoryId}
                onChange={(event) =>
                  setCategoryId(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
              >
                <option value="">
                  Selecciona una categorÃ­a
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
                DescripciÃ³n
              </p>

              <Input
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Ej. Compra de bolsas"
                className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Importe
              </p>

              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                placeholder="0.00"
                className="h-12 rounded-xl text-lg"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                MÃ©todo de pago
              </p>

              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
              >
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">
                  Transferencia
                </option>
              </select>
            </div>

            <div>
              {expenseType === "recurring" && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Cada cuánto se paga
                </p>

                <select
                  value={frequencyType}
                  onChange={(event) =>
                    setFrequencyType(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
                >
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                  <option value="bimonthly">Bimestral</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="semiannual">Semestral</option>
                  <option value="annual">Anual</option>
                </select>
              </div>
            )}

            <p className="mb-1.5 text-xs font-medium text-slate-500">
              {expenseType === "recurring"
                ? "Última vez pagado"
                : "Fecha"}
            </p>

              <Input
                type="date"
                value={expenseDate}
                onChange={(event) =>
                  setExpenseDate(event.target.value)
                }
                className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Observaciones
              </p>

              <Input
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Opcional"
                className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
              />
            </div>

            <button
              type="button"
              onClick={() => void registerExpense()}
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#102019] text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <WalletCards className="h-5 w-5" />
              )}

              Registrar gasto
            </button>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-[#dde2da] bg-white shadow-sm">
          <div className="border-b border-[#e6eae4] p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Historial de gastos
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredExpenses.length} resultados
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
                    placeholder="Buscar descripciÃ³n o categorÃ­a"
                    className="h-10 w-full rounded-xl border border-[#dce2d9] bg-[#f8f9f6] pl-9 pr-3 text-sm outline-none"
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
                    Todas las categorÃ­as
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
                  value={paymentFilter}
                  onChange={(event) =>
                    setPaymentFilter(event.target.value)
                  }
                  className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
                >
                  <option value="Todos">
                    Todos los mÃ©todos
                  </option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">
                    Transferencia
                  </option>
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
              <table className="w-full min-w-[980px] text-left">
                <thead className="sticky top-0 z-10 bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Fecha</th>
                    <th className="px-5 py-3.5">DescripciÃ³n</th>
                    <th className="px-5 py-3.5">CategorÃ­a</th>
                    <th className="px-5 py-3.5">MÃ©todo</th>
                    <th className="px-5 py-3.5">Usuario</th>
                    <th className="px-5 py-3.5">Notas</th>
                    <th className="px-6 py-4 text-right">
                      Importe
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf0eb]">
                  {filteredExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="transition-colors hover:bg-[#f7f9f5]"
                    >
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(
                          expense.expense_date,
                        ).toLocaleString("es-MX")}
                      </td>

                      <td className="px-6 py-4 font-medium">
                        {expense.description}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {expense.category?.name ??
                          "Sin categorÃ­a"}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#eef3ed] px-3 py-1.5 text-xs font-medium text-[#1f6a3a]">
                          <PaymentIcon
                            method={expense.payment_method}
                          />

                          {paymentLabel(
                            expense.payment_method,
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {expense.user?.full_name ?? "Usuario"}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {expense.notes ?? "â€”"}
                      </td>

                      <td className="px-6 py-4 text-right font-semibold text-red-700">
                        {money(expense.amount)}
                      </td>
                    </tr>
                  ))}

                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        No se encontraron gastos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      <section className="mt-4 rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">
          Gastos recurrentes
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Pagos que el negocio debe cubrir periódicamente.
        </p>

        <div className="mt-5 space-y-3">
          {recurringExpenses.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay gastos recurrentes registrados.
            </p>
          ) : (
            recurringExpenses.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-[#e4e8e1] bg-[#fbfcfa] p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <p className="font-semibold">
                    {item.description}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {money(item.amount)} ·{" "}
                    {frequencyLabels[item.frequency_type] ??
                      item.frequency_type}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Último pago: {formatDate(item.last_paid_date)} · Próximo:{" "}
                    {formatDate(item.next_due_date)} ·{" "}
                    {recurringStatus(item.next_due_date)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void payRecurringExpense(item)}
                  disabled={payingRecurringId === item.id}
                  className="h-10 rounded-xl bg-[#102019] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {payingRecurringId === item.id
                    ? "Registrando..."
                    : "Registrar pago"}
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </AppShell>
  )
}


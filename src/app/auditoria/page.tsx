"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  Activity,
  ChevronDown,
  ChevronUp,
  FileClock,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type AuditLog = {
  id: string
  table_name: string
  record_id: string | null
  action: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
  user: {
    full_name: string | null
    email: string | null
    role: string
  } | null
}

function moduleLabel(tableName: string) {
  const labels: Record<string, string> = {
    profiles: "Usuarios",
    products: "Productos",
    purchases: "Compras",
    purchase_items: "Detalle de compras",
    sales: "Ventas",
    sale_items: "Detalle de ventas",
    sale_refunds: "Devoluciones",
    cash_registers: "Caja",
    cash_movements: "Movimientos de caja",
    expenses: "Gastos",
    waste_records: "Mermas",
    stock_adjustments: "Ajustes de inventario",
    business_settings: "Configuración",
    tickets: "Tickets",
    product_lots: "Lotes",
    inventory_movements: "Movimientos de inventario",
  }

  return labels[tableName] ?? tableName
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    INSERT: "Creación",
    UPDATE: "Actualización",
    DELETE: "Eliminación",
    OPEN: "Apertura",
    CLOSE: "Cierre",
    REFUND: "Devolución",
    UPDATE_ACCESS: "Cambio de acceso",
    ADJUSTMENT: "Ajuste",
  }

  return labels[action] ?? action
}

function roleLabel(role?: string) {
  if (role === "admin") return "Administrador"
  if (role === "cashier") return "Caja"
  if (role === "warehouse") return "Almacén"
  if (role === "finance") return "Finanzas"
  if (role === "partner") return "Socio"

  return role ?? "Sin rol"
}

function actionTone(action: string) {
  if (
    action === "DELETE" ||
    action === "REFUND"
  ) {
    return "bg-red-50 text-red-700"
  }

  if (
    action === "INSERT" ||
    action === "OPEN"
  ) {
    return "bg-emerald-50 text-emerald-700"
  }

  if (
    action === "UPDATE" ||
    action === "UPDATE_ACCESS" ||
    action === "ADJUSTMENT"
  ) {
    return "bg-amber-50 text-amber-700"
  }

  if (action === "CLOSE") {
    return "bg-slate-100 text-slate-700"
  }

  return "bg-sky-50 text-sky-700"
}

function JsonDetails({
  title,
  data,
}: {
  title: string
  data: Record<string, unknown> | null
}) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="rounded-2xl border border-[#e2e7df] bg-white p-5">
        <p className="text-sm font-semibold">
          {title}
        </p>

        <p className="mt-3 text-sm text-slate-500">
          Sin información registrada.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[#e2e7df] bg-white p-5">
      <p className="text-sm font-semibold">
        {title}
      </p>

      <div className="mt-4 space-y-3">
        {Object.entries(data).map(([key, value]) => (
          <div
            key={key}
            className="grid gap-1 border-b border-[#edf0eb] pb-3 last:border-0 last:pb-0 sm:grid-cols-[170px_1fr]"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {key}
            </p>

            <p className="break-words text-sm text-slate-700">
              {typeof value === "object"
                ? JSON.stringify(value)
                : String(value ?? "—")}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AuditoriaPage() {
  const supabase = useMemo(() => createClient(), [])

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [search, setSearch] = useState("")
  const [moduleFilter, setModuleFilter] =
    useState("Todos")
  const [actionFilter, setActionFilter] =
    useState("Todos")
  const [expandedId, setExpandedId] =
    useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: logsError } = await supabase
      .from("audit_logs")
      .select(`
        id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        created_at,
        user:profiles (
          full_name,
          email,
          role
        )
      `)
      .order("created_at", {
        ascending: false,
      })
      .limit(1000)

    if (logsError) {
      setError(logsError.message)
      setLoading(false)
      return
    }

    setLogs((data ?? []) as unknown as AuditLog[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const modules = useMemo(() => {
    return [
      "Todos",
      ...Array.from(
        new Set(logs.map((log) => log.table_name)),
      ).sort((a, b) =>
        moduleLabel(a).localeCompare(
          moduleLabel(b),
          "es",
        ),
      ),
    ]
  }, [logs])

  const actions = useMemo(() => {
    return [
      "Todos",
      ...Array.from(
        new Set(logs.map((log) => log.action)),
      ).sort(),
    ]
  }, [logs])

  const filteredLogs = useMemo(() => {
    const value = search.trim().toLowerCase()

    return logs.filter((log) => {
      const matchesSearch =
        !value ||
        moduleLabel(log.table_name)
          .toLowerCase()
          .includes(value) ||
        actionLabel(log.action)
          .toLowerCase()
          .includes(value) ||
        log.user?.full_name
          ?.toLowerCase()
          .includes(value) ||
        log.user?.email
          ?.toLowerCase()
          .includes(value) ||
        log.record_id
          ?.toLowerCase()
          .includes(value)

      const matchesModule =
        moduleFilter === "Todos" ||
        log.table_name === moduleFilter

      const matchesAction =
        actionFilter === "Todos" ||
        log.action === actionFilter

      return (
        matchesSearch &&
        matchesModule &&
        matchesAction
      )
    })
  }, [
    logs,
    search,
    moduleFilter,
    actionFilter,
  ])

  const summary = useMemo(() => {
    const today = new Date()

    return logs.reduce(
      (totals, log) => {
        totals.total += 1

        const date = new Date(log.created_at)

        if (
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate()
        ) {
          totals.today += 1
        }

        if (
          log.action === "DELETE" ||
          log.action === "REFUND"
        ) {
          totals.critical += 1
        }

        if (log.user?.email) {
          totals.users.add(log.user.email)
        }

        return totals
      },
      {
        total: 0,
        today: 0,
        critical: 0,
        users: new Set<string>(),
      },
    )
  }, [logs])

  return (
    <AppShell
      title="Auditoría"
      description="Trazabilidad completa de acciones y cambios."
    >
      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadLogs()}
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
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
            <FileClock className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Movimientos registrados
          </p>

          <p className="mt-2 text-[28px] font-semibold">
            {summary.total}
          </p>
        </article>

        <article className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700">
            <Activity className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-emerald-700">
            Actividad de hoy
          </p>

          <p className="mt-2 text-[28px] font-semibold text-emerald-950">
            {summary.today}
          </p>
        </article>

        <article className="rounded-[20px] border border-[#dde2da] bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
            <UserRound className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Usuarios con actividad
          </p>

          <p className="mt-2 text-[28px] font-semibold">
            {summary.users.size}
          </p>
        </article>

        <article className="rounded-[20px] border border-red-200 bg-red-50 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-red-700">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <p className="mt-5 text-sm font-medium text-red-700">
            Acciones críticas
          </p>

          <p className="mt-2 text-[28px] font-semibold text-red-950">
            {summary.critical}
          </p>
        </article>
      </section>

      <section className="mt-6 overflow-hidden rounded-[24px] border border-[#dde2da] bg-white shadow-sm">
        <div className="border-b border-[#e6eae4] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Historial del sistema
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {filteredLogs.length} resultados
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
                  placeholder="Buscar usuario, módulo o registro"
                  className="h-10 w-full rounded-xl border border-[#dce2d9] bg-[#f8f9f6] pl-9 pr-3 text-sm outline-none focus:border-[#1f6a3a] focus:bg-white"
                />
              </div>

              <select
                value={moduleFilter}
                onChange={(event) =>
                  setModuleFilter(event.target.value)
                }
                className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
              >
                {modules.map((module) => (
                  <option
                    key={module}
                    value={module}
                  >
                    {module === "Todos"
                      ? "Todos los módulos"
                      : moduleLabel(module)}
                  </option>
                ))}
              </select>

              <select
                value={actionFilter}
                onChange={(event) =>
                  setActionFilter(event.target.value)
                }
                className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
              >
                {actions.map((action) => (
                  <option
                    key={action}
                    value={action}
                  >
                    {action === "Todos"
                      ? "Todas las acciones"
                      : actionLabel(action)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-96 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#1f6a3a]" />
          </div>
        ) : (
          <div className="divide-y divide-[#edf0eb]">
            {filteredLogs.map((log) => {
              const expanded =
                expandedId === log.id

              return (
                <article key={log.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(
                        expanded ? null : log.id,
                      )
                    }
                    className="grid w-full gap-4 px-5 py-4 text-left transition hover:bg-[#fafbf8] lg:grid-cols-[180px_170px_1fr_230px_auto] lg:items-center"
                  >
                    <div>
                      <p className="font-medium">
                        {moduleLabel(log.table_name)}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {log.table_name}
                      </p>
                    </div>

                    <div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium ${actionTone(
                          log.action,
                        )}`}
                      >
                        {actionLabel(log.action)}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {log.user?.full_name ?? "Sistema"}
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-400">
                        {log.user?.email ?? "Sin usuario"} ·{" "}
                        {roleLabel(log.user?.role)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-600">
                        {new Date(
                          log.created_at,
                        ).toLocaleString("es-MX")}
                      </p>

                      {log.record_id && (
                        <p className="mt-1 truncate text-xs text-slate-400">
                          ID: {log.record_id}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      {expanded ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {expanded && (
                    <div className="grid gap-4 border-t border-[#edf0eb] bg-[#f8f9f6] p-5 lg:grid-cols-2">
                      <JsonDetails
                        title="Información anterior"
                        data={log.old_data}
                      />

                      <JsonDetails
                        title="Información nueva"
                        data={log.new_data}
                      />
                    </div>
                  )}
                </article>
              )
            })}

            {filteredLogs.length === 0 && (
              <div className="px-6 py-20 text-center">
                <FileClock className="mx-auto h-8 w-8 text-slate-300" />

                <p className="mt-4 text-sm font-medium text-slate-600">
                  No se encontraron movimientos
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </AppShell>
  )
}

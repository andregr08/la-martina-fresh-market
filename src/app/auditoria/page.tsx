"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  ChevronDown,
  ChevronUp,
  FileClock,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    sales: "Ventas",
    cash_registers: "Caja",
    expenses: "Gastos",
    waste_records: "Mermas",
    stock_adjustments: "Ajustes de inventario",
    restaurant_orders: "Pedidos",
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

function JsonData({
  title,
  value,
}: {
  title: string
  value: Record<string, unknown> | null
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-sm font-medium text-slate-700">
        {title}
      </p>

      {value && Object.keys(value).length > 0 ? (
        <dl className="space-y-2">
          {Object.entries(value).map(([key, item]) => (
            <div
              key={key}
              className="grid gap-1 text-sm sm:grid-cols-[160px_1fr]"
            >
              <dt className="font-medium text-slate-500">
                {key}
              </dt>

              <dd className="break-words text-slate-800">
                {typeof item === "object"
                  ? JSON.stringify(item)
                  : String(item ?? "—")}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-slate-500">
          Sin información registrada.
        </p>
      )}
    </div>
  )
}

export default function AuditoriaPage() {
  const supabase = createClient()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [search, setSearch] = useState("")
  const [moduleFilter, setModuleFilter] = useState("Todos")
  const [actionFilter, setActionFilter] = useState("Todos")
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
    const values = new Set(logs.map((log) => log.table_name))

    return [
      "Todos",
      ...Array.from(values).sort((a, b) =>
        moduleLabel(a).localeCompare(moduleLabel(b), "es"),
      ),
    ]
  }, [logs])

  const actions = useMemo(() => {
    const values = new Set(logs.map((log) => log.action))

    return ["Todos", ...Array.from(values).sort()]
  }, [logs])

  const filteredLogs = useMemo(() => {
    const value = search.trim().toLowerCase()

    return logs.filter((log) => {
      const matchesSearch =
        !value ||
        moduleLabel(log.table_name).toLowerCase().includes(value) ||
        actionLabel(log.action).toLowerCase().includes(value) ||
        log.user?.full_name?.toLowerCase().includes(value) ||
        log.user?.email?.toLowerCase().includes(value) ||
        log.record_id?.toLowerCase().includes(value)

      const matchesModule =
        moduleFilter === "Todos" ||
        log.table_name === moduleFilter

      const matchesAction =
        actionFilter === "Todos" ||
        log.action === actionFilter

      return matchesSearch && matchesModule && matchesAction
    })
  }, [logs, search, moduleFilter, actionFilter])

  const todayCount = useMemo(() => {
    const today = new Date()

    return logs.filter((log) => {
      const date = new Date(log.created_at)

      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      )
    }).length
  }, [logs])

  const usersCount = useMemo(() => {
    const users = new Set(
      logs
        .map((log) => log.user?.email)
        .filter((value): value is string => Boolean(value)),
    )

    return users.size
  }, [logs])

  return (
    <AppShell
      title="Auditoría"
      description="Historial de movimientos y acciones realizadas en el sistema."
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <FileClock className="h-5 w-5 text-slate-500" />

          <p className="mt-4 text-sm text-slate-500">
            Movimientos registrados
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {logs.length}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <Activity className="h-5 w-5 text-slate-500" />

          <p className="mt-4 text-sm text-slate-500">
            Movimientos de hoy
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {todayCount}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Usuarios con actividad
          </p>

          <p className="mt-3 text-2xl font-semibold">
            {usersCount}
          </p>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Registro de actividad
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {filteredLogs.length} movimientos encontrados
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <Input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar usuario, módulo o registro"
                className="pl-9"
              />
            </div>

            <select
              value={moduleFilter}
              onChange={(event) =>
                setModuleFilter(event.target.value)
              }
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {modules.map((module) => (
                <option key={module} value={module}>
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
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action === "Todos"
                    ? "Todas las acciones"
                    : actionLabel(action)}
                </option>
              ))}
            </select>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadLogs()}
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
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const expanded = expandedId === log.id

              return (
                <article key={log.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expanded ? null : log.id)
                    }
                    className="grid w-full gap-4 px-5 py-4 text-left transition hover:bg-slate-50 lg:grid-cols-[180px_180px_1fr_220px_auto] lg:items-center"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {moduleLabel(log.table_name)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {log.table_name}
                      </p>
                    </div>

                    <div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                        {actionLabel(log.action)}
                      </span>
                    </div>

                    <div>
                      <p className="font-medium">
                        {log.user?.full_name ?? "Sistema"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {log.user?.email ?? "Sin usuario"} ·{" "}
                        {roleLabel(log.user?.role)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-700">
                        {new Date(log.created_at).toLocaleString(
                          "es-MX",
                        )}
                      </p>

                      {log.record_id && (
                        <p className="mt-1 truncate text-xs text-slate-500">
                          ID: {log.record_id}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      {expanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </button>

                  {expanded && (
                    <div className="grid gap-4 border-t border-slate-100 bg-slate-50/60 px-5 py-5 lg:grid-cols-2">
                      <JsonData
                        title="Información anterior"
                        value={log.old_data}
                      />

                      <JsonData
                        title="Información nueva"
                        value={log.new_data}
                      />
                    </div>
                  )}
                </article>
              )
            })}

            {filteredLogs.length === 0 && (
              <div className="px-5 py-16 text-center text-sm text-slate-500">
                No existen movimientos con esos filtros.
              </div>
            )}
          </div>
        )}
      </section>
    </AppShell>
  )
}

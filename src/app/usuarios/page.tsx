"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type UserRole =
  | "admin"
  | "cashier"
  | "warehouse"
  | "finance"
  | "partner"

type UserProfile = {
  id: string
  full_name: string | null
  email: string | null
  role: UserRole
  active: boolean
  created_at: string
  updated_at: string
}

type EditableUser = UserProfile & {
  nameInput: string
  roleInput: UserRole
  activeInput: boolean
}

const roles: {
  value: UserRole
  label: string
  description: string
}[] = [
  {
    value: "admin",
    label: "Administrador",
    description: "Acceso completo al sistema.",
  },
  {
    value: "cashier",
    label: "Caja",
    description: "Ventas, caja, cortes y gastos.",
  },
  {
    value: "warehouse",
    label: "Almacén",
    description: "Inventario, entradas, mermas y ajustes.",
  },
  {
    value: "finance",
    label: "Finanzas",
    description: "Compras, gastos, reportes y resultados.",
  },
  {
    value: "partner",
    label: "Socio",
    description: "Consulta de resultados y operación.",
  },
]

function roleLabel(role: string) {
  return (
    roles.find((item) => item.value === role)?.label ??
    role
  )
}

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "Usuario"

  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}

export default function UsuariosPage() {
  const supabase = useMemo(() => createClient(), [])

  const [users, setUsers] = useState<EditableUser[]>([])
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("Todos")
  const [statusFilter, setStatusFilter] = useState("Todos")

  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: usersError } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        role,
        active,
        created_at,
        updated_at
      `)
      .order("created_at", {
        ascending: true,
      })

    if (usersError) {
      setError(usersError.message)
      setLoading(false)
      return
    }

    setUsers(
      ((data ?? []) as UserProfile[]).map((user) => ({
        ...user,
        nameInput: user.full_name ?? "",
        roleInput: user.role,
        activeInput: user.active,
      })),
    )

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadUsers])

  const filteredUsers = useMemo(() => {
    const value = search.trim().toLowerCase()

    return users.filter((user) => {
      const matchesSearch =
        !value ||
        user.full_name?.toLowerCase().includes(value) ||
        user.email?.toLowerCase().includes(value)

      const matchesRole =
        roleFilter === "Todos" ||
        user.role === roleFilter

      const matchesStatus =
        statusFilter === "Todos" ||
        (statusFilter === "Activos" && user.active) ||
        (statusFilter === "Inactivos" && !user.active)

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      )
    })
  }, [users, search, roleFilter, statusFilter])

  const summary = useMemo(() => {
    return users.reduce(
      (totals, user) => {
        totals.total += 1

        if (user.active) {
          totals.active += 1
        } else {
          totals.inactive += 1
        }

        if (user.role === "admin" && user.active) {
          totals.admins += 1
        }

        return totals
      },
      {
        total: 0,
        active: 0,
        inactive: 0,
        admins: 0,
      },
    )
  }, [users])

  function updateUser(
    userId: string,
    field:
      | "nameInput"
      | "roleInput"
      | "activeInput",
    value: string | boolean,
  ) {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId
          ? {
              ...user,
              [field]: value,
            }
          : user,
      ),
    )
  }

  function hasChanges(user: EditableUser) {
    return (
      user.nameInput.trim() !==
        (user.full_name ?? "").trim() ||
      user.roleInput !== user.role ||
      user.activeInput !== user.active
    )
  }

  async function saveUser(user: EditableUser) {
    setError("")
    setMessage("")

    if (!user.nameInput.trim()) {
      setError("El nombre no puede estar vacío.")
      return
    }

    if (!hasChanges(user)) {
      setMessage("No existen cambios por guardar.")
      return
    }

    const confirmed = window.confirm(
      `Se actualizará el acceso de ${
        user.email ?? user.nameInput
      }. ¿Deseas continuar?`,
    )

    if (!confirmed) return

    setSavingId(user.id)

    const { data, error: rpcError } = await supabase.rpc(
      "update_user_access",
      {
        p_user_id: user.id,
        p_full_name: user.nameInput.trim(),
        p_role: user.roleInput,
        p_active: user.activeInput,
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      setSavingId(null)
      return
    }

    const result = data as {
      full_name?: string
      role?: UserRole
      active?: boolean
    }

    setUsers((current) =>
      current.map((item) =>
        item.id === user.id
          ? {
              ...item,
              full_name:
                result.full_name ??
                user.nameInput.trim(),
              role:
                result.role ??
                user.roleInput,
              active:
                typeof result.active === "boolean"
                  ? result.active
                  : user.activeInput,
              nameInput:
                result.full_name ??
                user.nameInput.trim(),
              roleInput:
                result.role ??
                user.roleInput,
              activeInput:
                typeof result.active === "boolean"
                  ? result.active
                  : user.activeInput,
              updated_at: new Date().toISOString(),
            }
          : item,
      ),
    )

    setMessage(
      `El acceso de ${
        user.email ?? user.nameInput
      } se actualizó correctamente.`,
    )

    setSavingId(null)
  }

  return (
    <AppShell
      title="Usuarios"
      description="Roles, accesos y estado del personal."
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

      <section className="mb-6 rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="text-sm font-medium text-amber-900">
          Creación de usuarios
        </p>

        <p className="mt-1 text-sm leading-6 text-amber-800">
          Los usuarios nuevos se crean desde Supabase
          Authentication. Después puedes asignar aquí su nombre,
          rol y estado.
        </p>
      </section>

      <div className="mb-6 flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadUsers()}
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
        <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
            <Users className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Usuarios registrados
          </p>

          <p className="mt-1 text-[24px] font-semibold">
            {summary.total}
          </p>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-emerald-700">
            Usuarios activos
          </p>

          <p className="mt-1 text-[24px] font-semibold text-emerald-950">
            {summary.active}
          </p>
        </article>

        <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-slate-600">
            <UserCog className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Usuarios inactivos
          </p>

          <p className="mt-1 text-[24px] font-semibold">
            {summary.inactive}
          </p>
        </article>

        <article className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f3eb] text-[#1f6a3a]">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Administradores activos
          </p>

          <p className="mt-1 text-[24px] font-semibold">
            {summary.admins}
          </p>
        </article>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#dde2da] bg-white shadow-sm">
        <div className="border-b border-[#e6eae4] p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Administración de usuarios
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {filteredUsers.length} resultados
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
                  placeholder="Buscar nombre o correo"
                  className="h-10 w-full rounded-xl border border-[#dce2d9] bg-[#f8f9f6] pl-9 pr-3 text-sm outline-none focus:border-[#1f6a3a] focus:bg-white"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value)
                }
                className="h-10 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
              >
                <option value="Todos">
                  Todos los roles
                </option>

                {roles.map((role) => (
                  <option
                    key={role.value}
                    value={role.value}
                  >
                    {role.label}
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
            <table className="w-full min-w-[1250px] text-left">
              <thead className="sticky top-0 z-10 bg-[#f8f9f6] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Usuario</th>
                  <th className="px-5 py-3.5">Nombre</th>
                  <th className="px-5 py-3.5">Rol actual</th>
                  <th className="px-5 py-3.5">Nuevo rol</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5">Registro</th>
                  <th className="px-5 py-3.5">Cambios</th>
                  <th className="px-5 py-3.5">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#edf0eb]">
                {filteredUsers.map((user) => {
                  const changed = hasChanges(user)

                  return (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-[#f7f9f5]"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f3eb] text-sm font-semibold text-[#1f6a3a]">
                            {initials(
                              user.full_name,
                              user.email,
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-60 truncate font-medium">
                              {user.email ?? "Sin correo"}
                            </p>

                            <p className="mt-1 max-w-60 truncate text-xs text-slate-400">
                              {user.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <Input
                          value={user.nameInput}
                          onChange={(event) =>
                            updateUser(
                              user.id,
                              "nameInput",
                              event.target.value,
                            )
                          }
                          className="min-w-52 rounded-xl"
                        />
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="rounded-full bg-[#eef3ed] px-3 py-1.5 text-xs font-medium text-[#1f6a3a]">
                          {roleLabel(user.role)}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <select
                          value={user.roleInput}
                          onChange={(event) =>
                            updateUser(
                              user.id,
                              "roleInput",
                              event.target.value as UserRole,
                            )
                          }
                          className="h-10 min-w-44 rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
                        >
                          {roles.map((role) => (
                            <option
                              key={role.value}
                              value={role.value}
                            >
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-5 py-3.5">
                        <label className="inline-flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={user.activeInput}
                            onChange={(event) =>
                              updateUser(
                                user.id,
                                "activeInput",
                                event.target.checked,
                              )
                            }
                            className="h-4 w-4"
                          />

                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                              user.activeInput
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {user.activeInput
                              ? "Activo"
                              : "Inactivo"}
                          </span>
                        </label>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(
                          user.created_at,
                        ).toLocaleString("es-MX")}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            changed
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {changed
                            ? "Pendientes"
                            : "Sin cambios"}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() =>
                            void saveUser(user)
                          }
                          disabled={
                            savingId === user.id ||
                            !changed
                          }
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#102019] px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {savingId === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}

                          Guardar
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-14 text-center text-sm text-slate-500"
                    >
                      No se encontraron usuarios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {roles.map((role) => (
          <article
            key={role.value}
            className="rounded-2xl border border-[#dde2da] bg-white p-4 shadow-sm"
          >
            <p className="font-semibold">
              {role.label}
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {role.description}
            </p>
          </article>
        ))}
      </section>
    </AppShell>
  )
}

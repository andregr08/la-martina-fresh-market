"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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

type UserProfile = {
  id: string
  full_name: string | null
  email: string | null
  role: "admin" | "cashier" | "warehouse" | "finance" | "partner"
  active: boolean
  created_at: string
  updated_at: string
}

type EditableUser = UserProfile & {
  fullNameInput: string
  roleInput: UserProfile["role"]
  activeInput: boolean
}

const roleOptions = [
  {
    value: "admin",
    label: "Administrador",
  },
  {
    value: "cashier",
    label: "Caja",
  },
  {
    value: "warehouse",
    label: "Almacén",
  },
  {
    value: "finance",
    label: "Finanzas",
  },
  {
    value: "partner",
    label: "Socio",
  },
] as const

function roleLabel(role: string) {
  return (
    roleOptions.find((option) => option.value === role)?.label ??
    role
  )
}

export default function UsuariosPage() {
  const supabase = createClient()

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
      .order("created_at")

    if (usersError) {
      setError(usersError.message)
      setLoading(false)
      return
    }

    setUsers(
      ((data ?? []) as UserProfile[]).map((user) => ({
        ...user,
        fullNameInput: user.full_name ?? "",
        roleInput: user.role,
        activeInput: user.active,
      })),
    )

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadUsers()
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

      return matchesSearch && matchesRole && matchesStatus
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
      | "fullNameInput"
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

  async function saveUser(user: EditableUser) {
    setError("")
    setMessage("")

    if (!user.fullNameInput.trim()) {
      setError("El nombre del usuario no puede estar vacío.")
      return
    }

    const confirmed = window.confirm(
      `Se actualizará el acceso de ${
        user.email ?? user.fullNameInput
      }. ¿Deseas continuar?`,
    )

    if (!confirmed) return

    setSavingId(user.id)

    const { data, error: rpcError } = await supabase.rpc(
      "update_user_access",
      {
        p_user_id: user.id,
        p_full_name: user.fullNameInput.trim(),
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
      role?: UserProfile["role"]
      active?: boolean
    }

    setUsers((current) =>
      current.map((item) =>
        item.id === user.id
          ? {
              ...item,
              full_name:
                result.full_name ?? user.fullNameInput.trim(),
              role: result.role ?? user.roleInput,
              active:
                typeof result.active === "boolean"
                  ? result.active
                  : user.activeInput,
              fullNameInput:
                result.full_name ?? user.fullNameInput.trim(),
              roleInput: result.role ?? user.roleInput,
              activeInput:
                typeof result.active === "boolean"
                  ? result.active
                  : user.activeInput,
            }
          : item,
      ),
    )

    setMessage(
      `El acceso de ${
        user.email ?? user.fullNameInput
      } se actualizó correctamente.`,
    )

    setSavingId(null)
  }

  return (
    <AppShell
      title="Usuarios"
      description="Roles, permisos y accesos del personal."
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

      <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        Para crear un usuario nuevo, créalo primero en
        Supabase Authentication y después asígnale aquí su rol y
        permisos. Esta pantalla no guarda contraseñas.
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <Users className="h-5 w-5 text-slate-500" />

          <p className="mt-4 text-sm text-slate-500">
            Usuarios registrados
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {summary.total}
          </p>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />

          <p className="mt-4 text-sm text-emerald-700">
            Usuarios activos
          </p>

          <p className="mt-2 text-2xl font-semibold text-emerald-900">
            {summary.active}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <UserCog className="h-5 w-5 text-slate-500" />

          <p className="mt-4 text-sm text-slate-500">
            Usuarios inactivos
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {summary.inactive}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <ShieldCheck className="h-5 w-5 text-slate-500" />

          <p className="mt-4 text-sm text-slate-500">
            Administradores activos
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {summary.admins}
          </p>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
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

              <Input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar nombre o correo"
                className="pl-9"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value)
              }
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="Todos">Todos los roles</option>

              {roleOptions.map((role) => (
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
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="Todos">Todos</option>
              <option value="Activos">Activos</option>
              <option value="Inactivos">Inactivos</option>
            </select>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadUsers()}
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-medium">
                    Usuario
                  </th>
                  <th className="px-5 py-4 font-medium">
                    Nombre
                  </th>
                  <th className="px-5 py-4 font-medium">
                    Rol actual
                  </th>
                  <th className="px-5 py-4 font-medium">
                    Nuevo rol
                  </th>
                  <th className="px-5 py-4 font-medium">
                    Estado
                  </th>
                  <th className="px-5 py-4 font-medium">
                    Registro
                  </th>
                  <th className="px-5 py-4 font-medium">
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium">
                        {user.email ?? "Sin correo"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {user.id}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <Input
                        value={user.fullNameInput}
                        onChange={(event) =>
                          updateUser(
                            user.id,
                            "fullNameInput",
                            event.target.value,
                          )
                        }
                        className="min-w-52"
                      />
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                        {roleLabel(user.role)}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <select
                        value={user.roleInput}
                        onChange={(event) =>
                          updateUser(
                            user.id,
                            "roleInput",
                            event.target.value,
                          )
                        }
                        className="h-10 min-w-40 rounded-md border border-slate-200 bg-white px-3 text-sm"
                      >
                        {roleOptions.map((role) => (
                          <option
                            key={role.value}
                            value={role.value}
                          >
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-5 py-4">
                      <label className="flex items-center gap-3">
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

                        <span className="text-sm">
                          {user.activeInput
                            ? "Activo"
                            : "Inactivo"}
                        </span>
                      </label>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {new Date(
                        user.created_at,
                      ).toLocaleString("es-MX")}
                    </td>

                    <td className="px-5 py-4">
                      <Button
                        type="button"
                        onClick={() => void saveUser(user)}
                        disabled={savingId === user.id}
                      >
                        {savingId === user.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}

                        Guardar
                      </Button>
                    </td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
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
    </AppShell>
  )
}

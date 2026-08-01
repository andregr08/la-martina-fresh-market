"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  Loader2,
  LogOut,
  PackagePlus,
  ReceiptText,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"

type UserRole =
  | "admin"
  | "cashier"
  | "warehouse"
  | "finance"
  | "partner"

type MenuItem = {
  name: string
  href: string
  icon: React.ComponentType<{
    className?: string
  }>
  roles: UserRole[]
}

const menu: MenuItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    roles: ["admin", "finance", "partner"],
  },
  {
    name: "Punto de venta",
    href: "/punto-de-venta",
    icon: CircleDollarSign,
    roles: ["admin", "cashier"],
  },
  {
    name: "Ventas",
    href: "/ventas",
    icon: ReceiptText,
    roles: ["admin", "cashier", "finance", "partner"],
  },
  {
    name: "Caja",
    href: "/caja",
    icon: WalletCards,
    roles: ["admin", "cashier", "finance"],
  },
  {
    name: "Cortes de caja",
    href: "/cortes",
    icon: WalletCards,
    roles: ["admin", "cashier", "finance", "partner"],
  },
  {
    name: "Inventario",
    href: "/inventario",
    icon: Boxes,
    roles: ["admin", "warehouse", "finance", "partner"],
  },
  {
    name: "Entradas",
    href: "/entradas",
    icon: PackagePlus,
    roles: ["admin", "warehouse", "finance"],
  },
  {
    name: "Compras",
    href: "/compras",
    icon: ShoppingCart,
    roles: ["admin", "warehouse", "finance", "partner"],
  },
  {
    name: "Ajustes de inventario",
    href: "/ajustes-inventario",
    icon: ClipboardCheck,
    roles: ["admin", "warehouse"],
  },
  {
    name: "Productos",
    href: "/productos",
    icon: Tags,
    roles: ["admin"],
  },
  {
    name: "Gastos",
    href: "/gastos",
    icon: Store,
    roles: ["admin", "cashier", "finance"],
  },
  {
    name: "Mermas",
    href: "/mermas",
    icon: Trash2,
    roles: ["admin", "warehouse", "finance", "partner"],
  },
  {
    name: "Reportes",
    href: "/reportes",
    icon: BarChart3,
    roles: ["admin", "finance", "partner"],
  },
  {
    name: "Usuarios",
    href: "/usuarios",
    icon: Users,
    roles: ["admin"],
  },
  {
    name: "Auditoría",
    href: "/auditoria",
    icon: FileClock,
    roles: ["admin"],
  },
  {
    name: "Configuración",
    href: "/configuracion",
    icon: Settings,
    roles: ["admin"],
  },
]

const roleNames: Record<UserRole, string> = {
  admin: "Administrador",
  cashier: "Caja",
  warehouse: "Almacén",
  finance: "Finanzas",
  partner: "Socio",
}

type AppShellProps = {
  title: string
  description?: string
  children: React.ReactNode
}

export function AppShell({
  title,
  description,
  children,
}: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  const supabase = useMemo(() => createClient(), [])

  const [role, setRole] = useState<UserRole | null>(null)
  const [fullName, setFullName] = useState("")
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profileError, setProfileError] = useState("")

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true)
    setProfileError("")

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.replace("/login")
      return
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, role, active")
      .eq("id", user.id)
      .single()

    if (error || !data) {
      setProfileError(
        error?.message ?? "No se encontró el perfil del usuario.",
      )
      setLoadingProfile(false)
      return
    }

    if (!data.active) {
      await supabase.auth.signOut()
      router.replace("/login")
      router.refresh()
      return
    }

    setRole(data.role as UserRole)
    setFullName(data.full_name ?? user.email ?? "Usuario")
    setLoadingProfile(false)
  }, [router, supabase])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const allowedMenu = useMemo(() => {
    if (!role) return []

    return menu.filter((item) => item.roles.includes(role))
  }, [role])

  const currentRoute = useMemo(() => {
    return menu.find((item) =>
      item.href === "/"
        ? pathname === "/"
        : pathname.startsWith(item.href),
    )
  }, [pathname])

  const hasRouteAccess =
    !currentRoute ||
    (role !== null && currentRoute.roles.includes(role))

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  if (loadingProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7f4]">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando acceso...
        </div>
      </main>
    )
  }

  if (profileError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7f4] p-6">
        <section className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-7">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="text-lg font-semibold">
              No fue posible cargar tu acceso
            </h1>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            {profileError}
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 rounded-xl bg-slate-950 px-4 py-2 text-sm text-white"
          >
            Cerrar sesión
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f7f4] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-6 py-6">
            <p className="text-xl font-semibold">La Martina</p>
            <p className="text-sm text-slate-500">
              Fresh Market
            </p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {allowedMenu.map((item) => {
              const Icon = item.icon

              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                    active
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-slate-200 p-4">
            <div className="mb-3 rounded-xl bg-slate-50 px-4 py-3">
              <p className="truncate text-sm font-medium">
                {fullName}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {role ? roleNames[role] : "Sin rol"}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <LogOut className="h-5 w-5" />
              Cerrar sesión
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white px-5 py-5 lg:px-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold">
                  {title}
                </h1>

                {description && (
                  <p className="mt-1 text-sm text-slate-500">
                    {description}
                  </p>
                )}
              </div>

              <div className="w-fit rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
                {role ? roleNames[role] : "Usuario"}
              </div>
            </div>

            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {allowedMenu.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                      active
                        ? "bg-slate-950 text-white"
                        : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </header>

          <div className="p-5 lg:p-10">
            {hasRouteAccess ? (
              children
            ) : (
              <section className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <AlertTriangle className="h-6 w-6" />
                </div>

                <h2 className="mt-5 text-xl font-semibold">
                  Acceso restringido
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  Tu rol de {role ? roleNames[role] : "usuario"} no
                  tiene permiso para consultar este módulo.
                </p>

                <Link
                  href={allowedMenu[0]?.href ?? "/login"}
                  className="mt-6 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm text-white"
                >
                  Regresar a un módulo autorizado
                </Link>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

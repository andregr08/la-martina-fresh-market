"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PackagePlus,
  ReceiptText,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Trash2,
  Users,
  WalletCards,
  X,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"

type UserRole =
  | "admin"
  | "cashier"
  | "warehouse"
  | "finance"
  | "partner"

type MenuSection =
  | "General"
  | "Ventas"
  | "Inventario"
  | "Administración"

type MenuItem = {
  name: string
  href: string
  icon: React.ComponentType<{
    className?: string
  }>
  roles: UserRole[]
  section: MenuSection
}

const menu: MenuItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    roles: ["admin", "finance", "partner"],
    section: "General",
  },
  {
    name: "Punto de venta",
    href: "/punto-de-venta",
    icon: CircleDollarSign,
    roles: ["admin", "cashier"],
    section: "Ventas",
  },
  {
    name: "Ventas",
    href: "/ventas",
    icon: ReceiptText,
    roles: ["admin", "cashier", "finance", "partner"],
    section: "Ventas",
  },
  {
    name: "Caja",
    href: "/caja",
    icon: WalletCards,
    roles: ["admin", "cashier", "finance"],
    section: "Ventas",
  },
  {
    name: "Cortes de caja",
    href: "/cortes",
    icon: WalletCards,
    roles: ["admin", "cashier", "finance", "partner"],
    section: "Ventas",
  },
  {
    name: "Inventario",
    href: "/inventario",
    icon: Boxes,
    roles: ["admin", "warehouse", "finance", "partner"],
    section: "Inventario",
  },
  {
    name: "Entradas",
    href: "/entradas",
    icon: PackagePlus,
    roles: ["admin", "warehouse", "finance"],
    section: "Inventario",
  },
  {
    name: "Compras",
    href: "/compras",
    icon: ShoppingCart,
    roles: ["admin", "warehouse", "finance", "partner"],
    section: "Inventario",
  },
  {
    name: "Ajustes",
    href: "/ajustes-inventario",
    icon: ClipboardCheck,
    roles: ["admin", "warehouse"],
    section: "Inventario",
  },
  {
    name: "Productos",
    href: "/productos",
    icon: Tags,
    roles: ["admin"],
    section: "Inventario",
  },
  {
    name: "Gastos",
    href: "/gastos",
    icon: Store,
    roles: ["admin", "cashier", "finance"],
    section: "Administración",
  },
  {
    name: "Mermas",
    href: "/mermas",
    icon: Trash2,
    roles: ["admin", "warehouse", "finance", "partner"],
    section: "Administración",
  },
  {
    name: "Reportes",
    href: "/reportes",
    icon: BarChart3,
    roles: ["admin", "finance", "partner"],
    section: "Administración",
  },
  {
    name: "Usuarios",
    href: "/usuarios",
    icon: Users,
    roles: ["admin"],
    section: "Administración",
  },
  {
    name: "Auditoría",
    href: "/auditoria",
    icon: FileClock,
    roles: ["admin"],
    section: "Administración",
  },
  {
    name: "Configuración",
    href: "/configuracion",
    icon: Settings,
    roles: ["admin"],
    section: "Administración",
  },
]

const sections: MenuSection[] = [
  "General",
  "Ventas",
  "Inventario",
  "Administración",
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
  const [email, setEmail] = useState("")
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profileError, setProfileError] = useState("")
  const [mobileOpen, setMobileOpen] = useState(false)

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
      .select("full_name, email, role, active")
      .eq("id", user.id)
      .single()

    if (error || !data) {
      setProfileError(
        error?.message ??
          "No se encontró el perfil del usuario.",
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
    setEmail(data.email ?? user.email ?? "")
    setLoadingProfile(false)
  }, [router, supabase])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

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
      <main className="flex min-h-screen items-center justify-center bg-[#f4f5f1]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#102019] text-white shadow-lg">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>

          <p className="text-sm font-medium text-slate-600">
            Preparando La Martina...
          </p>
        </div>
      </main>
    )
  }

  if (profileError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f5f1] p-6">
        <section className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-8 shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <h1 className="mt-5 text-xl font-semibold">
            No fue posible cargar tu acceso
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {profileError}
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 rounded-xl bg-[#102019] px-5 py-2.5 text-sm font-medium text-white"
          >
            Cerrar sesión
          </button>
        </section>
      </main>
    )
  }

  const navigation = (
    <>
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-bold text-[#174f2d]">
            LM
          </div>

          <div>
            <p className="font-semibold tracking-tight text-white">
              La Martina
            </p>

            <p className="text-xs text-white/50">
              Fresh Market
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {sections.map((section) => {
          const items = allowedMenu.filter(
            (item) => item.section === section,
          )

          if (items.length === 0) return null

          return (
            <div key={section} className="mb-6">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                {section}
              </p>

              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon

                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? "bg-white text-[#102019] shadow-sm"
                          : "text-white/65 hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-[18px] w-[18px] ${
                          active
                            ? "text-[#1f6a3a]"
                            : "text-white/45 group-hover:text-white/80"
                        }`}
                      />

                      <span className="flex-1">
                        {item.name}
                      </span>

                      {active && (
                        <ChevronRight className="h-4 w-4 text-[#1f6a3a]" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 rounded-2xl bg-white/7 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2c6943] text-sm font-semibold text-white">
              {fullName
                .split(" ")
                .slice(0, 2)
                .map((word) => word.charAt(0))
                .join("")
                .toUpperCase()}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {fullName}
              </p>

              <p className="truncate text-xs text-white/45">
                {email}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-white/7 px-2.5 py-1.5 text-center text-[11px] font-medium text-white/60">
            {role ? roleNames[role] : "Sin rol"}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/55 transition hover:bg-white/8 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <main className="min-h-screen bg-[#f4f5f1] text-[#172018]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col bg-[#102019] lg:flex">
        {navigation}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
          />

          <aside className="relative flex h-full w-[290px] flex-col bg-[#102019] shadow-2xl">
            {navigation}
          </aside>
        </div>
      )}

      <section className="min-h-screen lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-[#dde2da]/90 bg-[#f4f5f1]/90 backdrop-blur-xl">
          <div className="flex min-h-[78px] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dde2da] bg-white text-slate-700 shadow-sm lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <span>La Martina</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="truncate text-slate-500">
                  {currentRoute?.name ?? title}
                </span>
              </div>

              <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-semibold tracking-tight text-[#172018] sm:text-2xl">
                    {title}
                  </h1>

                  {description && (
                    <p className="mt-1 hidden text-sm text-slate-500 sm:block">
                      {description}
                    </p>
                  )}
                </div>

                <div className="hidden shrink-0 items-center gap-2 rounded-full border border-[#d7ddd4] bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm sm:flex">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Sistema conectado
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1680px] p-4 sm:p-6 lg:p-8">
          {hasRouteAccess ? (
            children
          ) : (
            <section className="mx-auto mt-10 max-w-xl rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <h2 className="mt-5 text-xl font-semibold">
                Acceso restringido
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Tu rol de{" "}
                {role ? roleNames[role] : "usuario"} no tiene
                permiso para consultar este módulo.
              </p>

              <Link
                href={allowedMenu[0]?.href ?? "/login"}
                className="mt-6 inline-flex rounded-xl bg-[#102019] px-5 py-2.5 text-sm font-medium text-white"
              >
                Ir a un módulo autorizado
              </Link>
            </section>
          )}
        </div>
      </section>
    </main>
  )
}

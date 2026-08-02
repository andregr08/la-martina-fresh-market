"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Phone,
  Printer,
  RefreshCw,
  Save,
  Settings,
  Store,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import {
  TicketBranding,
  TicketFooter,
} from "@/components/tickets/ticket-branding"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { BusinessSettings } from "@/hooks/use-business-settings"
import { createClient } from "@/lib/supabase/client"

type SettingsRecord = BusinessSettings & {
  id: string
  updated_at: string
}

export default function ConfiguracionPage() {
  const supabase = useMemo(() => createClient(), [])

  const [settingsId, setSettingsId] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [ticketHeader, setTicketHeader] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [currency, setCurrency] =
    useState<"MXN" | "USD">("MXN")
  const [ticketFooter, setTicketFooter] = useState("")
  const [showAddress, setShowAddress] = useState(true)
  const [showPhone, setShowPhone] = useState(true)
  const [autoPrint, setAutoPrint] = useState(false)
  const [updatedAt, setUpdatedAt] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: settingsError } = await supabase
      .from("business_settings")
      .select(`
        id,
        business_name,
        ticket_header,
        address,
        phone,
        currency,
        ticket_footer,
        show_address_on_ticket,
        show_phone_on_ticket,
        auto_print_ticket,
        updated_at
      `)
      .limit(1)
      .maybeSingle()

    if (settingsError) {
      setError(settingsError.message)
      setLoading(false)
      return
    }

    if (!data) {
      setError("No existe una configuración del negocio.")
      setLoading(false)
      return
    }

    const record = data as SettingsRecord

    setSettingsId(record.id)
    setBusinessName(record.business_name)
    setTicketHeader(record.ticket_header ?? "")
    setAddress(record.address ?? "")
    setPhone(record.phone ?? "")
    setCurrency(record.currency)
    setTicketFooter(record.ticket_footer)
    setShowAddress(record.show_address_on_ticket)
    setShowPhone(record.show_phone_on_ticket)
    setAutoPrint(record.auto_print_ticket)
    setUpdatedAt(record.updated_at)

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSettings()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadSettings])

  const previewSettings: BusinessSettings = {
    business_name:
      businessName.trim() || "La Martina Fresh Market",
    ticket_header: ticketHeader.trim() || null,
    address: address.trim() || null,
    phone: phone.trim() || null,
    currency,
    ticket_footer:
      ticketFooter.trim() ||
      "Siempre mejor precio, mejor calidad y más fresco.",
    show_address_on_ticket: showAddress,
    show_phone_on_ticket: showPhone,
    auto_print_ticket: autoPrint,
  }

  async function saveSettings() {
    setError("")
    setMessage("")

    if (!businessName.trim()) {
      setError("El nombre comercial no puede estar vacío.")
      return
    }

    if (!ticketFooter.trim()) {
      setError("El mensaje final del ticket es obligatorio.")
      return
    }

    setSaving(true)

    const { data, error: rpcError } = await supabase.rpc(
      "update_business_settings",
      {
        p_business_name: businessName.trim(),
        p_ticket_header: ticketHeader.trim() || null,
        p_address: address.trim() || null,
        p_phone: phone.trim() || null,
        p_currency: currency,
        p_ticket_footer: ticketFooter.trim(),
        p_show_address_on_ticket: showAddress,
        p_show_phone_on_ticket: showPhone,
        p_auto_print_ticket: autoPrint,
      },
    )

    if (rpcError) {
      setError(rpcError.message)
      setSaving(false)
      return
    }

    const result = data as {
      settings_id?: string
      business_name?: string
    }

    setSettingsId(result.settings_id ?? settingsId)
    setMessage(
      `La configuración de ${
        result.business_name ?? businessName
      } se guardó correctamente.`,
    )

    await loadSettings()
    setSaving(false)
  }

  return (
    <AppShell
      title="Configuración"
      description="Datos comerciales, tickets y preferencias del sistema."
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
          onClick={() => void loadSettings()}
          disabled={loading}
          className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Recargar
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-[520px] items-center justify-center rounded-[24px] border border-[#dde2da] bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#1f6a3a]" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <section className="space-y-4">
            <article className="rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f3eb] text-[#1f6a3a]">
                  <Building2 className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold">
                    Información comercial
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Datos que identifican el negocio.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">
                    Nombre comercial
                  </p>

                  <div className="relative">
                    <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <Input
                      value={businessName}
                      onChange={(event) =>
                        setBusinessName(event.target.value)
                      }
                      className="rounded-xl pl-9"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">
                    Encabezado secundario
                  </p>

                  <Input
                    value={ticketHeader}
                    onChange={(event) =>
                      setTicketHeader(event.target.value)
                    }
                    placeholder="Ej. Frutas y verduras frescas"
                    className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
                  />
                </div>

                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">
                    Dirección
                  </p>

                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <Input
                      value={address}
                      onChange={(event) =>
                        setAddress(event.target.value)
                      }
                      className="rounded-xl pl-9"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-500">
                    Teléfono
                  </p>

                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <Input
                      value={phone}
                      onChange={(event) =>
                        setPhone(event.target.value)
                      }
                      className="rounded-xl pl-9"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-500">
                    Moneda
                  </p>

                  <select
                    value={currency}
                    onChange={(event) =>
                      setCurrency(
                        event.target.value as "MXN" | "USD",
                      )
                    }
                    className="h-10 w-full rounded-xl border border-[#dce2d9] bg-white px-3 text-sm"
                  >
                    <option value="MXN">
                      Peso mexicano (MXN)
                    </option>

                    <option value="USD">
                      Dólar estadounidense (USD)
                    </option>
                  </select>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef3ed] text-[#1f6a3a]">
                  <Printer className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold">
                    Configuración del ticket
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Información visible e impresión automática.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Mensaje final
                </p>

                <Input
                  value={ticketFooter}
                  onChange={(event) =>
                    setTicketFooter(event.target.value)
                  }
                  className="rounded-xl focus-visible:ring-4 focus-visible:ring-[#1f6a3a]/10"
                />
              </div>

              <div className="mt-6 grid gap-4">
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#e1e6de] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef3ed] text-[#1f6a3a]">
                      {showAddress ? (
                        <Eye className="h-5 w-5" />
                      ) : (
                        <EyeOff className="h-5 w-5" />
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-medium">
                        Mostrar dirección
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Aparece en los tickets impresos.
                      </p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={showAddress}
                    onChange={(event) =>
                      setShowAddress(event.target.checked)
                    }
                    className="h-5 w-5"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#e1e6de] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef3ed] text-[#1f6a3a]">
                      {showPhone ? (
                        <Eye className="h-5 w-5" />
                      ) : (
                        <EyeOff className="h-5 w-5" />
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-medium">
                        Mostrar teléfono
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Aparece en los tickets impresos.
                      </p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={showPhone}
                    onChange={(event) =>
                      setShowPhone(event.target.checked)
                    }
                    className="h-5 w-5"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#e1e6de] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef3ed] text-[#1f6a3a]">
                      <Printer className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-sm font-medium">
                        Impresión automática
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Abre la ventana de impresión al cobrar.
                      </p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={autoPrint}
                    onChange={(event) =>
                      setAutoPrint(event.target.checked)
                    }
                    className="h-5 w-5"
                  />
                </label>
              </div>
            </article>

            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={saving}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#102019] text-sm font-semibold text-white transition hover:bg-[#174f2d] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}

              Guardar configuración
            </button>

            {updatedAt && (
              <p className="text-center text-xs text-slate-400">
                Última actualización:{" "}
                {new Date(updatedAt).toLocaleString("es-MX")}
              </p>
            )}
          </section>

          <aside className="space-y-4">
            <article className="sticky top-28 rounded-2xl border border-[#dde2da] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#102019] text-white">
                  <Settings className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold">
                    Vista previa
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Así se verá el ticket.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-dashed border-slate-400 bg-white p-5 text-black">
                <TicketBranding
                  settings={previewSettings}
                />

                <div className="my-5 border-y border-dashed border-black py-3 text-sm">
                  <p>Ticket: TK-000001</p>
                  <p>Venta: VEN-000001</p>
                  <p>
                    Fecha:{" "}
                    {new Date().toLocaleString("es-MX")}
                  </p>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">
                      Producto de ejemplo
                    </p>

                    <div className="flex justify-between">
                      <span>1 kg × $25.00</span>
                      <span>$25.00</span>
                    </div>
                  </div>
                </div>

                <div className="my-5 space-y-2 border-y border-dashed border-black py-3 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>$25.00</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Descuento</span>
                    <span>-$0.00</span>
                  </div>

                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span>$25.00</span>
                  </div>
                </div>

                <TicketFooter
                  settings={previewSettings}
                />
              </div>
            </article>
          </aside>
        </div>
      )}
    </AppShell>
  )
}

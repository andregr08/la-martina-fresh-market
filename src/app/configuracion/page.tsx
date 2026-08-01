"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  Settings,
} from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type BusinessSettings = {
  id: string
  business_name: string
  ticket_header: string | null
  address: string | null
  phone: string | null
  currency: "MXN" | "USD"
  ticket_footer: string
  show_address_on_ticket: boolean
  show_phone_on_ticket: boolean
  auto_print_ticket: boolean
  updated_at: string
}

export default function ConfiguracionPage() {
  const supabase = createClient()

  const [settingsId, setSettingsId] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [ticketHeader, setTicketHeader] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN")
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

    const settings = data as BusinessSettings

    setSettingsId(settings.id)
    setBusinessName(settings.business_name)
    setTicketHeader(settings.ticket_header ?? "")
    setAddress(settings.address ?? "")
    setPhone(settings.phone ?? "")
    setCurrency(settings.currency)
    setTicketFooter(settings.ticket_footer)
    setShowAddress(settings.show_address_on_ticket)
    setShowPhone(settings.show_phone_on_ticket)
    setAutoPrint(settings.auto_print_ticket)
    setUpdatedAt(settings.updated_at)

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  async function saveSettings() {
    setError("")
    setMessage("")

    if (!businessName.trim()) {
      setError("El nombre comercial no puede estar vacío.")
      return
    }

    if (!ticketFooter.trim()) {
      setError("El mensaje final del ticket no puede estar vacío.")
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
      description="Información comercial y formato general de tickets."
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

      {loading ? (
        <div className="flex min-h-96 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />

              <h2 className="text-lg font-semibold">
                Datos del negocio
              </h2>
            </div>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="businessName">
                  Nombre comercial
                </Label>

                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(event) =>
                    setBusinessName(event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticketHeader">
                  Encabezado secundario del ticket
                </Label>

                <Input
                  id="ticketHeader"
                  value={ticketHeader}
                  onChange={(event) =>
                    setTicketHeader(event.target.value)
                  }
                  placeholder="Ej. Frutas y verduras frescas"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>

                <Input
                  id="address"
                  value={address}
                  onChange={(event) =>
                    setAddress(event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>

                <Input
                  id="phone"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>

                <select
                  id="currency"
                  value={currency}
                  onChange={(event) =>
                    setCurrency(
                      event.target.value as "MXN" | "USD",
                    )
                  }
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="MXN">
                    Peso mexicano (MXN)
                  </option>

                  <option value="USD">
                    Dólar estadounidense (USD)
                  </option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticketFooter">
                  Mensaje final del ticket
                </Label>

                <Input
                  id="ticketFooter"
                  value={ticketFooter}
                  onChange={(event) =>
                    setTicketFooter(event.target.value)
                  }
                />
              </div>

              <Button
                type="button"
                onClick={saveSettings}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}

                Guardar configuración
              </Button>

              {updatedAt && (
                <p className="text-xs text-slate-500">
                  Última actualización:{" "}
                  {new Date(updatedAt).toLocaleString("es-MX")}
                </p>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <article className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold">
                Opciones del ticket
              </h2>

              <div className="mt-6 space-y-5">
                <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-medium">
                      Mostrar dirección
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Incluye la dirección en el comprobante.
                    </p>
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

                <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-medium">
                      Mostrar teléfono
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Incluye el teléfono del local.
                    </p>
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

                <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-medium">
                      Impresión automática
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Abrirá la impresión al terminar una venta.
                    </p>
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

            <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
              <p className="text-lg font-semibold">
                {businessName}
              </p>

              {ticketHeader && (
                <p className="mt-1 text-sm">
                  {ticketHeader}
                </p>
              )}

              {showAddress && address && (
                <p className="mt-4 text-sm">{address}</p>
              )}

              {showPhone && phone && (
                <p className="text-sm">Tel. {phone}</p>
              )}

              <div className="my-5 border-y border-dashed border-slate-400 py-4 text-sm">
                <div className="flex justify-between">
                  <span>Producto de ejemplo</span>
                  <span>$25.00</span>
                </div>

                <div className="mt-3 flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>$25.00</span>
                </div>
              </div>

              <p className="text-sm">{ticketFooter}</p>
            </article>
          </section>
        </div>
      )}
    </AppShell>
  )
}

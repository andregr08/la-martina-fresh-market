"use client"

import { useCallback, useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/client"

export type BusinessSettings = {
  business_name: string
  ticket_header: string | null
  address: string | null
  phone: string | null
  currency: "MXN" | "USD"
  ticket_footer: string
  show_address_on_ticket: boolean
  show_phone_on_ticket: boolean
  auto_print_ticket: boolean
}

const defaultSettings: BusinessSettings = {
  business_name: "La Martina Fresh Market",
  ticket_header: "Frutas y verduras frescas",
  address: "14 Oriente 405, San Andrés Cholula, Puebla",
  phone: "2224848251",
  currency: "MXN",
  ticket_footer:
    "Siempre mejor precio, mejor calidad y más fresco.",
  show_address_on_ticket: true,
  show_phone_on_ticket: true,
  auto_print_ticket: false,
}

export function useBusinessSettings() {
  const supabase = createClient()

  const [settings, setSettings] =
    useState<BusinessSettings>(defaultSettings)

  const [loading, setLoading] = useState(true)

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from("business_settings")
      .select(`
        business_name,
        ticket_header,
        address,
        phone,
        currency,
        ticket_footer,
        show_address_on_ticket,
        show_phone_on_ticket,
        auto_print_ticket
      `)
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      setSettings(data as BusinessSettings)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  return {
    settings,
    loading,
    reloadSettings: loadSettings,
  }
}

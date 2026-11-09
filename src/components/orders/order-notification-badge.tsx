"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import { createClient } from "@/lib/supabase/client"

export function OrderNotificationBadge() {
  const supabase = useMemo(() => createClient(), [])
  const [count, setCount] = useState(0)

  const loadCount = useCallback(async () => {
    const {
      count: pendingCount,
      error,
    } = await supabase
      .from("restaurant_orders")
      .select("id", {
        count: "exact",
        head: true,
      })
      .not(
        "status",
        "in",
        '("paid","cancelled")',
      )

    if (error) {
      console.error(
        "Error cargando notificaciones de pedidos:",
        error,
      )
      return
    }

    setCount(pendingCount ?? 0)
  }, [supabase])

  useEffect(() => {
    void loadCount()

    const interval = window.setInterval(() => {
      void loadCount()
    }, 5000)

    return () => {
      window.clearInterval(interval)
    }
  }, [loadCount])

  if (count <= 0) {
    return null
  }

  return (
    <span className="flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  )
}

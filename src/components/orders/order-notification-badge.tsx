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
      data,
      error,
    } = await supabase.rpc(
      "get_restaurant_active_orders",
    )

    if (error) {
      console.error(
        "Error cargando notificaciones de pedidos:",
        error,
      )
      return
    }

    const activeOrders =
      Array.isArray(data)
        ? data
        : []

    setCount(activeOrders.length)
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

"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function OrderNotificationBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const loadCount = async () => {
      const [
        { data: orders, error: ordersError },
        { data: waiterRequests, error: waiterError },
      ] = await Promise.all([
        supabase.rpc("get_restaurant_active_orders"),
        supabase.rpc("get_active_waiter_requests"),
      ])

      if (!active) return

      if (ordersError) {
        console.error(
          "Error cargando pedidos para notificación:",
          ordersError,
        )
      }

      if (waiterError) {
        console.error(
          "Error cargando llamadas de mesero:",
          waiterError,
        )
      }

      const orderCount =
        Array.isArray(orders) ? orders.length : 0

      const waiterCount =
        Array.isArray(waiterRequests)
          ? waiterRequests.length
          : 0

      setCount(orderCount + waiterCount)
    }

    void loadCount()

    const interval = setInterval(() => {
      void loadCount()
    }, 4000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  if (count === 0) {
    return null
  }

  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  )
}

export default OrderNotificationBadge

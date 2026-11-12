"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type WaiterRequest = {
  id: string
  table_number: string
  status: string
  created_at: string
}

export default function WaiterRequests() {
  const supabase = createClient()

  const [requests, setRequests] = useState<WaiterRequest[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase.rpc(
      "get_active_waiter_requests",
    )

    if (error) {
      console.error("Error cargando solicitudes:", error)
      return
    }

    setRequests((data ?? []) as WaiterRequest[])
  }, [supabase])

  useEffect(() => {
    void loadRequests()

    const interval = setInterval(() => {
      void loadRequests()
    }, 4000)

    return () => clearInterval(interval)
  }, [loadRequests])

  const markAttended = async (id: string) => {
    setLoadingId(id)

    const { error } = await supabase.rpc(
      "attend_waiter_request",
      {
        p_request_id: id,
      },
    )

    if (error) {
      console.error("Error marcando atendido:", error)
      setLoadingId(null)
      return
    }

    setRequests((current) =>
      current.filter((request) => request.id !== id),
    )

    setLoadingId(null)
  }

  if (requests.length === 0) {
    return null
  }

  return (
    <div className="mb-6 space-y-3">
      {requests.map((request) => (
        <div
          key={request.id}
          className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-lg font-bold text-amber-950">
              🔔 Solicita atención — Mesa {request.table_number}
            </p>

            <p className="mt-1 text-sm text-amber-800">
              {new Date(request.created_at).toLocaleTimeString(
                "es-MX",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </p>
          </div>

          <button
            type="button"
            disabled={loadingId === request.id}
            onClick={() =>
              void markAttended(request.id)
            }
            className="h-11 rounded-xl bg-[#102019] px-5 font-semibold text-white disabled:opacity-50"
          >
            {loadingId === request.id
              ? "Marcando..."
              : "Atendido"}
          </button>
        </div>
      ))}
    </div>
  )
}

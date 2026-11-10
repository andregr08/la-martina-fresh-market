import { NextResponse } from "next/server"
﻿import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  // Ruta pública para clientes del restaurante
  if (request.nextUrl.pathname.startsWith("/ordenar")) {
    return NextResponse.next()
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

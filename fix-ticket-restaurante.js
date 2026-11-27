const fs = require("fs")

const path = "./src/app/pedidos/page.tsx"
let s = fs.readFileSync(path, "utf8")

function r(oldText, newText, label) {
  if (!s.includes(oldText)) {
    throw new Error("NO ENCONTRÉ: " + label)
  }

  s = s.replace(oldText, newText)
  console.log("OK:", label)
}

/* =========================================================
   IMPORTS
========================================================= */

r(
`  PackageCheck,
  ReceiptText,`,
`  PackageCheck,
  Printer,
  ReceiptText,`,
"import Printer"
)

r(
`import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"`,
`import { AppShell } from "@/components/layout/app-shell"
import {
  TicketBranding,
  TicketFooter,
} from "@/components/tickets/ticket-branding"
import { useBusinessSettings } from "@/hooks/use-business-settings"
import { createClient } from "@/lib/supabase/client"`,
"imports ticket"
)

/* =========================================================
   TIPO DE TICKET
========================================================= */

r(
`type SaleResult = {
  success: boolean
  sale_id: string
  folio: string
  total: number
}`,
`type SaleResult = {
  success: boolean
  sale_id: string
  folio: string
  total: number
}

type RestaurantTicket = {
  sale: SaleResult
  group: OrderGroup
  paymentMethod: "cash" | "card" | "transfer"
  cashReceived: number
  change: number
  soldAt: string
}`,
"tipo RestaurantTicket"
)

/* =========================================================
   ETIQUETA DE PAGO
========================================================= */

r(
`function time(value: string) {`,
`function paymentLabel(value: string) {
  if (value === "cash") return "Efectivo"
  if (value === "card") return "Tarjeta"
  if (value === "transfer") return "Transferencia"

  return value
}

function time(value: string) {`,
"paymentLabel"
)

/* =========================================================
   SETTINGS DEL NEGOCIO
========================================================= */

r(
`export default function PedidosPage() {
  const supabase = useMemo(() => createClient(), [])`,
`export default function PedidosPage() {
  const supabase = useMemo(() => createClient(), [])
  const { settings } = useBusinessSettings()`,
"business settings"
)

/* =========================================================
   ESTADO DEL ÚLTIMO TICKET
========================================================= */

r(
`  const [charging, setCharging] =
    useState(false)`,
`  const [charging, setCharging] =
    useState(false)

  const [lastTicket, setLastTicket] =
    useState<RestaurantTicket | null>(null)`,
"estado lastTicket"
)

/* =========================================================
   GUARDAR TICKET AL COBRAR
========================================================= */

r(
`    setCheckoutKey(null)
    setCashReceived("")
    setPaymentMethod("cash")
    setCharging(false)

    await loadOrders(true)`,
`    const ticket: RestaurantTicket = {
      sale,
      group: checkoutGroup,
      paymentMethod,
      cashReceived:
        paymentMethod === "cash"
          ? cashAmount
          : sale.total,
      change:
        paymentMethod === "cash"
          ? change
          : 0,
      soldAt: new Date().toISOString(),
    }

    setLastTicket(ticket)

    setCheckoutKey(null)
    setCashReceived("")
    setPaymentMethod("cash")
    setCharging(false)

    await loadOrders(true)`,
"crear ticket después del cobro"
)

/* =========================================================
   MODAL DEL TICKET
========================================================= */

r(
`      {checkoutGroup && (`,
`      {lastTicket && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 print:static print:block print:bg-white print:p-0"
        >
          <style>{\`
            @media print {
              body * {
                visibility: hidden !important;
              }

              #restaurant-ticket,
              #restaurant-ticket * {
                visibility: visible !important;
              }

              #restaurant-ticket {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 80mm !important;
                max-width: 80mm !important;
                padding: 4mm !important;
                margin: 0 !important;
                background: white !important;
              }

              @page {
                size: 80mm auto;
                margin: 0;
              }
            }
          \`}</style>

          <section
            id="restaurant-ticket"
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 text-black shadow-2xl print:max-h-none print:overflow-visible print:rounded-none print:shadow-none"
          >
            <div className="mb-4 flex justify-end print:hidden">
              <button
                type="button"
                onClick={() =>
                  setLastTicket(null)
                }
                className="rounded-xl border border-[#dce2d9] p-2 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <TicketBranding settings={settings} />

            <div className="my-5 border-y border-dashed border-black py-3 text-sm">
              <p>
                Venta: {lastTicket.sale.folio}
              </p>

              <p>
                {lastTicket.group.label}
              </p>

              <p>
                Pedido(s):{" "}
                {lastTicket.group.orders
                  .map(
                    (order) =>
                      \`#\${order.order_number}\`,
                  )
                  .join(", ")}
              </p>

              <p>
                Fecha:{" "}
                {new Date(
                  lastTicket.soldAt,
                ).toLocaleString("es-MX")}
              </p>
            </div>

            <div className="space-y-3">
              {lastTicket.group.orders
                .flatMap(
                  (order) => order.items,
                )
                .map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-dashed border-slate-300 pb-2"
                  >
                    <div className="flex justify-between gap-4 text-sm">
                      <span>
                        {item.quantity} ×{" "}
                        {item.product_name}
                      </span>

                      <span>
                        {money(
                          item.line_total,
                        )}
                      </span>
                    </div>

                    {item.variant_name && (
                      <p className="mt-1 text-xs">
                        {item.variant_name}
                      </p>
                    )}

                    {item.fruit_selections.length > 0 && (
                      <p className="mt-1 text-xs">
                        {item.fruit_selections
                          .map(
                            (fruit) =>
                              fruit.name ||
                              fruit.product_id,
                          )
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
            </div>

            <div className="mt-5 space-y-2 border-t border-dashed border-black pt-4 text-sm">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>

                <span>
                  {money(
                    lastTicket.sale.total,
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Método</span>

                <span>
                  {paymentLabel(
                    lastTicket.paymentMethod,
                  )}
                </span>
              </div>

              {lastTicket.paymentMethod ===
                "cash" && (
                <>
                  <div className="flex justify-between">
                    <span>Recibido</span>

                    <span>
                      {money(
                        lastTicket.cashReceived,
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Cambio</span>

                    <span>
                      {money(
                        lastTicket.change,
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5">
              <TicketFooter settings={settings} />
            </div>

            <button
              type="button"
              onClick={() =>
                window.print()
              }
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#102019] font-semibold text-white print:hidden"
            >
              <Printer className="h-5 w-5" />
              Imprimir ticket
            </button>
          </section>
        </div>
      )}

      {checkoutGroup && (`,
"modal del ticket"
)

fs.writeFileSync(path, s, "utf8")

console.log("")
console.log("==========================================")
console.log("✅ TICKET RESTAURANTE INSTALADO")
console.log("==========================================")

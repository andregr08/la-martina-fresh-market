"use client"

import type { BusinessSettings } from "@/hooks/use-business-settings"

type TicketBrandingProps = {
  settings: BusinessSettings
}

export function TicketBranding({
  settings,
}: TicketBrandingProps) {
  return (
    <>
      <div className="text-center">
        <h2 className="text-xl font-semibold">
          {settings.business_name}
        </h2>

        {settings.ticket_header && (
          <p className="mt-1 text-sm">
            {settings.ticket_header}
          </p>
        )}

        {settings.show_address_on_ticket &&
          settings.address && (
            <p className="mt-1 text-sm">
              {settings.address}
            </p>
          )}

        {settings.show_phone_on_ticket &&
          settings.phone && (
            <p className="text-sm">
              Tel. {settings.phone}
            </p>
          )}
      </div>
    </>
  )
}

export function TicketFooter({
  settings,
}: TicketBrandingProps) {
  return (
    <p className="text-center text-sm">
      {settings.ticket_footer}
    </p>
  )
}

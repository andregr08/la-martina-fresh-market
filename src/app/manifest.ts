import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Martina Fresh Market",
    short_name: "La Martina",
    description:
      "Sistema administrativo y punto de venta de La Martina Fresh Market.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ed",
    theme_color: "#0b251b",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}

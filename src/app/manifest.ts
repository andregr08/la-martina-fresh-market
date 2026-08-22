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
        src: "/icons/la-martina-app-192-v6.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/la-martina-app-512-v6.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/la-martina-app-512-v6.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}


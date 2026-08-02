import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "La Martina Fresh Market",
  description:
    "Sistema administrativo y punto de venta de La Martina Fresh Market.",
  icons: {
    icon: [
      {
        url: "/favicon.ico?v=5",
        type: "image/x-icon",
      },
      {
        url: "/icon.png?v=5",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    shortcut: "/favicon.ico?v=5",
    apple: "/apple-icon.png?v=5",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

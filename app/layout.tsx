import "./globals.css"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Great Sage",
  description: "Navy leadership dashboard",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
import { NextRequest, NextResponse } from "next/server"

const protectedPaths = [
  "/roster",
  "/collaterals",
  "/divisions",
  "/leave",
  "/audit-log",
]

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const needsProtection = protectedPaths.some((path) =>
    pathname.startsWith(path)
  )

  if (!needsProtection) {
    return NextResponse.next()
  }

  const role = req.cookies.get("gs_role")?.value

  if (role === "admin" || role === "leadership") {
    return NextResponse.next()
  }

  const url = req.nextUrl.clone()
  url.pathname = "/leadership-login"
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    "/roster/:path*",
    "/collaterals/:path*",
    "/divisions/:path*",
    "/leave/:path*",
    "/audit-log/:path*",
  ],
}
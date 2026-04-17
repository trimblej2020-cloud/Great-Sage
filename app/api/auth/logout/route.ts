import { NextResponse } from "next/server"

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set("gs_role", "", {
    httpOnly: false,
    expires: new Date(0),
    path: "/",
  })
  res.cookies.set("gs_sailor_id", "", {
    httpOnly: false,
    expires: new Date(0),
    path: "/",
  })
  return res
}
import { NextRequest, NextResponse } from "next/server"

const LEADERSHIP_PASSWORD = "NavyLeadership1"
const ADMIN_PASSWORD = "Ourfather1!"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { role, password, sailorId } = body

  if (role === "admin") {
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid admin password." }, { status: 401 })
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set("gs_role", "admin", {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
    })
    res.cookies.set("gs_sailor_id", "", {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
    })
    return res
  }

  if (role === "leadership") {
    if (password !== LEADERSHIP_PASSWORD) {
      return NextResponse.json({ error: "Invalid leadership password." }, { status: 401 })
    }

    if (!sailorId) {
      return NextResponse.json(
        { error: "Leadership login requires a sailor identity." },
        { status: 400 }
      )
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set("gs_role", "leadership", {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
    })
    res.cookies.set("gs_sailor_id", sailorId, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
    })
    return res
  }

  return NextResponse.json({ error: "Invalid role." }, { status: 400 })
}
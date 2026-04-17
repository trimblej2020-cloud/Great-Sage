"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { canEditDivision, getClientAuth } from "@/lib/auth-client"

type Division = {
  id: string
  division_name: string
}

type Leader = {
  id: string
  division_id: string | null
  sailor_id: string | null
  role_title: string
}

type Sailor = {
  id: string
  full_name: string
  rank: string
  role: string | null
  division_id: string | null
  prd: string | null
  pcs_date: string | null
  roster_status: string | null
  tad_status: string | null
  phone_number: string | null
  email: string | null
  current_address: string | null
  leave_start: string | null
  leave_end: string | null
  shift_name: string | null
  shift_start: string | null
  shift_end: string | null
}

export default function RosterPage() {
  const [sailors, setSailors] = useState<Sailor[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [message, setMessage] = useState("")
  const [auth, setAuth] = useState({ role: null as string | null, sailorId: null as string | null })

  const loadData = async () => {
    const [sailorsRes, divisionsRes, leadersRes] = await Promise.all([
      supabase
        .from("sailors")
        .select("id, full_name, rank, role, division_id, prd, pcs_date, roster_status, tad_status, phone_number, email, current_address, leave_start, leave_end, shift_name, shift_start, shift_end")
        .order("full_name"),
      supabase.from("divisions").select("id, division_name").order("division_name"),
      supabase.from("leaders").select("id, division_id, sailor_id, role_title"),
    ])

    setSailors((sailorsRes.data ?? []) as Sailor[])
    setDivisions((divisionsRes.data ?? []) as Division[])
    setLeaders((leadersRes.data ?? []) as Leader[])
  }

  useEffect(() => {
    setAuth(getClientAuth())
    loadData()
  }, [])

  const logAudit = async (entityId: string, oldValue: unknown, newValue: unknown) => {
    await supabase.from("audit_log").insert([
      {
        entity_type: "sailor",
        entity_id: entityId,
        action: "update",
        changed_by: auth.role === "admin" ? "Admin" : `Leadership:${auth.sailorId}`,
        old_value: oldValue,
        new_value: newValue,
      },
    ])
  }

  const updateSailorField = async (
    sailor: Sailor,
    field: keyof Sailor,
    value: string
  ) => {
    const allowed =
      auth.role === "admin" ||
      canEditDivision(auth.role, auth.sailorId, leaders, sailor.division_id)

    if (!allowed) {
      setMessage("You do not have permission to edit this sailor.")
      return
    }

    const oldValue = { ...sailor }
    const newValue = { ...sailor, [field]: value || null }

    const { error } = await supabase
      .from("sailors")
      .update({ [field]: value || null })
      .eq("id", sailor.id)

    if (error) {
      setMessage("Error updating sailor.")
      return
    }

    await logAudit(sailor.id, oldValue, newValue)
    setMessage("Sailor updated.")
    loadData()
  }

  const archiveSailor = async (sailor: Sailor) => {
    const allowed =
      auth.role === "admin" ||
      canEditDivision(auth.role, auth.sailorId, leaders, sailor.division_id)

    if (!allowed) {
      setMessage("You do not have permission to mark this sailor departed.")
      return
    }

    const oldValue = { ...sailor }
    const newValue = { ...sailor, roster_status: "Departed" }

    const { error } = await supabase
      .from("sailors")
      .update({ roster_status: "Departed" })
      .eq("id", sailor.id)

    if (error) {
      setMessage("Error archiving sailor.")
      return
    }

    await logAudit(sailor.id, oldValue, newValue)
    setMessage("Sailor marked as Departed.")
    loadData()
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/leadership-login"
  }

  return (
    <main className="min-h-screen bg-[#0a1f44] p-6">
      <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 text-black shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Roster Management</h1>
            <p className="mt-2 text-sm">
              Manage division placement, contact info, leave, and shift schedules.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/"
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm"
            >
              Back to Dashboard
            </a>
            <button
              onClick={logout}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {sailors.map((sailor) => (
            <details
              key={sailor.id}
              className="rounded-2xl border border-yellow-600 bg-gray-50 p-4"
            >
              <summary className="cursor-pointer font-semibold">
                {sailor.rank} {sailor.full_name} — {sailor.role || "No Role"}
              </summary>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field
                  label="Division"
                  control={
                    <select
                      value={sailor.division_id || ""}
                      onChange={(e) => updateSailorField(sailor, "division_id", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2"
                    >
                      <option value="">Unassigned</option>
                      {divisions.map((division) => (
                        <option key={division.id} value={division.id}>
                          {division.division_name}
                        </option>
                      ))}
                    </select>
                  }
                />
                <Field
                  label="Phone Number"
                  control={
                    <input
                      type="text"
                      defaultValue={sailor.phone_number || ""}
                      onBlur={(e) => updateSailorField(sailor, "phone_number", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2"
                    />
                  }
                />
                <Field
                  label="Email"
                  control={
                    <input
                      type="email"
                      defaultValue={sailor.email || ""}
                      onBlur={(e) => updateSailorField(sailor, "email", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2"
                    />
                  }
                />
                <Field
                  label="Current Address"
                  control={
                    <input
                      type="text"
                      defaultValue={sailor.current_address || ""}
                      onBlur={(e) => updateSailorField(sailor, "current_address", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2"
                    />
                  }
                />
                <Field
                  label="Leave Start"
                  control={
                    <input
                      type="date"
                      defaultValue={sailor.leave_start || ""}
                      onBlur={(e) => updateSailorField(sailor, "leave_start", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2"
                    />
                  }
                />
                <Field
                  label="Leave End"
                  control={
                    <input
                      type="date"
                      defaultValue={sailor.leave_end || ""}
                      onBlur={(e) => updateSailorField(sailor, "leave_end", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2"
                    />
                  }
                />
                <Field
                  label="Shift Name"
                  control={
                    <input
                      type="text"
                      defaultValue={sailor.shift_name || ""}
                      onBlur={(e) => updateSailorField(sailor, "shift_name", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2"
                    />
                  }
                />
                <Field
                  label="Shift Start"
                  control={
                    <input
                      type="time"
                      defaultValue={sailor.shift_start || ""}
                      onBlur={(e) => updateSailorField(sailor, "shift_start", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2"
                    />
                  }
                />
                <Field
                  label="Shift End"
                  control={
                    <input
                      type="time"
                      defaultValue={sailor.shift_end || ""}
                      onBlur={(e) => updateSailorField(sailor, "shift_end", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2"
                    />
                  }
                />
              </div>

              <div className="mt-4">
                <button
                  onClick={() => archiveSailor(sailor)}
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  Mark Departed
                </button>
              </div>
            </details>
          ))}
        </div>

        {message && (
          <div className="mt-4 rounded-xl bg-gray-100 p-3 text-sm font-medium">
            {message}
          </div>
        )}
      </div>
    </main>
  )
}

function Field({
  label,
  control,
}: {
  label: string
  control: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {control}
    </div>
  )
}
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

export default function RosterPage() {
  const [sailors, setSailors] = useState<Sailor[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [message, setMessage] = useState("")
  const [auth, setAuth] = useState({
    role: null as string | null,
    sailorId: null as string | null,
  })

  const loadData = async () => {
    const [sailorsRes, divisionsRes, leadersRes] = await Promise.all([
      supabase
        .from("sailors")
        .select(
          "id, full_name, rank, role, division_id, prd, pcs_date, roster_status, tad_status, phone_number, email, current_address, leave_start, leave_end, shift_name, shift_start, shift_end"
        )
        .order("full_name"),
      supabase
        .from("divisions")
        .select("id, division_name")
        .order("division_name"),
      supabase
        .from("leaders")
        .select("id, division_id, sailor_id, role_title"),
    ])

    setSailors((sailorsRes.data ?? []) as Sailor[])
    setDivisions((divisionsRes.data ?? []) as Division[])
    setLeaders((leadersRes.data ?? []) as Leader[])
  }

  useEffect(() => {
    setAuth(getClientAuth())
    loadData()
  }, [])

  const logAudit = async (
    entityType: string,
    entityId: string,
    action: string,
    oldValue: unknown,
    newValue: unknown
  ) => {
    await supabase.from("audit_log").insert([
      {
        entity_type: entityType,
        entity_id: entityId,
        action,
        changed_by: auth.role === "admin" ? "Admin" : `Leadership:${auth.sailorId}`,
        old_value: oldValue,
        new_value: newValue,
      },
    ])
  }

  const canEditSailor = (sailor: Sailor) => {
    if (auth.role === "admin") return true
    return canEditDivision(auth.role, auth.sailorId, leaders, sailor.division_id)
  }

  const updateSailorField = async (
    sailor: Sailor,
    field: keyof Sailor,
    value: string
  ) => {
    if (!canEditSailor(sailor)) {
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
      setMessage(`Error updating sailor: ${error.message}`)
      return
    }

    await logAudit("sailor", sailor.id, "update", oldValue, newValue)

    setMessage("Sailor updated.")
    loadData()
  }

  const archiveSailor = async (sailor: Sailor) => {
    if (!canEditSailor(sailor)) {
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
      setMessage(`Error archiving sailor: ${error.message}`)
      return
    }

    await logAudit("sailor", sailor.id, "mark_departed", oldValue, newValue)

    setMessage("Sailor marked as Departed.")
    loadData()
  }

  const deleteSailorPermanently = async (sailor: Sailor) => {
    if (!canEditSailor(sailor) && auth.role !== "admin") {
      setMessage("You do not have permission to delete this sailor.")
      return
    }

    const confirmed = window.confirm(
      `Permanently delete ${sailor.rank} ${sailor.full_name}? This cannot be undone.`
    )

    if (!confirmed) return

    const oldValue = { ...sailor }

    // Delete child/related records first
    const steps = [
      () => supabase.from("leaders").delete().eq("sailor_id", sailor.id),
      () =>
        supabase
          .from("program_assignments")
          .delete()
          .or(`owner_sailor_id.eq.${sailor.id},assistant_sailor_id.eq.${sailor.id}`),
      () => supabase.from("cfl_status").delete().eq("sailor_id", sailor.id),
      () => supabase.from("sailor_program_status").delete().eq("sailor_id", sailor.id),
      () => supabase.from("sailor_training_status").delete().eq("sailor_id", sailor.id),
      () => supabase.from("sailor_advancement_status").delete().eq("sailor_id", sailor.id),
      () => supabase.from("leave_requests").delete().eq("sailor_id", sailor.id),
      () => supabase.from("counseling_logs").delete().eq("sailor_id", sailor.id),
      () => supabase.from("awards").delete().eq("sailor_id", sailor.id),
      () => supabase.from("eval_inputs").delete().eq("sailor_id", sailor.id),
      () => supabase.from("advancement_tracking").delete().eq("sailor_id", sailor.id),
    ]

    for (const step of steps) {
      const { error } = await step()
      if (error) {
        setMessage(`Error deleting linked records: ${error.message}`)
        return
      }
    }

    // Log before deleting audit entries
    await logAudit("sailor", sailor.id, "delete", oldValue, null)

    // Remove audit trail entries directly tied to that sailor record
    await supabase
      .from("audit_log")
      .delete()
      .eq("entity_type", "sailor")
      .eq("entity_id", sailor.id)

    const { error: sailorError } = await supabase
      .from("sailors")
      .delete()
      .eq("id", sailor.id)

    if (sailorError) {
      setMessage(`Error deleting sailor: ${sailorError.message}`)
      return
    }

    setMessage("Sailor permanently deleted.")
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
              Manage division placement, contact info, leave, shifts, and roster status.
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
          {sailors.map((sailor) => {
            const editable = canEditSailor(sailor)

            return (
              <details
                key={sailor.id}
                className="rounded-2xl border border-yellow-600 bg-gray-50 p-4"
              >
                <summary className="cursor-pointer font-semibold">
                  {sailor.rank} {sailor.full_name} — {sailor.role || "No Role"}
                  {!editable && (
                    <span className="ml-3 rounded-full bg-gray-300 px-2 py-1 text-xs">
                      Read Only
                    </span>
                  )}
                </summary>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field
                    label="Division"
                    control={
                      <select
                        value={sailor.division_id || ""}
                        onChange={(e) =>
                          updateSailorField(sailor, "division_id", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
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
                    label="PRD"
                    control={
                      <input
                        type="date"
                        defaultValue={sailor.prd || ""}
                        onBlur={(e) =>
                          updateSailorField(sailor, "prd", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="PCS"
                    control={
                      <input
                        type="date"
                        defaultValue={sailor.pcs_date || ""}
                        onBlur={(e) =>
                          updateSailorField(sailor, "pcs_date", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="Roster Status"
                    control={
                      <select
                        value={sailor.roster_status || "Onboard"}
                        onChange={(e) =>
                          updateSailorField(sailor, "roster_status", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      >
                        <option value="Onboard">Onboard</option>
                        <option value="Inbound">Inbound</option>
                        <option value="TAD">TAD</option>
                        <option value="Departed">Departed</option>
                      </select>
                    }
                  />

                  <Field
                    label="TAD Status"
                    control={
                      <select
                        value={sailor.tad_status || "None"}
                        onChange={(e) =>
                          updateSailorField(sailor, "tad_status", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      >
                        <option value="None">None</option>
                        <option value="School">School</option>
                        <option value="Temporary Duty">Temporary Duty</option>
                        <option value="Leave">Leave</option>
                      </select>
                    }
                  />

                  <Field
                    label="Phone Number"
                    control={
                      <input
                        type="text"
                        defaultValue={sailor.phone_number || ""}
                        onBlur={(e) =>
                          updateSailorField(sailor, "phone_number", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="Email"
                    control={
                      <input
                        type="email"
                        defaultValue={sailor.email || ""}
                        onBlur={(e) =>
                          updateSailorField(sailor, "email", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="Current Address"
                    control={
                      <input
                        type="text"
                        defaultValue={sailor.current_address || ""}
                        onBlur={(e) =>
                          updateSailorField(sailor, "current_address", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="Leave Start"
                    control={
                      <input
                        type="date"
                        defaultValue={sailor.leave_start || ""}
                        onBlur={(e) =>
                          updateSailorField(sailor, "leave_start", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="Leave End"
                    control={
                      <input
                        type="date"
                        defaultValue={sailor.leave_end || ""}
                        onBlur={(e) =>
                          updateSailorField(sailor, "leave_end", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="Shift Name"
                    control={
                      <input
                        type="text"
                        defaultValue={sailor.shift_name || ""}
                        onBlur={(e) =>
                          updateSailorField(sailor, "shift_name", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="Shift Start"
                    control={
                      <input
                        type="time"
                        defaultValue={sailor.shift_start || ""}
                        onBlur={(e) =>
                          updateSailorField(sailor, "shift_start", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="Shift End"
                    control={
                      <input
                        type="time"
                        defaultValue={sailor.shift_end || ""}
                        onBlur={(e) =>
                          updateSailorField(sailor, "shift_end", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => archiveSailor(sailor)}
                    disabled={!editable}
                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-gray-300"
                  >
                    Mark Departed
                  </button>

                  <button
                    onClick={() => deleteSailorPermanently(sailor)}
                    disabled={!editable && auth.role !== "admin"}
                    className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:bg-gray-300"
                  >
                    Delete Permanently
                  </button>
                </div>
              </details>
            )
          })}
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
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { canEditDivision, getClientAuth } from "@/lib/auth-client"

type Sailor = {
  id: string
  full_name: string
  rank: string
  division_id: string | null
}

type Leader = {
  id: string
  division_id: string | null
  sailor_id: string | null
  role_title: string
}

type CflStatus = {
  id: string
  sailor_id: string
  pfa_cycle: string | null
  parfq_status: string
  bca_status: string
  prt_result: string
  fep_enrolled: boolean
  fep_weekly_weigh_in_date: string | null
  medical_clearance: string
  waiver_required: boolean
  waiver_expiration: string | null
  prims_issue: string | null
  loc_required: boolean
  last_updated: string
}

export default function CflBoardPage() {
  const [auth, setAuth] = useState({ role: null as string | null, sailorId: null as string | null })
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [sailors, setSailors] = useState<Sailor[]>([])
  const [rows, setRows] = useState<CflStatus[]>([])
  const [message, setMessage] = useState("")

  const loadAll = async () => {
    const [leadersRes, sailorsRes, rowsRes] = await Promise.all([
      supabase.from("leaders").select("id, division_id, sailor_id, role_title"),
      supabase.from("sailors").select("id, full_name, rank, division_id").order("full_name"),
      supabase.from("cfl_status").select("*").order("last_updated", { ascending: false }),
    ])

    setLeaders((leadersRes.data ?? []) as Leader[])
    setSailors((sailorsRes.data ?? []) as Sailor[])
    setRows((rowsRes.data ?? []) as CflStatus[])
  }

  useEffect(() => {
    setAuth(getClientAuth())
    loadAll()
  }, [])

  const canEditSailor = (sailor: Sailor) => {
    if (auth.role === "admin") return true
    return canEditDivision(auth.role, auth.sailorId, leaders, sailor.division_id)
  }

  const updateField = async (
    row: CflStatus,
    sailor: Sailor,
    field: keyof CflStatus,
    value: string | boolean
  ) => {
    if (!canEditSailor(sailor)) {
      setMessage("You do not have permission to edit this sailor's CFL data.")
      return
    }

    const oldValue = { ...row }
    const newValue = {
      ...row,
      [field]: value,
      last_updated: new Date().toISOString(),
    }

    const { error } = await supabase
      .from("cfl_status")
      .update({
        [field]: value,
        last_updated: new Date().toISOString(),
      })
      .eq("id", row.id)

    if (error) {
      setMessage("Error updating CFL data.")
      return
    }

    await supabase.from("audit_log").insert([
      {
        entity_type: "cfl_status",
        entity_id: row.id,
        action: "update",
        changed_by: auth.role === "admin" ? "Admin" : `Leadership:${auth.sailorId}`,
        old_value: oldValue,
        new_value: newValue,
      },
    ])

    setMessage("CFL data updated.")
    loadAll()
  }

  const summary = {
    fep: rows.filter((r) => r.fep_enrolled).length,
    parfqMissing: rows.filter((r) => r.parfq_status !== "Entered").length,
    locRequired: rows.filter((r) => r.loc_required).length,
    waiverRequired: rows.filter((r) => r.waiver_required).length,
  }

  return (
    <main className="min-h-screen bg-[#0a1f44] p-6">
      <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 text-black shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">CFL / FEP Board</h1>
            <p className="mt-2 text-sm">
              Track PARFQ, BCA, PRT, FEP, medical clearance, waivers, PRIMS issues, and LOC needs.
            </p>
          </div>

          <a
            href="/"
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm"
          >
            Back to Dashboard
          </a>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-4">
          <StatCard title="FEP Enrolled" value={summary.fep} />
          <StatCard title="PARFQ Not Entered" value={summary.parfqMissing} />
          <StatCard title="LOC Required" value={summary.locRequired} />
          <StatCard title="Waiver Required" value={summary.waiverRequired} />
        </div>

        <div className="mt-6 space-y-4">
          {rows.map((row) => {
            const sailor = sailors.find((s) => s.id === row.sailor_id)
            if (!sailor) return null

            const editable = canEditSailor(sailor)

            return (
              <details
                key={row.id}
                className={`rounded-2xl border p-4 ${
                  row.loc_required
                    ? "border-red-500 bg-red-50"
                    : row.fep_enrolled
                    ? "border-yellow-600 bg-yellow-50"
                    : "border-yellow-600 bg-gray-50"
                }`}
              >
                <summary className="cursor-pointer font-semibold">
                  {sailor.rank} {sailor.full_name}
                </summary>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field
                    label="PFA Cycle"
                    control={
                      <input
                        type="text"
                        defaultValue={row.pfa_cycle || ""}
                        onBlur={(e) => updateField(row, sailor, "pfa_cycle", e.target.value)}
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="PARFQ Status"
                    control={
                      <select
                        value={row.parfq_status}
                        onChange={(e) => updateField(row, sailor, "parfq_status", e.target.value)}
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      >
                        <option value="Not Entered">Not Entered</option>
                        <option value="Entered">Entered</option>
                        <option value="Paper Only">Paper Only</option>
                      </select>
                    }
                  />

                  <Field
                    label="BCA Status"
                    control={
                      <select
                        value={row.bca_status}
                        onChange={(e) => updateField(row, sailor, "bca_status", e.target.value)}
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Pass">Pass</option>
                        <option value="Fail">Fail</option>
                      </select>
                    }
                  />

                  <Field
                    label="PRT Result"
                    control={
                      <select
                        value={row.prt_result}
                        onChange={(e) => updateField(row, sailor, "prt_result", e.target.value)}
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Outstanding">Outstanding</option>
                        <option value="Excellent High">Excellent High</option>
                        <option value="Excellent Med">Excellent Med</option>
                        <option value="Excellent Low">Excellent Low</option>
                        <option value="Good High">Good High</option>
                        <option value="Good Med">Good Med</option>
                        <option value="Good Low">Good Low</option>
                        <option value="Satisfactory">Satisfactory</option>
                        <option value="Probationary">Probationary</option>
                        <option value="Fail">Fail</option>
                      </select>
                    }
                  />

                  <Field
                    label="FEP Enrolled"
                    control={
                      <input
                        type="checkbox"
                        checked={row.fep_enrolled}
                        onChange={(e) => updateField(row, sailor, "fep_enrolled", e.target.checked)}
                        disabled={!editable}
                      />
                    }
                  />

                  <Field
                    label="Weekly Weigh-In"
                    control={
                      <input
                        type="date"
                        defaultValue={row.fep_weekly_weigh_in_date || ""}
                        onBlur={(e) =>
                          updateField(row, sailor, "fep_weekly_weigh_in_date", e.target.value)
                        }
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="Medical Clearance"
                    control={
                      <select
                        value={row.medical_clearance}
                        onChange={(e) => updateField(row, sailor, "medical_clearance", e.target.value)}
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Cleared">Cleared</option>
                        <option value="Not Cleared">Not Cleared</option>
                      </select>
                    }
                  />

                  <Field
                    label="Waiver Required"
                    control={
                      <input
                        type="checkbox"
                        checked={row.waiver_required}
                        onChange={(e) => updateField(row, sailor, "waiver_required", e.target.checked)}
                        disabled={!editable}
                      />
                    }
                  />

                  <Field
                    label="Waiver Expiration"
                    control={
                      <input
                        type="date"
                        defaultValue={row.waiver_expiration || ""}
                        onBlur={(e) => updateField(row, sailor, "waiver_expiration", e.target.value)}
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="PRIMS Issue"
                    control={
                      <input
                        type="text"
                        defaultValue={row.prims_issue || ""}
                        onBlur={(e) => updateField(row, sailor, "prims_issue", e.target.value)}
                        disabled={!editable}
                        className="w-full rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                      />
                    }
                  />

                  <Field
                    label="LOC Required"
                    control={
                      <input
                        type="checkbox"
                        checked={row.loc_required}
                        onChange={(e) => updateField(row, sailor, "loc_required", e.target.checked)}
                        disabled={!editable}
                      />
                    }
                  />
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

function StatCard({
  title,
  value,
}: {
  title: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-yellow-600 bg-white p-4 text-black shadow-sm">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
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
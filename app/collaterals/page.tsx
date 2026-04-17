"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { canEditProgram, getClientAuth } from "@/lib/auth-client"

type Sailor = {
  id: string
  full_name: string
  rank: string
}

type ProgramTemplate = {
  id: string
  program_name: string
  description: string | null
}

type ProgramAssignment = {
  id: string
  template_id: string
  owner_sailor_id: string | null
  assistant_sailor_id: string | null
  owner_name: string | null
  assistant_name: string | null
  suspense_date: string | null
  division_id?: string | null
}

type ProgramRequirement = {
  id: string
  template_id: string
  requirement_name: string
  allowed_values: string[]
  needs_due_date: boolean
  needs_completion_date: boolean
  needs_appointment_datetime: boolean
}

type SailorProgramStatus = {
  id: string
  sailor_id: string
  program_assignment_id: string
  requirement_id: string
  value: string | null
  due_date: string | null
  completion_date: string | null
  appointment_at: string | null
  notes: string | null
  is_dinq: boolean
  is_at_risk: boolean
}

type Leader = {
  id: string
  division_id: string | null
  sailor_id: string | null
  role_title: string
}

export default function ProgramsPage() {
  const [auth, setAuth] = useState({ role: null as string | null, sailorId: null as string | null })
  const [sailors, setSailors] = useState<Sailor[]>([])
  const [templates, setTemplates] = useState<ProgramTemplate[]>([])
  const [assignments, setAssignments] = useState<ProgramAssignment[]>([])
  const [requirements, setRequirements] = useState<ProgramRequirement[]>([])
  const [statuses, setStatuses] = useState<SailorProgramStatus[]>([])
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [selectedRequirementId, setSelectedRequirementId] = useState("")
  const [selectedSailorId, setSelectedSailorId] = useState("")
  const [message, setMessage] = useState("")

  const [form, setForm] = useState({
    value: "",
    due_date: "",
    completion_date: "",
    appointment_at: "",
    notes: "",
  })

  const loadAll = async () => {
    const [sailorsRes, templatesRes, assignmentsRes, reqRes, statusRes, leadersRes] =
      await Promise.all([
        supabase.from("sailors").select("id, full_name, rank").eq("roster_status", "Onboard").order("full_name"),
        supabase.from("program_templates").select("*").order("program_name"),
        supabase.from("program_assignments").select("*"),
        supabase.from("program_requirements").select("*"),
        supabase.from("sailor_program_status").select("*"),
        supabase.from("leaders").select("id, division_id, sailor_id, role_title"),
      ])

    setSailors((sailorsRes.data ?? []) as Sailor[])
    setTemplates((templatesRes.data ?? []) as ProgramTemplate[])
    setAssignments((assignmentsRes.data ?? []) as ProgramAssignment[])
    setRequirements((reqRes.data ?? []) as ProgramRequirement[])
    setStatuses((statusRes.data ?? []) as SailorProgramStatus[])
    setLeaders((leadersRes.data ?? []) as Leader[])

    if (!selectedTemplateId && templatesRes.data && templatesRes.data.length > 0) {
      setSelectedTemplateId(templatesRes.data[0].id)
    }
  }

  useEffect(() => {
    setAuth(getClientAuth())
    loadAll()
  }, [])

  const currentTemplate =
    templates.find((t) => t.id === selectedTemplateId) || null
  const currentAssignment =
    assignments.find((a) => a.template_id === selectedTemplateId) || null
  const currentRequirements = requirements.filter(
    (r) => r.template_id === selectedTemplateId
  )
  const currentRequirement =
    currentRequirements.find((r) => r.id === selectedRequirementId) || null

  const canEditCurrentProgram = canEditProgram(
    auth.role,
    auth.sailorId,
    currentAssignment,
    leaders
  )

  const getExistingStatus = () => {
    if (!currentAssignment || !selectedSailorId || !selectedRequirementId) return null
    return (
      statuses.find(
        (s) =>
          s.sailor_id === selectedSailorId &&
          s.program_assignment_id === currentAssignment.id &&
          s.requirement_id === selectedRequirementId
      ) || null
    )
  }

  useEffect(() => {
    const existing = getExistingStatus()
    setForm({
      value: existing?.value || "",
      due_date: existing?.due_date || "",
      completion_date: existing?.completion_date || "",
      appointment_at: existing?.appointment_at || "",
      notes: existing?.notes || "",
    })
  }, [selectedSailorId, selectedRequirementId, selectedTemplateId])

  const computeFlags = (value: string, dueDate: string, completionDate: string) => {
    const today = new Date()
    const due = dueDate ? new Date(dueDate) : null

    const manualDinqValues = [
      "Fail",
      "Missing",
      "Incomplete",
      "Overdue",
      "Not Cleared",
      "Class 3",
      "Class 4",
      "No Contact",
      "Not Assigned",
      "Missed",
      "Discrepancy",
    ]

    const timeDinq =
      !!due && due < today && !completionDate

    const atRisk =
      !!due &&
      due >= today &&
      (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 7 &&
      !completionDate

    return {
      is_dinq: manualDinqValues.includes(value) || timeDinq,
      is_at_risk: atRisk,
    }
  }

  const saveStatus = async () => {
    if (!currentAssignment || !currentRequirement || !selectedSailorId) {
      setMessage("Select a program, requirement, and sailor first.")
      return
    }

    if (!canEditCurrentProgram) {
      setMessage("You do not have permission to edit this program.")
      return
    }

    const existing = getExistingStatus()
    const flags = computeFlags(form.value, form.due_date, form.completion_date)

    const payload = {
      sailor_id: selectedSailorId,
      program_assignment_id: currentAssignment.id,
      requirement_id: currentRequirement.id,
      value: form.value || null,
      due_date: form.due_date || null,
      completion_date: form.completion_date || null,
      appointment_at: form.appointment_at || null,
      notes: form.notes || null,
      is_dinq: flags.is_dinq,
      is_at_risk: flags.is_at_risk,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error } = await supabase
        .from("sailor_program_status")
        .update(payload)
        .eq("id", existing.id)

      if (error) {
        setMessage("Error updating status.")
        return
      }

      await supabase.from("audit_log").insert([
        {
          entity_type: "sailor_program_status",
          entity_id: existing.id,
          action: "update",
          changed_by: auth.role === "admin" ? "Admin" : `Leadership:${auth.sailorId}`,
          old_value: existing,
          new_value: payload,
        },
      ])
    } else {
      const { data, error } = await supabase
        .from("sailor_program_status")
        .insert([payload])
        .select()

      if (error) {
        setMessage("Error creating status.")
        return
      }

      if (data?.[0]) {
        await supabase.from("audit_log").insert([
          {
            entity_type: "sailor_program_status",
            entity_id: data[0].id,
            action: "create",
            changed_by: auth.role === "admin" ? "Admin" : `Leadership:${auth.sailorId}`,
            old_value: null,
            new_value: payload,
          },
        ])
      }
    }

    setMessage("Status updated.")
    loadAll()
  }

  const selectedSailor = sailors.find((s) => s.id === selectedSailorId)
  const currentStatusesForRequirement =
    currentAssignment && selectedRequirementId
      ? statuses.filter(
          (s) =>
            s.program_assignment_id === currentAssignment.id &&
            s.requirement_id === selectedRequirementId
        )
      : []

  return (
    <main className="min-h-screen bg-[#0a1f44] p-6">
      <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 text-black shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Program Management</h1>
            <p className="mt-2 text-sm">
              Pick a program, then a requirement, then a sailor.
            </p>
            <p className="mt-1 text-sm font-medium">
              Access: {canEditCurrentProgram ? "Editable" : "Read Only"}
            </p>
          </div>

          <a
            href="/"
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm"
          >
            Back to Dashboard
          </a>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-yellow-600 bg-gray-50 p-5">
            <h2 className="text-xl font-semibold">Program</h2>
            <select
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value)
                setSelectedRequirementId("")
                setSelectedSailorId("")
              }}
              className="mt-4 w-full rounded-lg border border-gray-300 p-3"
            >
              <option value="">Select Program</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.program_name}
                </option>
              ))}
            </select>

            {currentAssignment && (
              <div className="mt-4 rounded-xl bg-white p-3 shadow-sm text-sm">
                <p>Owner: {currentAssignment.owner_name || "Unassigned"}</p>
                <p>Assistant: {currentAssignment.assistant_name || "Unassigned"}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-yellow-600 bg-gray-50 p-5">
            <h2 className="text-xl font-semibold">Requirement</h2>
            <div className="mt-4 space-y-3">
              {currentRequirements.map((req) => (
                <button
                  key={req.id}
                  onClick={() => setSelectedRequirementId(req.id)}
                  className={`block w-full rounded-xl border p-3 text-left ${
                    selectedRequirementId === req.id
                      ? "border-black bg-[#d4af37] font-semibold"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {req.requirement_name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-600 bg-gray-50 p-5">
            <h2 className="text-xl font-semibold">Sailor</h2>
            <select
              value={selectedSailorId}
              onChange={(e) => setSelectedSailorId(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 p-3"
            >
              <option value="">Select Sailor</option>
              {sailors.map((sailor) => (
                <option key={sailor.id} value={sailor.id}>
                  {sailor.rank} {sailor.full_name}
                </option>
              ))}
            </select>

            {selectedSailor && (
              <div className="mt-4 rounded-xl bg-white p-3 shadow-sm">
                <p className="font-semibold">
                  {selectedSailor.rank} {selectedSailor.full_name}
                </p>
                <p className="text-sm">
                  Requirement: {currentRequirement?.requirement_name || "None selected"}
                </p>
              </div>
            )}
          </div>
        </div>

        {currentRequirement && selectedSailor && (
          <div className="mt-6 rounded-2xl border border-yellow-600 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Quick Update</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <select
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  disabled={!canEditCurrentProgram}
                  className="w-full rounded-lg border border-gray-300 p-3 disabled:bg-gray-100"
                >
                  <option value="">Select</option>
                  {currentRequirement.allowed_values.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              {currentRequirement.needs_due_date && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    disabled={!canEditCurrentProgram}
                    className="w-full rounded-lg border border-gray-300 p-3 disabled:bg-gray-100"
                  />
                </div>
              )}

              {currentRequirement.needs_completion_date && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Completion Date</label>
                  <input
                    type="date"
                    value={form.completion_date}
                    onChange={(e) => setForm({ ...form, completion_date: e.target.value })}
                    disabled={!canEditCurrentProgram}
                    className="w-full rounded-lg border border-gray-300 p-3 disabled:bg-gray-100"
                  />
                </div>
              )}

              {currentRequirement.needs_appointment_datetime && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Appointment</label>
                  <input
                    type="datetime-local"
                    value={form.appointment_at}
                    onChange={(e) => setForm({ ...form, appointment_at: e.target.value })}
                    disabled={!canEditCurrentProgram}
                    className="w-full rounded-lg border border-gray-300 p-3 disabled:bg-gray-100"
                  />
                </div>
              )}

              <div className="md:col-span-2 xl:col-span-5">
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  disabled={!canEditCurrentProgram}
                  className="w-full rounded-lg border border-gray-300 p-3 disabled:bg-gray-100"
                />
              </div>
            </div>

            <button
              onClick={saveStatus}
              disabled={!canEditCurrentProgram}
              className="mt-4 rounded-lg bg-[#d4af37] px-4 py-3 font-semibold text-black shadow-sm hover:opacity-90 disabled:bg-gray-300"
            >
              Save Update
            </button>
          </div>
        )}

        {selectedRequirementId && (
          <div className="mt-6 rounded-2xl border border-yellow-600 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Current Requirement View</h2>

            <div className="mt-4 space-y-3">
              {currentStatusesForRequirement.length === 0 ? (
                <div className="rounded-xl bg-gray-100 p-3 text-sm">
                  No entries yet for this requirement.
                </div>
              ) : (
                currentStatusesForRequirement.map((status) => {
                  const sailor = sailors.find((s) => s.id === status.sailor_id)
                  return (
                    <div
                      key={status.id}
                      className={`rounded-xl border p-3 ${
                        status.is_dinq
                          ? "border-red-500 bg-red-50"
                          : status.is_at_risk
                          ? "border-yellow-600 bg-yellow-50"
                          : "border-gray-300 bg-gray-50"
                      }`}
                    >
                      <p className="font-semibold">
                        {sailor ? `${sailor.rank} ${sailor.full_name}` : "Unknown Sailor"}
                      </p>
                      <p className="text-sm">Status: {status.value || "-"}</p>
                      <p className="text-sm">Due: {status.due_date || "-"}</p>
                      <p className="text-sm">Completed: {status.completion_date || "-"}</p>
                      <p className="text-sm">Appointment: {status.appointment_at || "-"}</p>
                      <p className="text-sm">Notes: {status.notes || "-"}</p>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-xl bg-gray-100 p-3 text-sm font-medium">
            {message}
          </div>
        )}
      </div>
    </main>
  )
}
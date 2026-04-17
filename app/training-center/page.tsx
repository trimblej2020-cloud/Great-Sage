"use client"

import { useEffect, useMemo, useState } from "react"
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

type TrainingRequirement = {
  id: string
  title: string
  applies_to_paygrades: string[]
  category: string | null
  official_source: string | null
  command_specific: boolean
}

type SailorTrainingStatus = {
  id: string
  sailor_id: string
  training_requirement_id: string
  status: string
  due_date: string | null
  scheduled_date: string | null
  completion_date: string | null
  notes: string | null
}

type TrainingSession = {
  id: string
  title: string
  training_requirement_id: string | null
  session_date: string | null
  location: string | null
  instructor: string | null
  notes: string | null
}

type AdvancementStatus = {
  id: string
  sailor_id: string
  target_paygrade: string | null
  exam_cycle: string | null
  eaw_status: string
  pmkee_status: string
  eld_course: string | null
  eld_status: string
  exam_date: string | null
  eligible: boolean
  notes: string | null
}

export default function TrainingCenterPage() {
  const [auth, setAuth] = useState({ role: null as string | null, sailorId: null as string | null })
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [sailors, setSailors] = useState<Sailor[]>([])
  const [requirements, setRequirements] = useState<TrainingRequirement[]>([])
  const [statuses, setStatuses] = useState<SailorTrainingStatus[]>([])
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [advancement, setAdvancement] = useState<AdvancementStatus[]>([])
  const [message, setMessage] = useState("")

  const [selectedSailorId, setSelectedSailorId] = useState("")
  const [selectedRequirementId, setSelectedRequirementId] = useState("")
  const [trainingForm, setTrainingForm] = useState({
    status: "Not Started",
    due_date: "",
    scheduled_date: "",
    completion_date: "",
    notes: "",
  })

  const [sessionForm, setSessionForm] = useState({
    title: "",
    training_requirement_id: "",
    session_date: "",
    location: "",
    instructor: "",
    notes: "",
  })

  const loadAll = async () => {
    const [
      leadersRes,
      sailorsRes,
      requirementsRes,
      statusesRes,
      sessionsRes,
      advancementRes,
    ] = await Promise.all([
      supabase.from("leaders").select("id, division_id, sailor_id, role_title"),
      supabase.from("sailors").select("id, full_name, rank, division_id").order("full_name"),
      supabase.from("training_requirements").select("*").order("category").order("title"),
      supabase.from("sailor_training_status").select("*").order("updated_at", { ascending: false }),
      supabase.from("training_sessions").select("*").order("session_date", { ascending: true }),
      supabase.from("sailor_advancement_status").select("*").order("updated_at", { ascending: false }),
    ])

    setLeaders((leadersRes.data ?? []) as Leader[])
    setSailors((sailorsRes.data ?? []) as Sailor[])
    setRequirements((requirementsRes.data ?? []) as TrainingRequirement[])
    setStatuses((statusesRes.data ?? []) as SailorTrainingStatus[])
    setSessions((sessionsRes.data ?? []) as TrainingSession[])
    setAdvancement((advancementRes.data ?? []) as AdvancementStatus[])
  }

  useEffect(() => {
    setAuth(getClientAuth())
    loadAll()
  }, [])

  const canEditSailor = (sailor: Sailor) => {
    if (auth.role === "admin") return true
    return canEditDivision(auth.role, auth.sailorId, leaders, sailor.division_id)
  }

  const selectedSailor = sailors.find((s) => s.id === selectedSailorId) || null
  const selectedRequirement =
    requirements.find((r) => r.id === selectedRequirementId) || null

  const existingTrainingStatus =
    statuses.find(
      (row) =>
        row.sailor_id === selectedSailorId &&
        row.training_requirement_id === selectedRequirementId
    ) || null

  useEffect(() => {
    setTrainingForm({
      status: existingTrainingStatus?.status || "Not Started",
      due_date: existingTrainingStatus?.due_date || "",
      scheduled_date: existingTrainingStatus?.scheduled_date || "",
      completion_date: existingTrainingStatus?.completion_date || "",
      notes: existingTrainingStatus?.notes || "",
    })
  }, [selectedSailorId, selectedRequirementId])

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

  const saveTrainingStatus = async () => {
    if (!selectedSailor || !selectedRequirement) {
      setMessage("Select a sailor and a requirement first.")
      return
    }

    if (!canEditSailor(selectedSailor)) {
      setMessage("You do not have permission to edit this sailor's training.")
      return
    }

    const payload = {
      sailor_id: selectedSailor.id,
      training_requirement_id: selectedRequirement.id,
      status: trainingForm.status,
      due_date: trainingForm.due_date || null,
      scheduled_date: trainingForm.scheduled_date || null,
      completion_date: trainingForm.completion_date || null,
      notes: trainingForm.notes || null,
      updated_at: new Date().toISOString(),
    }

    if (existingTrainingStatus) {
      const { error } = await supabase
        .from("sailor_training_status")
        .update(payload)
        .eq("id", existingTrainingStatus.id)

      if (error) {
        setMessage("Error updating training status.")
        return
      }

      await logAudit(
        "sailor_training_status",
        existingTrainingStatus.id,
        "update",
        existingTrainingStatus,
        payload
      )
    } else {
      const { data, error } = await supabase
        .from("sailor_training_status")
        .insert([payload])
        .select()

      if (error) {
        setMessage("Error creating training status.")
        return
      }

      if (data?.[0]) {
        await logAudit(
          "sailor_training_status",
          data[0].id,
          "create",
          null,
          payload
        )
      }
    }

    setMessage("Training status saved.")
    loadAll()
  }

  const createSession = async () => {
    if (!sessionForm.title || !sessionForm.session_date) {
      setMessage("Session title and date are required.")
      return
    }

    if (auth.role !== "admin" && auth.role !== "leadership") {
      setMessage("You do not have permission to create sessions.")
      return
    }

    const payload = {
      title: sessionForm.title,
      training_requirement_id: sessionForm.training_requirement_id || null,
      session_date: sessionForm.session_date || null,
      location: sessionForm.location || null,
      instructor: sessionForm.instructor || null,
      notes: sessionForm.notes || null,
    }

    const { data, error } = await supabase
      .from("training_sessions")
      .insert([payload])
      .select()

    if (error) {
      setMessage("Error creating session.")
      return
    }

    if (data?.[0]) {
      await logAudit("training_session", data[0].id, "create", null, payload)
    }

    setSessionForm({
      title: "",
      training_requirement_id: "",
      session_date: "",
      location: "",
      instructor: "",
      notes: "",
    })

    setMessage("Training session created.")
    loadAll()
  }

  const updateAdvancement = async (
    row: AdvancementStatus,
    field: keyof AdvancementStatus,
    value: string | boolean
  ) => {
    const sailor = sailors.find((s) => s.id === row.sailor_id)
    if (!sailor) return

    if (!canEditSailor(sailor)) {
      setMessage("You do not have permission to edit this sailor's advancement.")
      return
    }

    const oldValue = { ...row }
    const newValue = { ...row, [field]: value }

    const { error } = await supabase
      .from("sailor_advancement_status")
      .update({
        [field]: value,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)

    if (error) {
      setMessage("Error updating advancement status.")
      return
    }

    await logAudit("sailor_advancement_status", row.id, "update", oldValue, newValue)
    setMessage("Advancement status updated.")
    loadAll()
  }

  const groupedRequirements = useMemo(() => {
    const groups: Record<string, TrainingRequirement[]> = {}
    requirements.forEach((req) => {
      const key = req.category || "Other"
      if (!groups[key]) groups[key] = []
      groups[key].push(req)
    })
    return groups
  }, [requirements])

  const trainingSummary = {
    due: statuses.filter((s) => s.due_date && new Date(s.due_date) >= new Date()).length,
    scheduled: statuses.filter((s) => s.scheduled_date && !s.completion_date).length,
    complete: statuses.filter((s) => s.completion_date).length,
    overdue: statuses.filter(
      (s) => s.due_date && new Date(s.due_date) < new Date() && !s.completion_date
    ).length,
  }

  const advancementSummary = {
    eligible: advancement.filter((a) => a.eligible).length,
    eawPending: advancement.filter((a) => a.eaw_status !== "Verified").length,
    pmkeePending: advancement.filter((a) => a.pmkee_status !== "Complete").length,
    eldPending: advancement.filter(
      (a) => a.eld_course && a.eld_status !== "Complete"
    ).length,
  }

  return (
    <main className="min-h-screen bg-[#0a1f44] p-6">
      <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 text-black shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Training & Advancement Center</h1>
            <p className="mt-2 text-sm">
              Track training due dates, scheduled sessions, completions, PMK-EE, EAW, and leader development requirements.
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
          <StatCard title="Due" value={trainingSummary.due} />
          <StatCard title="Scheduled" value={trainingSummary.scheduled} />
          <StatCard title="Complete" value={trainingSummary.complete} />
          <StatCard title="Overdue" value={trainingSummary.overdue} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-4">
          <StatCard title="Eligible" value={advancementSummary.eligible} />
          <StatCard title="EAW Pending" value={advancementSummary.eawPending} />
          <StatCard title="PMK-EE Pending" value={advancementSummary.pmkeePending} />
          <StatCard title="ELD Pending" value={advancementSummary.eldPending} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-yellow-600 bg-gray-50 p-5">
            <h2 className="text-xl font-semibold">Training Status Update</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Sailor</label>
                <select
                  value={selectedSailorId}
                  onChange={(e) => setSelectedSailorId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-3"
                >
                  <option value="">Select Sailor</option>
                  {sailors.map((sailor) => (
                    <option key={sailor.id} value={sailor.id}>
                      {sailor.rank} {sailor.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Requirement</label>
                <select
                  value={selectedRequirementId}
                  onChange={(e) => setSelectedRequirementId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-3"
                >
                  <option value="">Select Requirement</option>
                  {requirements.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <select
                  value={trainingForm.status}
                  onChange={(e) => setTrainingForm({ ...trainingForm, status: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                >
                  <option value="Not Started">Not Started</option>
                  <option value="Due">Due</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Complete">Complete</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Due Date</label>
                <input
                  type="date"
                  value={trainingForm.due_date}
                  onChange={(e) => setTrainingForm({ ...trainingForm, due_date: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Scheduled Date</label>
                <input
                  type="date"
                  value={trainingForm.scheduled_date}
                  onChange={(e) => setTrainingForm({ ...trainingForm, scheduled_date: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Completion Date</label>
                <input
                  type="date"
                  value={trainingForm.completion_date}
                  onChange={(e) => setTrainingForm({ ...trainingForm, completion_date: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <input
                  type="text"
                  value={trainingForm.notes}
                  onChange={(e) => setTrainingForm({ ...trainingForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>
            </div>

            <button
              onClick={saveTrainingStatus}
              className="mt-4 rounded-lg bg-[#d4af37] px-4 py-3 font-semibold text-black"
            >
              Save Training Status
            </button>
          </section>

          <section className="rounded-2xl border border-yellow-600 bg-gray-50 p-5">
            <h2 className="text-xl font-semibold">Create Training Session</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <input
                  type="text"
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Requirement</label>
                <select
                  value={sessionForm.training_requirement_id}
                  onChange={(e) =>
                    setSessionForm({ ...sessionForm, training_requirement_id: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 p-3"
                >
                  <option value="">Optional Requirement Link</option>
                  {requirements.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Session Date</label>
                <input
                  type="datetime-local"
                  value={sessionForm.session_date}
                  onChange={(e) => setSessionForm({ ...sessionForm, session_date: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Location</label>
                <input
                  type="text"
                  value={sessionForm.location}
                  onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Instructor</label>
                <input
                  type="text"
                  value={sessionForm.instructor}
                  onChange={(e) => setSessionForm({ ...sessionForm, instructor: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <input
                  type="text"
                  value={sessionForm.notes}
                  onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>
            </div>

            <button
              onClick={createSession}
              className="mt-4 rounded-lg bg-[#d4af37] px-4 py-3 font-semibold text-black"
            >
              Create Session
            </button>
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-yellow-600 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Requirement Library</h2>

            <div className="mt-4 space-y-5">
              {Object.entries(groupedRequirements).map(([category, items]) => (
                <div key={category}>
                  <h3 className="font-semibold">{category}</h3>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    {items.map((item) => (
                      <div key={item.id} className="rounded-xl border border-gray-300 bg-gray-50 p-3">
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-sm">{item.official_source || "Local / Command"}</p>
                        <p className="text-xs mt-1">
                          {item.command_specific ? "Command Specific" : "Official/Common"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-yellow-600 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Scheduled Sessions</h2>

            <div className="mt-4 space-y-3">
              {sessions.length === 0 ? (
                <div className="rounded-xl bg-gray-100 p-3 text-sm">
                  No sessions scheduled.
                </div>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} className="rounded-xl border border-gray-300 bg-gray-50 p-3">
                    <p className="font-semibold">{session.title}</p>
                    <p className="text-sm">{session.session_date || "-"}</p>
                    <p className="text-sm">Location: {session.location || "-"}</p>
                    <p className="text-sm">Instructor: {session.instructor || "-"}</p>
                    <p className="text-sm">Notes: {session.notes || "-"}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 rounded-2xl border border-yellow-600 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Advancement Board</h2>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-yellow-600">
                <tr>
                  <th className="pb-3 pr-4">Sailor</th>
                  <th className="pb-3 pr-4">Target</th>
                  <th className="pb-3 pr-4">Cycle</th>
                  <th className="pb-3 pr-4">EAW</th>
                  <th className="pb-3 pr-4">PMK-EE</th>
                  <th className="pb-3 pr-4">ELD Course</th>
                  <th className="pb-3 pr-4">ELD Status</th>
                  <th className="pb-3 pr-4">Exam Date</th>
                  <th className="pb-3 pr-4">Eligible</th>
                </tr>
              </thead>
              <tbody>
                {advancement.map((row) => {
                  const sailor = sailors.find((s) => s.id === row.sailor_id)
                  if (!sailor) return null

                  const editable = canEditSailor(sailor)

                  return (
                    <tr key={row.id} className="border-b border-gray-200">
                      <td className="py-3 pr-4 font-medium">
                        {sailor.rank} {sailor.full_name}
                      </td>
                      <td className="py-3 pr-4">{row.target_paygrade || "-"}</td>
                      <td className="py-3 pr-4">{row.exam_cycle || "-"}</td>
                      <td className="py-3 pr-4">
                        <select
                          value={row.eaw_status}
                          onChange={(e) => updateAdvancement(row, "eaw_status", e.target.value)}
                          disabled={!editable}
                          className="rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="Pending">Pending</option>
                          <option value="Verified">Verified</option>
                          <option value="Missing">Missing</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          value={row.pmkee_status}
                          onChange={(e) => updateAdvancement(row, "pmkee_status", e.target.value)}
                          disabled={!editable}
                          className="rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="Pending">Pending</option>
                          <option value="Complete">Complete</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4">{row.eld_course || "-"}</td>
                      <td className="py-3 pr-4">
                        <select
                          value={row.eld_status}
                          onChange={(e) => updateAdvancement(row, "eld_status", e.target.value)}
                          disabled={!editable}
                          className="rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="Complete">Complete</option>
                          <option value="Incomplete">Incomplete</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="date"
                          defaultValue={row.exam_date || ""}
                          onBlur={(e) => updateAdvancement(row, "exam_date", e.target.value)}
                          disabled={!editable}
                          className="rounded-lg border border-gray-300 p-2 disabled:bg-gray-100"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="checkbox"
                          checked={row.eligible}
                          onChange={(e) => updateAdvancement(row, "eligible", e.target.checked)}
                          disabled={!editable}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
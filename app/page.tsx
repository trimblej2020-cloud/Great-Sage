"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getClientAuth, getRoleLabel } from "@/lib/auth-client"

type Sailor = {
  id: string
  full_name: string
  rank: string
  role: string | null
  leave_start: string | null
  leave_end: string | null
  shift_name: string | null
  shift_start: string | null
  shift_end: string | null
  phone_number?: string | null
  email?: string | null
  current_address?: string | null
  division_id?: string | null
  sponsor_assigned?: boolean | null
  imr_last_verified?: string | null
}

type HelpfulInfo = {
  id: string
  category: string
  term: string
  short_definition: string
}

type LeaveRequest = {
  id: string
  sailor_id: string
  leave_type: string | null
  start_date: string
  end_date: string
  status: string
  reason: string | null
}

type ProgramTemplate = {
  id: string
  program_name: string
}

type ProgramAssignment = {
  id: string
  template_id: string
  owner_name: string | null
  owner_sailor_id?: string | null
  assistant_sailor_id?: string | null
  division_id?: string | null
}

type ProgramRequirement = {
  id: string
  requirement_name: string
}

type SailorProgramStatus = {
  id?: string
  sailor_id: string
  requirement_id: string
  program_assignment_id: string
  value: string | null
  due_date: string | null
  completion_date?: string | null
  appointment_at?: string | null
  is_dinq: boolean
  is_at_risk?: boolean
}

type Leader = {
  id: string
  division_id: string | null
  sailor_id: string | null
  role_title: string
}

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-yellow-600 bg-white p-5 text-black shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function isWithinNext7Days(dateString: string | null) {
  if (!dateString) return false
  const today = new Date()
  const target = new Date(dateString)
  const diffMs = target.getTime() - today.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= 7
}

function getWeekLabel(offset: number) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" })
}

export default function HomePage() {
  const [auth, setAuth] = useState({ role: null as string | null, sailorId: null as string | null })
  const [sailors, setSailors] = useState<Sailor[]>([])
  const [helpfulInfo, setHelpfulInfo] = useState<HelpfulInfo[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [templates, setTemplates] = useState<ProgramTemplate[]>([])
  const [assignments, setAssignments] = useState<ProgramAssignment[]>([])
  const [requirements, setRequirements] = useState<ProgramRequirement[]>([])
  const [statuses, setStatuses] = useState<SailorProgramStatus[]>([])
  const [leaders, setLeaders] = useState<Leader[]>([])

  const loadAll = async () => {
    const [
      sailorsRes,
      helpfulRes,
      leaveReqRes,
      templatesRes,
      assignmentsRes,
      requirementsRes,
      statusesRes,
      leadersRes,
    ] = await Promise.all([
      supabase
        .from("sailors")
        .select("id, full_name, rank, role, leave_start, leave_end, shift_name, shift_start, shift_end, phone_number, email, current_address, division_id, sponsor_assigned, imr_last_verified")
        .order("full_name"),
      supabase
        .from("helpful_information")
        .select("id, category, term, short_definition")
        .order("category"),
      supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("program_templates")
        .select("id, program_name")
        .order("program_name"),
      supabase
        .from("program_assignments")
        .select("id, template_id, owner_name, owner_sailor_id, assistant_sailor_id, division_id"),
      supabase
        .from("program_requirements")
        .select("id, requirement_name"),
      supabase
        .from("sailor_program_status")
        .select("id, sailor_id, requirement_id, program_assignment_id, value, due_date, completion_date, appointment_at, is_dinq, is_at_risk"),
      supabase
        .from("leaders")
        .select("id, division_id, sailor_id, role_title"),
    ])

    setSailors((sailorsRes.data ?? []) as Sailor[])
    setHelpfulInfo((helpfulRes.data ?? []) as HelpfulInfo[])
    setLeaveRequests((leaveReqRes.data ?? []) as LeaveRequest[])
    setTemplates((templatesRes.data ?? []) as ProgramTemplate[])
    setAssignments((assignmentsRes.data ?? []) as ProgramAssignment[])
    setRequirements((requirementsRes.data ?? []) as ProgramRequirement[])
    setStatuses((statusesRes.data ?? []) as SailorProgramStatus[])
    setLeaders((leadersRes.data ?? []) as Leader[])
  }

  useEffect(() => {
    setAuth(getClientAuth())
    loadAll()
  }, [])

  useEffect(() => {
    if (statuses.length === 0) return

    const today = new Date()
    const updates: Array<Promise<unknown>> = []

    statuses.forEach((status) => {
      const due = status.due_date ? new Date(status.due_date) : null
      const shouldBeDinq =
        !!due && due < today && (!status.completion_date || status.completion_date === "")

      const shouldBeAtRisk =
        !!due &&
        due >= today &&
        (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 7 &&
        (!status.completion_date || status.completion_date === "")

      if (status.is_dinq !== shouldBeDinq || !!status.is_at_risk !== shouldBeAtRisk) {
        updates.push(
          supabase
            .from("sailor_program_status")
            .update({
              is_dinq: shouldBeDinq,
              is_at_risk: shouldBeAtRisk,
            })
            .eq("id", status.id!)
        )
      }
    })

    if (updates.length > 0) {
      Promise.all(updates).then(() => loadAll())
    }
  }, [statuses.length])

  const currentSailor = sailors.find((s) => s.id === auth.sailorId)

  const dinqRows = statuses.filter((s) => s.is_dinq)
  const atRiskRows = statuses.filter((s) => !s.is_dinq && s.is_at_risk)

  const dinqFeed = dinqRows.map((row) => {
    const sailor = sailors.find((s) => s.id === row.sailor_id)
    const req = requirements.find((r) => r.id === row.requirement_id)
    const assignment = assignments.find((a) => a.id === row.program_assignment_id)
    const template = templates.find((t) => t.id === assignment?.template_id)

    return {
      sailor: sailor ? `${sailor.rank} ${sailor.full_name}` : "Unknown Sailor",
      topic: template?.program_name ?? "Unknown Program",
      item: req?.requirement_name ?? "Unknown Requirement",
      due: row.due_date ?? "No due date",
      value: row.value ?? "No value",
      owner: assignment?.owner_name ?? "Unassigned",
    }
  })

  const upcomingDueFeed = statuses
    .filter((s) => isWithinNext7Days(s.due_date))
    .map((row) => {
      const sailor = sailors.find((s) => s.id === row.sailor_id)
      const req = requirements.find((r) => r.id === row.requirement_id)
      const assignment = assignments.find((a) => a.id === row.program_assignment_id)
      const template = templates.find((t) => t.id === assignment?.template_id)

      return {
        sailor: sailor ? `${sailor.rank} ${sailor.full_name}` : "Unknown Sailor",
        topic: template?.program_name ?? "Unknown Program",
        item: req?.requirement_name ?? "Unknown Requirement",
        due: row.due_date ?? "No due date",
      }
    })

  const pendingLeave = leaveRequests.filter((r) => r.status === "Pending")
  const shifts = sailors.filter((s) => s.shift_name)

  const programOwnerSummaries = useMemo(() => {
    if (auth.role !== "admin" && auth.role !== "leadership") return []

    return assignments
      .filter((assignment) => {
        if (auth.role === "admin") return true
        return (
          assignment.owner_sailor_id === auth.sailorId ||
          assignment.assistant_sailor_id === auth.sailorId
        )
      })
      .map((assignment) => {
        const template = templates.find((t) => t.id === assignment.template_id)
        const related = statuses.filter((s) => s.program_assignment_id === assignment.id)
        const dinqCount = related.filter((r) => r.is_dinq).length
        const riskCount = related.filter((r) => r.is_at_risk && !r.is_dinq).length

        return {
          id: assignment.id,
          name: template?.program_name ?? "Unknown Program",
          dinqCount,
          riskCount,
          owner: assignment.owner_name ?? "Unassigned",
        }
      })
  }, [assignments, templates, statuses, auth])

  const qualityAlerts = sailors.flatMap((sailor) => {
    const alerts: string[] = []

    if (!sailor.phone_number) alerts.push(`${sailor.rank} ${sailor.full_name} is missing a phone number`)
    if (!sailor.email) alerts.push(`${sailor.rank} ${sailor.full_name} is missing an email`)
    if (!sailor.current_address) alerts.push(`${sailor.rank} ${sailor.full_name} is missing a current address`)
    if (!sailor.sponsor_assigned) alerts.push(`${sailor.rank} ${sailor.full_name} does not have sponsor status marked`)
    if (!sailor.imr_last_verified) alerts.push(`${sailor.rank} ${sailor.full_name} has no IMR verification date`)

    return alerts
  })

  const weekColumns = Array.from({ length: 7 }, (_, i) => {
    const label = getWeekLabel(i)
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + i)
    const targetStr = targetDate.toISOString().slice(0, 10)

    const leaveItems = leaveRequests.filter(
      (req) =>
        req.start_date <= targetStr &&
        req.end_date >= targetStr &&
        req.status === "Approved"
    )

    const dueItems = statuses.filter((s) => s.due_date === targetStr)

    return {
      label,
      leaveItems,
      dueItems,
    }
  })

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/leadership-login"
  }

  return (
    <main className="min-h-screen bg-[#0a1f44]">
      <div className="mx-auto max-w-7xl p-6">
        <header className="mb-6 rounded-3xl bg-[#d4af37] p-6 text-black shadow-lg">

         <div className="mt-4 flex flex-wrap gap-3">
  <a href="/roster" className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm">Roster</a>
  <a href="/collaterals" className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm">Programs</a>
  <a href="/training-center" className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm">Training Center</a>
  <a href="/cfl-board" className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm">CFL Board</a>
  <a href="/divisions" className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm">Divisions</a>
  <a href="/leave" className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm">Leave</a>
  <a href="/helpful-info" className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm">Helpful Info</a>
  {(auth.role === "admin" || auth.role === "leadership") && (
    <a href="/audit-log" className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm">Audit Log</a>
  )}
</div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em]">
                  Great Sage
                </p>
                <h1 className="mt-2 text-4xl font-bold">Daily Brief</h1>
                <p className="mt-2 max-w-2xl">
                  DINQ, next-week due items, leave, shifts, and helpful Navy information.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-[#d4af37]">
                  Role: {getRoleLabel(auth.role)}
                  {currentSailor ? ` · ${currentSailor.rank} ${currentSailor.full_name}` : ""}
                </div>
                {(auth.role === "admin" || auth.role === "leadership") && (
                  <button
                    onClick={logout}
                    className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Logout
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/quick-add/add-sailor" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm">
                Add Sailor
              </a>
              <a href="/leave" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm">
                Submit Leave
              </a>
              <a href="/collaterals" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm">
                Update Program Status
              </a>
              <a href="/divisions" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm">
                Manage Divisions
              </a>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-4">
          <Card title="Daily Brief">
            <div className="space-y-3">
              {[...dinqFeed.slice(0, 5), ...upcomingDueFeed.slice(0, 5)].length === 0 ? (
                <div className="rounded-xl bg-gray-100 p-3 text-sm">
                  No critical items for the next week.
                </div>
              ) : (
                <>
                  {dinqFeed.slice(0, 5).map((item, index) => (
                    <div key={`dinq-${index}`} className="rounded-xl border border-red-500 bg-red-50 p-3">
                      <p className="font-semibold">{item.sailor}</p>
                      <p className="text-sm">DINQ: {item.topic} / {item.item}</p>
                      <p className="text-sm">Due: {item.due}</p>
                    </div>
                  ))}
                  {upcomingDueFeed.slice(0, 5).map((item, index) => (
                    <div key={`due-${index}`} className="rounded-xl border border-yellow-600 bg-yellow-50 p-3">
                      <p className="font-semibold">{item.sailor}</p>
                      <p className="text-sm">Upcoming: {item.topic} / {item.item}</p>
                      <p className="text-sm">Due: {item.due}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </Card>

          <Card title="Pending Leave">
            <div className="space-y-3">
              {pendingLeave.length === 0 ? (
                <div className="rounded-xl bg-gray-100 p-3 text-sm">No pending leave requests.</div>
              ) : (
                pendingLeave.map((req) => {
                  const sailor = sailors.find((s) => s.id === req.sailor_id)
                  return (
                    <div key={req.id} className="rounded-xl border border-yellow-600 bg-gray-50 p-3">
                      <p className="font-semibold">
                        {sailor ? `${sailor.rank} ${sailor.full_name}` : "Unknown Sailor"}
                      </p>
                      <p className="text-sm">{req.start_date} to {req.end_date}</p>
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          <Card title="Shift Schedule">
            <div className="space-y-3">
              {shifts.length === 0 ? (
                <div className="rounded-xl bg-gray-100 p-3 text-sm">No shifts assigned.</div>
              ) : (
                shifts.map((sailor) => (
                  <div key={sailor.id} className="rounded-xl border border-yellow-600 bg-gray-50 p-3">
                    <p className="font-semibold">
                      {sailor.rank} {sailor.full_name}
                    </p>
                    <p className="text-sm">Shift: {sailor.shift_name || "-"}</p>
                    <p className="text-sm">
                      {sailor.shift_start || "-"} to {sailor.shift_end || "-"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card title="Helpful Information">
            <div className="space-y-3">
              {helpfulInfo.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-xl border border-yellow-600 bg-gray-50 p-3">
                  <p className="font-semibold">{item.term}</p>
                  <p className="text-sm">{item.short_definition}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Card title="Weekly View">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              {weekColumns.map((day) => (
                <div key={day.label} className="rounded-xl border border-yellow-600 bg-gray-50 p-3">
                  <p className="font-semibold">{day.label}</p>
                  <p className="mt-2 text-sm font-medium">Approved Leave: {day.leaveItems.length}</p>
                  <p className="text-sm font-medium">Due Items: {day.dueItems.length}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Program Owner Summary">
            <div className="space-y-3">
              {programOwnerSummaries.length === 0 ? (
                <div className="rounded-xl bg-gray-100 p-3 text-sm">
                  No owned programs in your current access scope.
                </div>
              ) : (
                programOwnerSummaries.map((program) => (
                  <div key={program.id} className="rounded-xl border border-yellow-600 bg-gray-50 p-3">
                    <p className="font-semibold">{program.name}</p>
                    <p className="text-sm">Owner: {program.owner}</p>
                    <p className="text-sm">DINQ: {program.dinqCount}</p>
                    <p className="text-sm">At Risk: {program.riskCount}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card title="Data Quality Alerts">
            <div className="space-y-3">
              {qualityAlerts.length === 0 ? (
                <div className="rounded-xl bg-gray-100 p-3 text-sm">
                  No obvious data quality gaps.
                </div>
              ) : (
                qualityAlerts.slice(0, 12).map((alert, index) => (
                  <div key={index} className="rounded-xl border border-yellow-600 bg-yellow-50 p-3 text-sm">
                    {alert}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </main>
  )
}
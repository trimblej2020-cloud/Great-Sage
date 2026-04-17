"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Sailor = {
  id: string
  full_name: string
  rank: string
}

type LeaveRequest = {
  id: string
  sailor_id: string
  leave_type: string | null
  start_date: string
  end_date: string
  status: string
  requested_by: string | null
  approved_by: string | null
  reason: string | null
}

export default function LeavePage() {
  const [sailors, setSailors] = useState<Sailor[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [message, setMessage] = useState("")

  const [form, setForm] = useState({
    sailor_id: "",
    leave_type: "Ordinary",
    start_date: "",
    end_date: "",
    requested_by: "Great Sage User",
    reason: "",
  })

  const loadData = async () => {
    const [sailorsRes, leaveRes] = await Promise.all([
      supabase.from("sailors").select("id, full_name, rank").order("full_name"),
      supabase.from("leave_requests").select("*").order("created_at", { ascending: false }),
    ])

    setSailors((sailorsRes.data ?? []) as Sailor[])
    setLeaveRequests((leaveRes.data ?? []) as LeaveRequest[])
  }

  useEffect(() => {
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
        changed_by: "Great Sage User",
        old_value: oldValue,
        new_value: newValue,
      },
    ])
  }

  const submitLeave = async () => {
    if (!form.sailor_id || !form.start_date || !form.end_date) {
      setMessage("Fill in sailor, start date, and end date.")
      return
    }

    const { data, error } = await supabase
      .from("leave_requests")
      .insert([form])
      .select()

    if (error) {
      setMessage("Error submitting leave request.")
      return
    }

    if (data?.[0]) {
      await logAudit("leave_request", data[0].id, "create", null, data[0])
    }

    setMessage("Leave request submitted.")
    setForm({
      sailor_id: "",
      leave_type: "Ordinary",
      start_date: "",
      end_date: "",
      requested_by: "Great Sage User",
      reason: "",
    })
    loadData()
  }

  const updateLeaveStatus = async (
    req: LeaveRequest,
    status: "Approved" | "Rejected"
  ) => {
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status,
        approved_by: "Great Sage Approver",
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.id)

    if (error) {
      setMessage("Error updating leave request.")
      return
    }

    await logAudit("leave_request", req.id, "update_status", req, {
      ...req,
      status,
      approved_by: "Great Sage Approver",
    })

    setMessage(`Leave request ${status.toLowerCase()}.`)
    loadData()
  }

  return (
    <main className="min-h-screen bg-[#0a1f44] p-6">
      <div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 text-black shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Leave Workflow</h1>
            <p className="mt-2 text-sm">
              Submit, review, approve, and reject leave requests.
            </p>
          </div>

          <a
            href="/"
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm hover:opacity-90"
          >
            Back to Dashboard
          </a>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-yellow-600 bg-gray-50 p-5">
            <h2 className="text-xl font-semibold">Submit Leave Request</h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Sailor</label>
                <select
                  value={form.sailor_id}
                  onChange={(e) => setForm({ ...form, sailor_id: e.target.value })}
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
                <label className="mb-1 block text-sm font-medium">Leave Type</label>
                <select
                  value={form.leave_type}
                  onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                >
                  <option value="Ordinary">Ordinary</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Special Liberty">Special Liberty</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="min-h-[100px] w-full rounded-lg border border-gray-300 p-3"
                />
              </div>

              <button
                onClick={submitLeave}
                className="w-full rounded-lg bg-[#d4af37] py-3 font-semibold text-black shadow-sm hover:opacity-90"
              >
                Submit Leave Request
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-yellow-600 bg-gray-50 p-5">
            <h2 className="text-xl font-semibold">Requests</h2>

            <div className="mt-4 space-y-3">
              {leaveRequests.map((req) => {
                const sailor = sailors.find((s) => s.id === req.sailor_id)
                return (
                  <div
                    key={req.id}
                    className="rounded-xl border border-gray-300 bg-white p-4"
                  >
                    <p className="font-semibold">
                      {sailor ? `${sailor.rank} ${sailor.full_name}` : "Unknown Sailor"}
                    </p>
                    <p className="text-sm">Type: {req.leave_type || "Ordinary"}</p>
                    <p className="text-sm">Start: {req.start_date}</p>
                    <p className="text-sm">End: {req.end_date}</p>
                    <p className="text-sm">Status: {req.status}</p>
                    <p className="text-sm">Reason: {req.reason || "-"}</p>

                    {req.status === "Pending" && (
                      <div className="mt-3 flex gap-3">
                        <button
                          onClick={() => updateLeaveStatus(req, "Approved")}
                          className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateLeaveStatus(req, "Rejected")}
                          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
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
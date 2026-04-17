"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function AddSailor() {
  const [form, setForm] = useState({
    full_name: "",
    rank: "",
    role: "",
    division: "",
    phone_number: "",
    email: "",
    current_address: "",
  })

  const [status, setStatus] = useState("")

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const { data, error } = await supabase.from("sailors").insert([form]).select()

    if (error) {
      setStatus("Error adding sailor.")
      console.error(error)
      return
    }

    if (data?.[0]) {
      await supabase.from("audit_log").insert([
        {
          entity_type: "sailor",
          entity_id: data[0].id,
          action: "create",
          changed_by: "Great Sage User",
          old_value: null,
          new_value: data[0],
        },
      ])
    }

    setStatus("Sailor added successfully.")
    setForm({
      full_name: "",
      rank: "",
      role: "",
      division: "",
      phone_number: "",
      email: "",
      current_address: "",
    })
  }

  return (
    <main className="min-h-screen bg-[#0a1f44] p-6">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 text-black shadow-sm">
        <h1 className="text-3xl font-bold text-black">Add Sailor</h1>
        <p className="mt-2 text-black">
          Add a sailor to Great Sage.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-black">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-3 text-black"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black">Rank</label>
            <input
              type="text"
              value={form.rank}
              onChange={(e) => setForm({ ...form, rank: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-3 text-black"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black">Role</label>
            <input
              type="text"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-3 text-black"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black">Division</label>
            <input
              type="text"
              value={form.division}
              onChange={(e) => setForm({ ...form, division: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-3 text-black"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black">Phone Number</label>
            <input
              type="text"
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-3 text-black"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-3 text-black"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black">Current Address</label>
            <input
              type="text"
              value={form.current_address}
              onChange={(e) => setForm({ ...form, current_address: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-3 text-black"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-[#d4af37] py-3 font-semibold text-black shadow-sm hover:opacity-90"
          >
            Add Sailor
          </button>
        </form>

        {status && <p className="mt-4 text-sm text-black">{status}</p>}

        <div className="mt-6">
          <a
            href="/quick-add"
            className="inline-block rounded-lg bg-black px-4 py-2 font-semibold text-[#d4af37] shadow-sm hover:opacity-90"
          >
            Back to Quick Add
          </a>
        </div>
      </div>
    </main>
  )
}
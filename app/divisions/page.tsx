"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Division = {
  id: string
  division_name: string
  department_name: string
  command_name: string
}

type Sailor = {
  id: string
  full_name: string
  rank: string
  division_id: string | null
}

type Leader = {
  id: string
  division_id: string | null
  role_title: string
  sailor_id: string | null
  display_name: string | null
}

export default function DivisionsPage() {
  const [divisions, setDivisions] = useState<Division[]>([])
  const [sailors, setSailors] = useState<Sailor[]>([])
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [message, setMessage] = useState("")
  const [newDivision, setNewDivision] = useState("")

  const loadData = async () => {
    const [divisionsRes, sailorsRes, leadersRes] = await Promise.all([
      supabase.from("divisions").select("*").order("division_name"),
      supabase.from("sailors").select("id, full_name, rank, division_id").order("full_name"),
      supabase.from("leaders").select("*"),
    ])

    setDivisions((divisionsRes.data ?? []) as Division[])
    setSailors((sailorsRes.data ?? []) as Sailor[])
    setLeaders((leadersRes.data ?? []) as Leader[])
  }

  useEffect(() => {
    loadData()
  }, [])

  const addDivision = async () => {
    if (!newDivision.trim()) return

    const { data, error } = await supabase
      .from("divisions")
      .insert([
        {
          division_name: newDivision,
          department_name: "Operations",
          command_name: "NIOC Pacific",
        },
      ])
      .select()

    if (error) {
      setMessage("Error adding division.")
      return
    }

    const created = data?.[0]
    if (created) {
      await supabase.from("leaders").insert([
        { division_id: created.id, role_title: "DIVO", is_custom: false },
        { division_id: created.id, role_title: "LCPO", is_custom: false },
        { division_id: created.id, role_title: "LPO", is_custom: false },
        { division_id: created.id, role_title: "CCC", is_custom: false },
        { division_id: created.id, role_title: "DLPO", is_custom: true },
        { division_id: created.id, role_title: "DCPO", is_custom: true },
      ])
    }

    setNewDivision("")
    setMessage("Division added.")
    loadData()
  }

  const updateLeader = async (leaderId: string, sailorId: string) => {
    const sailor = sailors.find((s) => s.id === sailorId)

    const { error } = await supabase
      .from("leaders")
      .update({
        sailor_id: sailorId || null,
        display_name: sailor ? `${sailor.rank} ${sailor.full_name}` : null,
      })
      .eq("id", leaderId)

    if (error) {
      setMessage("Error updating chain of command.")
      return
    }

    setMessage("Chain of command updated.")
    loadData()
  }

  const moveSailor = async (sailorId: string, divisionId: string) => {
    const { error } = await supabase
      .from("sailors")
      .update({ division_id: divisionId || null })
      .eq("id", sailorId)

    if (error) {
      setMessage("Error moving sailor.")
      return
    }

    setMessage("Sailor moved.")
    loadData()
  }

  return (
    <main className="min-h-screen bg-[#0a1f44] p-6">
      <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 text-black shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Division Management</h1>
            <p className="mt-2 text-sm">
              Add divisions, set chain of command, and move sailors between divisions.
            </p>
          </div>

          <a
            href="/"
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm hover:opacity-90"
          >
            Back to Dashboard
          </a>
        </div>

        <div className="mt-6 rounded-2xl border border-yellow-600 bg-gray-50 p-5">
          <h2 className="text-xl font-semibold">Add Division</h2>
          <div className="mt-4 flex gap-3">
            <input
              type="text"
              value={newDivision}
              onChange={(e) => setNewDivision(e.target.value)}
              placeholder="Example: Bravo Division"
              className="flex-1 rounded-lg border border-gray-300 p-3"
            />
            <button
              onClick={addDivision}
              className="rounded-lg bg-[#d4af37] px-4 py-3 font-semibold text-black"
            >
              Add
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {divisions.map((division) => {
            const divisionLeaders = leaders.filter((l) => l.division_id === division.id)
            const divisionSailors = sailors.filter((s) => s.division_id === division.id)

            return (
              <div
                key={division.id}
                className="rounded-2xl border border-yellow-600 bg-gray-50 p-5"
              >
                <h2 className="text-2xl font-bold">{division.division_name}</h2>
                <p className="mt-1 text-sm">{division.department_name}</p>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {divisionLeaders.map((leader) => (
                    <div
                      key={leader.id}
                      className="rounded-xl border border-gray-300 bg-white p-4"
                    >
                      <label className="mb-1 block text-sm font-medium">
                        {leader.role_title}
                      </label>
                      <select
                        value={leader.sailor_id || ""}
                        onChange={(e) => updateLeader(leader.id, e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2"
                      >
                        <option value="">Unassigned</option>
                        {divisionSailors.map((sailor) => (
                          <option key={sailor.id} value={sailor.id}>
                            {sailor.rank} {sailor.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-semibold">Move Sailors Here</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {sailors.map((sailor) => (
                      <div
                        key={sailor.id}
                        className="rounded-xl border border-gray-300 bg-white p-3"
                      >
                        <p className="font-semibold">
                          {sailor.rank} {sailor.full_name}
                        </p>
                        <button
                          onClick={() => moveSailor(sailor.id, division.id)}
                          className="mt-2 rounded-lg bg-[#d4af37] px-3 py-2 text-sm font-semibold text-black"
                        >
                          Move to {division.division_name}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
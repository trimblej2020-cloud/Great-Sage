"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

type Template = {
  id: string
  title: string
  message_body: string
}

export default function ReminderGeneratorPage() {
  const [eventType, setEventType] = useState("")
  const [groupName, setGroupName] = useState("")
  const [dateTime, setDateTime] = useState("")
  const [generatedMessage, setGeneratedMessage] = useState("")
  const [templates, setTemplates] = useState<Template[]>([])

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      const { data } = await supabase.from("reminder_templates").select("*")
      setTemplates(data || [])
    }
    loadTemplates()
  }, [])

  const generateReminder = () => {
    const msg = `Good morning ${groupName}, reminder that ${eventType} is scheduled for ${dateTime}. Ensure proper preparation and notify chain of command if unable to attend.`
    setGeneratedMessage(msg)
  }

  const saveTemplate = async () => {
    if (!generatedMessage) return

    await supabase.from("reminder_templates").insert([
      {
        title: eventType,
        message_body: generatedMessage,
      },
    ])

    alert("Template saved.")
  }

  const copyToClipboard = async () => {
    if (!generatedMessage) return
    await navigator.clipboard.writeText(generatedMessage)
    alert("Copied.")
  }

  return (
    <main className="min-h-screen bg-[#0a1f44] p-6">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-6 text-black shadow-sm">

        <h1 className="text-3xl font-bold">Reminder Generator</h1>

        <div className="mt-6 grid gap-6 md:grid-cols-2">

          {/* INPUT */}
          <div>
            <input
              placeholder="Event Type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full border p-3 rounded mb-3"
            />

            <input
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full border p-3 rounded mb-3"
            />

            <input
              placeholder="Date / Time"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full border p-3 rounded mb-3"
            />

            <button
              onClick={generateReminder}
              className="w-full bg-[#d4af37] py-3 rounded font-semibold"
            >
              Generate
            </button>
          </div>

          {/* OUTPUT */}
          <div>
            <div className="border p-4 rounded min-h-[150px] bg-gray-50">
              {generatedMessage || "Generated message will appear here"}
            </div>

            <div className="mt-3 flex gap-3">
              <button
                onClick={copyToClipboard}
                className="bg-[#d4af37] px-4 py-2 rounded"
              >
                Copy
              </button>

              <button
                onClick={saveTemplate}
                className="bg-black text-[#d4af37] px-4 py-2 rounded"
              >
                Save Template
              </button>
            </div>
          </div>

        </div>

        {/* TEMPLATE LIST */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-3">Saved Templates</h2>

          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="p-3 border rounded bg-gray-100 cursor-pointer hover:bg-gray-200"
                onClick={() => setGeneratedMessage(t.message_body)}
              >
                <strong>{t.title}</strong>
                <p className="text-sm">{t.message_body}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}
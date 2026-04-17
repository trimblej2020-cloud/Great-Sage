import { supabase } from "@/lib/supabase"

type HelpfulInfo = {
  id: string
  category: string
  term: string
  short_definition: string
  detailed_note: string | null
  source_label: string | null
}

export default async function HelpfulInfoPage() {
  const { data } = await supabase
    .from("helpful_information")
    .select("*")
    .order("category")
    .order("term")

  const items = (data ?? []) as HelpfulInfo[]
  const grouped = items.reduce<Record<string, HelpfulInfo[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-[#0a1f44] p-6">
      <div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 text-black shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Helpful Information</h1>
            <p className="mt-2 text-sm">
              Useful Navy acronyms, terminology, and quick-reference explanations for junior Sailors and leaders.
            </p>
          </div>

          <a
            href="/"
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#d4af37] shadow-sm hover:opacity-90"
          >
            Back to Dashboard
          </a>
        </div>

        <div className="mt-6 space-y-6">
          {Object.entries(grouped).map(([category, records]) => (
            <section
              key={category}
              className="rounded-2xl border border-yellow-600 bg-gray-50 p-5"
            >
              <h2 className="text-xl font-semibold">{category}</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {records.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-300 bg-white p-4"
                  >
                    <p className="text-lg font-bold">{item.term}</p>
                    <p className="mt-2 text-sm">{item.short_definition}</p>
                    {item.detailed_note && (
                      <p className="mt-2 text-sm text-slate-700">
                        {item.detailed_note}
                      </p>
                    )}
                    {item.source_label && (
                      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-600">
                        {item.source_label}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
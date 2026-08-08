'use client'

// CompanyForm (§11): jediný zdroj kontaktních údajů.
// Uložení = ChangeSet s itemy company.* (item_type 'company') – žádný
// přímý zápis; změna se projeví všude na webu až po publikování.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, AlertCircle, Info } from 'lucide-react'
import ChangeSetPanel from '@/components/ccc/ChangeSetPanel'
import { createChangeSetAction, getChangeSetAction } from '@/lib/actions/ccc'
import type { ChangeSetWithItems, CompanyProfile } from '@/types/website-contract'

type FieldDef = {
  key: string // sloupec company_profiles = suffix field_key company.*
  label: string
  type?: 'text' | 'email' | 'tel' | 'url'
  placeholder?: string
  span?: boolean
}

const FIELDS: FieldDef[] = [
  { key: 'company_name', label: 'Název firmy', placeholder: 'Truhlářství Novák s.r.o.', span: true },
  { key: 'ico', label: 'IČO', placeholder: '12345678' },
  { key: 'dic', label: 'DIČ', placeholder: 'CZ12345678' },
  { key: 'street', label: 'Ulice a číslo', placeholder: 'Truhlářská 1299' },
  { key: 'city', label: 'Město', placeholder: 'Plzeň' },
  { key: 'postal_code', label: 'PSČ', placeholder: '301 00' },
  { key: 'country', label: 'Země', placeholder: 'Česká republika' },
  { key: 'phone', label: 'Telefon', type: 'tel', placeholder: '+420 777 000 000' },
  { key: 'secondary_phone', label: 'Druhý telefon', type: 'tel' },
  { key: 'email', label: 'E-mail', type: 'email', placeholder: 'info@firma.cz' },
  { key: 'opening_hours', label: 'Otevírací doba', placeholder: 'Po–Pá: 8:00–17:00' },
  { key: 'google_maps_url', label: 'Odkaz na Google Mapy', type: 'url' },
  { key: 'facebook', label: 'Facebook', type: 'url' },
  { key: 'instagram', label: 'Instagram', type: 'url' },
  { key: 'linkedin', label: 'LinkedIn', type: 'url' },
  { key: 'youtube', label: 'YouTube', type: 'url' },
]

export default function CompanyForm({
  companyProfile,
  canEdit,
  canPublish,
}: {
  companyProfile: CompanyProfile | null
  canEdit: boolean
  canPublish: boolean
}) {
  const router = useRouter()
  const initial: Record<string, string> = {}
  for (const f of FIELDS) {
    const v = companyProfile?.[f.key as keyof CompanyProfile]
    initial[f.key] = typeof v === 'string' ? v : ''
  }

  const [values, setValues] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [changeset, setChangeset] = useState<ChangeSetWithItems | null>(null)

  const changedItems = FIELDS
    .filter((f) => values[f.key] !== initial[f.key])
    .map((f) => ({ fieldKey: `company.${f.key}`, newValue: values[f.key] }))

  const save = () => {
    setError(null)
    if (changedItems.length === 0) return
    startTransition(async () => {
      try {
        const created = await createChangeSetAction(
          `Kontaktní údaje – ${new Date().toLocaleDateString('cs-CZ')}`,
          changedItems,
        )
        setChangeset(await getChangeSetAction(created.id))
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Uložení návrhu selhalo')
      }
    })
  }

  if (changeset) {
    return (
      <ChangeSetPanel
        changeset={changeset}
        canPublish={canPublish}
        onClose={() => setChangeset(null)}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
        <Info className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
        <p className="text-sm text-white/60">
          Tyto údaje se používají na celém webu – v kontaktech, patičce i na mapě.
          Změna se projeví všude po publikování návrhu.
        </p>
      </div>

      <section className="bg-[#0d1525] rounded-2xl border border-white/5 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.span ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                {f.label}
              </label>
              <input
                type={f.type ?? 'text'}
                value={values[f.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/10 transition-all"
              />
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-400/5 border border-red-400/20 p-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {canEdit && (
        <button
          onClick={save}
          disabled={pending || changedItems.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-[#0a0e17] hover:bg-cyan-300 disabled:opacity-40 transition-all"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Uložit jako návrh ({changedItems.length})
        </button>
      )}
    </div>
  )
}

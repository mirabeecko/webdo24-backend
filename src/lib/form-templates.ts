// ============================================
// Předpřipravené oborové formuláře — „v ceně“
//
// Definice šablon pro formulářový builder. Zákazník si šablonu načte
// v administraci (Formuláře → Šablony) a rovnou ji používá.
// Tvar pole odpovídá `webdo24_forms.fields` (FormField bez `id`).
// ============================================

export type FormTemplateField = {
  key: string
  label: string
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'date' | 'number'
  required?: boolean
  options?: string[]
  placeholder?: string
}

export type FormTemplate = {
  key: string
  icon: string
  name: string
  description: string
  submit_button: string
  fields: FormTemplateField[]
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    key: 'gardens',
    icon: '🌿',
    name: 'Zahradnictví — realizace',
    description: 'Poptávka realizace zahrady, pergoly, terasy, závlah.',
    submit_button: 'Poptat realizaci zdarma',
    fields: [
      { key: 'name', label: 'Jméno', type: 'text', required: true, placeholder: 'Vaše jméno' },
      { key: 'phone', label: 'Telefon', type: 'phone', required: true, placeholder: '+420 700 123 456' },
      { key: 'email', label: 'E-mail', type: 'email', placeholder: 'vas@email.cz' },
      {
        key: 'service',
        label: 'Co chcete realizovat?',
        type: 'select',
        required: true,
        options: ['Kompletní realizace zahrady', 'Pergola', 'Terasa', 'Zahradní architektura', 'Závlahy', 'Údržba zahrady', 'Jiné'],
      },
      { key: 'location', label: 'Lokalita (město)', type: 'text', placeholder: 'Např. Teplice' },
      { key: 'scope', label: 'Orientační rozsah / představa', type: 'textarea', placeholder: 'Pár vět o tom, co potřebujete…' },
    ],
  },
  {
    key: 'reconstruction',
    icon: '🏗',
    name: 'Stavební firma — rekonstrukce',
    description: 'Poptávka rekonstrukce s rozsahem, typem nemovitosti a termínem.',
    submit_button: 'Poptat rekonstrukci zdarma',
    fields: [
      { key: 'name', label: 'Jméno', type: 'text', required: true, placeholder: 'Vaše jméno' },
      { key: 'phone', label: 'Telefon', type: 'phone', required: true, placeholder: '+420 700 123 456' },
      { key: 'email', label: 'E-mail', type: 'email', placeholder: 'vas@email.cz' },
      {
        key: 'property',
        label: 'Typ nemovitosti',
        type: 'select',
        required: true,
        options: ['Rodinný dům', 'Byt', 'Komerční objekt', 'Jiné'],
      },
      {
        key: 'scope',
        label: 'Rozsah rekonstrukce',
        type: 'select',
        required: true,
        options: ['Kompletní rekonstrukce', 'Koupelna', 'Kuchyň', 'Interiér', 'Jiné'],
      },
      {
        key: 'deadline',
        label: 'Termín',
        type: 'select',
        options: ['Co nejdříve', 'Do 3 měsíců', 'Do 6 měsíců', 'Jen orientačně'],
      },
      { key: 'location', label: 'Lokalita (město)', type: 'text', placeholder: 'Např. Ústí nad Labem' },
      { key: 'note', label: 'Poznámka', type: 'textarea', placeholder: 'Doplňte cokoli důležitého…' },
    ],
  },
  {
    key: 'windows',
    icon: '🪟',
    name: 'Okna, dveře, stínění',
    description: 'Žádost o kalkulaci a zaměření.',
    submit_button: 'Poptat kalkulaci zdarma',
    fields: [
      { key: 'name', label: 'Jméno', type: 'text', required: true, placeholder: 'Vaše jméno' },
      { key: 'phone', label: 'Telefon', type: 'phone', required: true, placeholder: '+420 700 123 456' },
      { key: 'email', label: 'E-mail', type: 'email', placeholder: 'vas@email.cz' },
      {
        key: 'product',
        label: 'Co poptáváte?',
        type: 'select',
        required: true,
        options: ['Okna', 'Dveře', 'Stínění / žaluzie', 'Vše / kombinace', 'Jiné'],
      },
      { key: 'count', label: 'Orientační počet oken / dveří', type: 'number', placeholder: 'např. 8' },
      { key: 'location', label: 'Lokalita (město)', type: 'text', placeholder: 'Např. Děčín' },
      { key: 'note', label: 'Poznámka', type: 'textarea', placeholder: 'Rozměry, termín, cokoli…' },
    ],
  },
  {
    key: 'hvac',
    icon: '❄',
    name: 'Klimatizace — montáž',
    description: 'Nezávazná poptávka montáže s termínem.',
    submit_button: 'Zjistit termín zdarma',
    fields: [
      { key: 'name', label: 'Jméno', type: 'text', required: true, placeholder: 'Vaše jméno' },
      { key: 'phone', label: 'Telefon', type: 'phone', required: true, placeholder: '+420 700 123 456' },
      {
        key: 'property',
        label: 'Typ nemovitosti',
        type: 'select',
        required: true,
        options: ['Rodinný dům', 'Byt', 'Kancelář / komerční', 'Jiné'],
      },
      { key: 'rooms', label: 'Počet místností', type: 'number', placeholder: 'např. 3' },
      {
        key: 'deadline',
        label: 'Termín',
        type: 'select',
        required: true,
        options: ['Co nejdříve', 'Do měsíce', 'Jen orientačně'],
      },
      { key: 'location', label: 'Lokalita (město)', type: 'text', placeholder: 'Např. Teplice' },
    ],
  },
  {
    key: 'heating',
    icon: '♨',
    name: 'Topení, tepelná čerpadla',
    description: 'Kvalifikovaná poptávka s technickým zadáním.',
    submit_button: 'Poptat nezávazně',
    fields: [
      { key: 'name', label: 'Jméno', type: 'text', required: true, placeholder: 'Vaše jméno' },
      { key: 'phone', label: 'Telefon', type: 'phone', required: true, placeholder: '+420 700 123 456' },
      { key: 'email', label: 'E-mail', type: 'email', placeholder: 'vas@email.cz' },
      {
        key: 'service',
        label: 'Požadovaná služba',
        type: 'select',
        required: true,
        options: ['Tepelné čerpadlo', 'Kotel', 'Podlahové topení', 'Ohřev vody', 'Servis', 'Jiné'],
      },
      {
        key: 'property',
        label: 'Typ nemovitosti',
        type: 'select',
        required: true,
        options: ['Rodinný dům', 'Byt', 'Komerční objekt'],
      },
      { key: 'current', label: 'Současné řešení', type: 'text', placeholder: 'např. plynový kotel' },
      {
        key: 'deadline',
        label: 'Termín',
        type: 'select',
        options: ['Do topné sezóny', 'Co nejdříve', 'Jen orientačně'],
      },
      { key: 'location', label: 'Lokalita (město)', type: 'text', placeholder: 'Např. Most' },
    ],
  },
  {
    key: 'guesthouses',
    icon: '⌂',
    name: 'Penzion / hotel — rezervace',
    description: 'Rezervace pobytu s termínem a počtem hostů.',
    submit_button: 'Odeslat rezervaci',
    fields: [
      { key: 'name', label: 'Jméno', type: 'text', required: true, placeholder: 'Vaše jméno' },
      { key: 'email', label: 'E-mail', type: 'email', required: true, placeholder: 'vas@email.cz' },
      { key: 'phone', label: 'Telefon', type: 'phone', placeholder: '+420 700 123 456' },
      { key: 'arrival', label: 'Datum příjezdu', type: 'date', required: true },
      { key: 'departure', label: 'Datum odjezdu', type: 'date', required: true },
      { key: 'guests', label: 'Počet hostů', type: 'number', placeholder: 'např. 4' },
      { key: 'note', label: 'Poznámka', type: 'textarea', placeholder: 'Dětská postýlka, pozdní příjezd…' },
    ],
  },
]

export function getFormTemplate(key: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find((t) => t.key === key)
}

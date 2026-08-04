'use client'

import {
  FileText, Image, Search, Zap,
  Users, MessageSquare, Share2, Tag,
} from 'lucide-react'

const ACTIONS = [
  {
    icon: FileText,
    title: 'Upravit texty',
    description: 'Nadpisy, popisy, obsah',
    prompt: 'Chci upravit texty na webu — ',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Tag,
    title: 'Přidat službu',
    description: 'Nový produkt nebo nabídka',
    prompt: 'Chci přidat novou službu — ',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Image,
    title: 'Změnit fotky',
    description: 'Aktualizovat fotografie',
    prompt: 'Chci vyměnit fotky na webu — ',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Search,
    title: 'Zlepšit SEO',
    description: 'Lepší umístění v Google',
    prompt: 'Chci zlepšit SEO webu — ',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Zap,
    title: 'Vytvořit akci',
    description: 'Časová nabídka nebo sleva',
    prompt: 'Chci přidat časovou akci — ',
    color: 'bg-orange-50 text-orange-600',
  },
  {
    icon: Users,
    title: 'Více poptávek',
    description: 'Optimalizace konverzí',
    prompt: 'Chci získat více poptávek přes web — ',
    color: 'bg-rose-50 text-rose-600',
  },
  {
    icon: MessageSquare,
    title: 'Přidat formulář',
    description: 'Kontaktní nebo rezervační',
    prompt: 'Chci přidat formulář na web — ',
    color: 'bg-teal-50 text-teal-600',
  },
  {
    icon: Share2,
    title: 'Sociální sítě',
    description: 'Propojit Instagram, FB',
    prompt: 'Chci propojit sociální sítě — ',
    color: 'bg-indigo-50 text-indigo-600',
  },
] as const

interface Props {
  onSelect: (prompt: string) => void
}

export default function QuickActions({ onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {ACTIONS.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.title}
            onClick={() => onSelect(action.prompt)}
            className="group flex flex-col items-start gap-2.5 rounded-2xl border border-gray-100 bg-white p-4 text-left hover:border-gray-200 hover:shadow-md transition-all duration-200 active:scale-[0.97]"
          >
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${action.color} group-hover:scale-110 transition-transform duration-200`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#0F172A]">{action.title}</div>
              <div className="text-xs text-gray-400 mt-0.5 leading-snug">{action.description}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

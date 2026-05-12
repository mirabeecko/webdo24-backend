# WEBDO24 LEAD MACHINE™ — Implementační nástřel

> Technická architektura pro Next.js + Supabase stack.

---

## Databázové schéma (Supabase)

### Tabulka: `profiles` (uživatelé)
```sql
create table profiles (
  id uuid references auth.users primary key,
  full_name text not null,
  company_name text not null,
  phone text not null,
  email text,
  avatar_url text,
  website_slug text unique not null, -- vanity URL
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Tabulka: `leads` (poptávky/CRM)
```sql
create type lead_status as enum ('new', 'contacted', 'negotiation', 'done');
create type lead_source as enum ('web', 'whatsapp', 'email', 'form', 'phone');

create table leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  name text not null,
  phone text,
  email text,
  message text not null,
  source lead_source default 'form',
  status lead_status default 'new',
  ai_reply text,           -- návrh AI odpovědi
  ai_reply_used boolean default false,
  notes text,
  metadata jsonb default '{}', -- extra data z formuláře
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Tabulka: `messages` (komunikace)
```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) not null,
  sender_type text check (sender_type in ('customer', 'user', 'ai')),
  content text not null,
  is_ai_suggestion boolean default false,
  ai_action text,          -- jaký typ AI to generoval
  sent_at timestamptz default now(),
  read_at timestamptz
);
```

### Tabulka: `website_content` (obsah webu)
```sql
create table website_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  section_key text not null,    -- "hero_title", "about_text", "phone"
  content_type text default 'text', -- text, image, list, json
  content_value text not null,
  is_published boolean default true,
  version integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, section_key)
);
```

### Tabulka: `testimonials` (reference)
```sql
create table testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  customer_name text not null,
  rating integer check (rating between 1 and 5),
  text text not null,
  image_url text,
  is_published boolean default true,
  created_at timestamptz default now()
);
```

### Tabulka: `services` (služby)
```sql
create table services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  title text not null,
  description text,
  price text,              -- "od 500 Kč" nebo konkrétní
  image_url text,
  sort_order integer default 0,
  is_published boolean default true,
  created_at timestamptz default now()
);
```

### Tabulka: `automations` (automatizace uživatele)
```sql
create table automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  automation_key text not null, -- "auto_reply", "notify_owner", "follow_up"
  enabled boolean default false,
  template text,           -- text šablony
  settings jsonb default '{}',
  unique(user_id, automation_key)
);
```

### RLS Policies (příklad)
```sql
-- Každý uživatel vidí jen svoje data
alter table leads enable row level security;
create policy "Users can only see their own leads"
  on leads for all
  using (auth.uid() = user_id);
```

---

## Next.js App Router struktura

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          -- Magic link / OTP přihlášení
│   │   └── onboarding/page.tsx     -- 3-krokový onboarding
│   ├── (admin)/
│   │   ├── layout.tsx              -- Admin layout s sidebar/bottom nav
│   │   ├── page.tsx                -- Dashboard
│   │   ├── zpravy/page.tsx         -- Seznam zpráv (inbox)
│   │   ├── zpravy/[id]/page.tsx    -- Detail konverzace
│   │   ├── zakaznici/page.tsx      -- CRM pipeline
│   │   ├── web/page.tsx            -- Živý náhled + editor
│   │   ├── reference/page.tsx      -- Správa referencí
│   │   ├── sluzby/page.tsx         -- Správa služeb
│   │   └── nastaveni/page.tsx      -- Profil, notifikace, automatizace
│   ├── api/
│   │   └── webhooks/
│   │       └── n8n/route.ts        -- Webhook pro n8n
│   └── [slug]/page.tsx             -- Veřejný web zákazníka
├── components/
│   ├── ui/                         -- shadcn/ui komponenty
│   ├── dashboard/
│   │   ├── DashboardCard.tsx
│   │   ├── LeadPreview.tsx
│   │   └── QuickActions.tsx
│   ├── crm/
│   │   ├── PipelineBoard.tsx
│   │   ├── LeadCard.tsx
│   │   ├── LeadDetail.tsx
│   │   └── StatusColumn.tsx
│   ├── web-editor/
│   │   ├── LivePreview.tsx
│   │   ├── EditableField.tsx
│   │   └── SectionEditor.tsx
│   ├── ai/
│   │   ├── AiButton.tsx
│   │   ├── AiSuggestion.tsx
│   │   └── AiComposer.tsx
│   ├── messages/
│   │   ├── MessageThread.tsx
│   │   ├── MessageBubble.tsx
│   │   └── QuickReplyBar.tsx
│   └── layout/
│       ├── AdminSidebar.tsx        -- Desktop nav
│       ├── MobileNav.tsx           -- Bottom nav
│       └── TopBar.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               -- Browser client
│   │   ├── server.ts               -- Server client (RSC)
│   │   └── admin.ts                -- Service role (edge cases)
│   ├── actions/
│   │   ├── leads.ts                -- Server Actions pro leads
│   │   ├── messages.ts             -- Server Actions pro zprávy
│   │   ├── website.ts              -- Server Actions pro web
│   │   └── ai.ts                   -- Server Actions pro AI
│   ├── hooks/
│   │   ├── useRealtime.ts          -- Supabase realtime subscription
│   │   ├── useOptimistic.ts        -- Optimistic updates
│   │   └── useLeadDrag.ts          -- Drag & drop logika
│   └── utils/
│       ├── ai-prompts.ts           -- Prompt templates
│       └── validations.ts          -- Zod schemas
└── types/
    └── index.ts                    -- Shared TypeScript types
```

---

## Server Actions (příklady)

```typescript
// lib/actions/leads.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', leadId);
  
  if (error) throw new Error('Nepodařilo se uložit');
  
  revalidatePath('/zakaznici');
}

export async function createLead(formData: LeadFormData) {
  // Insert + trigger notifikace přes n8n webhook
}
```

```typescript
// lib/actions/ai.ts
'use server';

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

export async function generateReply(leadId: string, tone: 'friendly' | 'formal') {
  const supabase = await createClient();
  
  // Načti kontext poptávky
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();
  
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: buildReplyPrompt(lead, tone),
  });
  
  return { suggestion: text };
}
```

---

## Realtime subscriptions

```typescript
// hooks/useRealtime.ts
export function useNewLeads(userId: string) {
  useEffect(() => {
    const channel = supabase
      .channel('new-leads')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'leads', filter: `user_id=eq.${userId}` },
        (payload) => {
          showNotification('Nová poptávka!');
          playSound('gentle-ding');
        }
      )
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [userId]);
}
```

---

## n8n Workflow (automatizace)

### Workflow 1: Nová poptávka
```
Webhook (nový lead)
  → Odeslat push notifikaci (Firebase/OneSignal)
  → Pokud auto_reply = on: Odeslat email/SMS
  → Uložit log
```

### Workflow 2: Follow-up
```
Schedule (každý den 9:00)
  → Najdi leads ve stavu 'new' starší 24h
  → Pošli připomínku majiteli
```

### Workflow 3: Žádost o hodnocení
```
Trigger (lead přesunut do 'done')
  → Počkej 3 dny
  → Pošli SMS/email s odkazem na hodnocení
```

---

## AI Prompt Templates

```typescript
// lib/utils/ai-prompts.ts

export const REPLY_PROMPT = (lead: Lead) => `
Jsi asistent lokální firmy. Napiš přátelskou odpověď na poptávku.

Informace o poptávce:
- Jméno zákazníka: ${lead.name}
- Zpráva: ${lead.message}
- Služba: ${lead.metadata?.service || 'obecná poptávka'}

Pravidla:
- Odpověz česky
- Buď stručný (max 3 věty)
- Navrhni další krok (telefon/schůzka)
- Nepoužívej technické termíny
`;

export const IMPROVE_TEXT_PROMPT = (text: string) => `
Uprav následující text webové stránky, aby působil profesionálněji,
ale stále přátelsky. Zachovej délku.

Text: ${text}
`;

export const FB_POST_PROMPT = (testimonial: Testimonial) => `
Vytvoř příspěvek na Facebook z této reference:

Zákazník: ${testimonial.customer_name}
Hodnocení: ${testimonial.rating}/5
Text: ${testimonial.text}

Příspěvek měl být:
- Poutavý
- S emoji
- S výzvou k akci
- Max 5 řádků
`;
```

---

## Performance checklist

- [ ] **Edge rendering** — použij `export const runtime = 'edge'` pro dashboard
- [ ] **Partial Prerendering** — Next.js PPR pro statické části
- [ ] **Image optimization** — Next.js Image pro všechny fotky
- [ ] **Font optimization** — `next/font` pro Inter/Geist
- [ ] **Bundle size** — Route splitting, žádné velké knihovny
- [ ] **Caching** — `unstable_cache` pro dashboard data (30s)
- [ ] **Optimistic UI** — useOptimistic pro pipeline, zprávy
- [ ] **Lazy loading** — Intersection Observer pro pipeline sloupce
- [ ] **Service Worker** — Workbox pro offline cache

---

## Bezpečnost

- RLS na všech tabulkách (žádná data bez auth)
- Rate limiting na AI endpointech (Upstash Redis)
- Input sanitization (DOMPurify pro HTML z AI)
- File upload omezení (5MB, pouze obrázky)
- Magic links s expirací (1 hodina)
- OTP pro kritické operace (změna hesla, smazání účtu)

---

## Měření úspěchu (Analytics)

| Metrika | Cíl | Jak měřit |
|---------|-----|-----------|
| Time to first lead | < 24h | Od registrace do prvního leadu |
| Denní aktivita | 60% | DAU/MAU poměr |
| Odezva na poptávku | < 2h | Průměrný čas od leadu do první odpovědi |
| AI použití | 40% | Kolik odpovědí jde přes AI |
| Churn | < 5%/měsíc | Uživatelé bez loginu 30 dní |
| NPS | > 50 | Pravidelný in-app survey |

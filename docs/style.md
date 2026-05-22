# TASK: Apply "Cerita Keluarga" Visual Theme

You are refactoring the frontend of a Muslim family platform called **CeritaKeluarga**.
The app has: family tree visualization, member directory, family chat, and document storage.

The current UI uses plain white (`bg-white`, `bg-gray-50`) which feels cold and clinical.
Your job is to replace all background and color classes with a **warm, organic, family-album aesthetic**.

---

## DESIGN DIRECTION

Theme: **warm organic** — think old family photo albums, aged paper, tree bark, leaves.
NOT: tropical, batik-heavy, or overly decorative. Clean and modern but with warmth.

---

## COLOR TOKENS

Memorize these. Use them consistently everywhere.

| Role | Hex | Usage |
|------|-----|-------|
| `ck-page` | `#F5F0E8` | Page / app background (replaces `bg-gray-50`, `bg-gray-100`) |
| `ck-card` | `#FDFAF5` | Cards, panels, header, sidebar (replaces `bg-white`) |
| `ck-surface` | `#EDE4D3` | Muted surfaces, input backgrounds, chat message bg area |
| `ck-border` | `#D4C4A8` | All borders (replaces `border-gray-200`, `border-gray-100`) |
| `ck-text-1` | `#3B2F1E` | Primary text (replaces `text-gray-900`, `text-black`) |
| `ck-text-2` | `#6B5B45` | Secondary text (replaces `text-gray-600`, `text-gray-700`) |
| `ck-text-3` | `#9C8B75` | Tertiary / hint text (replaces `text-gray-400`, `text-gray-500`) |
| `ck-green` | `#4A7C59` | Primary action color — buttons, active nav, links (replaces `text-primary`, `bg-primary`) |
| `ck-green-lt` | `#D6EAD9` | Light green — active nav bg, badges, highlights |
| `ck-green-dk` | `#2E5239` | Dark green — active nav text, hover states |
| `ck-gold` | `#C4922A` | Accent — document icons, special badges |
| `ck-gold-lt` | `#F5E8C8` | Light gold — badge backgrounds |
| `ck-bark` | `#8B6F47` | Brown accent — tree/generation related elements |
| `ck-bark-lt` | `#EDE3D6` | Light bark — bark-toned badge backgrounds |

---

## MAPPING: OLD → NEW

Apply these replacements **everywhere** across all components:

### Backgrounds
```
bg-white              → bg-[#FDFAF5]
bg-gray-50            → bg-[#F5F0E8]
bg-gray-100           → bg-[#EDE4D3]
bg-gray-200           → bg-[#D4C4A8]
bg-muted              → bg-[#EDE4D3]
bg-muted/20           → bg-[#F5F0E8]
bg-muted/30           → bg-[#EDE4D3]
bg-muted/60           → bg-[#D4C4A8]
bg-background         → bg-[#FDFAF5]
```

### Borders
```
border-gray-100       → border-[#D4C4A8]
border-gray-200       → border-[#D4C4A8]
border-border         → border-[#D4C4A8]
border-border/60      → border-[#D4C4A8]
divide-gray-200       → divide-[#D4C4A8]
```

### Text
```
text-gray-900         → text-[#3B2F1E]
text-gray-800         → text-[#3B2F1E]
text-gray-700         → text-[#6B5B45]
text-gray-600         → text-[#6B5B45]
text-gray-500         → text-[#9C8B75]
text-gray-400         → text-[#9C8B75]
text-foreground       → text-[#3B2F1E]
text-muted-foreground → text-[#9C8B75]
```

### Primary / brand color
```
bg-primary            → bg-[#4A7C59]
text-primary          → text-[#4A7C59]
bg-primary/10         → bg-[#D6EAD9]
text-primary-foreground → text-white
hover:bg-primary/5    → hover:bg-[#D6EAD9]
ring-primary          → ring-[#4A7C59]
focus-visible:ring-primary/30 → focus-visible:ring-[#4A7C59]/30
```

### Emerald (keluarga inti rooms) — keep as is, already fits the palette
```
bg-emerald-600        → bg-[#2E5239]   (slightly darker, more earthy)
bg-emerald-100        → bg-[#D6EAD9]
text-emerald-600      → text-[#2E5239]
hover:bg-emerald-50   → hover:bg-[#D6EAD9]
hover:bg-emerald-950/40 → hover:bg-[#2E5239]/20
```

---

## FILE-BY-FILE INSTRUCTIONS

### 1. `src/components/app-sidebar.tsx`

- Root div: `bg-[#F5F0E8]` (was `bg-gray-50`)
- Header `<header>`: `bg-[#FDFAF5] border-[#D4C4A8]`
- Logo shield icon container: `bg-[#4A7C59]` rounded, icon white
- Brand name: `text-[#3B2F1E]`
- Logout button: `text-[#6B5B45] hover:bg-[#EDE4D3]`
- Left `<nav>` card: `bg-[#FDFAF5] border-[#D4C4A8]`
- Nav link default: `text-[#6B5B45] hover:bg-[#D6EAD9] hover:text-[#2E5239]`
- Nav link active: `bg-[#D6EAD9] text-[#2E5239]`  (remove `bg-primary/10 text-primary`)
- `<main>`: no change needed (inherits from children)

### 2. `src/app/chat/page.tsx`

- Root wrapper: `bg-[#FDFAF5] border-[#D4C4A8]`
- Sidebar aside: `bg-[#FDFAF5] border-[#D4C4A8]`
- Sidebar room list background: `bg-[#F5F0E8]`
- Room item default: `text-[#6B5B45] hover:bg-[#EDE4D3]`
- Room item active (general): `bg-[#4A7C59] text-white`
- Room item active (small/inti): `bg-[#2E5239] text-white`
- Chat header: `bg-[#FDFAF5] border-[#D4C4A8]`
- Room icon bg (general): `bg-[#D6EAD9]`, icon `text-[#4A7C59]`
- Room icon bg (small): `bg-[#D6EAD9]`, icon `text-[#2E5239]`
- **Messages area** (the scrollable div): `bg-[#EDE4D3]`
  - This is the most important one — warm sand bg like old paper
- **Bubble (others)**: `bg-[#FDFAF5] border border-[#D4C4A8] text-[#3B2F1E]`
- **Bubble (mine)**: `bg-[#4A7C59] text-white`
- Sender name inside bubble: `text-[#4A7C59]`
- Timestamp (others): `text-[#9C8B75]`
- Timestamp (mine): `text-white/60`
- Input bar container: `bg-[#FDFAF5] border-[#D4C4A8]`
- Input field: `bg-[#EDE4D3] text-[#3B2F1E] placeholder:text-[#9C8B75]` rounded-full, no border
- Send button: `bg-[#4A7C59] hover:bg-[#2E5239] text-white` rounded-full

### 3. `src/app/dashboard/page.tsx` (and any dashboard widgets)

- Page wrapper: `bg-[#F5F0E8]`
- Cards: `bg-[#FDFAF5] border-[#D4C4A8]`
- Section labels / subtitles: `text-[#9C8B75]`
- Stats numbers: `text-[#3B2F1E]`
- Icon badge for "anggota" / people stats: `bg-[#D6EAD9]` icon `text-[#4A7C59]`
- Icon badge for "dokumen" stats: `bg-[#F5E8C8]` icon `text-[#C4922A]`
- Icon badge for "generasi" / tree stats: `bg-[#EDE3D6]` icon `text-[#8B6F47]`
- Primary CTA buttons: `bg-[#4A7C59] hover:bg-[#2E5239] text-white`

### 4. `src/app/tree/page.tsx` (family tree)

- Background canvas: `bg-[#EDE4D3]`
- Tree node cards: `bg-[#FDFAF5] border-[#D4C4A8]`
- Connector lines / edges: stroke `#D4C4A8` or `#8B6F47`
- Generation labels: `text-[#8B6F47]`

### 5. `src/app/members/page.tsx`

- Page bg: `bg-[#F5F0E8]`
- Member cards: `bg-[#FDFAF5] border-[#D4C4A8]`
- Avatar fallback: `bg-[#D6EAD9] text-[#2E5239]`
- Role/generation badge: `bg-[#EDE3D6] text-[#6B5235]`

### 6. `src/app/documents/page.tsx`

- Page bg: `bg-[#F5F0E8]`
- Document cards: `bg-[#FDFAF5] border-[#D4C4A8]`
- File type icon bg: `bg-[#F5E8C8]` icon `text-[#C4922A]`

### 7. `globals.css` — add to `:root`

Add these CSS variables so shadcn/ui components (Card, Input, Button, etc.) automatically pick up the theme:

```css
:root {
  --background:          30 43% 97%;   /* #FDFAF5 */
  --foreground:          27 32% 17%;   /* #3B2F1E */
  --card:                30 43% 97%;
  --card-foreground:     27 32% 17%;
  --border:              34 28% 75%;   /* #D4C4A8 */
  --input:               34 28% 75%;
  --primary:             143 25% 39%;  /* #4A7C59 */
  --primary-foreground:  0 0% 100%;
  --muted:               34 35% 88%;   /* #EDE4D3 */
  --muted-foreground:    27 14% 53%;   /* #9C8B75 */
  --accent:              143 25% 39%;
  --accent-foreground:   0 0% 100%;
  --ring:                143 25% 39%;
  --radius:              0.625rem;
}
```

After adding CSS variables, shadcn components like `<Card>`, `<Input>`, `<Button variant="ghost">` will automatically use the warm palette without needing arbitrary Tailwind values on every element.

---

## RULES

1. **Never use plain white** (`#FFFFFF`, `bg-white`) — always `bg-[#FDFAF5]` (warm white) or `bg-[#FDFAF5]`
2. **Never use pure black text** — always `text-[#3B2F1E]` minimum
3. **Never use cool grays** (`gray-*`, `slate-*`, `zinc-*`) — replace with warm equivalents above
4. **Keep all layout/flex/grid classes untouched** — only change color-related classes
5. **Do not change any logic, API calls, state management, or component structure**
6. **Shadows**: if any `shadow-*` classes exist, keep them — they add depth without color
7. **Dark mode**: if the project has `.dark` mode, apply dark variants:
   - page bg: `dark:bg-[#2A2118]`
   - card: `dark:bg-[#33291C]`
   - border: `dark:border-[#4A3D2A]`
   - text: `dark:text-[#F0E8D8]`

---

## EXPECTED VISUAL RESULT

When done, the app should feel like:
- A warm, aged-paper family album — not a cold SaaS dashboard
- The green (#4A7C59) echoes nature and tree/roots
- The gold (#C4922A) echoes old photographs and important documents  
- The brown/bark tones echo wood, roots, and generational connection
- Overall: trusted, warm, personal — appropriate for a Muslim family heritage app
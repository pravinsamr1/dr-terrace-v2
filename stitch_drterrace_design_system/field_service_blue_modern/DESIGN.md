---
name: Field Service Blue Modern
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#784b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#996100'
  on-tertiary-container: '#ffeedd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 22px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system is engineered specifically for high-velocity field service technicians, sales representatives, and service managers operating on mobile devices in dynamic, real-world environments. 

The aesthetic adheres to **Corporate Modern with Tactile Fluidity**: crisp structural clarity combined with gentle, ergonomic surfaces. It evokes precision, prompt execution, and operational reliability. 

### Visual Tenets
- **High Legibility in Motion:** Ample whitespace, high-contrast numeric callouts, and distinctive semantic color-tagging allow field reps to absorb customer data, stage progressions, and monetary values in single-glance visits.
- **Ergonomic Tactility:** Generous touch targets (minimum 44px to 48px), prominent rounded card containers (16px to 24px corner radii), and pill-form button groups optimized for single-handed thumb operation.
- **Micro-Status Clarity:** Clear status coding (Won, In Progress, Follow-up, Overdue) using high-legibility colored badges with 10% opacity tinted backgrounds to prevent visual fatigue while keeping priorities immediate.

## Colors

The color palette centers on a commanding royal blue paired with deliberate semantic status colors and ultra-clean neutral surfaces.

### Primary & Brand Accents
- **Primary Blue (`#2563EB` / Active: `#1D4ED8`):** The operational core. Used for high-emphasis call-to-actions, primary navigation headers, active tab pills, customer initials avatars, and active progress rings.
- **Blue Tint Surface (`#EFF6FF`):** Background fill for primary badges, active selector chips, and interactive action highlights.

### Functional & Semantic Roles
- **Success / Won (`#10B981` / Surface: `#ECFDF5` / Dark: `#047857`):** Signals completed stages, collected funds, closed deals, and positive MoM metrics.
- **Warning / Follow-up (`#F59E0B` / Surface: `#FFFBEB` / Text: `#B45309`):** Flags pending follow-up deadlines, upcoming calls, and mid-pipeline transitions.
- **Danger / Overdue (`#EF4444` / Surface: `#FEF2F2` / Text: `#B91C1C`):** Denotes overdue follow-ups, delayed invoice collections, and recording alerts.
- **In-Progress / Info (`#6366F1` & `#3B82F6` / Surface: `#EEF2FF`):** Highlights active quotes, dispatched technicians, and scheduled appointments.

### Neutrals & Structural Hierarchy
- **Canvas / Root Background (`#F1F5F9` to `#F8FAFC`):** Soft, low-strain cool gray backdrop providing subtle contrast against foreground elements.
- **Surface Pure (`#FFFFFF`):** High-level card containers, modal bottom sheets, floating segmented bars, and nested list items.
- **Sub-Surface Tier (`#F8FAFC`):** Nested metric panels, table row headers, and disabled form elements.
- **Border Ghost (`#E2E8F0`):** Hairline borders (1px) framing unselected buttons, card contours, and input containers.
- **Text Headings (`#0F172A`):** Pure slate black for titles, customer names, and currency amounts.
- **Text Body / Secondary (`#64748B`):** Cool slate for dates, address snippets, secondary labels, and descriptive captions.

## Typography

Typography relies on **Plus Jakarta Sans** across all levels to combine structural precision with warm, contemporary geometric clarity.

### Hierarchy & Treatment
- **Display Numerics & Financial Figures:** Rendered with weights `700` and `800` using tight letter tracking (`-0.02em`) to guarantee quick recognition of quote values (e.g., `₹34,200` or `$24,500`) and key metric counters.
- **Section Headers:** Bold and grounded (`title-lg`, `headline-sm`), ensuring unmistakable separation between functional areas like "Key metrics," "Site & Details," and "Status History."
- **Status Pills & Chips:** Micro-caps or bold sentence-case (`label-md` at 11px/700) with slight letter-spacing (`0.03em`) to preserve legibility when rendered at small scale.
- **Metadata Subtitles:** Formatted in `body-sm` (`#64748B`), balancing quiet readability with high clarity for customer phone numbers, timestamps, and address lines.

## Layout & Spacing

The system is configured around an ergonomic, mobile-first fluid layout that guarantees smooth scrolling and clear structural grouping.

### Layout Rhythm
- **Global Canvas Margins:** Strict `16px` (`1rem`) outer margins on mobile views, ensuring screen edge safety while maximizing usable data width.
- **Component Padding Scale:**
  - Card Containers: Internal padding of `16px` (`1rem`) to `20px` (`1.25rem`).
  - Action Chips & Filter Pills: Horizontal padding of `12px` to `16px`, vertical `6px` to `8px`.
  - Notification / Alert Banners: Compact `12px` vertical by `16px` horizontal padding.
- **Vertical Flow Spacing:**
  - Standard spacing between consecutive cards is `12px` (`0.75rem`).
  - Section-to-section block spacing sits at `20px` to `24px` (`1.25rem` to `1.5rem`) to delineate content boundaries without clutter.
- **Dual-Action Grids:** Two-column split-button layouts (e.g., "Call" and "Update Status") utilize an `8px` (`space-sm`) to `12px` (`space-md`) gap.

## Elevation & Depth

Visual hierarchy is communicated through subtle layer separation and gentle, ambient drop shadows rather than heavy structural borders.

### Elevation Hierarchy
- **Level 0 (Flat / Canvas):** `#F1F5F9` background canvas. No shadow.
- **Level 1 (Card & List Elements):** Pure `#FFFFFF` surface floating over canvas with a soft ambient shadow: `0 2px 8px -2px rgba(15, 23, 42, 0.05), 0 1px 3px 0 rgba(15, 23, 42, 0.03)` bordered with a crisp `1px solid rgba(226, 232, 240, 0.8)`.
- **Level 2 (Active Segmented Controls & Floating Tabs):** White pill surfaces resting within soft gray tracks, utilizing `0 3px 6px -1px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)`.
- **Level 3 (Quick Action Launchers & Floating Bar):** High-contrast vibrant cards (orange, purple, blue, emerald) using saturated ambient glow: `0 8px 16px -4px rgba(37, 99, 235, 0.15)`.
- **Level 4 (Modal Bottom Sheets):** Elevated from bottom screen edges with backdrop scrim (`rgba(15, 23, 42, 0.45)`) and sheet elevation: `0 -8px 24px -4px rgba(15, 23, 42, 0.12)`.

## Shapes

The shape vocabulary prioritizes rounded, approachable geometry that reflects friendly, modern software.

### Corner Radii Guidelines
- **Outer Cards & Containers (`rounded-xl` / 16px to 20px):** Customer summary cards, metric comparisons, and data report blocks use an inviting 16px to 20px radius.
- **Interactive Buttons & Badges (`rounded-full` / Pill):** Primary action buttons, status indicators, tab switches, and filter chips use a full pill radius (`9999px`) to invite touch.
- **Avatars & Quick Icons (`rounded-full`):** Rep and customer initials containers maintain perfect 1:1 circular shapes (typically 40px to 48px).
- **Bottom Sheet Modals:** Rounded only at the top corners (`rounded-t-[24px]`), providing a unified slide-over feel.
- **Nested Inner Badges / Small Inputs (`rounded-lg` / 8px to 12px):** Form fields, date selection buttons, and nested breakdown chips use softened sub-radii to maintain clean visual nesting.

## Components

### Buttons & Quick Actions
- **Primary Action Button:** Full pill shape, `#2563EB` solid fill, white text (`14px`, SemiBold), height `44px` to `48px`. Active state presses down to `#1D4ED8`.
- **Secondary Outlined Button:** Full pill shape, `1px solid #E2E8F0` border, transparent background, `#0F172A` text. Hover/pressed state applies `#F8FAFC`.
- **Action Quick Tile:** Square or squircle container (`rounded-2xl`) bathed in vibrant gradients (e.g., Orange `#F97316`, Purple `#8B5CF6`, Royal Blue `#2563EB`, Teal `#059669`). Includes a subtle white icon watermark, clear bold white text, and an overlaid circular white arrow launcher at bottom-left.

### Status Pills & Badges
- **Won / Paid:** Background `#ECFDF5`, text `#059669`, border `1px solid #A7F3D0`, `rounded-full`, padding `4px 10px`, font size `11px`, weight `700`.
- **Follow-up / Warning:** Background `#FFFBEB`, text `#D97706`, border `1px solid #FDE68A`.
- **Overdue / Urgent:** Background `#FEF2F2`, text `#DC2626`, border `1px solid #FECACA`.
- **Sent / In Progress:** Background `#EFF6FF`, text `#2563EB`, border `1px solid #BFDBFE`.

### Customer & Payment Metric Cards
- **Card Shell:** Background `#FFFFFF`, border `1px solid #E2E8F0`, border-radius `18px`, padding `16px`.
- **Lead / Rep Avatar:** Circular `44px` badge, soft slate-blue background (`#DBEAFE`), bold primary blue text (`#2563EB`), displaying two-letter uppercase customer or rep initials.
- **Dual Button Action Footer:** 50/50 horizontal split between a primary solid button (e.g. "Call" or "Send reminder") and a secondary outlined button (e.g. "Update Status" or "Record payment") separated by an `8px` gap.

### Audio Note Player & Recorder
- **Playback Module:** Compact rounded container (`12px` radius) with `#F8FAFC` background and `1px solid #E2E8F0` border.
  - Left: Circular play/pause toggle button (`32px`, green `#10B981` or blue `#2563EB` with white play icon).
  - Center: Dynamic multi-bar sound waveform showing recorded peaks with dynamic color coding (muted green/blue bars).
  - Right: Timestamp readout (`12px`, `#64748B`, e.g., `0:28`) alongside status tag ("Verified by rep").
- **Voice Note Recorder:** Red live-indicator pill (`REC`), dynamic waveform animation during audio capture, and immediate "Ready to save" feedback state.

### Segmented Switchers & Filters
- **Pill Tab Segment:** Background `#E2E8F0` or `#EEF2F6`, containing equal-width tabs. Active tab renders with pure `#FFFFFF` background, subtle elevation shadow, and `#0F172A` bold text; inactive tabs use muted `#64748B` text.
- **Filter Chips Bar:** Horizontally scrollable row of pill-shaped chips (`padding: 6px 14px`). Active filter has `#0F172A` background with white text; inactive filters sit on white or transparent surfaces with a thin border.

### Modal Bottom Sheet
- **Container Structure:** Draggable sheet emerging from bottom viewport, top corners rounded at `24px`, background `#FFFFFF`.
- **Header:** Centered pill pull-bar (`36px` width, `4px` height, `#CBD5E1`), bold title, subtitle breadcrumb, and a circular close button (`32px`, `#F1F5F9`).
- **Form Controls:** Dropdowns and textarea blocks with soft gray background (`#F8FAFC`), crisp border (`1px solid #E2E8F0`), and rounded radius (`12px`).
- **Sticky Footer Actions:** Cancel and Save actions grouped in a persistent horizontal bottom row.
---
# Do not remove this header. Agents read it.
description: |
  Agents: Always follow this skill when creating or modifying any UI or styling. 
  Use Shadcn MCP + CLI to scaffold primitives, patterns, and themes; do not hand-roll UI. 
  Prefer tokens, canonical layouts, and the variants matrix over ad-hoc decisions.
  Enforce paper-like elevation (no nested cards, no shadows, borders for definition).
---

# Styling Skill

## Quick Toolbelt
- Init MCP (pick your client): `bunx --bun shadcn@latest mcp init --client opencode`
- Add primitives fast: `bunx --bun shadcn@latest add button input select dialog table`
- Compose in `components/` using tokens and allowed variants

## Purpose

Provide a shared, opinionated design language for legal tech applications. Conservative, accessible, hierarchy-first design that avoids "vibe coding." This document defines foundations (tokens, type, spacing), canonical layouts, and enforcement guidelines.

## Design Principles

1. **Conservative**: Professional, trustworthy, appropriate for legal contexts
2. **Accessible**: WCAG AA compliant, clear contrast, readable typography
3. **Hierarchy-First**: Clear visual hierarchy guides user attention
4. **Consistent**: Predictable patterns and reusable components
5. **Paper-Like Elevation**: Elements closer to user have prominence via contrast, not shadows

### Paper-Like Design Rules

- **No boxes in boxes**: Avoid nested card structures
- **Minimal shadows**: Remove shadows from main content; use borders and background colors
- **Prominence through contrast**: Elements closer to user use lighter backgrounds (`bg-card`) on warm background (`bg-background`)
- **Borders for definition**: Use warm borders to define sections instead of shadows

## Decision Heuristics

- **Actions**: One primary action per view; secondary/outline for rest. Ghost for inline only. Destructive requires confirmation.
- **Composition**: Page headers include title, description, then actions. Keep copy to 60–72ch. Avoid centered body copy.
- **Elevation**: Prefer 1px borders; avoid shadows unless essential. Use `shadow-sm` sparingly.
- **Density**: Cozy by default; compact for data-dense (`text-sm`, `gap-2/3`). Never reduce hit targets below 40px.
- **Typography**: H1 unique per page; H2 sections; H3 subsections. Never invent sizes.
- **Icons**: Pair with labels unless universal. Size 20 default; inherit color.
- **Forms**: Always include Label; help text beneath. Errors via `aria-invalid` and `aria-describedby`.
- **Motion**: 150ms fast, 200ms base, 300ms slow. No bounce/overshoot. Prefer color/opacity transitions.
- **Color**: Primary sparse; accent rare. Destructive = irreversible risk only.

## Scope & Key Files

- `app/globals.css` — Tailwind v4 imports, inline theme tokens
- `app/layout.tsx` — Font loading (Geist Sans primary)
- `components.json` — Shadcn theme configuration

## Color System

### CSS Variables (HSL)
```css
--background: 40 6% 96%;        /* #f6f6f5 - warm light */
--foreground: 25 8% 12%;        /* #1f1d1b - warm dark */
--card: 0 0% 100%;              /* #ffffff - white */
--card-foreground: 25 8% 12%;
--muted: 40 4% 92%;
--muted-foreground: 30 6% 42%;  /* #6b6560 - warm gray */
--border: 35 12% 86%;           /* #ddd8d3 - warm border */
--input: 35 12% 86%;
--ring: 210 54% 40%;
--primary: 210 54% 40%;         /* #2f5f9e - professional blue */
--primary-foreground: 0 0% 100%;
--destructive: 0 50% 50%;       /* #b84a4a - red */
--radius: 6px;
```

### Semantic Token Classes (Required)
Use only these. Never raw hex, rgb, or numeric palettes.

```
Surfaces:  bg-background, bg-card, bg-muted, bg-popover
Text:      text-foreground, text-muted-foreground, text-primary-foreground
Actions:   bg-primary, bg-secondary, bg-accent, bg-destructive
Chrome:    border, ring, input
```

### Status Colors
| Status | Color | Use |
|--------|-------|-----|
| Danger | Red (`destructive`) | Errors, delete actions |
| Warning | Amber | Processing, warnings |
| Success | Green | Completed states |

## Typography

| Role | Classes |
|------|---------|
| Page Title | `text-3xl font-semibold` |
| Section | `text-2xl font-semibold` |
| Card Title | `text-lg font-semibold` |
| Body | `text-base text-foreground` |
| Muted | `text-sm text-muted-foreground` |
| Caption | `text-xs text-muted-foreground` |

Text emphasis: High (`text-foreground`), Medium (`text-foreground/80`), Low (`text-muted-foreground`)

## Spacing Scale

| Token | Size | Use |
|-------|------|-----|
| `gap-2` | 8px | Tight (icon+text, label+input) |
| `gap-4` | 16px | Standard |
| `gap-6` | 24px | Section spacing, card grids |
| `gap-8` | 32px | Major sections |
| `gap-12` | 48px | Large section spacing |

**Page container**: `container mx-auto px-8 py-12 max-w-7xl`
**Page gutters**: `px-4` (mobile), `md:px-6`

## Border Radius

- Small: `4px` (badges)
- Default: `6px` (buttons, inputs, cards)
- Medium: `8px` (larger elements)

## Motion & Animation

### Timing
| Type | Duration | Use |
|------|----------|-----|
| Fast | 150ms | Hover, button press |
| Base | 200ms | Standard transitions |
| Slow | 300ms | Modals, page transitions |

**Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` - smooth, professional

### Patterns
- **Buttons**: `hover:scale-[1.02] active:scale-[0.98]` with `duration-150`
- **Lists**: Staggered `fade-in-up` with 50ms delay per item
- **Cards**: `hover:border-foreground/20` transition
- **Forms**: `focus:scale-[1.01]` for inputs
- **Loading**: `animate-pulse` for skeletons

### Reduced Motion (Required)
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Canonical Page Patterns

### Section Structure (Paper-Like)
```tsx
<section className="space-y-6">
  <div>
    <h2 className="text-2xl font-semibold">Section Title</h2>
    <p className="text-sm text-muted-foreground mb-6">Description</p>
  </div>
  <div className="rounded-lg border bg-card">
    {/* Flat content, no nested cards */}
  </div>
</section>
```

### Page Header
```tsx
<div className="border-b bg-background">
  <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
    <div>
      <h1 className="text-xl md:text-2xl font-semibold">Page Title</h1>
      <p className="text-sm text-muted-foreground">Description</p>
    </div>
    <div className="flex items-center gap-2">
      <Button variant="outline">Secondary</Button>
      <Button>Primary</Button>
    </div>
  </div>
</div>
```

### Two-Column Layout
```tsx
<div className="container mx-auto grid grid-cols-1 gap-6 md:grid-cols-[280px,1fr] px-4 md:px-6">
  <aside className="space-y-4">{/* Nav / Filters */}</aside>
  <main className="space-y-6">{/* Content */}</main>
</div>
```

### Card Grid (No Nesting)
```tsx
<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
  <div className="rounded-lg border bg-card p-6">
    {/* Content directly, no Card wrapper if already in grid */}
  </div>
</div>
```

### Forms
```tsx
<form className="space-y-6">
  <div className="space-y-2">
    <Label htmlFor="email">Email</Label>
    <Input id="email" type="email" />
    <p className="text-xs text-muted-foreground">Help text.</p>
  </div>
  <div className="flex gap-2">
    <Button type="submit">Save</Button>
    <Button type="button" variant="outline">Cancel</Button>
  </div>
</form>
```

## Accessibility & States

- **Focus**: Visible ring on all interactive elements (`ring-2 ring-foreground/10`)
- **Contrast**: WCAG AA minimum (4.5:1 text, 3:1 UI)
- **Hit targets**: Min 40×40px
- **Motion**: Respect `prefers-reduced-motion`

### State Patterns
```tsx
// Skeleton
<div className="h-6 w-48 animate-pulse rounded bg-muted" />

// Inline error
<p className="text-sm text-destructive">Error message.</p>

// Empty state
<div className="text-center py-12">
  <Icon className="mx-auto h-12 w-12 text-muted-foreground" />
  <p className="mt-4 text-muted-foreground">No items found.</p>
  <Button className="mt-4">Add Item</Button>
</div>
```

## Do / Don't

**Do:**
- Use token classes (`bg-primary`, `text-muted-foreground`, `border`)
- Keep spacing to the shared scale
- Use borders for elevation, not shadows
- Respect reduced motion preferences

**Don't:**
- Use raw colors (`#fff`, `bg-black`, `bg-primary-500`)
- Nest cards inside cards
- Add shadows to main content
- Use `dark:` when tokens suffice
- Use negative margins for layout

## Design Review Checklist

```
- [ ] No nested cards (paper-like elevation)
- [ ] No shadows on main content
- [ ] Colors use tokens only
- [ ] Typography matches scale
- [ ] Spacing uses defined scale
- [ ] Focus states visible
- [ ] Reduced motion respected
- [ ] Dark mode works via tokens
```

## Resources

- Tailwind CSS v4
- Shadcn UI: https://ui.shadcn.com/docs
- Shadcn MCP: https://ui.shadcn.com/docs/mcp

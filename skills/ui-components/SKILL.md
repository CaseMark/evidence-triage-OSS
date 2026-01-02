---
# Do not remove this header. Agents read it.
description: |
  Agents: Always follow this skill when creating or modifying any UI component. 
  Use Shadcn MCP + CLI to scaffold primitives and patterns; avoid hand-rolled UI. 
  Conform to the variants matrix, canonical compositions, and paper-like elevation.
---

# UI Components Skill

## Quick Toolbelt
- Init MCP (pick your client): `bunx --bun shadcn@latest mcp init --client opencode`
- Add primitives fast: `bunx --bun shadcn@latest add button input select dialog table badge alert tabs`
- Compose in `components/` using tokens and allowed variants

## Purpose

Define an opinionated component vocabulary and variants matrix for legal tech applications. Conservative, accessible, hierarchy-first. Complements the Styling Skill by prescribing allowed variants, sizes, compositions, and interaction patterns.

## Key Files

- `components/ui/*` — Shadcn primitives (auto-generated; do not edit)
- `components/*` — Custom components (author here)
- `components.json` — Shadcn configuration

## Authoring Rules

- Import primitives from `@/components/ui/[name]`
- Compose with `cn()` from `@/lib/utils`
- Use semantic `variant` and `size` props; avoid boolean style flags
- Use token classes only. No raw colors or numeric palettes.
- Add `'use client'` when using hooks or browser APIs
- Type all props with explicit interfaces

## Icons

- Library: Phosphor (`@phosphor-icons/react`)
- Sizes: 16 (dense), 20 (default), 24 (prominent)
- Weights: `regular` default; `bold` for active; `duotone` decorative
- Color: inherit text color; use token classes for accents

## Variants Matrix

### Button

| Variant | Use Case | Style |
|---------|----------|-------|
| `default` | Primary CTAs, confirmations | Dark bg, light text |
| `secondary` | Alternative actions | Light bg, dark text |
| `outline` | Cancel, tertiary actions | Border only |
| `ghost` | Table actions, subtle | No border, hover bg |
| `destructive` | Delete, dangerous ops | Red bg |

Sizes: `sm`, `md` (default), `lg`

```tsx
<Button>Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">View</Button>
<Button variant="destructive">Delete</Button>
```

**Interaction states:**
- Hover: `hover:scale-[1.02]` with `duration-150`
- Active: `active:scale-[0.98]` for press feedback
- Loading: Spinner left, disable interactions
- Destructive: Always requires confirmation dialog

### Input / Textarea / Select

- Sizes: `sm`, `md` (default)
- States: `default`, `invalid`, `disabled`
- Always compose with Label + Help text

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" />
  <p className="text-xs text-muted-foreground">Help text.</p>
</div>
```

**Focus states:**
- Border darkens: `focus-visible:border-foreground`
- Subtle ring: `focus-visible:ring-2 focus-visible:ring-foreground/10`
- Slight scale: `focus:scale-[1.01]`

**Invalid state:**
```tsx
<Input aria-invalid="true" className="border-destructive" />
<p className="text-sm text-destructive">Error message.</p>
```

### Status Badges

| Variant | Use | Style |
|---------|-----|-------|
| `default` | Standard labels | Dark bg |
| `secondary` | Subdued labels | Light bg |
| `outline` | Minimal emphasis | Border only |
| `destructive` | Errors, failures | Red bg |
| Processing | In-progress | Amber + spinner |
| Completed | Success | Green + check |
| Failed | Errors | Red + X icon |

```tsx
<Badge>Default</Badge>
<Badge variant="outline">Draft</Badge>
<Badge variant="destructive">Failed</Badge>

{/* Status badges with icons */}
<Badge className="bg-amber-600 text-white gap-1">
  <Loader2 className="h-3 w-3 animate-spin" />
  Processing
</Badge>

<Badge className="bg-green-700 text-white gap-1">
  <CheckCircle2 className="h-3 w-3" />
  Completed
</Badge>
```

### Card

**Paper-like rules apply:** No nested cards, no shadows on main content.

- Variants: `flat` (border), `elevated` (`shadow-sm` - use sparingly), `ghost`
- Use borders and background contrast for elevation

```tsx
{/* Standard card - border only, no shadow */}
<div className="rounded-lg border bg-card p-6">
  <h3 className="text-lg font-semibold">Title</h3>
  <p className="text-sm text-muted-foreground">Description</p>
</div>

{/* Card with hover */}
<div className="rounded-lg border bg-card p-6 hover:border-foreground/20 transition-colors">
  {/* Content */}
</div>
```

### Tables

- Container: `rounded-lg border bg-card overflow-hidden`
- Row borders: `border-border`
- Row hover: `hover:bg-muted/50 transition-colors duration-150`
- No shadows

```tsx
<div className="rounded-lg border bg-card overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow className="hover:bg-muted/50 transition-colors">
        <TableCell className="text-foreground">Document</TableCell>
        <TableCell className="text-sm text-muted-foreground">Draft</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</div>
```

### Dialog/Modal

- Background: `bg-card`
- Border: `border`
- No shadows (elevated by z-index and overlay)

```tsx
<DialogContent className="bg-card border">
  <DialogHeader>
    <DialogTitle className="font-semibold">Title</DialogTitle>
    <DialogDescription className="text-sm text-muted-foreground">
      Description
    </DialogDescription>
  </DialogHeader>
  {/* Content */}
  <DialogFooter className="gap-2">
    <Button variant="outline">Cancel</Button>
    <Button>Confirm</Button>
  </DialogFooter>
</DialogContent>
```

### Tabs

- Simple bottom border indicator
- Active: dark text + 2px bottom border
- Inactive: muted text, darkens on hover

```tsx
<Tabs>
  <TabsList className="border-b gap-6">
    <TabsTrigger 
      className="text-muted-foreground data-[state=active]:text-foreground 
                 data-[state=active]:border-b-2 data-[state=active]:border-foreground
                 hover:text-foreground transition-colors"
    >
      Tab 1
    </TabsTrigger>
  </TabsList>
  <TabsContent>...</TabsContent>
</Tabs>
```

### Alert

```tsx
<Alert className="bg-card border">
  <AlertCircle className="h-4 w-4 text-primary" />
  <AlertTitle className="font-semibold">Title</AlertTitle>
  <AlertDescription className="text-sm text-muted-foreground">
    Description
  </AlertDescription>
</Alert>
```

### Dropdown Menu

```tsx
<DropdownMenuContent className="bg-card border">
  <DropdownMenuItem className="focus:bg-muted focus:text-foreground">
    Action
  </DropdownMenuItem>
  <DropdownMenuItem className="text-destructive focus:bg-destructive/10">
    Delete
  </DropdownMenuItem>
</DropdownMenuContent>
```

## Canonical Compositions

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

### Table Page Shell
```tsx
<section className="space-y-6">
  <header className="flex items-center justify-between">
    <div>
      <h2 className="text-xl font-semibold">Records</h2>
      <p className="text-sm text-muted-foreground">Manage data</p>
    </div>
    <Button>New</Button>
  </header>
  <div className="flex flex-wrap items-center gap-2">
    <Input placeholder="Search" className="w-[240px]" />
    <Select>{/* filters */}</Select>
  </div>
  <div className="rounded-lg border bg-card overflow-hidden">
    <Table>{/* rows */}</Table>
  </div>
</section>
```

### Section Pattern (Paper-Like)
```tsx
<section className="space-y-6">
  <div>
    <h2 className="text-2xl font-semibold">Section Title</h2>
    <p className="text-sm text-muted-foreground mb-6">Description</p>
  </div>
  <div className="rounded-lg border bg-card">
    {/* Flat content, no nested wrappers */}
  </div>
</section>
```

## Motion & Feedback

### Timing
- Fast: 150ms (hover, press)
- Base: 200ms (standard transitions)
- Slow: 300ms (modals, entrances)

### Patterns
- **Buttons**: `hover:scale-[1.02] active:scale-[0.98]`
- **Lists**: Staggered fade-in-up with 50ms delay per item
- **Cards**: `hover:border-foreground/20`
- **Loading**: `animate-pulse` for skeletons, spinners for buttons
- **Empty**: Neutral icon, concise guidance, primary action

### Reduced Motion
All animations must respect `prefers-reduced-motion: reduce`.

## Accessibility

- Labels: `<Label htmlFor="...">` for all form fields
- Errors: `aria-invalid="true"` + `aria-describedby`
- Hit targets: Min 40×40px
- Focus: Visible ring on all interactive elements
- Contrast: WCAG AA (4.5:1 text, 3:1 UI)

## Design Review Checklist

```
- [ ] No nested cards
- [ ] No shadows on main content
- [ ] Variants from allowed matrix only
- [ ] Colors are token-based
- [ ] Focus states visible
- [ ] Keyboard interactions work
- [ ] Loading/empty/error states present
- [ ] Reduced motion respected
```

## Resources

- Shadcn MCP: https://ui.shadcn.com/docs/mcp
- Shadcn Docs: https://ui.shadcn.com/docs
- Phosphor Icons: https://phosphoricons.com
- Tailwind CSS: https://tailwindcss.com/docs

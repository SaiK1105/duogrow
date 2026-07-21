# DuoGrow — "Night Terrarium" design system

A dark, phone-first accountability UI for **two paired people**. Bioluminescent green is
the brand + the "you" identity; a warm amber is the "partner" identity. Build on-brand
screens by composing the real components below and styling your own layout glue with the
tokens and utility classes this system already ships.

## Setup — no provider needed

Components are plain React + plain CSS. There is **no theme provider or context wrapper** to
mount — all styling comes from `styles.css` (design tokens on `:root` + component CSS + the
`.btn`/`.chip`/`.card` utilities + the brand webfonts). Just make sure `styles.css` is loaded,
then render any component. Everything is a named export on the bundle
(`window.DuoGrow.*`, e.g. `ProgressRing`, `CoachBubble`, `VerifiedStamp`).

**This is a DARK system.** Every screen must sit on a dark surface or it reads as unstyled.
Set the page/section background to `var(--surface-void)` (or `--surface-base`) and default text
to `var(--text-primary)`. `global.css` already applies this to `<body>`; if you render into a
smaller container, set the dark background yourself.

## Styling idiom — tokens + a small utility-class vocabulary

Style your own layout with `var(--*)` tokens and these ready-made classes. **Prefer these over
inventing class names or hard-coded colors.**

- **Surfaces** (dark → lighter): `--surface-void` `--surface-base` `--surface-raised`
  `--surface-overlay` `--surface-highlight`; borders `--surface-border` `--surface-border-strong`.
- **Text tiers**: `--text-primary` `--text-secondary` `--text-tertiary` `--text-disabled`
  `--text-on-accent` (use on green fills).
- **Accent (green, brand + "you")**: `--accent-100`…`--accent-700` (`--accent-500` primary),
  `--accent-glow`. **Partner (amber, "them")**: `--partner-300`/`--partner-400`, `--glow-partner`.
- **Confidence bands**: `--confidence-high/-bg` (green), `--confidence-medium/-bg` (amber),
  `--confidence-low/-bg` (red); danger `--danger-400`/`--danger-500`.
- **Type**: `--font-display` (Space Grotesk, headings) · `--font-ui` (Inter, body).
  Sizes `--text-display-xl/-lg/-md`, `--text-body-lg`, `--text-body`, `--text-caption`,
  `--text-micro`. `--leading-tight/-snug/-normal`, `--tracking-tight/-wide`.
- **Space** `--space-1…--space-20` · **Radius** `--radius-sm/-md/-lg/-xl/-full/-phone`
  · **Shadow** `--shadow-card/-modal`, glows `--glow-accent-sm/-md/-lg`
  · **Motion** `--duration-fast/-normal/-slow`, `--ease-out-expo`, `--ease-spring`.
- **Utility classes** (from `ui.css`): `.card` (raised panel), `.btn` +
  `.btn--primary/--outline/--ghost/--danger/--sm/--block`, `.chip` + `.chip--active`,
  `.section-title` (uppercase eyebrow), `.screen` (padded column scaffold).

## Where the truth lives

Read these before styling: `styles.css` and its imports (`tokens/tokens.css`, `tokens/ui.css`,
`tokens/global.css`) for the full token + class list, and each component's
`components/<group>/<Name>/<Name>.prompt.md` + `<Name>.d.ts` for its exact props. Icons
(`WakeIcon`, `StudyIcon`, `HomeIcon`, `PotdIcon`, `PlusIcon`, `CheckIcon`, …) and `TabBar` are
importable from the bundle even though their preview cards are minimal.

## Idiomatic snippet

```tsx
// A dashboard slice — real DS components, tokens for the layout glue.
<div className="screen" style={{ background: 'var(--surface-void)' }}>
  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-display-md)' }}>
    Good morning, Sreya
  </h1>
  <CoachBubble mood="celebrate" message="Seven days straight — consistency beats intensity." />
  <div className="card" style={{ display: 'flex', gap: 'var(--space-6)', justifyContent: 'center' }}>
    <ProgressRing value={57} label="You" suffix="%" />
    <ProgressRing value={43} label="Sai" suffix="%" color="var(--partner-400)" />
  </div>
  <VerifiedStamp band="high" />
</div>
```

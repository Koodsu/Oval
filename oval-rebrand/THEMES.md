# Oval — Landing Page Re-themes

Same layout you already have (phone-mockup hero, floating chips, live feed, ticker, CampusLife, HowItWorks, FeatureBento, StatsBar, Testimonials, FinalCta, Footer). **No structural changes** — only the color tokens, the accent gradients, and the gradient/aurora helpers change. Each theme is a drop-in swap of `tailwind.config.js` colors + a few `index.css` utilities.

The current theme stays the warm "fire" default. These three are alternates.

---

## Theme 1 — Daybreak (light)

Warm cream daytime version. Page goes light, text goes dark, the phone stays dark for contrast (Apple-style). Scarlet/flame kept as the accent + the "right now." gradient.

**tailwind.config.js → theme.extend.colors**

```js
colors: {
  void:        '#F5EFE4', // page background (was dark)
  ink:         '#1A1612', // primary text
  scarlet:     '#BB0000',
  'scarlet-bright': '#E81010',
  flame:       '#FF4B26',
  amber:       '#F59E0B',
  cream:       '#0c0909', // phone body stays dark
  'warm-gray': '#7A7166',
}
```

**index.css swaps**

```css
body { background: #F5EFE4; }
::selection { background: rgba(255,75,38,.25); color:#1A1612; }

.bg-aurora{
  background-image:
    radial-gradient(ellipse 55% 45% at 14% 10%, rgba(255,75,38,.14), transparent 60%),
    radial-gradient(ellipse 45% 40% at 88% 24%, rgba(245,158,11,.16), transparent 60%);
}
/* dot grid: switch the dot color to dark */
/* radial-gradient(rgba(26,22,18,.10) 1px, transparent 1px) */

/* keep .text-gradient-fire exactly as-is */
.glass{ background:rgba(255,255,255,.7); border:1px solid rgba(26,22,18,.10); }
.glow-card:hover{ border-color:rgba(187,0,0,.35); }
```

Body text: replace `text-white/55` etc. with `text-ink/62`, `text-ink/45`. Cards become `bg-white` with `border-ink/10` and soft shadows (`shadow-[0_10px_30px_rgba(26,22,18,.07)]`).

---

## Theme 2 — Nightshift (cool dark)

Same dark, energetic mood — just cooled from fire to electric indigo + cyan. Lowest-effort swap because the structure/opacities are identical to today; you're only changing hues.

**tailwind.config.js → theme.extend.colors**

```js
colors: {
  void:    '#070810',
  ink:     '#0a0d18',
  scarlet: '#6366F1', // indigo takes the "primary" slot
  'scarlet-bright': '#818CF8',
  flame:   '#22D3EE', // cyan is the live/accent
  amber:   '#A78BFA', // violet as the third
  cream:   '#F5EFE4',
  'warm-gray': '#8A90A8',
}
```

**index.css swaps**

```css
body { background:#070810; }
::selection { background: rgba(34,211,238,.4); }

.text-gradient-fire{
  background:linear-gradient(100deg,#818CF8 0%,#22D3EE 55%,#A78BFA 100%);
  background-size:200% auto; -webkit-background-clip:text; background-clip:text;
  -webkit-text-fill-color:transparent; animation:shimmer 5s linear infinite;
}
.bg-aurora{
  background-image:
    radial-gradient(ellipse 58% 45% at 18% 12%, rgba(99,102,241,.30), transparent 60%),
    radial-gradient(ellipse 45% 38% at 85% 20%, rgba(34,211,238,.18), transparent 60%),
    radial-gradient(ellipse 55% 42% at 55% 95%, rgba(139,92,246,.18), transparent 60%);
}
.glow-card:hover{ border-color:rgba(34,211,238,.45); }
```

Everywhere the live dot / LIVE badge / ticker accent uses `flame` it now reads cyan — no markup change needed since they reference the `flame` token.

---

## Theme 3 — Scarlet Reign (color-forward)

Scarlet is promoted from accent to the **dominant field** — a saturated maroon→scarlet background with cream text and gold accents. Boldest, most unmistakably OSU.

**tailwind.config.js → theme.extend.colors**

```js
colors: {
  void:    '#2a0303', // deep maroon base
  ink:     '#190101', // phone body / deepest
  scarlet: '#E81010',
  'scarlet-bright': '#FF4B26',
  flame:   '#F5C24B', // gold becomes the live/accent
  amber:   '#F5D98A',
  cream:   '#F7EFE2', // primary text
  'warm-gray': 'rgba(247,239,226,.6)',
}
```

**index.css swaps**

```css
body { background:#2a0303; color:#F7EFE2; }
::selection { background: rgba(245,194,75,.4); color:#5a0000; }

.text-gradient-fire{           /* now a gold-on-scarlet shimmer */
  background:linear-gradient(100deg,#FFE9B0,#F5C24B 55%,#FFF1DD);
  -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
}
.bg-aurora{
  background-color:#2a0303;
  background-image:
    radial-gradient(ellipse 70% 60% at 18% 8%,  rgba(232,16,16,.55), transparent 62%),
    radial-gradient(ellipse 55% 50% at 90% 30%, rgba(245,158,11,.30), transparent 60%),
    radial-gradient(ellipse 80% 70% at 55% 105%,rgba(90,0,0,.7),     transparent 60%);
}
/* primary CTA flips to cream/gold on scarlet */
.btn-primary{ background:linear-gradient(100deg,#F7EFE2,#F5D9A8); color:#5a0000; }
.glow-card:hover{ border-color:rgba(245,194,75,.4); }
```

Text opacities move from `white/x` to `cream/x` (`text-cream/70`, `/55`). The LIVE dot, ticker bullets, and tab highlight all become gold via the `flame` token.

---

## Applying any theme

1. Swap the `colors` block in `tailwind.config.js`.
2. Apply the matching `index.css` overrides (mostly `body`, `.bg-aurora`, `.text-gradient-fire`, `::selection`, `.glow-card:hover`).
3. For Daybreak only: also flip body-text utility opacities to dark (`text-ink/*`) and give cards a white surface — that's the one theme where text inverts.
4. Nothing in the component JSX needs to change for Nightshift or Scarlet Reign — they ride entirely on token values. Daybreak needs the light-mode text/card tweaks above.

Recommended: keep the current fire theme as default, wire these as selectable `data-theme` variants if you want to A/B which converts the waitlist best.

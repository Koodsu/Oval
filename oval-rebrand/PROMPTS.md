# Oval — Rebrand Wireframes & Build Prompts

A complete rebrand of the **Bridge** landing page → **Oval**, the social map of Ohio State. "Oval" references OSU's iconic central green where campus life actually happens — it's instantly recognizable to any Buckeye and far more ownable than a generic word like "Bridge."

Three directions, ranging from a safe evolution of the current site to an experimental reinvention. Each has a live HTML preview (`concept-*.html`) and a long, paste-ready build prompt below.

**Carried over from the current site (so nothing is lost):**

- Palette anchors: `--void #080606`, scarlet `#BB0000`, flame `#FF4B26`, amber `#F59E0B`, cream `#F5EFE4`
- Type: Space Grotesk (display), Instrument Serif (italic accent), Inter (body)
- Real product facts: pods of 2–10, OSU-verified email, 50 activities / 10 categories, 0 ads, clubs, waitlist, pod feed, real testimonials
- Signature motion language: aurora blobs, animated ticker, scroll-reveal, glassmorphism, live "pulse" dots

---

## Concept 1 — "Emberline" · Safe Evolution

**One-liner:** The current site, leveled up. Same dark fire DNA, but tighter, more confident, with a hero anchored by an **animated orbital "Oval" SVG** (people circling a live core) instead of the phone mockup.

**Why pick this:** Lowest risk, fastest to ship, keeps everything that already works. Looks like a 2026 version of what you have.

### Build prompt

> Design a dark-mode landing page for **Oval**, a real-time social app for Ohio State students that surfaces small-group hangouts ("pods") happening on campus right now. Tone: energetic, premium, a little nightlife. This is an evolution of an existing scarlet/flame "fire" theme — keep that DNA but make it sharper and more modern.
>
> **Palette:** background `--void #080606`; primary scarlet `#BB0000`; flame `#FF4B26`; amber `#F59E0B`; text white at varying opacities (.4–.9). Use a signature fire gradient `linear-gradient(100deg, #FF4B26, #BB0000 48%, #F59E0B)` with an animated shimmer (`background-position` sweep) on the key headline word.
>
> **Type:** Space Grotesk 700 for display/UI, Instrument Serif italic 400 for the one "hero" accent word (large, gradient-filled), Inter for body.
>
> **Hero (split 1.05fr / 0.95fr):** Left — a glass status pill ("Launching at Ohio State · waitlist open") with an animated ping dot; an H1 reading "Your people are already **on the Oval.**" where "on the Oval." is the serif gradient line; a 2-sentence subhead; a flame gradient CTA button with hover lift + glow and a ghost "Running a club?" secondary; a trust row (OSU students only · groups of 2–10 · free, zero ads). Right — replace any phone mockup with an **animated SVG "orbit" scene**: concentric oval rings (echoing OSU's Oval), a glowing radial core labeled "LIVE / on campus now," small colored dots orbiting the core on two counter-rotating rings (CSS `@keyframes spin`), expanding pulse rings around the core, and 3 floating glass notification cards ("3v3 at the RPAC — 2 spots," "Chess Club tonight — 28 RSVPs," "Cane's run — leaving 11:15") that gently bob with staggered `float` animations.
>
> **Background FX:** aurora radial-gradient blobs (scarlet/amber/flame) that slowly drift; a faint dot-grid masked with a radial fade behind the hero.
>
> **Below the hero:** (1) an infinite horizontal **live ticker** of pod blurbs with edge fades; (2) "How Oval works" — 3 hover-lift glass cards (See what's live / Tap in / Show up) with icon tiles and 01–03 numbers; (3) "Explore" — a wrap of 10 category chips (Sports, Food, Academic, Arts, Social, Outdoors, Music, Wellness, Gaming, Volunteering) that lift on hover; (4) "Why Oval" — a 4-up stat grid (50 activities · 2–10 per pod · OSU email · 0 ads) with gradient numbers; (5) a final CTA panel with a radial scarlet glow and waitlist button; (6) a minimal footer with the Oval wordmark + ellipse logo.
>
> **Logo:** a horizontal ellipse (the Oval) stroked in the flame→amber gradient with a small filled dot at center.
>
> **Motion rules:** scroll-reveal (fade + translateY + slight blur) on every section; respect `prefers-reduced-motion`. Keep it buttery, never busy. Fully responsive — hero stacks on mobile with the SVG on top.

---

## Concept 2 — "Daylight" · Bold Reinvention

**One-liner:** Flip the whole mood. A **bright, warm, editorial daytime** site on cream paper with big Instrument Serif headlines and an **animated top-down campus map** of the Oval where live pins drop and little person-dots travel the criss-cross paths.

**Why pick this:** Feels friendly, premium, and genuinely different from every dark "nightlife" app. Reads as sunny, real-world, and trustworthy — strong for parents/clubs/admin too.

### Build prompt

> Design a **light, warm, editorial** landing page for **Oval**, the daytime social map of Ohio State. Mood: a sunny afternoon on the quad — optimistic, premium, magazine-like. This is a deliberate departure from a dark app aesthetic.
>
> **Palette:** paper background `#F5EFE4`, deeper paper `#EDE6D8`, near-black ink `#1A1612`; accents scarlet `#BB0000`, flame `#FF4B26`, amber `#F59E0B`, plus a soft grass-green `#639922` for map accents. White cards float on the paper with soft long shadows.
>
> **Type:** Instrument Serif (italic for emphasis) as the *primary* display face — big, expressive headlines; Space Grotesk 700 for small UI/labels and the occasional bold sans line inside a serif headline; Inter for body. Headlines mix the two faces in one line (e.g. a bold sans phrase above an italic serif phrase).
>
> **Hero (2-col):** Left — an uppercase kicker with a slowly spinning sun icon ("A brighter way to do campus"); an H1 "Sunny days, real *plans.*" mixing Space Grotesk + italic serif (scarlet italic on "plans."); a warm subhead; an inline email-capture field (white, rounded, soft shadow) with a flame-gradient "Get access" button; microcopy (OSU only · 2–10 · free, no ads). Right — an **animated SVG campus map**: a rounded "paper map" tile with faint street grid, a central translucent **green ellipse labeled "the Oval"** (italic serif) outlined with an animated marching-ants dash, criss-cross walking paths, **person-dots that travel those paths on loop** (`<animateMotion>`), and 4 **live map pins** (Spikeball, Study pod, Cane's, Chess) that gently drop/bob with staggered timing, each with a small white label card.
>
> **Signature strip:** a dark full-bleed marquee bar under the hero scrolling italic-serif phrases ("pickup games ✦ study pods ✦ late-night food ✦ club nights…").
>
> **Below:** (1) "How it works" — 3 white feature cards with emoji, a Space Grotesk title, and an italic-serif step label (01 / look around …); (2) "Explore" — a 5-up row of compact category cards; (3) "Why Oval" — a single bordered white panel split into 4 columns of huge italic-serif numbers (50 / 2–10 / OSU / 0); (4) "What students are saying" — 3 testimonial cards on deeper-paper with italic-serif quotes, gradient initials avatars, name + major/year (use the real quotes from Chase L., Sofia C., Marcus J.); (5) a dark rounded final CTA block ("The Oval is busy *right now.*") with email capture; (6) minimal footer.
>
> **Motion:** marching-ants on the Oval outline, looping path dots, bobbing pins, spinning sun, scroll-reveal on sections, card hover-lift with shadow. Respect `prefers-reduced-motion`. Fully responsive — map moves above the copy on mobile.

---

## Concept 3 — "Pulse" · Experimental

**One-liner:** The whole hero **is** a living thing: a full-bleed **radar / topographic map of campus** with a rotating sweep, pulsing blips, and signal lines firing from a glowing core, overlaid with a terminal-style live readout. Dark, kinetic, almost sci-fi.

**Why pick this:** Maximum "alive and cool." Unmistakable, demo-ready, makes the product's real-time nature the entire visual thesis. Highest effort/risk, highest wow.

### Build prompt

> Design an **experimental, kinetic, dark** landing page for **Oval**, a real-time radar for Ohio State campus life. Concept: campus has a *pulse*, and Oval lets you feel it. The hero is a living instrument, not a static layout. Mood: sci-fi command console meets nightlife.
>
> **Palette:** near-black `#050404`; flame `#FF4B26` and scarlet `#BB0000` as primary energy; amber `#F59E0B`; a single electric **cyan `#16e0c8`** as the "signal/live" accent (used sparingly for HUD elements). Text white at varying opacities. Add subtle glow (`text-shadow` / `box-shadow`) on key flame and cyan elements.
>
> **Type:** Space Grotesk 700 display; Instrument Serif italic for one accent word; **JetBrains Mono** for HUD/readout text (`// 37 pods forming · 12 clubs active · 4 within 500ft`); Inter for body.
>
> **Hero (full viewport, layered):** A **full-bleed animated SVG radar** centered behind the content: concentric **oval topographic contours**, a faint diagonal grid, a **rotating radar sweep wedge** (conic-style gradient fan, `@keyframes spin`), a glowing central core with expanding ripple rings, **pulsing blips** scattered across the field (`<animate>` on `r`), and **signal lines** from core to blips that fade in/out on loop. Over it: a vignette/gradient mask so the left side stays dark and readable. Foreground content (left-aligned, max ~600px): a cyan "LIVE · scanning campus" tag with a blinking dot; H1 "Campus has a **pulse.** *Feel it.*" (flame glow on "pulse.", serif italic on "Feel it."); a subhead; a **mono live-readout line** of fake-but-plausible live counts; a flame-gradient "Request access" CTA with heavy glow + a ghost "Watch the signal." At the very bottom of the hero, a **full-width live feed rail** that auto-scrolls pod chips (emoji + title + meta), bordered and blurred.
>
> **Below:** (1) "How the signal works" — 3 panels with a top edge-light gradient line, mono step labels (01 — DETECT / 02 — LOCK / 03 — CONNECT), titles, and copy; (2) "Signal strength" — a 4-cell stat bar with hairline dividers and glowing flame numbers (50 / 2–10 / OSU / 0); (3) a final CTA with a radial flame glow ("Don't watch campus happen. **Be on it.**"); (4) minimal mono-flavored footer. Logo: flame-stroked ellipse with a **cyan** center dot; wordmark set as "OVAL" in tracked caps.
>
> **Motion:** continuous radar sweep, pulsing blips, firing signal lines, ripple rings, auto-scrolling feed rail, scroll-reveal on lower sections. Provide a `prefers-reduced-motion` fallback that freezes the radar to a static state and stops the sweep. Fully responsive — on mobile, dial the radar opacity down so text stays legible and the radar reads as ambient texture.

---

## How to use these prompts

- Each prompt is self-contained — paste into your build tool of choice (or hand to a dev) to generate production React/Tailwind matching the existing `landing/` stack (Vite + React 18 + Tailwind 3, Space Grotesk / Instrument Serif / Inter).
- The live `concept-*.html` files are working references — open them in a browser to see the exact motion and proportions each prompt describes.
- All three reuse the existing Tailwind tokens, so dropping the winner into `landing/` mostly means swapping copy ("Bridge" → "Oval"), the hero scene, and section styling.
- Recommended path: ship **Concept 1** first (low risk), A/B the hero against **Concept 2** or **3** to see which converts the waitlist better.

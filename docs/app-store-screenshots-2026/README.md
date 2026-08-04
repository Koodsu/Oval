# Oval App Store screenshots — simple reference-matched v4

The current direction is a six-image, English (US) iPhone App Store story for
Oval that deliberately matches the supplied v1.0.1 references: warm-white
backgrounds, oversized black headlines, one scarlet italic phrase, muted gray
supporting copy, and clean angled phones. There are no collage textures,
stickers, poster panels, campaign badges, decorative branding, or background
illustrations.

Final exports are flattened RGB PNGs in both Apple's current 6.9-inch size
(`1320 × 2868`) and the provided 6.5-inch size (`1284 × 2778`).

## Final sequence

1. `01-find-your-people.png` — current Explore screen
2. `02-join-the-plan.png` — current My Pods screen
3. `03-plan-it-together.png` — current main Inbox screen
4. `04-every-club-one-place.png` — current Clubs and Club Home screens
5. `05-stay-in-the-loop.png` — current Club Home screen
6. `06-rsvp-in-a-tap.png` — current meeting RSVP/check-in screen

The screen content comes from Oval's deterministic development preview
fixtures. It contains no production accounts or private user data, and the app
interface itself is not fabricated.

## Upload packages

- `Oval-App-Store-Screenshots-SIMPLE-v4-6.9-inch-en-US.zip`
- `Oval-App-Store-Screenshots-SIMPLE-v4-6.5-inch-en-US.zip`

## Working files

- `iteration-v4-simple/apple/en-US/6.9-inch/` — current upload-ready images
- `iteration-v4-simple/apple/en-US/6.5-inch/` — 6.5-inch upload-ready images
- `iteration-v4-simple/contact-sheet-simple-v4.png` — final visual review sheet
- `captures/*-v2.png` — dense current UI captures at 390 × 844
- `captures/inbox-pod-chats-v3.png` and `captures/inbox-invites-v3.png` — real filtered Inbox states
- `generate_simple.py` — deterministic reference-matched compositor

The earlier v1–v3 exports are retained for comparison rather than silently
deleting the previous iterations. The generated collage background is used only
by the superseded v3 direction, not by v4.

## Regenerate v4

```sh
/Users/brady/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 generate_simple.py
```

## Previous v3 background-generation prompt

> Use case: ads-marketing. Asset type: reusable vertical background plate for a
> six-image App Store screenshot campaign for Oval, an Ohio State campus
> community app. Primary request: replace elegant editorial minimalism with
> energetic, social, student-made campus bulletin-board energy. Scene/backdrop:
> edge-to-edge layered torn paper, overlapping poster shapes,
> photo-booth-frame silhouettes, hand-drawn oval loops, chunky
> arrows, confetti, halftone dots, sticker stars, and friendly imperfect
> marker-like accents. Style/medium: bold contemporary risograph and cut-paper
> collage, youthful and communal, polished enough for the App Store but clearly
> lively rather than luxurious. Composition/framing: vertical 9:19.5; visually
> active across the full canvas with no large blank white or ivory region; keep
> the center readable enough for a large phone screenshot, while the sides and
> corners carry dense energy. Color palette: saturated Oval scarlet and warm
> cream anchored by electric cobalt blue, sunflower yellow, mint green,
> lavender, and small black accents. Constraints: no phones, no app interface,
> no readable words, no letters, no logos, no brands, no watermarks, no
> photorealistic people, no luxury watercolor, no elegant serif mood, no empty
> upper third.

## Final background cleanup edit

The built-in image editor removed every beige, tan, peach, and pink masking-tape
strip from the background while preserving the torn-paper composition, photo
strip, arrows, stars, ovals, halftone pattern, palette, and texture. The edit
explicitly prohibited text, logos, phones, app UI, people, watermarks, and new
objects.

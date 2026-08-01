# Oval illustration asset manifest

This folder contains the approved **Campus Pulse** editorial illustration system
for onboarding, cold-start states, invitations, and ambient backgrounds.

The characters are fictional editorial figures. They may support a headline,
empty state, onboarding step, or invitation prompt. They must never be rendered
as real Oval members, avatars, attendees, message senders, mutual friends, or
social proof.

## Which files to import

- `spot/**` — **preferred production assets** for onboarding, empty/low-supply
  states, and invitation prompts. These are transparent PNG cutouts designed to
  sit above live UI copy.
- `runtime/ambient/**` — optimized JPEG atmosphere textures for the shipped app.
- `runtime/onboarding/**`, `runtime/cold-start/**`, and `runtime/invites/**` —
  alternate full-scene editorial treatments. Do not use them by default; the
  compact `spot/**` assets are the approved match for the current mockups.
- `onboarding/**`, `cold-start/**`, `invites/**`, and `ambient/**` — high-resolution
  full-scene PNG masters. Do not import these into production UI.
- Any filename ending in `-source.png` is a chroma-key generation source. Never
  import it into the app; use the sibling PNG without `-source`.
- `_reference/oval-character-ensemble.png` — internal style reference for future
  image generation. Never ship it as a user-facing collage.

All generated artwork contains no baked-in product copy. Headlines, buttons,
labels, counts, event details, and accessibility descriptions must remain live
React Native content.

## Onboarding spot illustrations

| Preferred transparent asset | Intended use |
| --- | --- |
| `spot/onboarding/01-welcome.png` | Auth welcome / campus belonging |
| `spot/onboarding/02-create-account.png` | Account creation value preview |
| `spot/onboarding/03-verification.png` | Successful email verification |
| `spot/onboarding/04-interests.png` | Interest selection; generic props only |
| `spot/onboarding/05-first-plan.png` | First-plan recommendations / first join |
| `spot/onboarding/06-profile.png` | Profile setup or identity investment |

## Cold-start and empty-state spot illustrations

| Preferred transparent asset | Trigger and intended use |
| --- | --- |
| `spot/cold-start/01-home-zero-start-network.png` | Home when global relevant pod supply is `0` |
| `spot/cold-start/02-explore-first-move.png` | Explore when global relevant pod supply is `0` |
| `spot/cold-start/03-pods-first-plan.png` | My Pods when global pod supply is `0` |
| `spot/cold-start/04-clubs-bring-groups.png` | Clubs when verified discoverable club supply is `0` |
| `spot/cold-start/05-inbox-connections.png` | Inbox when both network and personal activity are `0` |
| `spot/cold-start/06-low-supply-spotlight.png` | Spotlight mode when relevant supply is `1–9` |
| `spot/cold-start/07-no-search-results.png` | Search/filter query has no exact matches |
| `spot/cold-start/08-no-upcoming-personal.png` | User has no upcoming pods but global supply is nonzero |
| `spot/cold-start/09-no-conversations-personal.png` | User has no conversations but real people exist |
| `spot/cold-start/10-inbox-all-caught-up.png` | Previously active inbox currently has no unread/actionable items |

Global emptiness and personal emptiness are different states. Do not select an
illustration based on a single generic `items.length === 0` check.

## Invitation and growth spot illustrations

| Preferred transparent asset | Intended use |
| --- | --- |
| `spot/invites/01-invite-friends.png` | Generic friend invitation or share-link prompt |
| `spot/invites/02-share-pod.png` | Post-create or pod-detail sharing |
| `spot/invites/03-invite-organization.png` | Bring an existing organization to Oval |
| `spot/invites/04-community-growth.png` | Launch/community growth explainer |

## Ambient backgrounds

| Runtime asset | Intended use |
| --- | --- |
| `runtime/ambient/01-light-paper-wash.jpg` | Light-mode screen atmosphere |
| `runtime/ambient/02-dark-charcoal-wash.jpg` | Dark-mode screen atmosphere |
| `runtime/ambient/03-neutral-transition-wash.jpg` | Onboarding transitions, sheets, or launch moments |

Ambient textures must remain subtle. Solid theme surfaces should still sit
between content and the background. Do not place body text directly over a
high-contrast portion of a texture.

## Future activity imagery

Activity imagery is intentionally deferred until the activity taxonomy is
approved. Future files should follow this contract:

```text
frontend/assets/content/activities/<activity-key>/hero.jpg
frontend/assets/content/activities/<activity-key>/thumbnail.jpg
frontend/assets/content/activities/<activity-key>/empty-state.jpg   # optional
```

Requirements:

- `activity-key` must be a stable key from the activity configuration, not a
  display label.
- Hero art should be landscape and text-free.
- Thumbnail art should preserve the same subject and grading at a tighter crop.
- Screens must fall back to the activity icon plus deterministic category tint
  when no image mapping exists.
- Never infer a filesystem path directly from user-entered text.

## Future club-category imagery

Club-category imagery is also intentionally deferred:

```text
frontend/assets/content/club-categories/<category-key>/hero.jpg
frontend/assets/content/club-categories/<category-key>/thumbnail.jpg
```

Requirements:

- `category-key` must come from the approved club-category configuration.
- A missing category image must fall back to the club mark or deterministic tint.
- Category art is editorial context, not a substitute for a club’s uploaded mark
  or cover image.
- Never use these fictional characters as a club’s real members.

## Rendering guidance

- Render all `spot/**` PNGs with `resizeMode="contain"`. Never crop the people,
  props, or transparent silhouette.
- Size a spot illustration as a compact supporting vignette, normally about
  `160–230` points tall at a `390`-point viewport. It must not become a
  full-screen hero or displace the live headline and action.
- Prefer `resizeMode="cover"` only for an explicitly selected alternate
  full-scene onboarding or invitation JPEG.
- Keep meaningful faces and gestures inside the center 70% crop-safe area.
- Provide an accessibility label for meaningful illustrations and mark purely
  atmospheric images as inaccessible.
- Preserve image aspect ratio; do not stretch.
- Do not add baked-in gradients to compensate for unreadable text. Place live
  content on a solid surface or add a controlled code-native overlay.

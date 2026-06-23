# Onboarding a club (manual, via Supabase)

For the launch model, clubs are created by hand from form submissions. Creating a
club correctly means **two rows**, not one:

1. a `Club` row, and
2. a `ClubMember` row with `role = 'OWNER'` for the officer's account.

If you only insert the `Club` row, the club shows up but **no one can manage it**
(officers can't post announcements or create meetings — permissions come from the
`ClubMember` role, not from `createdById`). Channels are created automatically the
first time someone opens the club, so you don't need to insert those.

## One-shot SQL (paste into the Supabase SQL editor)

Edit the officer's email and the club's name/description/category/emoji, then run.
The officer (whoever's email you use) becomes the OWNER and can manage the club
immediately.

```sql
with officer as (
  select id from "User" where email = '[email protected]'
),
new_club as (
  insert into "Club"
    (id, name, description, category, emoji, "isVerified", "isPublic",
     university, "createdById", "officerPermissions", "createdAt", "updatedAt")
  select gen_random_uuid(),
    'Club Name Here',
    'One or two sentence description.',
    'Academic',          -- category
    '🎓',                -- emoji
    true,                -- isVerified (true for hand-onboarded clubs)
    true,                -- isPublic
    'OSU', officer.id, '[]', now(), now()
  from officer
  returning id, "createdById"
)
insert into "ClubMember" (id, "clubId", "userId", role, "joinedAt")
select gen_random_uuid(), nc.id, nc."createdById", 'OWNER', now()
from new_club nc;
```

Notes:
- The officer must have already created an Oval account (so their `User` row
  exists) before you run this.
- `isVerified = true` gives the club the blue check; set it `false` if you don't
  want to verify it yet.
- This mirrors exactly what the app's `POST /clubs` endpoint does in a transaction
  (Club row + OWNER membership).

## Audit: find clubs missing an owner

If you ever want to check for ownerless clubs (created before this process):

```sql
select c.id, c.name
from "Club" c
left join "ClubMember" m
  on m."clubId" = c.id and m.role = 'OWNER'
where m.id is null;
```

An empty result means every club has an owner. 

## Future (v1.1)

This manual process is the launch stopgap. In v1.1, open club creation in-app with
an unverified-by-default tier (`isVerified = false`), creation limits, and reactive
verification — so you stop hand-creating clubs but keep quality control without a
pre-approval queue.

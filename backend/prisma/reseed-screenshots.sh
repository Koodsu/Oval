#!/usr/bin/env bash
#
# Reseed screenshot demo data: clean up the previous seed, then seed fresh.
#
# Wraps cleanup-screenshots.ts + seed-screenshots.ts so the two always run in
# the right order against the same database. Loads backend/.env, shows you the
# target host, and makes you type "yes" before it touches anything.
#
#   ./prisma/reseed-screenshots.sh                  # clean up (if needed), then seed
#   ./prisma/reseed-screenshots.sh --cleanup-only   # just remove the current seed
#   ./prisma/reseed-screenshots.sh --seed-only      # skip cleanup, seed on top
#
# SEED_ATTACH_EMAIL defaults to the manifest's previous value, else to
# $OVAL_SEED_EMAIL, else nothing is attached. Override inline:
#   SEED_ATTACH_EMAIL=you@osu.edu ./prisma/reseed-screenshots.sh

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_DIR"

MANIFEST="prisma/.screenshot-seed-manifest.json"

DO_CLEANUP=1
DO_SEED=1
case "${1:-}" in
  --cleanup-only) DO_SEED=0 ;;
  --seed-only)    DO_CLEANUP=0 ;;
  "")             ;;
  *) echo "Unknown option: $1" >&2; exit 2 ;;
esac

if [[ ! -f .env ]]; then
  echo "No backend/.env found. Set DATABASE_URL and DIRECT_URL first." >&2
  exit 1
fi

# .env values are quoted, so this is safe for URLs containing ? and &.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set after loading .env." >&2
  exit 1
fi

DB_HOST="$(node -e 'try{console.log(new URL(process.env.DATABASE_URL).host)}catch(e){console.log("(unparseable)")}')"

# Default the attach email from the existing manifest, then $OVAL_SEED_EMAIL.
if [[ -z "${SEED_ATTACH_EMAIL:-}" && -f "$MANIFEST" ]]; then
  SEED_ATTACH_EMAIL="$(node -e "try{console.log(require('./$MANIFEST').attachEmail||'')}catch(e){console.log('')}")"
fi
SEED_ATTACH_EMAIL="${SEED_ATTACH_EMAIL:-${OVAL_SEED_EMAIL:-}}"

echo
echo "  Target database : $DB_HOST"
echo "  Cleanup first   : $([[ $DO_CLEANUP == 1 ]] && echo yes || echo 'no (--seed-only)')"
echo "  Seed after      : $([[ $DO_SEED == 1 ]] && echo yes || echo 'no (--cleanup-only)')"
echo "  Attach account  : ${SEED_ATTACH_EMAIL:-(none)}"
if [[ -f "$MANIFEST" ]]; then
  node -e "
    const m = require('./$MANIFEST');
    console.log('  Current manifest: ' + m.createdAt + ' — ' +
      [['users',m.users],['pods',m.pods],['clubs',m.clubs],['dmThreads',m.dmThreads],['friendships',m.friendships]]
        .map(([k,v]) => (v||[]).length + ' ' + k).join(', '));
  "
else
  echo "  Current manifest: none (nothing to clean up)"
fi
echo
read -r -p "This writes to the database above. Type 'yes' to continue: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi

if [[ $DO_CLEANUP == 1 ]]; then
  if [[ -f "$MANIFEST" ]]; then
    echo
    echo "==> Cleaning up previous seed"
    CLEANUP_CONFIRM=yes npx ts-node prisma/cleanup-screenshots.ts
  else
    echo
    echo "==> No manifest present; skipping cleanup"
  fi
fi

if [[ $DO_SEED == 1 ]]; then
  echo
  echo "==> Seeding screenshot data"
  SEED_CONFIRM=yes SEED_ATTACH_EMAIL="${SEED_ATTACH_EMAIL:-}" npx ts-node prisma/seed-screenshots.ts
fi

echo
echo "Done. To remove this seed later:"
echo "  ./prisma/reseed-screenshots.sh --cleanup-only"

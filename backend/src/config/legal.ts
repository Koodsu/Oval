/**
 * Terms version tracking.
 *
 * CURRENT_TERMS_VERSION is what a freshly-updated client displays and what the
 * app re-prompts against. ACCEPTED_TERMS_VERSIONS is what the API will still
 * take from clients that haven't updated yet.
 *
 * WHY THE ALLOWLIST: the App Store build and the backend deploy are never
 * simultaneous. If the API only accepted the current version, then between the
 * two deploys every affected client would 400 on /auth/register and
 * /auth/accept-terms — an inescapable wall on the terms screen, since the app
 * re-prompts whenever the stored version differs. This has broken a release
 * twice. See docs/PLAYBOOK.md → "Bumping the terms version".
 *
 * The version a user actually accepted is recorded as-submitted, never
 * overwritten with CURRENT_TERMS_VERSION — a user on an older build saw the
 * older text, and the record needs to reflect that.
 *
 * WHEN BUMPING: move the old value into PREVIOUS_TERMS_VERSIONS in the same
 * commit. Drop entries only once that build is out of circulation (App Store
 * Connect → force-upgrade cutoff), not before.
 */
export const CURRENT_TERMS_VERSION = '2026-08-05';

/**
 * Older versions still honored during the upgrade window, newest first.
 * '2026-06-20' ships in v1.1, which is live on the App Store.
 */
export const PREVIOUS_TERMS_VERSIONS = ['2026-06-20'] as const;

export const ACCEPTED_TERMS_VERSIONS: readonly string[] = [
  CURRENT_TERMS_VERSION,
  ...PREVIOUS_TERMS_VERSIONS,
];

/** True if `version` is a version the API will accept from a client. */
export function isAcceptedTermsVersion(version: unknown): version is string {
  return typeof version === 'string' && ACCEPTED_TERMS_VERSIONS.includes(version.trim());
}

import { spawnSync } from 'node:child_process';

const audits = [
  { directory: 'backend', allowedAdvisories: new Set() },
  {
    directory: 'frontend',
    // Expo SDK 56 pulls image-size into Metro's local build tooling. These
    // advisories have no patched release, and Oval does not run Metro or
    // image-size in the shipped app or API. Keep this list scoped to the exact
    // package/advisory pairs so every other production advisory still fails CI.
    allowedAdvisories: new Set([
      'image-size:GHSA-5p2g-fcmc-qvqq',
      'image-size:GHSA-w3rx-r6r6-pgpr',
    ]),
  },
  { directory: 'landing', allowedAdvisories: new Set() },
];

function advisoryKey(via) {
  const id = via.url?.match(/GHSA-[a-z0-9-]+/i)?.[0];
  return id ? `${via.name}:${id}` : `${via.name}:unknown-${via.source ?? 'source'}`;
}

function collectRootAdvisories(name, vulnerabilities, visiting = new Set()) {
  if (visiting.has(name)) return { keys: new Set(), incomplete: false };

  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return { keys: new Set(), incomplete: true };

  const nextVisiting = new Set(visiting).add(name);
  const keys = new Set();
  let incomplete = false;

  for (const via of vulnerability.via ?? []) {
    if (typeof via === 'string') {
      const nested = collectRootAdvisories(via, vulnerabilities, nextVisiting);
      for (const key of nested.keys) keys.add(key);
      incomplete ||= nested.incomplete;
      continue;
    }
    keys.add(advisoryKey(via));
  }

  return { keys, incomplete };
}

function isAllowlisted(name, vulnerabilities, allowedAdvisories) {
  if (allowedAdvisories.size === 0) return false;

  const roots = collectRootAdvisories(name, vulnerabilities);
  return !roots.incomplete && roots.keys.size > 0 &&
    [...roots.keys].every((key) => allowedAdvisories.has(key));
}

function runAudit({ directory, allowedAdvisories }) {
  const result = spawnSync(
    'npm',
    ['audit', '--omit=dev', '--json', '--prefix', directory],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    console.error(`[audit:production] ${directory}: npm audit did not return valid JSON.`);
    if (result.stderr) console.error(result.stderr.trim());
    return false;
  }

  const vulnerabilities = report.vulnerabilities ?? {};
  const blocked = Object.keys(vulnerabilities).filter(
    (name) => !isAllowlisted(name, vulnerabilities, allowedAdvisories),
  );
  const allowed = Object.keys(vulnerabilities).filter(
    (name) => isAllowlisted(name, vulnerabilities, allowedAdvisories),
  );

  if (blocked.length > 0) {
    console.error(
      `[audit:production] ${directory}: ${blocked.length} production vulnerability ` +
      `entr${blocked.length === 1 ? 'y' : 'ies'} found: ${blocked.join(', ')}`,
    );
    return false;
  }

  if (result.status !== 0 && allowed.length === 0) {
    console.error(`[audit:production] ${directory}: npm audit failed with status ${result.status}.`);
    if (result.stderr) console.error(result.stderr.trim());
    return false;
  }

  if (allowed.length > 0) {
    console.warn(
      `[audit:production] ${directory}: accepted the documented Metro-only image-size ` +
      `advisories (${[...allowedAdvisories].join(', ')}).`,
    );
  } else {
    console.log(`[audit:production] ${directory}: no production vulnerabilities found.`);
  }
  return true;
}

let passed = true;
for (const audit of audits) passed = runAudit(audit) && passed;
if (!passed) process.exitCode = 1;

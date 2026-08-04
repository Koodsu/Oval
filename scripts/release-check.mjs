import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

function fail(message) {
  console.error(`[release-check] ${message}`);
  process.exitCode = 1;
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor !== 22) {
  fail(`Node 22 is required for release checks; current runtime is ${process.versions.node}`);
}

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const forbiddenTracked = tracked.filter((file) =>
  /(^|\/)node_modules\//.test(file) ||
  /(^|\/)dist\//.test(file) ||
  /(^|\/)\.env$/.test(file) ||
  /^backend\/uploads\//.test(file)
);
if (forbiddenTracked.length > 0) {
  fail(`private or generated files are tracked:\n${forbiddenTracked.slice(0, 30).join('\n')}`);
}

const backendLegal = fs.readFileSync('backend/src/config/legal.ts', 'utf8')
  .match(/CURRENT_TERMS_VERSION\s*=\s*['"]([^'"]+)/)?.[1];
const frontendLegal = fs.readFileSync('frontend/src/constants/legal.ts', 'utf8')
  .match(/CURRENT_TERMS_VERSION\s*=\s*['"]([^'"]+)/)?.[1];
if (!backendLegal || backendLegal !== frontendLegal) {
  fail('backend and frontend terms versions do not match');
}

const appConfig = JSON.parse(fs.readFileSync('frontend/app.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(appConfig.expo.version) || appConfig.expo.version === '1.0.1') {
  fail('frontend/app.json must contain the bumped semantic release version');
}
if (appConfig.expo.ios?.supportsTablet !== false) {
  fail('iPad support must stay disabled until the iPad release is tested');
}
const splashConfig = appConfig.expo.plugins?.find(
  (entry) => Array.isArray(entry) && entry[0] === 'expo-splash-screen',
)?.[1];
if (splashConfig?.image !== './assets/brand/oval-open-1024-transparent.png') {
  fail('the production splash screen is not using the Oval wordmark artwork');
}
// Splash background must match the app's dark-theme bg (theme.ts darkColors.bg)
// so the splash → first-paint transition doesn't flash a different color.
if (splashConfig?.backgroundColor !== '#0F0E12') {
  fail('the splash backgroundColor does not match the Crimson dark theme bg (#0F0E12)');
}

const publicSource = [
  fs.readFileSync('landing/src/components/FinalCta.jsx', 'utf8'),
  fs.readFileSync('landing/src/components/FeatureBento.jsx', 'utf8'),
  fs.readFileSync('backend/src/routes/waitlist.ts', 'utf8'),
].join('\n');
for (const pattern of [
  /founding-member badge/i,
  /founding-member status/i,
  /brady\.vanbibber@(gmail|icloud)\.com/i,
  /© 2026 Bridge\. Ohio State University/i,
]) {
  if (pattern.test(publicSource)) fail(`stale public claim or personal address matched ${pattern}`);
}

if (!fs.existsSync('landing/public/.well-known/apple-app-site-association')) {
  fail('the landing Apple association file is missing');
}

const landingVercel = JSON.parse(fs.readFileSync('landing/vercel.json', 'utf8'));
const androidAssociationRewrite = landingVercel.rewrites?.find(
  (entry) => entry.source === '/.well-known/assetlinks.json',
);
if (androidAssociationRewrite?.destination !== 'https://api.theovalapp.com/.well-known/assetlinks.json') {
  fail('the landing Android App Links association route is missing or points at the wrong API');
}

const expectedArtworkKeys = [
  'study-group', 'reading-book-club', 'pickup-basketball', 'pickup-soccer',
  'pickup-volleyball', 'tennis-pickleball', 'running-jogging', 'swimming', 'golf',
  'bowling', 'frisbee', 'gym-partner', 'yoga', 'meditation', 'nature-walk',
  'casual-hangout', 'movie-watch-party', 'go-to-event', 'video-games', 'board-games',
  'card-games', 'tabletop-rpgs', 'mobile-games', 'trivia', 'chess',
  'food-bank-volunteering', 'animal-shelter-volunteering', 'medical-center-volunteering',
  'other-volunteering', 'cook-together', 'eat-at-restaurant', 'eat-at-dining-hall',
  'grab-coffee-tea', 'bake-something', 'picnic', 'draw-paint', 'crafting',
  'creative-writing', 'play-practice-music', 'photography', 'dance',
];
const activityCatalogSource = fs.readFileSync('backend/prisma/activityCatalog.ts', 'utf8');
for (const key of expectedArtworkKeys) {
  if (!activityCatalogSource.includes(`artworkKey: '${key}'`)) {
    fail(`backend activity catalog is missing artwork key ${key}`);
  }
  if (!fs.existsSync(`frontend/assets/illustrations/activity/catalog/${key}.jpg`)) {
    fail(`activity artwork is missing for ${key}`);
  }
}

if (!process.exitCode) {
  console.log('[release-check] repository configuration passed');
}

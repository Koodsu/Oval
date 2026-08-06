import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const sourceRoot = join(root, 'src')
const failures = []

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

function report(path, message) {
  failures.push(`${relative(root, path)}: ${message}`)
}

for (const path of filesUnder(sourceRoot).filter((file) => ['.js', '.jsx'].includes(extname(file)))) {
  const source = readFileSync(path, 'utf8')

  for (const match of source.matchAll(/<img\b[\s\S]*?>/g)) {
    if (!/\balt\s*=/.test(match[0])) report(path, 'image is missing an alt attribute')
  }

  for (const match of source.matchAll(/<(input|select|textarea)\b[\s\S]*?>/g)) {
    const tag = match[0]
    if (/type\s*=\s*["']hidden["']/.test(tag)) continue
    if (!/\bid\s*=/.test(tag) && !/\baria-label(?:ledby)?\s*=/.test(tag)) {
      report(path, `${match[1]} needs an id-linked label or accessible name`)
    }
  }

  if (/<(?:div|li|span|p)\b[^>]*\bonClick\s*=/.test(source)) {
    report(path, 'non-semantic element has an onClick handler')
  }
}

const appPath = join(sourceRoot, 'App.jsx')
const app = readFileSync(appPath, 'utf8')
for (const required of ['skip-link', 'main-content', "'/accessibility'", 'focus({ preventScroll: true })']) {
  if (!app.includes(required)) report(appPath, `missing application accessibility contract: ${required}`)
}

const routeComponents = [
  'AccessibilityStatement.jsx',
  'ClubsPage.jsx',
  'CommunityGuidelines.jsx',
  'DeleteAccount.jsx',
  'PodInvitePage.jsx',
  'PrivacyPolicy.jsx',
  'Support.jsx',
  'TermsOfUse.jsx',
  'UserProfilePage.jsx',
]
for (const name of routeComponents) {
  const path = join(sourceRoot, 'components', name)
  if (!readFileSync(path, 'utf8').includes('id="main-content"')) {
    report(path, 'route is missing the main-content focus target')
  }
}

const cssPath = join(sourceRoot, 'index.css')
const css = readFileSync(cssPath, 'utf8')
for (const required of [':focus-visible', '.skip-link', 'prefers-reduced-motion: reduce', 'animation: none !important']) {
  if (!css.includes(required)) report(cssPath, `missing CSS accessibility contract: ${required}`)
}

if (failures.length) {
  console.error(`Website accessibility audit failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Website accessibility static audit passed.')
}

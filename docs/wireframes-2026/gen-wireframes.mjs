// Oval "Lumen 2.0" wireframe generator — light + dark SVGs for 4 screens.
// Run: node gen-wireframes.mjs <outDir>
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const outDir = process.argv[2] || './wireframes-2026';
mkdirSync(outDir, { recursive: true });

// ── Proposed Lumen 2.0 tokens ────────────────────────────────────────────────
const THEMES = {
  light: {
    name: 'Light',
    pageBg: '#FFFFFF',
    bgTop: '#FBF2EC', bgBot: '#EEF1F9',           // calmer 2-stop wash
    surface: '#FFFFFF', surfaceAlt: '#F6F3F7',
    ink: '#211C28', sub: '#5D5666', faint: '#8A8294',
    border: '#E6E0E9', borderSoft: '#EFEAF1',
    accent: '#BA0C2F', accentPress: '#98092A',     // true OSU scarlet
    accentSoft: '#F8E4E9', onAccent: '#FFFFFF',
    success: '#177A41', successSoft: '#E1F2E8',
    violet: '#6D3FD4', violetSoft: '#EEE8FB',
    amberSoft: '#F9EFDC',
    dock: '#FFFFFFF2', shadow: 'rgba(42,31,54,0.12)',
    unread: '#BA0C2F',
    mapFill: '#E9EEF6', mapStroke: '#C9D4E6',
  },
  dark: {
    name: 'Dark',
    pageBg: '#FFFFFF',
    bgTop: '#1B1524', bgBot: '#121520',
    surface: '#221D2D', surfaceAlt: '#2A2437',
    ink: '#F3EEF9', sub: '#B3ABC1', faint: '#837A91',
    border: '#38314699', borderSoft: '#2E2839',
    accent: '#FF6B7A', accentPress: '#E84F60',     // scarlet-hue, AA on dark bg
    accentSoft: '#3A1F28', onAccent: '#2A0810',    // dark ink on bright accent
    success: '#4ED186', successSoft: '#1E3229',
    violet: '#B79BFF', violetSoft: '#2C2540',
    amberSoft: '#3A3222',
    dock: '#221D2DF0', shadow: 'rgba(0,0,0,0.5)',
    unread: '#FF6B7A',
    mapFill: '#1C2230', mapStroke: '#33405A',
  },
};

// ── svg helpers ──────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const R = (x, y, w, h, rx, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const Rb = (x, y, w, h, rx, fill, stroke) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
const T = (x, y, s, size, fill, weight = 400, extra = '') => `<text x="${x}" y="${y}" font-family="Inter,system-ui,sans-serif" font-size="${size}" fill="${fill}" font-weight="${weight}" ${extra}>${esc(s)}</text>`;
const TD = (x, y, s, size, fill, weight = 700, extra = '') => `<text x="${x}" y="${y}" font-family="Sora,Inter,system-ui,sans-serif" font-size="${size}" fill="${fill}" font-weight="${weight}" letter-spacing="-0.4" ${extra}>${esc(s)}</text>`;
const C = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const L = (x1, y1, x2, y2, stroke, w = 1, dash = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;

function avatar(t, cx, cy, r, tint) {
  return C(cx, cy, r, tint || t.surfaceAlt, `stroke="${t.border}"`) +
    C(cx, cy - r * 0.28, r * 0.34, t.faint) +
    `<path d="M ${cx - r * 0.62} ${cy + r * 0.75} Q ${cx} ${cy - r * 0.1} ${cx + r * 0.62} ${cy + r * 0.75} Z" fill="${t.faint}"/>`;
}
function chip(t, x, y, w, label, opts = {}) {
  const h = 30, sel = opts.selected;
  return Rb(x, y, w, h, 15, sel ? t.accentSoft : t.surface, sel ? t.accent : t.border) +
    T(x + w / 2, y + 19, label, 11.5, sel ? (t.name === 'Dark' ? t.accent : t.accent) : t.sub, 600, 'text-anchor="middle"');
}
function button(t, x, y, w, label, opts = {}) {
  const h = opts.h || 44;
  const ghost = opts.ghost;
  const fill = ghost ? 'none' : t.accent;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${ghost ? t.surface : t.accent}" stroke="${ghost ? t.border : 'none'}" stroke-width="1"/>` +
    T(x + w / 2, y + h / 2 + 4.5, label, 13.5, ghost ? t.ink : t.onAccent, 700, 'text-anchor="middle"');
}
function dot(t, cx, cy, color) { return C(cx, cy, 4.5, color) ; }

function statusBar(t, px, py) {
  return T(px + 30, py + 30, '9:41', 13, t.ink, 700) +
    R(px + 320, py + 20, 22, 12, 3, 'none', `stroke="${t.sub}"`) + R(px + 322, py + 22, 14, 8, 1.5, t.sub) +
    R(px + 300, py + 20, 14, 12, 2, t.sub) + R(px + 282, py + 20, 14, 12, 2, t.sub);
}

function dock(t, px, py, active, badges = {}) {
  const y = py + 844 - 88;
  const tabs = ['Home', 'Explore', 'Pods', 'Clubs', 'Inbox'];
  let s = `<rect x="${px + 14}" y="${y}" width="362" height="62" rx="24" fill="${t.dock}" stroke="${t.border}" stroke-width="1"/>`;
  tabs.forEach((tab, i) => {
    const cx = px + 14 + 36 + i * 73;
    const on = tab === active;
    if (on) s += R(cx - 22, y + 8, 44, 28, 14, t.accentSoft);
    s += R(cx - 8, y + 14, 16, 16, 4, on ? t.accent : t.faint);
    s += T(cx, y + 50, tab, 9.5, on ? t.accent : t.faint, 600, 'text-anchor="middle"');
    const b = badges[tab];
    if (b) {
      s += C(cx + 16, y + 12, 8.5, t.unread) + T(cx + 16, y + 15.5, String(b), 9.5, t.name === 'Dark' ? t.onAccent : '#fff', 700, 'text-anchor="middle"');
    }
  });
  return s;
}

function phone(t, px, py, title, body) {
  const defsId = `g${Math.random().toString(36).slice(2, 7)}`;
  return `
  <defs><linearGradient id="${defsId}" x1="0" y1="0" x2="0.6" y2="1">
    <stop offset="0" stop-color="${t.bgTop}"/><stop offset="1" stop-color="${t.bgBot}"/>
  </linearGradient></defs>
  <rect x="${px - 10}" y="${py - 10}" width="410" height="864" rx="52" fill="${t.name === 'Dark' ? '#0B0910' : '#241F2B'}"/>
  <clipPath id="clip${defsId}"><rect x="${px}" y="${py}" width="390" height="844" rx="44"/></clipPath>
  <g clip-path="url(#clip${defsId})">
    <rect x="${px}" y="${py}" width="390" height="844" fill="url(#${defsId})"/>
    ${statusBar(t, px, py)}
    ${body}
  </g>`;
}

function annot(items, ax, t) {
  let s = '';
  items.forEach(([y, targetY, text], i) => {
    s += L(ax - 22, targetY, ax + 2, y + 9, '#B0483F', 1.2, '3 3') + C(ax - 22, targetY, 3, '#B0483F');
    const lines = text.match(/.{1,44}(\s|$)|\S+/g).reduce((acc, w) => acc, null) || [];
    // simple wrap at ~46 chars
    const words = text.split(' ');
    let line = '', out = [];
    for (const w of words) { if ((line + ' ' + w).trim().length > 46) { out.push(line.trim()); line = w; } else line += ' ' + w; }
    if (line.trim()) out.push(line.trim());
    out.forEach((ln, j) => { s += T(ax + 8, y + 13 + j * 15, ln, 11.5, '#3E3944', j === 0 ? 700 : 400); });
  });
  return s;
}

function frame(t, screenTitle, subtitle, body, notes) {
  const W = 830, H = 950, px = 40, py = 62;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>
  ${TD(px - 10, 34, `Oval — ${screenTitle}`, 20, '#211C28', 800)}
  ${T(px - 10, 52, `${t.name} theme · Lumen 2.0 proposal`, 12.5, '#7A7284', 500)}
  ${phone(t, px, py, screenTitle, body)}
  ${annot(notes, 470, t)}
  ${T(px - 10, H - 18, 'Wireframe — generated from docs/wireframes-2026/gen-wireframes.mjs. Spacing/copy indicative, not final.', 10.5, '#9A93A3')}
</svg>`;
}

// ── Screen bodies ────────────────────────────────────────────────────────────

function homeBody(t, px, py) {
  let s = '';
  let y = py + 58;
  // masthead
  s += T(px + 24, y, 'WEDNESDAY, JULY 1', 10.5, t.accent, 700, 'letter-spacing="1"');
  s += TD(px + 24, y + 30, 'Evening, Brady.', 26, t.ink, 800);
  s += avatar(t, px + 342, y + 12, 22, t.accentSoft);
  y += 52;
  // hero: tonight card (single next action)
  s += Rb(px + 24, y, 342, 118, 20, t.accent, 'none');
  s += T(px + 42, y + 28, 'YOUR NEXT MOVE · 7:30 PM', 10, t.onAccent, 700, 'letter-spacing="0.8" opacity="0.85"');
  s += TD(px + 42, y + 56, 'Pickup Frisbee — The Oval', 18, t.onAccent, 800);
  s += T(px + 42, y + 78, '4/8 going · starts in 2h', 12, t.onAccent, 500, 'opacity="0.9"');
  for (let i = 0; i < 3; i++) s += avatar(t, px + 54 + i * 20, y + 96, 11, t.surface);
  s += Rb(px + 258, y + 76, 92, 30, 15, t.pageBg === '#FFFFFF' && t.name === 'Light' ? '#FFFFFF' : t.surface, 'none') +
       T(px + 304, y + 95, 'Open pod', 11.5, t.accent, 700, 'text-anchor="middle"');
  y += 134;
  // pulse strip (compact, 3 stats)
  s += Rb(px + 24, y, 342, 58, 16, t.surface, t.border);
  const stats = [['12', 'open pods'], ['5', 'meetings today'], ['3', 'friends out']];
  stats.forEach(([n, l], i) => {
    const cx = px + 24 + 57 + i * 114;
    s += TD(cx, y + 27, n, 17, i === 0 ? t.accent : t.ink, 800, 'text-anchor="middle"');
    s += T(cx, y + 44, l, 10.5, t.sub, 500, 'text-anchor="middle"');
    if (i) s += L(px + 24 + i * 114, y + 12, px + 24 + i * 114, y + 46, t.borderSoft);
  });
  y += 74;
  // happening soon — cards with inline join + social proof
  s += T(px + 24, y + 8, 'HAPPENING SOON', 10.5, t.sub, 700, 'letter-spacing="1"');
  s += T(px + 320, y + 8, 'Explore →', 11, t.accent, 600);
  y += 18;
  const rows = [
    ['8:00', 'Late-night study sesh', '2 friends going', true],
    ['9:15', 'Boba run — High St', '3 spots left', false],
  ];
  rows.forEach(([time, title, meta, friends]) => {
    s += Rb(px + 24, y, 342, 64, 16, t.surface, t.border);
    s += Rb(px + 36, y + 14, 52, 36, 10, t.accentSoft, 'none');
    s += T(px + 62, y + 36, time, 11.5, t.accent, 700, 'text-anchor="middle"');
    s += T(px + 100, y + 26, title, 13, t.ink, 700);
    if (friends) { s += avatar(t, px + 106, y + 43, 8) + avatar(t, px + 122, y + 43, 8); s += T(px + 136, y + 47, meta, 10.5, t.success, 600); }
    else s += T(px + 100, y + 47, meta, 10.5, t.sub, 500);
    s += Rb(px + 296, y + 17, 58, 30, 15, t.accent, 'none') + T(px + 325, y + 36, 'Join', 12, t.onAccent, 700, 'text-anchor="middle"');
    y += 74;
  });
  // map preview strip
  s += Rb(px + 24, y, 342, 96, 16, t.mapFill, t.mapStroke);
  s += `<path d="M ${px + 40} ${y + 70} Q ${px + 120} ${y + 10} ${px + 200} ${y + 50} T ${px + 350} ${y + 30}" stroke="${t.mapStroke}" fill="none" stroke-width="2"/>`;
  s += C(px + 120, y + 44, 7, t.accent) + C(px + 220, y + 60, 7, t.accent) + C(px + 300, y + 34, 7, t.accent);
  s += Rb(px + 36, y + 62, 120, 24, 12, t.surface, t.border) + T(px + 96, y + 78, '3 pods live on map', 10.5, t.ink, 600, 'text-anchor="middle"');
  s += dock(t, px, py, 'Home', { Inbox: 3 });
  return s;
}

function onboardingBody(t, px, py) {
  let s = '';
  let y = py + 66;
  s += R(px + 24, y - 22, 60, 5, 2.5, t.accent) + R(px + 90, y - 22, 60, 5, 2.5, t.accent) + R(px + 156, y - 22, 60, 5, 2.5, t.border);
  s += T(px + 24, y, 'STEP 3 OF 3 · YOUR FIRST PLAN', 10.5, t.accent, 700, 'letter-spacing="1"');
  s += TD(px + 24, y + 32, 'This week, near you', 24, t.ink, 800);
  s += T(px + 24, y + 54, 'Picked from your interests — join one and', 12.5, t.sub);
  s += T(px + 24, y + 70, "you're in. No empty first day.", 12.5, t.sub);
  y += 88;
  // interest recap chips
  s += chip(t, px + 24, y, 84, 'Frisbee ✓', { selected: true });
  s += chip(t, px + 116, y, 76, 'Food ✓', { selected: true });
  s += chip(t, px + 200, y, 92, 'Studying ✓', { selected: true });
  s += T(px + 304, y + 19, 'Edit', 11.5, t.accent, 600);
  y += 46;
  // matched pods
  const pods = [
    ['TONIGHT 7:30', 'Pickup Frisbee — The Oval', '4/8 going · 0.3 mi', true],
    ['THU 6:00', 'Dumpling crawl — High St', '3/6 going · 2 friends', false],
    ['FRI 4:00', 'Finals grind — Thompson 2F', '5/10 going', false],
  ];
  pods.forEach(([when, title, meta, hot]) => {
    s += Rb(px + 24, y, 342, 88, 18, t.surface, hot ? t.accent : t.border);
    if (hot) s += Rb(px + 36, y - 10, 96, 20, 10, t.accent, 'none') + T(px + 84, y + 3.5, 'BEST MATCH', 9, t.onAccent, 700, 'text-anchor="middle"');
    s += T(px + 40, y + 26, when, 10, t.accent, 700, 'letter-spacing="0.6"');
    s += T(px + 40, y + 46, title, 14, t.ink, 700);
    s += T(px + 40, y + 66, meta, 11, t.sub, 500);
    s += Rb(px + 288, y + 26, 62, 34, 17, hot ? t.accent : t.surfaceAlt, hot ? 'none' : t.border);
    s += T(px + 319, y + 47, 'Join', 12.5, hot ? t.onAccent : t.ink, 700, 'text-anchor="middle"');
    y += 100;
  });
  y += 6;
  s += button(t, px + 24, y, 342, 'Continue to Oval');
  s += T(px + 195, y + 68, 'Skip for now', 12, t.faint, 600, 'text-anchor="middle"');
  return s;
}

function podDetailBody(t, px, py) {
  let s = '';
  let y = py + 56;
  s += T(px + 24, y + 4, '←', 18, t.ink, 700);
  s += Rb(px + 316, y - 12, 50, 28, 14, t.surface, t.border) + T(px + 341, y + 6, 'Share', 10.5, t.ink, 600, 'text-anchor="middle"');
  y += 26;
  s += Rb(px + 24, y, 342, 128, 20, t.surface, t.border);
  s += Rb(px + 40, y + 16, 120, 24, 12, t.accentSoft, 'none') + T(px + 100, y + 32, 'TONIGHT · 7:30 PM', 9.5, t.accent, 700, 'text-anchor="middle"');
  s += TD(px + 40, y + 66, 'Pickup Frisbee', 21, t.ink, 800);
  s += T(px + 40, y + 88, 'The Oval, south lawn · hosted by Maya K.', 11.5, t.sub);
  // capacity meter
  s += R(px + 40, y + 104, 310, 8, 4, t.surfaceAlt) + R(px + 40, y + 104, 194, 8, 4, t.success);
  s += T(px + 40, y + 124, '5 of 8 in — 3 spots left', 10.5, t.success, 600);
  y += 144;
  // members + friends context
  for (let i = 0; i < 5; i++) s += avatar(t, px + 44 + i * 30, y + 16, 14, i === 0 ? t.accentSoft : undefined);
  s += C(px + 44 + 5 * 30, y + 16, 14, t.surfaceAlt, `stroke="${t.border}" stroke-dasharray="3 3"`) + T(px + 44 + 5 * 30, y + 20.5, '+3', 10.5, t.sub, 700, 'text-anchor="middle"');
  s += T(px + 236, y + 20, '· Sam is a friend', 11, t.success, 600);
  y += 44;
  // primary actions
  s += button(t, px + 24, y, 220, 'Join this pod');
  s += button(t, px + 254, y, 112, 'Invite', { ghost: true });
  y += 60;
  // map card
  s += Rb(px + 24, y, 342, 84, 16, t.mapFill, t.mapStroke);
  s += C(px + 195, y + 38, 8, t.accent) + C(px + 195, y + 38, 14, 'none', `stroke="${t.accent}" opacity="0.4"`);
  s += T(px + 195, y + 70, 'The Oval — 0.3 mi from you', 10.5, t.sub, 600, 'text-anchor="middle"');
  y += 98;
  // chat preview
  s += Rb(px + 24, y, 342, 108, 16, t.surface, t.border);
  s += T(px + 40, y + 22, 'POD CHAT', 10, t.sub, 700, 'letter-spacing="1"');
  s += Rb(px + 106, y + 10, 52, 18, 9, t.accent, 'none') + T(px + 132, y + 23, '4 new', 9.5, t.onAccent, 700, 'text-anchor="middle"');
  s += avatar(t, px + 52, y + 48, 11);
  s += Rb(px + 70, y + 36, 200, 24, 12, t.surfaceAlt, 'none') + T(px + 82, y + 51.5, 'bringing an extra disc 🥏', 10.5, t.ink);
  s += avatar(t, px + 52, y + 78, 11);
  s += Rb(px + 70, y + 66, 160, 24, 12, t.surfaceAlt, 'none') + T(px + 82, y + 81.5, 'omw, save me a spot', 10.5, t.ink);
  s += T(px + 296, y + 96, 'Open chat →', 11, t.accent, 600);
  return s;
}

function inboxBody(t, px, py) {
  let s = '';
  let y = py + 58;
  s += TD(px + 24, y, 'Inbox', 26, t.ink, 800);
  s += Rb(px + 296, y - 20, 70, 28, 14, t.surface, t.border) + T(px + 331, y - 2, 'Search', 10.5, t.sub, 600, 'text-anchor="middle"');
  y += 20;
  // segmented with counts
  s += Rb(px + 24, y, 342, 38, 19, t.surfaceAlt, t.borderSoft);
  s += R(px + 28, y + 4, 110, 30, 15, t.surface, `stroke="${t.border}"`);
  s += T(px + 83, y + 23.5, 'Messages · 3', 11.5, t.ink, 700, 'text-anchor="middle"');
  s += T(px + 196, y + 23.5, 'Invites · 1', 11.5, t.sub, 600, 'text-anchor="middle"');
  s += T(px + 306, y + 23.5, 'Requests · 1', 11.5, t.sub, 600, 'text-anchor="middle"');
  y += 54;
  // unread thread rows
  const rows = [
    ['Maya K.', 'see you at the oval at 7?', '2m', true, false],
    ['Frisbee pod · tonight', 'Sam: bringing an extra disc 🥏', '9m', true, true],
    ['Jordan P.', 'that boba place was elite', '1h', true, false],
    ['Alex T.', 'you: good luck on the final!', 'Tue', false, false],
  ];
  rows.forEach(([name, preview, time, unread, isPod]) => {
    s += Rb(px + 24, y, 342, 64, 16, t.surface, t.border);
    s += avatar(t, px + 56, y + 32, 18, isPod ? t.violetSoft : undefined);
    if (unread) s += C(px + 70, y + 18, 5.5, t.unread, `stroke="${t.surface}" stroke-width="2"`);
    s += T(px + 84, y + 27, name, 13, t.ink, unread ? 700 : 600);
    s += T(px + 84, y + 47, preview, 11.5, unread ? t.ink : t.sub, unread ? 600 : 400);
    s += T(px + 350, y + 24, time, 10.5, unread ? t.accent : t.faint, unread ? 700 : 500, 'text-anchor="end"');
    if (isPod) { s += Rb(px + 296, y + 36, 56, 20, 10, t.violetSoft, 'none') + T(px + 324, y + 50, 'POD', 9, t.violet, 700, 'text-anchor="middle"'); }
    y += 74;
  });
  // friend request inline actions
  s += Rb(px + 24, y, 342, 72, 16, t.surface, t.border);
  s += avatar(t, px + 56, y + 36, 18, t.amberSoft);
  s += T(px + 84, y + 28, 'Riley M.', 12.5, t.ink, 700);
  s += T(px + 84, y + 46, 'Met in Frisbee pod', 11, t.sub);
  s += Rb(px + 232, y + 22, 62, 28, 14, t.accent, 'none') + T(px + 263, y + 40, 'Accept', 10.5, t.onAccent, 700, 'text-anchor="middle"');
  s += Rb(px + 302, y + 22, 52, 28, 14, t.surface, t.border) + T(px + 328, y + 40, 'Later', 10.5, t.sub, 600, 'text-anchor="middle"');
  s += dock(t, px, py, 'Inbox', { Inbox: 5 });
  return s;
}

// ── Annotations (shared across themes) ──────────────────────────────────────
const PX = 40, PY = 62;
const NOTES = {
  home: [
    [80, PY + 150, 'One hero = one next action. Merges "Your day" + "Your next move" — the old Home stacked 7 sections with duplicate content.'],
    [180, PY + 260, 'Pulse adds "friends out" — social proof, not just inventory counts.'],
    [300, PY + 330, 'Inline Join on feed rows. Today the core action is 2 taps away behind PodDetail.'],
    [400, PY + 355, 'Friends-going avatars on cards — the #1 reason a student actually shows up.'],
    [520, PY + 480, 'Map demoted to a compact strip; it was a 200px dead zone (non-scrollable) mid-feed.'],
    [640, PY + 790, 'Dock badge fed by ONE /inbox/summary call incl. pod-chat unreads (new read-state).'],
  ],
  onboarding: [
    [90, PY + 60, 'New post-verify step. Interests are already collected at signup but never used — this closes the loop.'],
    [210, PY + 200, 'Interests recap, editable in place.'],
    [330, PY + 260, '2–3 real joinable pods ranked by interest match + distance. Guarantees a non-empty first session.'],
    [470, PY + 300, '"Best match" gets the only filled Join — one obvious action.'],
    [620, PY + 640, 'Skip is available but quiet. Instrument the full funnel: onboarding.started → first_pod_joined.'],
  ],
  'pod-detail': [
    [90, PY + 100, 'Share promoted to the header — the invite loop is the growth engine and it fires invite.shared with attribution.'],
    [210, PY + 190, 'Capacity meter + "3 spots left" urgency instead of a plain 5/8 count.'],
    [330, PY + 250, '"Sam is a friend" — surface the social graph at the decision moment.'],
    [430, PY + 300, 'Join is the single filled action; Invite is the ghost twin. Both above the fold.'],
    [560, PY + 500, 'Chat preview with unread pill — pod chat currently has NO read state anywhere in the app.'],
  ],
  inbox: [
    [110, PY + 105, 'Segmented counts visible before you tap — invites and requests were hidden until visited.'],
    [230, PY + 170, 'Unread = scarlet dot + bold ink + timestamp. hasUnread already exists in the API.'],
    [350, PY + 240, 'Pod chats join the inbox as first-class threads (violet POD tag) once read-state ships.'],
    [520, PY + 470, 'Friend requests get inline Accept — no detour to a separate screen.'],
    [640, PY + 790, 'Badge count matches the segmented totals — one source of truth.'],
  ],
};

const SCREENS = {
  onboarding: ['First-run: your first plan', onboardingBody],
  home: ['Home', homeBody],
  'pod-detail': ['Pod detail', podDetailBody],
  inbox: ['Inbox', inboxBody],
};

for (const [key, [title, fn]] of Object.entries(SCREENS)) {
  for (const [mode, t] of Object.entries(THEMES)) {
    const svg = frame(t, title, '', fn(t, PX, PY), NOTES[key]);
    writeFileSync(join(outDir, `${key}-${mode}.svg`), svg);
    console.log(`wrote ${key}-${mode}.svg`);
  }
}
console.log('done');

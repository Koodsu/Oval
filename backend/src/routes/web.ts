import { Router, Request, Response } from 'express';

const router = Router();
const APP_HOST = 'joinbridgeapp.com';
const IOS_APP_ID = process.env.IOS_APP_ID?.trim() || 'com.bradyvb.bridgeapp';
const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE?.trim() || 'com.bradyvb.bridgeapp';
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID?.trim();
const ANDROID_SHA256 = process.env.ANDROID_SHA256_CERT_FINGERPRINT?.trim();

// iOS Universal Links verification
// Uses env values when available; falls back to the local app bundle id so
// the emitted config stays aligned with the mobile app even before release.
router.get('/.well-known/apple-app-site-association', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: APPLE_TEAM_ID ? `${APPLE_TEAM_ID}.${IOS_APP_ID}` : IOS_APP_ID,
          paths: ['/pod/*', '/clubs/*', '/users/*'],
        },
      ],
    },
  });
});

// Android App Links verification
// Uses the configured package id and optional SHA env override.
router.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: ANDROID_SHA256 ? [ANDROID_SHA256] : [],
      },
    },
  ]);
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Web landing page for pod invite links
// Shown to users who don't have the app installed
router.get('/pod/:podId', (req: Request, res: Response) => {
  const { podId } = req.params;

  // Validate podId before embedding in HTML to prevent XSS
  if (!UUID_RE.test(podId)) {
    res.status(400).send('Invalid pod ID');
    return;
  }

  const deepLink = `bridge://pod/${podId}`;
  const universalLink = `https://${APP_HOST}/pod/${podId}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Join a Pod on Bridge</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --ink: #0c0f1a;
      --indigo: #6366f1;
      --violet: #8b5cf6;
      --amber: #f5a623;
      --cream: #f0ece2;
      --cream-dim: rgba(240, 236, 226, 0.5);
      --surface: rgba(255, 255, 255, 0.04);
      --surface-hover: rgba(255, 255, 255, 0.08);
    }

    body {
      font-family: 'Outfit', sans-serif;
      background: var(--ink);
      color: var(--cream);
      min-height: 100vh;
      overflow-x: hidden;
      position: relative;
    }

    /* --- Atmospheric background layers --- */
    .bg {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }
    .bg-gradient {
      background:
        radial-gradient(ellipse 80% 60% at 20% 80%, rgba(99,102,241,0.18) 0%, transparent 70%),
        radial-gradient(ellipse 60% 50% at 80% 20%, rgba(139,92,246,0.12) 0%, transparent 70%),
        radial-gradient(ellipse 40% 40% at 60% 70%, rgba(245,166,35,0.06) 0%, transparent 70%);
    }
    .bg-grain {
      opacity: 0.35;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
      background-repeat: repeat;
      background-size: 180px 180px;
    }

    /* --- Floating dots (people gathering) --- */
    .dots { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
    .dot {
      position: absolute;
      border-radius: 50%;
      animation: drift 8s ease-in-out infinite alternate;
    }
    .dot:nth-child(1) { width: 6px; height: 6px; top: 18%; left: 12%; background: var(--indigo); opacity: 0.5; animation-delay: 0s; }
    .dot:nth-child(2) { width: 4px; height: 4px; top: 30%; left: 78%; background: var(--amber); opacity: 0.6; animation-delay: -2s; }
    .dot:nth-child(3) { width: 8px; height: 8px; top: 65%; left: 85%; background: var(--violet); opacity: 0.35; animation-delay: -4s; }
    .dot:nth-child(4) { width: 5px; height: 5px; top: 75%; left: 25%; background: var(--indigo); opacity: 0.4; animation-delay: -1s; }
    .dot:nth-child(5) { width: 3px; height: 3px; top: 45%; left: 55%; background: var(--amber); opacity: 0.55; animation-delay: -3s; }
    .dot:nth-child(6) { width: 7px; height: 7px; top: 12%; left: 65%; background: var(--violet); opacity: 0.25; animation-delay: -5s; }
    .dot:nth-child(7) { width: 4px; height: 4px; top: 85%; left: 50%; background: var(--cream); opacity: 0.2; animation-delay: -6s; }
    .dot:nth-child(8) { width: 5px; height: 5px; top: 55%; left: 8%; background: var(--amber); opacity: 0.3; animation-delay: -7s; }

    @keyframes drift {
      0%   { transform: translate(0, 0) scale(1); }
      100% { transform: translate(12px, -18px) scale(1.3); }
    }

    /* --- SVG bridge arc --- */
    .bridge-arc {
      position: fixed;
      bottom: -2%;
      left: 50%;
      transform: translateX(-50%);
      width: min(900px, 120vw);
      height: auto;
      z-index: 0;
      pointer-events: none;
    }
    .bridge-arc path {
      fill: none;
      stroke: url(#arcGrad);
      stroke-width: 1.5;
      stroke-dasharray: 900;
      stroke-dashoffset: 900;
      animation: drawArc 2.4s cubic-bezier(0.65, 0, 0.35, 1) 0.3s forwards;
    }
    @keyframes drawArc {
      to { stroke-dashoffset: 0; }
    }

    /* --- Main content --- */
    .content {
      position: relative;
      z-index: 1;
      min-height: 100vh;
      display: flex;
      align-items: center;
      padding: 48px 32px;
    }
    .inner {
      max-width: 520px;
      width: 100%;
      margin: 0 auto;
    }

    /* --- Staggered reveal animation --- */
    .reveal {
      opacity: 0;
      transform: translateY(28px);
      animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .reveal-1 { animation-delay: 0.15s; }
    .reveal-2 { animation-delay: 0.35s; }
    .reveal-3 { animation-delay: 0.55s; }
    .reveal-4 { animation-delay: 0.75s; }
    .reveal-5 { animation-delay: 0.90s; }

    @keyframes fadeUp {
      to { opacity: 1; transform: translateY(0); }
    }

    /* --- Logo mark --- */
    .logo-mark {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 40px;
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      font-size: 15px;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: var(--cream-dim);
    }
    .logo-mark .icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--indigo), var(--violet));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 0 24px rgba(99, 102, 241, 0.3);
    }

    /* --- Headline --- */
    .headline {
      font-family: 'Playfair Display', serif;
      font-weight: 700;
      font-style: italic;
      font-size: clamp(40px, 8vw, 64px);
      line-height: 1.05;
      letter-spacing: -1px;
      margin-bottom: 10px;
      color: var(--cream);
    }
    .headline .accent {
      color: var(--amber);
      font-style: normal;
    }

    /* --- Subheadline --- */
    .sub {
      font-size: 17px;
      line-height: 1.65;
      color: var(--cream-dim);
      margin-bottom: 44px;
      max-width: 400px;
    }

    /* --- CTA button --- */
    .cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 18px 40px;
      border-radius: 14px;
      border: none;
      cursor: pointer;
      font-family: 'Outfit', sans-serif;
      font-size: 17px;
      font-weight: 600;
      color: #fff;
      background: linear-gradient(135deg, var(--indigo), var(--violet));
      box-shadow:
        0 0 0 0 rgba(99, 102, 241, 0),
        0 8px 32px rgba(99, 102, 241, 0.3);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
                  box-shadow 0.25s ease;
      width: 100%;
      max-width: 320px;
    }
    .cta:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow:
        0 0 0 4px rgba(99, 102, 241, 0.15),
        0 12px 40px rgba(99, 102, 241, 0.4);
    }
    .cta:active {
      transform: translateY(0) scale(0.98);
    }
    .cta svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    /* --- Store links --- */
    .stores-section {
      margin-top: 44px;
      padding-top: 32px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    .stores-label {
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: rgba(240, 236, 226, 0.3);
      margin-bottom: 16px;
    }
    .stores {
      display: flex;
      gap: 12px;
    }
    .store-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 16px;
      border-radius: 12px;
      background: var(--surface);
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: var(--cream);
      text-decoration: none;
      font-family: 'Outfit', sans-serif;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
    }
    .store-btn:hover {
      background: var(--surface-hover);
      border-color: rgba(255, 255, 255, 0.12);
      transform: translateY(-1px);
    }
    .store-btn svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      opacity: 0.7;
    }

    /* --- Responsive --- */
    @media (min-width: 768px) {
      .content { padding: 64px 80px; }
      .inner { margin: 0; }
    }
    @media (max-width: 480px) {
      .content { padding: 40px 24px; }
      .headline { margin-bottom: 8px; }
      .sub { margin-bottom: 36px; }
      .cta { max-width: 100%; }
      .stores { flex-direction: column; }
    }
  </style>
</head>
<body>

  <!-- Background layers -->
  <div class="bg bg-gradient"></div>
  <div class="bg bg-grain"></div>

  <!-- Floating dots -->
  <div class="dots">
    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    <div class="dot"></div><div class="dot"></div>
  </div>

  <!-- SVG bridge arc -->
  <svg class="bridge-arc" viewBox="0 0 900 200" preserveAspectRatio="none">
    <defs>
      <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#6366f1" stop-opacity="0" />
        <stop offset="30%" stop-color="#6366f1" stop-opacity="0.4" />
        <stop offset="50%" stop-color="#8b5cf6" stop-opacity="0.5" />
        <stop offset="70%" stop-color="#f5a623" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#f5a623" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path d="M0,190 Q450,10 900,190" />
  </svg>

  <!-- Main content -->
  <main class="content">
    <div class="inner">

      <div class="logo-mark reveal reveal-1">
        <span class="icon">🌉</span>
        Bridge
      </div>

      <h1 class="headline reveal reveal-2">
        Your crew is<br/>waiting<span class="accent">.</span>
      </h1>

      <p class="sub reveal reveal-3">
        A friend invited you to a pod&mdash;a small group getting together in real life.
        Open Bridge to see who&rsquo;s in and claim your&nbsp;spot.
      </p>

      <div class="reveal reveal-4">
        <button class="cta" id="openBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          Open in Bridge
        </button>
      </div>

      <div class="stores-section reveal reveal-5">
        <p class="stores-label">Don&rsquo;t have Bridge yet?</p>
        <div class="stores">
          <a href="https://apps.apple.com/app/bridge/id0000000000" class="store-btn" id="iosBtn">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            App Store
          </a>
          <a href="https://play.google.com/store/apps/details?id=com.bridge.app" class="store-btn" id="androidBtn">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.04L14.41 12 3.18.96c-.36.28-.58.71-.58 1.2v19.68c0 .49.22.92.58 1.2zm1.63.84L16.85 17l-3.35-3.35L4.81 23.88zM21.3 10.87L18.07 9l-3.54 3 3.54 3 3.23-1.87c.55-.32.88-.84.88-1.38s-.33-1.06-.88-1.38v.5zM4.81.12l8.69 10.23L16.85 7 4.81.12z"/></svg>
            Google Play
          </a>
        </div>
      </div>

    </div>
  </main>

  <script>
    var deepLink = ${JSON.stringify(deepLink)};
    var universalLink = ${JSON.stringify(universalLink)};

    document.getElementById('openBtn').addEventListener('click', function () {
      var fallbackTimer = setTimeout(function () {
        document.getElementById('openBtn').style.display = 'none';
      }, 1500);

      window.location.href = deepLink;

      window.addEventListener('blur', function () {
        clearTimeout(fallbackTimer);
      }, { once: true });
    });
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;

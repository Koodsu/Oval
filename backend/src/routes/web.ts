import { Router, Request, Response } from 'express';

const router = Router();

// iOS Universal Links verification
// Replace APPLE_TEAM_ID and IOS_BUNDLE_ID with real values before publishing to App Store
router.get('/.well-known/apple-app-site-association', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: 'APPLE_TEAM_ID.com.bridge.app',
          paths: ['/pod/*'],
        },
      ],
    },
  });
});

// Android App Links verification
// Replace SHA256_CERT_FINGERPRINT with the real SHA-256 fingerprint of your signing key before publishing
router.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.bridge.app',
        sha256_cert_fingerprints: ['SHA256_CERT_FINGERPRINT'],
      },
    },
  ]);
});

// Web landing page for pod invite links
// Shown to users who don't have the app installed
router.get('/pod/:podId', (req: Request, res: Response) => {
  const { podId } = req.params;
  const deepLink = `bridge://pod/${podId}`;
  const universalLink = `https://bridge.app/pod/${podId}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Join a Pod on Bridge</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 20px;
      padding: 40px 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
    }
    .logo {
      width: 72px;
      height: 72px;
      border-radius: 18px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 36px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    p {
      font-size: 15px;
      color: #64748b;
      line-height: 1.5;
      margin-bottom: 32px;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 16px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
      margin-bottom: 12px;
    }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #ffffff;
    }
    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
    }
    .stores {
      display: flex;
      gap: 12px;
      margin-top: 4px;
    }
    .stores a {
      flex: 1;
    }
    .hint {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 20px;
      margin-bottom: 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🌉</div>
    <h1>You're invited to a pod</h1>
    <p>Someone shared a Bridge pod with you. Open the app to see who's joining and claim your spot.</p>

    <button class="btn btn-primary" id="openBtn">Open in Bridge</button>

    <p class="hint">Don't have Bridge yet? Get it free:</p>
    <div class="stores">
      <a href="https://apps.apple.com/app/bridge/id0000000000" class="btn btn-secondary" id="iosBtn">
        App Store
      </a>
      <a href="https://play.google.com/store/apps/details?id=com.bridge.app" class="btn btn-secondary" id="androidBtn">
        Google Play
      </a>
    </div>
  </div>

  <script>
    var deepLink = "${deepLink}";
    var universalLink = "${universalLink}";

    document.getElementById('openBtn').addEventListener('click', function () {
      // Try to open the app via custom scheme; fall through to store after timeout
      var fallbackTimer = setTimeout(function () {
        // App not installed — scroll to store buttons
        document.getElementById('openBtn').style.display = 'none';
      }, 1500);

      window.location.href = deepLink;

      // Cancel fallback if the page hides (app opened)
      window.addEventListener('blur', function () {
        clearTimeout(fallbackTimer);
      }, { once: true });
    });

    // On iOS Safari, Universal Links fire before the page loads.
    // If we reach this page it means the app isn't installed or the user
    // explicitly opened in browser — nothing more to do automatically.
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;

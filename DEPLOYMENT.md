# MVP Deployment

## 1. Frontend

Publish the contents of `frontend/` with any static hosting
provider, including `index.html`, `app.js`, `styles.css`, and the full `data/`
folder. Before publishing, update `config.js`:

```js
window.NIHONGO_CONFIG = {
  gaMeasurementId: 'G-XXXXXXXXXX'
};
```

Replace `G-XXXXXXXXXX` with the GA4 web data stream Measurement ID. Leave `gaMeasurementId` empty to disable
analytics. Analytics events do not include article text or translations.

For local testing, open the frontend through a static web server instead of
double-clicking `index.html`, because the app loads `data/*.json` at runtime.
For example, from `frontend/`:

```bash
python3 -m http.server 4173
```

Then visit:

```text
http://localhost:4173
```

## 2. Smoke Test

After deployment, verify:

1. Paste and analyze plain Japanese text.
2. Paste a URL and confirm the app asks the user to copy the original text instead of fetching it.
3. Upload one text-based PDF and review the import preview.
4. Upload a scanned or unsupported file and confirm the pasted-text fallback is clear.
5. Export landscape and portrait PPTX, PNG, and JPEG.
6. Confirm oversized and unsupported files show readable errors.

## 3. Backend Status

The existing `backend/` service is retained for future features, but the public MVP does not require it.
Do not configure or advertise automatic URL extraction, DOCX parsing, server PDF fallback, subscriptions, or quotas for the MVP.

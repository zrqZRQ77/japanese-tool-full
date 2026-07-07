# MVP Deployment

## 1. Backend

Deploy `backend/` as a Docker web service with at least 2 GB RAM. The image
contains Chromium for PNG export.

Required environment variables:

```text
PORT=3001
TRUST_PROXY=true
ALLOWED_ORIGINS=https://your-frontend-domain.example
```

Use `backend/.env.example` for limits and concurrency defaults. Verify the
deployed service at:

```text
https://your-api-domain.example/health
```

## 2. Frontend

Publish the contents of `frontend/` with any static hosting
provider, including `index.html`, `app.js`, `styles.css`, and the full `data/`
folder. Before publishing, update `config.js`:

```js
window.NIHONGO_CONFIG = {
  apiBaseUrl: 'https://your-api-domain.example'
};
```

Do not include a trailing slash.

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

## 3. Smoke Test

After both deployments are live, verify:

1. Paste and analyze plain Japanese text.
2. Extract one public article URL.
3. Upload one TXT, DOCX, and text-based PDF.
4. Export landscape and portrait PPTX.
5. Export landscape and portrait PNG.
6. Confirm oversized and unsupported files show readable errors.
7. Confirm requests from an unapproved website origin are rejected by CORS.

## 4. Operations

- Files are processed temporarily and are not retained.
- Metered route logs exclude document text and filenames.
- Review `metered-operation` logs weekly for volume, duration, errors, and peak load.
- Do not add Redis until the backend runs on multiple instances.
- Before adding subscriptions, follow the membership boundary in `PRODUCT_DECISIONS.md`.

# Nihongo Reader Backend

Node.js API for article extraction, document upload, YouTube transcripts, and
browser-rendered PNG export.

## Run

```bash
npm install
npm run install-browser
npm start
```

Default URL:

```txt
http://localhost:3001
```

Use `.env.example` as the production configuration reference. Set
`ALLOWED_ORIGINS` to the deployed frontend origin and `TRUST_PROXY=true` when
running behind a managed hosting proxy.

## Test

```bash
npm test
```

## Endpoints

### POST /api/extract-url

Supports ordinary HTML article pages and text-based PDF links. PDF processing is
limited to 20 MB, 80 pages, and 200,000 extracted characters. Image-only scanned
PDFs require OCR and are not supported in the MVP.

```bash
curl -X POST http://localhost:3001/api/extract-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/article"}'
```

### POST /api/extract-youtube

```bash
curl -X POST http://localhost:3001/api/extract-youtube \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=VIDEO_ID"}'
```

### POST /api/extract-file

Send one PDF, DOCX, or TXT file as the raw request body. Include the encoded
filename in the `X-File-Name` header.

### POST /api/export-png

Accepts structured base/ruby text units and renders a transparent PNG with
Chromium's native ruby layout engine.

### GET /api/dictionary

Looks up a Japanese word through a replaceable JMdict-compatible adapter. The
current MVP adapter uses Jisho's public search response and returns at most
three compact entries. Do not treat that third-party endpoint as a permanent
production SLA; a bundled or self-hosted JMdict index is the intended upgrade.

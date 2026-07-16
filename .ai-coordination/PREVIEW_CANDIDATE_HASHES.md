# Preview Candidate Hashes

- Branch: `stabilize/safari-dictionary-20260715`
- Candidate code commit: `9c4da88585534db716a70acacb09e77f68da7bc5`
- Build time (UTC): `2026-07-16T08:24:12Z`
- Cache version: `20260716-01`
- Dist file count: `123`
- Vercel static file count: `123`
- Missing from Vercel static: `[]`
- Extra in Vercel static: `[]`
- SHA-256 mismatches: `[]`
- Candidate aggregate SHA-256: `261b4c457b4288672eb1139fb0421cfc83215c2016bf20a67cc709a6918f6823`
- Comparison result: `PASS — relative paths and every file SHA-256 are identical`

## Automation results

- `npm run build`: PASS
- `frontend/npm run check`: PASS
- `frontend/npm run test:kuromoji`: PASS
- `frontend/npm run test:dictionary`: PASS
- `frontend/npm run audit:ui`: PASS
  - Functional report: `frontend/audit-screenshots/2026-07-16T08-20-39-820Z/ui-audit-report.md`
  - Responsive report: `frontend/audit-screenshots/2026-07-16T08-21-42-951Z/ui-audit-report.md`
- `npx vercel build`: PASS

## Preview deployment

- Preview URL: `https://japanese-tool-7y2vsc4r9-zrq-projects1.vercel.app`
- Deployment ID: `dpl_73jSyHz3LzSBapovuQDziPEtck3H`
- Target: `preview`
- Deployment status: `Ready`

## Release guardrails

- Deployment target: Preview only
- Production URL: `https://yomeru.japanese-hub.com`
- Production deployment ID: `dpl_HYpzrVrM4KGnKNfHjKVqDokkjGfw`
- Production status: `Ready` and unchanged
- Production action: none
- Release status: `HOLD`

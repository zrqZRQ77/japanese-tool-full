# Preview Candidate Hashes

- Branch: `stabilize/safari-dictionary-20260715`
- Candidate code commit: `2e24c4f`
- Build time (UTC): `2026-07-16T10:31:25Z`
- Cache version: `20260716-02`
- Dist file count: `123`
- Vercel static file count: `123`
- Missing from Vercel static: `[]`
- Extra in Vercel static: `[]`
- SHA-256 mismatches: `[]`
- Candidate aggregate SHA-256: `fe8bf67279f8ac05f066281283df247ae95a2c66209fc10334c9bc26eb07424e`
- Comparison result: `PASS — relative paths and every file SHA-256 are identical`

## First-round fixes

- iPhone Safari speech retains the current utterance, splits long articles into short chunks, prioritizes real Japanese voices, and retries once with the system voice.
- A save request made while a dictionary meaning is loading is queued and completed automatically with the final reading and meaning.
- Failed dictionary lookups can still be saved safely as `释义待补充`.
- Compound JMdict fallback is part of the main application flow.
- Visible attribution is simplified to `词典来源：JMdict`; EDRDG remains in the accessible label and licence documentation.
- Unknown JLPT data is displayed as `暂无参考等级`.

## Automation results

- `npm run build`: PASS
- `frontend/npm run check`: PASS
- `frontend/npm run test:kuromoji`: PASS
- `frontend/npm run test:dictionary`: PASS
- `frontend/npm run audit:ui`: PASS
  - Functional report: `frontend/audit-screenshots/2026-07-16T10-28-23-240Z/ui-audit-report.md`
  - Responsive report: `frontend/audit-screenshots/2026-07-16T10-28-37-749Z/ui-audit-report.md`
- `npx vercel build`: PASS

## Preview deployment

- Preview URL: `https://japanese-tool-nlctq0019-zrq-projects1.vercel.app`
- Deployment ID: `dpl_EGRZueDbgJzrJVnXR17SsVacAzpZ`
- Target: `preview`
- Deployment status: `Ready`

## Real-device acceptance

- iPhone Safari single-word speech: PASS
- iPhone Safari full-article continuous speech: PASS
- Save requested during dictionary lookup completes automatically: PASS
- Visible source and reference-level wording: PASS
- First-round real-device acceptance: PASS

## Release guardrails

- Deployment target: Preview only
- Production URL: `https://yomeru.japanese-hub.com`
- Production deployment ID: `dpl_HYpzrVrM4KGnKNfHjKVqDokkjGfw`
- Production status: `Ready` and unchanged
- Production action: none
- Release status: `HOLD` — waiting for the second-round Chinese-definition and JLPT reference-data work

## Second-round candidate — 2026-07-16

- Candidate ID: `preview-candidate-20260716-round-02-f680f92-df4d415c`
- Branch: `stabilize/safari-dictionary-20260715`
- Data commit: `2d449f0`
- Application commit: `f680f92`
- Cache version: `20260716-03`
- Chinese data version: `20260716`
- JLPT reference data version: `20260716`
- Dist file count: `146`
- Vercel static file count: `146`
- Missing from Vercel static: `[]`
- Extra in Vercel static: `[]`
- SHA-256 mismatches: `[]`
- Candidate aggregate SHA-256: `df4d415c3f0cbc9658044232ab119022df491d6a4c0f10a4a37fb38ef3ccff39`
- Comparison result: `PASS — relative paths and every file SHA-256 are identical`
- Functional audit: `frontend/audit-screenshots/2026-07-16T14-08-06-523Z/ui-audit-report.md`
- Responsive audit: `frontend/audit-screenshots/2026-07-16T14-08-25-338Z/ui-audit-report.md`
- Preview deployment: `PENDING — external upload protection requires renewed explicit user approval`
- Production action: `none`; Production deployment remains unchanged.
- Release status: `HOLD — Preview URL/Deployment ID and second-round real-device acceptance remain open`

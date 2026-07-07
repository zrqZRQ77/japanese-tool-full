# Product Decisions

## Deferred Membership Boundary

The MVP keeps all features open for user testing. Before public monetization,
add membership quotas to operations that create material server cost:

- PDF and DOCX upload/extraction
- PNG export through Chromium
- Future OCR and AI features

Keep these core capabilities free unless usage data gives a strong reason to
change them:

- Pasted-text reading and kuromoji analysis in the browser
- PPTX export generated in the browser
- Editable DOCX export generated in the browser
- A small trial allowance for metered features

Do not add payment logic until real usage data is available. First record per
route usage, processing time, failures, and peak concurrency. Remind the product
owner of this decision before implementing accounts, subscriptions, or quotas.

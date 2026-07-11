# Product Decisions

Confirmed future features that are intentionally deferred beyond the MVP are recorded in
[`FUTURE_FEATURES.md`](./FUTURE_FEATURES.md).

## MVP Input Boundary

The public MVP intentionally keeps a narrow, local-first input flow:

- Pasted Japanese text is the core input.
- Text-based PDF upload remains available as a Beta feature in the homepage “More” menu and is parsed in the browser.
- Scanned, image-only, encrypted, and complex-layout PDFs are not guaranteed.
- DOCX upload and automatic URL article extraction are hidden until a later phase.
- External sources open on their original websites; users copy the Japanese text they want to study.
- A PDF parsing failure falls back to pasted text instead of a server or paid upgrade.

The MVP does not expose accounts, subscriptions, Pro labels, usage quotas, or upgrade promises.
The existing backend remains optional future infrastructure and is not required for the public MVP.

## Homepage Entry Hierarchy

- The homepage directly shows “阅读示例” and “开始阅读”.
- The “更多” menu lists “上传 PDF（Beta）”, “水平测试”, and “使用说明” in that order.
- PDF remains discoverable for testing without competing visually with the pasted-text reading flow.

## Global Search Boundary

- Global search only exposes functions that are visible and usable in the public MVP.
- “调整今日目标” is hidden together with the unfinished goal-setting surface.
- “学习历史” is described as “查看学习日历、进度和今日建议” so the search result matches the current page.

## Reading Export Boundary

- The public MVP exports reading results as editable PPTX, PNG, or JPEG.
- DOCX export is not a current product capability and is not shown in the export menu.
- PPTX provides the MVP's editable-output path; DOCX should only be reconsidered after users demonstrate a distinct Word-editing need and compatibility has been tested.

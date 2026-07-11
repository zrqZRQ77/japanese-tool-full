# UI Audit Report

Started: 2026-07-10T05:50:33.126Z
URL: http://127.0.0.1:5174/index.html
Result: CHECK NEEDED

## Summary

- Failed steps: 1
- Issues: 1
- Console warnings/errors: 1

## Steps

- OK: state: initial
- OK: open app
- OK: state: reading
- OK: reading import
- OK: state: vocab added
- OK: word detail and vocab add
- FAIL: vocab page and flashcard - locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('#vocabDueTool')

- OK: state: typing
- OK: typing practice
- OK: state: history
- OK: history page
- OK: state: delete confirm
- OK: delete confirmation
- OK: state: grammar persisted
- OK: grammar add and persistence
- OK: state: grammar deleted
- OK: grammar delete icon and delete flow
- OK: viewport: mobile-390
- OK: viewport: mobile-430
- OK: viewport: desktop-1280

## Viewports

- mobile-390 (390x844): overflowX=false, screenshot=/Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/viewport-mobile-390.png
- mobile-430 (430x932): overflowX=false, screenshot=/Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/viewport-mobile-430.png
- desktop-1280 (1280x720): overflowX=false, screenshot=/Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/viewport-desktop-1280.png

## Issues

- [error] vocab page and flashcard: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('#vocabDueTool')


## Console

- [warning] kuromoji 加载失败,已退回内置词库 Error: 智能分词词典加载超时
    at http://127.0.0.1:5174/app.js?v=20260710-04:1002:35

## Screenshots

- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/01-initial.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/02-reading.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/03-word-added.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/05-typing.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/06-history.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/07-delete-confirm.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/08-grammar-saved.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/09-grammar-delete-icon.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/10-grammar-delete-confirm.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/viewport-mobile-390.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/viewport-mobile-430.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T05-50-33-123Z/viewport-desktop-1280.png

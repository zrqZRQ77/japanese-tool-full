# UI Audit Report

Started: 2026-07-10T04:02:41.862Z
URL: http://127.0.0.1:5175/index.html
Result: CHECK NEEDED

## Summary

- Failed steps: 1
- Issues: 1
- Console warnings/errors: 0

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

- mobile-390 (390x844): overflowX=false, screenshot=/Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/viewport-mobile-390.png
- mobile-430 (430x932): overflowX=false, screenshot=/Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/viewport-mobile-430.png
- desktop-1280 (1280x720): overflowX=false, screenshot=/Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/viewport-desktop-1280.png

## Issues

- [error] vocab page and flashcard: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('#vocabDueTool')


## Screenshots

- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/01-initial.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/02-reading.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/03-word-added.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/05-typing.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/06-history.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/07-delete-confirm.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/08-grammar-saved.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/09-grammar-delete-icon.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/10-grammar-delete-confirm.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/viewport-mobile-390.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/viewport-mobile-430.png
- /Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-10T04-02-41-860Z/viewport-desktop-1280.png

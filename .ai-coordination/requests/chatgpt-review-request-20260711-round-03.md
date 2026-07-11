# ChatGPT 网页端审查请求：2026-07-11 Round 03 最终复核

## 基线与权限

- 基线：`main / 5a7cd28 + 当前未提交修改 / 缓存 20260711-10`
- 唯一允许新建：`.ai-coordination/reviews/chatgpt-review-20260711-round-03.md`
- 不得修改业务代码、正式资料、协作文件或任何已有报告。

## 必须读取

1. `CODEX_CHATGPT_PRELAUNCH_COLLABORATION_PLAN.md`
2. `.ai-coordination/README.md`
3. `.ai-coordination/CURRENT_BASELINE.md`
4. `.ai-coordination/CODEX_STATUS.md`
5. `.ai-coordination/ISSUE_QUEUE.md`
6. `PRE_LAUNCH_TEST_REPORT.md`
7. `PRE_LAUNCH_CHECKLIST.md`
8. `frontend/audit-screenshots/2026-07-11T12-33-50-244Z/ui-audit-report.md`
9. `frontend/stage4-results/2026-07-11T12-30-28-135Z/stage4-report.md`
10. `frontend/tools/stage4-audit.mjs`
11. `.ai-coordination/reviews/REVIEW_TEMPLATE.md`

## 最终复核任务

1. 核对 PDF 五类、备份覆盖恢复、SEC-001/SEC-002、五种导出和 localStorage 三类异常的证据是否支持正式报告状态。
2. 核对 DATA-001、EXPORT-001、SEC-001 是否可以保持 VERIFIED，是否仍存在未解决 P0/P1。
3. 核对正式资料是否准确保留 Safari/iPhone、移动端真实下载、PPTX PowerPoint/Keynote 视觉打开和线上当前版本为 PENDING。
4. 检查是否存在证据夸大、状态矛盾或新 P0/P1。
5. 给出“允许上线 / 带条件上线 / 暂缓上线”的建议，但最终结论由本地 Codex记录。

完成后聊天窗口只回复报告路径和一句总体结论。

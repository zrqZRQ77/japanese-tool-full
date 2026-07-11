# 当前审查基线

> 由本地 Codex维护。开始正式检查时填写；未填写字段不得由 ChatGPT 网页端推测。

- 基线时间：2026-07-11 20:37 CST
- 审查轮次：Round 03 最终复核
- 当前分支：`main`
- 当前提交号：`5a7cd286077e8683478736a7738e41f70a6658f9`
- 工作区是否有未提交修改：是
- 未提交修改文件列表：
  - 本轮 Codex 修改：`MVP_LOGIC_CLOSURE_REVIEW.md`、`PRE_LAUNCH_CHECKLIST.md`、`PRE_LAUNCH_TEST_REPORT.md`、`README.md`、`frontend/app.js`、`frontend/index.html`、`frontend/tools/check.mjs`、`frontend/tools/ui-audit.mjs`
  - 本地进度记录：`LOCAL_PROGRESS_CHECKPOINT_2026-07-11.md`
  - 用户/既有变更（不得由网页端修改）：协作规划、`.ai-coordination/`、视觉快照删除与新增、自动审计产物
- 本轮实际审查文件：上述本轮 Codex 修改文件、`.ai-coordination/` 中当前状态资料、最新完整 UI 审计报告及 Round 01 审查与处理核对报告
- 最新构建和测试命令、时间及结果：
  - 根目录 `npm test`｜2026-07-11 20:36 CST｜PASS（部署构建）
  - `cd frontend && npm test`｜2026-07-11 20:33 CST｜PASS（完整核心 UI 审计及视觉验证）
  - `cd frontend && npm run verify:stage4`｜2026-07-11 20:59 CST｜PASS 12 / FAIL 0
  - 同轮沙箱内 Chromium 启动｜2026-07-11 18:51 CST｜BLOCKED（macOS Mach Port 权限；属于环境阻塞，不覆盖随后沙箱外 PASS）
- 自动审计结果目录：当前有效 PASS 为 `frontend/audit-screenshots/2026-07-11T12-33-50-244Z/`
- 阶段四专项目录：`frontend/stage4-results/2026-07-11T12-59-42-647Z/`（PASS 12 / FAIL 0）
- 当前审计摘要：失败步骤 0、问题 0、控制台警告/错误 0、Tokenizer mode `built-in`；SEC-002 恶意协议拒绝通过；390 × 844、430 × 932、1280 × 720 均完成菜单、阅读导入和生词本导航且无横向溢出
- 审计环境元数据：Chromium `149.0.7827.55`、Playwright bundled Chromium、提交 `5a7cd28`、dirty worktree、缓存 `20260711-10`
- 视觉截图版本：`frontend/visual-snapshots/20260711-10-states/` 和 `frontend/visual-snapshots/20260711-10/`
- 当前前端缓存版本：`20260711-10`
- 证据边界：本地 Chromium 已覆盖 PDF 五类、备份恢复、SEC-001、实际导出及 localStorage 三类异常；Safari/iPhone、移动端真实下载、PPTX 在 PowerPoint/Keynote 中视觉打开及当前线上版本仍需真实环境确认

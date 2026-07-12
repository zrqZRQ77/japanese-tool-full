# 当前审查基线

> 由本地 Codex维护。未执行的项目不得从其他基线继承 PASS。

- 基线时间：2026-07-12 16:09 CST
- 审查轮次：Round 04 两项 P2 处理后基线
- 当前分支：`main`
- 当前提交号：`4688793ad122f14d2e3ea96bf4029fa4ea7310dc`
- GitHub 状态：GitHub API 已确认远端 `main` 指向 `4688793`
- 当前工作区前端缓存版本：`20260712-03`
- 最近已确认线上缓存版本：`20260712-02`
- 工作区是否有未提交修改：是
- 本轮 Codex 修改：`frontend/app.js`、`frontend/index.html`、`.ai-coordination/` 当前状态资料、`PRE_LAUNCH_TEST_REPORT.md`、`PRE_LAUNCH_CHECKLIST.md`
- 用户/既有变更（不得纳入本轮提交）：历史视觉快照删除、自动审计与阶段四产物、`Reference_Books/`、`tmp/`
- 最近构建：根目录 `npm test`｜2026-07-12 16:05 CST｜PASS
- 最近静态检查：`cd frontend && npm run check`｜2026-07-12 16:06 CST｜PASS
- 最近定向 UI 审计：`frontend/audit-screenshots/2026-07-12T08-07-00-122Z/ui-audit-report.md`｜PASS
- 审计元数据：Playwright bundled Chromium `149.0.7827.55`、Git `4688793` dirty worktree、缓存 `20260712-03`、失败步骤 0、问题 0、控制台警告/错误 0
- 真实设备与线上证据：用户确认最新 GitHub/Vercel 版本已在手机端复测，左侧 Y 菜单、阅读显示设置、词汇/语法入口分离及长按选中短句“保存为语法”均正常
- 外部网络检查：当前 Codex 环境访问 Vercel 两次超时，记为环境 `BLOCKED`，不覆盖用户真实设备 PASS
- 仍为 PENDING：Mac/iPhone 的完整端到端核心闭环、其他移动浏览器、当前版本的线上 PDF/备份专项复测
- 已有历史真实验收：PPTX 可由 PowerPoint/Keynote 打开；移动端实际下载可用；JSON 备份可下载

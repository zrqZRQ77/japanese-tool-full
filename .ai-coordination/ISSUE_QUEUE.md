# 唯一问题队列

> 由本地 Codex维护。网页端报告中的问题必须由 Codex复现、去重和定级后才能进入本队列。

## 当前问题

### DOC-001

- 来源：ChatGPT 网页端 Round 01
- 基线：`main / 5a7cd28 / 20260711-07`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`MVP_LOGIC_CLOSURE_REVIEW.md`、`PRE_LAUNCH_CHECKLIST.md`、`PRE_LAUNCH_TEST_REPORT.md`
- 发现：正式资料混合历史结论、当前状态和待验证事项。
- 复现方式或证据：逐项对照第一轮基线代码、正式资料和审计产物，确认成立。
- 证据层级：静态代码与文档审查
- 证据位置：Round 01、Round 02 报告及当前正式资料
- 预期结果：明确区分历史发现、当前状态、证据层级和最终结论。
- 处理结论：Round 03 再次确认旧引用复发；现已统一到缓存 `20260711-10`、UI 报告 `12-33-50-244Z` 和专项报告 `12-59-42-647Z`，外部验收独立保留 PENDING。

### TEST-001

- 来源：ChatGPT 网页端 Round 01
- 基线：`main / 5a7cd28 / 20260711-07`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`PRE_LAUNCH_TEST_REPORT.md`、UI审计产物
- 发现：有效 PASS、后续环境 BLOCKED 与正式 PENDING 未统一。
- 复现方式或证据：核对提交时间、缓存版本、`07-51-55` PASS 和后续 BLOCKED 报告。
- 证据层级：测试产物与文档审查
- 证据位置：旧 PASS/BLOCKED 报告与当前 PASS `frontend/audit-screenshots/2026-07-11T12-33-50-244Z/`
- 预期结果：PASS 仅归属对应基线；BLOCKED 和 PENDING 分开记录。
- 处理结论：正式测试报告已分离历史环境 BLOCKED 与当前沙箱外 PASS，并绑定缓存和报告路径。

### TEST-002

- 来源：ChatGPT 网页端 Round 01
- 基线：`main / 5a7cd28 / 20260711-07`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`frontend/app.js`、`frontend/tools/ui-audit.mjs`
- 发现：UI审计未记录实际 tokenizer mode。
- 复现方式或证据：检查旧审计 JSON 和两条分词路径，确认成立。
- 证据层级：静态代码与本地运行自动化测试
- 证据位置：Round 01报告、当前未提交差异、`frontend/audit-screenshots/2026-07-11T12-33-50-244Z/`
- 预期结果：页面和报告明确记录 `built-in` 或 `kuromoji`。
- 处理结论：页面已暴露 mode，审计已新增记录；当前缓存完整审计 PASS 并明确报告 `Tokenizer mode: built-in`。

### COPY-001

- 来源：ChatGPT 网页端 Round 01
- 基线：`main / 5a7cd28 / 20260711-07`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`frontend/index.html`、`frontend/tools/check.mjs`
- 发现：“Anki牌组”与实际 TSV 导出能力不一致。
- 复现方式或证据：对照 SEO 描述和 `exportAnkiTsv()`，确认成立。
- 证据层级：静态代码与文案审查
- 证据位置：Round 01报告
- 预期结果：准确描述为可导入 Anki 的生词文件。
- 处理结论：文案已修正，并增加静态防回归检查。

### DEPLOY-001

- 来源：ChatGPT 网页端 Round 01 / 用户线上验收
- 基线：`main / 5a7cd28 / 20260711-07`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`scripts/build-frontend.mjs`、`README.md`
- 发现：构建产物曾漏掉页面引用的 `analytics.js`，部署说明与真实构建不一致。
- 复现方式或证据：对照 `index.html`、旧构建清单和 Vercel 首次访问。
- 证据层级：静态代码审查＋真实线上验收
- 证据位置：Round 01报告；用户线上截图
- 预期结果：构建包含所有本地资源，README明确推荐部署路径。
- 处理结论：构建已补齐并增加本地资源校验；用户线上确认文件正常；README已同步。

### DATA-001

- 来源：ChatGPT 网页端 Round 01
- 基线：`main / 5a7cd28 / 20260711-07`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`frontend/app.js`、`frontend/tools/check.mjs`
- 发现：水平测试重置及内联 TTS/清除数据逻辑曾绕过 `safeStorage` 直接操作 localStorage。
- 复现方式或证据：检查 `resetLevelTest()`，确认成立。
- 证据层级：静态代码审查与本地 Chromium 动态测试
- 证据位置：Round 01报告；`frontend/stage4-results/2026-07-11T12-59-42-647Z/`
- 预期结果：存储异常不会中断重置流程。
- 处理结论：使用正确的 `reading_vocab_list` 键；损坏数据，以及禁用/容量满时的水平测试重置、音色保存和数据清除均无未捕获异常。

### TEST-003

- 来源：ChatGPT 网页端后续建议 / 本地 Codex复现
- 基线：当前未提交修改 / 缓存 `20260711-08`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`frontend/tools/ui-audit.mjs`
- 发现：审计曾自动选择系统 Chrome，启动出现 SIGABRT 和 kill EPERM。
- 复现方式或证据：旧运行未进入页面；修复后使用 Playwright bundled Chromium 在沙箱外完成当前缓存完整审计。
- 证据层级：本地运行
- 证据位置：旧 BLOCKED 报告；当前 PASS `frontend/audit-screenshots/2026-07-11T12-33-50-244Z/`
- 预期结果：默认使用 Playwright bundled Chromium；只有显式设置时使用系统浏览器。
- 处理结论：默认启动逻辑已修复；当前报告自记录 Playwright bundled Chromium、浏览器版本、Git 和缓存 `20260711-10`，失败步骤、问题和控制台警告/错误均为 0。

### TEST-004

- 来源：ChatGPT 网页端 Round 02
- 基线：`main / 5a7cd28 + 未提交修改 / 缓存 20260711-08`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`frontend/tools/ui-audit.mjs`、`PRE_LAUNCH_TEST_REPORT.md`
- 发现：旧 viewport 步骤重新进入 first-visit，只检查横向溢出，并静默吞掉生词本导航失败，不能支持“手机主流程”表述。
- 复现方式或证据：核对旧脚本与 `10-52-21-510Z` JSON，确认三个尺寸均为 first-visit、无阅读且关键区域尺寸为 0。
- 证据层级：静态审查与本地运行自动化测试
- 证据位置：Round 02 报告；当前 PASS `frontend/audit-screenshots/2026-07-11T12-33-50-244Z/`
- 预期结果：每个尺寸显式进入确定应用状态，导航失败不可静默忽略，并断言关键区域可见。
- 处理结论：390/430/1280 均显式完成“展开更多菜单 → 导入阅读 → 打开生词本”，断言 view、hasReading、导航和内容区域尺寸及横向溢出；当前回归 PASS。真实 iPhone Safari 仍为 PENDING。

### TEST-005

- 来源：ChatGPT 网页端 Round 02
- 基线：`main / 5a7cd28 + 未提交修改 / 缓存 20260711-08`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`frontend/tools/ui-audit.mjs`
- 发现：旧 UI 审计报告缺少浏览器来源、版本、Git 和缓存元数据，无法独立追溯 TEST-003 与基线。
- 复现方式或证据：核对旧报告头部和报告生成代码，确认成立。
- 证据层级：静态审查与本地运行自动化测试
- 证据位置：Round 02 报告；当前 PASS `frontend/audit-screenshots/2026-07-11T12-33-50-244Z/`
- 预期结果：报告记录浏览器版本、可执行文件来源、Git 提交/工作区和前端缓存版本。
- 处理结论：JSON 与 Markdown 已记录全部元数据，当前缓存完整回归 PASS。

### EXPORT-001

- 来源：本地 Codex 静态审查
- 基线：当前未提交修改 / 缓存 `20260711-08`
- 等级：P1
- 状态：VERIFIED
- 涉及文件：`frontend/app.js`、`frontend/tools/check.mjs`
- 发现：阅读材料导出路径无条件调用 `initKuromoji()`，会绕过 MVP 的远程智能分词安全开关，重新引入首次访问卡顿或崩溃风险。
- 复现方式或证据：沿 `collectExportRubyUnits()` 调用链静态复现，确认开关仅用于阅读渲染路径。
- 证据层级：静态代码审查、本地 Chromium 动态测试与文件检查
- 证据位置：当前工作区差异；`frontend/stage4-results/2026-07-11T12-59-42-647Z/`
- 预期结果：远程智能分词关闭时，导出只使用页面已生成的本地假名标注。
- 处理结论：PPTX、PNG、JPEG、CSV、TSV 均实际下载；图片已人工查看，文本编码与内容正确，PPTX OOXML 完整。PowerPoint/Keynote 视觉打开仍为外部抽查。

### SEC-001

- 来源：本地 Codex 静态审查
- 基线：当前未提交修改 / 缓存 `20260711-08`
- 等级：P1
- 状态：VERIFIED
- 涉及文件：`frontend/app.js`、`frontend/tools/check.mjs`
- 发现：阅读历史恢复直接把备份中的 `annotatedHtml` 写入 `innerHTML`，恶意备份可形成持久型 XSS；通用 HTML 转义函数也未转义引号，不足以保护属性值。
- 复现方式或证据：沿备份导入、历史规范化、历史恢复链路静态复现；检查多处属性模板使用 `escapeHtml()`。
- 证据层级：静态代码审查与本地 Chromium 动态测试
- 证据位置：当前工作区差异；`frontend/stage4-results/2026-07-11T12-59-42-647Z/`
- 预期结果：历史恢复仅从纯文本重新渲染；属性内容中的单双引号均被编码。
- 处理结论：完整执行“恶意备份导入 → 打开历史文章 → 进入语法本 → 刷新”；脚本标记始终未变化，阅读输出和语法本未生成 script/img 恶意节点。

### SEC-002

- 来源：ChatGPT 网页端 Round 02
- 基线：`main / 5a7cd28 + 未提交修改 / 缓存 20260711-08`
- 等级：P1
- 状态：VERIFIED
- 涉及文件：`frontend/app.js`、`frontend/tools/check.mjs`、`frontend/tools/ui-audit.mjs`
- 发现：恶意备份可写入未限制协议的阅读历史 URL，随后成为可点击链接；HTML 属性转义不能替代 URL 协议白名单。
- 复现方式或证据：沿备份导入、历史规范化与链接渲染链路静态复现；确认 `String(item.url)` 接受 `javascript:` 与 `data:`。
- 证据层级：静态代码审查与本地 Chromium 动态测试
- 证据位置：Round 02 报告；当前 PASS `frontend/audit-screenshots/2026-07-11T12-33-50-244Z/`
- 预期结果：历史 URL 仅接受 HTTP(S)，无效协议清空且不渲染为链接。
- 处理结论：历史规范化复用 `readingQueueUrl()` HTTP(S) 白名单；新增静态断言，并在 Chromium 中验证 `javascript:`、`data:` 和空白混淆协议均被拒绝。

### TEST-006

- 来源：ChatGPT 网页端 Round 03
- 基线：`main / 5a7cd28 + 未提交修改 / 缓存 20260711-10`
- 等级：P1（核心上线门槛验证项）
- 状态：VERIFIED
- 涉及文件：`frontend/tools/stage4-audit.mjs`、`PRE_LAUNCH_TEST_REPORT.md`
- 发现：旧审计只进入并翻转闪卡，没有验证生词刷新持久化、完成评分、结束状态和学习历史。
- 复现方式或证据：对照旧 UI 审计步骤确认成立。
- 证据层级：本地 Chromium 动态测试
- 证据位置：`frontend/stage4-results/2026-07-11T12-59-42-647Z/`
- 预期结果：收藏后刷新仍存在，完整一轮评分后显示完成并持久化复习状态和历史。
- 处理结论：单词“毎朝”刷新后仍存在；评分“记住了”后显示“复习完成”，`lastPracticeRating`、`repetition` 和 practice history 均正确持久化。

### TEST-007

- 来源：ChatGPT 网页端 Round 03
- 基线：`main / 5a7cd28 + 未提交修改 / 缓存 20260711-10`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`frontend/tools/stage4-audit.mjs`
- 发现：旧损坏数据用例使用错误生词键，禁用/容量满只验证页面启动。
- 复现方式或证据：对照应用实际键 `reading_vocab_list` 和旧测试步骤确认成立。
- 证据层级：本地 Chromium 动态测试
- 证据位置：`frontend/stage4-results/2026-07-11T12-59-42-647Z/`
- 预期结果：使用正确键；存储禁用/容量满时真实动作不得产生未捕获异常。
- 处理结论：正确键损坏降级通过；水平测试重置、音色保存和数据清除在禁用/容量满上下文均完成且无未捕获异常。

## 问题模板

```text
编号：AREA-001
来源：本地 Codex / ChatGPT 网页端 / 用户
基线：
等级：P0 / P1 / P2 / P3
状态：NEW / CONFIRMED / FIXING / FIXED / VERIFIED / REJECTED / DEFERRED
涉及文件：
发现：
复现方式或证据：
证据层级：
证据位置：
预期结果：
处理结论：
```

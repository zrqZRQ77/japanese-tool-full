# 唯一问题队列

> 由本地 Codex维护。网页端报告中的问题必须由 Codex复现、去重和定级后才能进入本队列。

## 当前问题

### DOC-002

- 来源：ChatGPT 网页端 Round 04
- 基线：`main / 4688793 / 缓存 20260712-02`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`PRE_LAUNCH_TEST_REPORT.md`
- 发现：生词复习表重复使用 `VOCAB-07`、`VOCAB-08`，同一能力同时存在 PASS 与 PENDING。
- 复现方式或证据：静态核对测试表与阶段四报告，确认重复编号和证据归属冲突。
- 证据层级：静态代码与文档审查。
- 证据位置：`PRE_LAUNCH_TEST_REPORT.md` 4.2；`frontend/stage4-results/2026-07-11T12-59-42-647Z/stage4-report.md`
- 预期结果：每个测试编号唯一，刷新、单词复习完成、完成状态和历史分别只有一个状态。
- 是否阻止上线：否。
- 处理结论：删除重复行，将既有阶段四证据归并到 `VOCAB-03`、`VOCAB-07`、`VOCAB-08`、`VOCAB-09`，四项统一为 PASS；未执行项目不受影响。

### COPY-002

- 来源：ChatGPT 网页端 Round 04
- 基线：`main / 4688793 / 缓存 20260712-02`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`frontend/app.js`、`frontend/index.html`
- 发现：网页 URL 和不支持文件错误提示直接向用户显示“MVP 暂不”“MVP 当前只支持”。
- 复现方式或证据：静态搜索确认三处用户可见字符串。
- 证据层级：静态代码与文档审查＋本地运行与自动化测试。
- 证据位置：`frontend/audit-screenshots/2026-07-12T08-07-00-122Z/ui-audit-report.md`
- 预期结果：使用普通用户可理解的能力边界文案，保留 PDF Beta 边界但不显示开发阶段术语。
- 是否阻止上线：否。
- 处理结论：三处文案分别改为“暂不支持自动读取网页正文”和“目前支持文字型 PDF（Beta）”；缓存升级为 `20260712-03`，静态检查与 UI 回归 PASS。

### USER-REAL-004

- 来源：用户桌面 Chrome / iPhone Safari 定向验收（2026-07-12）
- 基线：`main / 4688793 / 缓存 20260712-02`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`frontend/app.js`、`frontend/index.html`、`frontend/design-system.css`
- 发现：普通词与语法保存入口混合；桌面选中短句时出现面向开发者的 AI/MVP 文案；iPhone 长按选中短句后没有可见的“保存为语法”入口。
- 复现方式或证据：用户桌面与手机实测；本地静态调用链检查；UI 自动回归。
- 证据层级：真实设备与线上验收＋本地运行与自动化测试。
- 预期结果：普通词只进入生词本；明确语法关联现有语法资料；复杂片段允许手动保存；用户界面不出现开发阶段术语；手机选择文字后入口可见。
- 处理结论：已按保守规则拆分词汇/语法动作，保留手动选择兜底；替换开发阶段文案；补充 iOS `touchend/selectionchange` 处理和手机底部选择操作卡。用户确认部署后的手机端测试无问题。

### USER-REAL-003

- 来源：用户第三轮 iPhone Safari 反馈（2026-07-12）
- 基线：`main / 29e9fd9 / 缓存 20260712-01`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`frontend/app.js`、`frontend/index.html`、`frontend/styles.css`、`frontend/design-system.css`、`frontend/tools/ui-audit.mjs`
- 发现：手机统一菜单视觉设计过多；阅读工具同时存在两套提示，其中内部伪元素提示受滚动工具栏裁切；手机 ruby 与正文距离略远。
- 复现方式或证据：用户实机反馈；静态检查确认 CSS 伪元素与页面级提示并存，页面级提示节点此前未实际挂载。
- 证据层级：真实设备反馈、静态审查、本地 Chromium 动态回归与视觉截图。
- 预期结果：手机菜单复用桌面侧栏语言；只保留一个不会被父容器裁切的页面级提示；手机 ruby 距离小幅缩短且继续响应阅读显示设置。
- 处理结论：手机抽屉改为与桌面一致的单列图标导航和纯白背景；移除内部伪元素提示并补齐固定定位提示节点；手机 ruby 偏移使用当前设置值的 60%。390/430/1280 回归 PASS；用户确认部署后相关手机端项目无问题。

### USER-REAL-002

- 来源：用户第二轮 Mac Safari / iPhone Safari 实机复测（2026-07-12）
- 基线：`main / 3cba6c8 / 缓存 20260711-11`
- 等级：P1
- 状态：VERIFIED
- 涉及文件：`frontend/app.js`、`frontend/index.html`、`frontend/styles.css`、`frontend/design-system.css`、`frontend/tools/ui-audit.mjs`
- 发现：`丁寧` ruby 正确但系统 TTS 误读；Safari ruby 开关无效；手机重复导航、工具提示遮挡、闪卡越界；iPhone 录音点击无反馈。
- 复现方式或证据：用户在最新线上版本逐项复测；本地检查确认后加载的 `design-system.css` 覆盖了旧修复，录音权限查询也会让 iOS Safari 丢失直接点击手势。
- 证据层级：真实设备反馈、静态调用链审查、本地 Chromium 动态回归与 Safari 能力模拟。
- 预期结果：TTS 使用核验读音；Safari ruby 可切换；手机只保留统一顶部菜单；闪卡不越界；无语音识别时仍能真实录音并回放。
- 处理结论：TTS 输入将 `丁寧` 替换为 `ていねい`；ruby 始终保留 `rt` 并以字号/可见性切换；移除手机底部导航并重做顶部菜单；统一最高层工具提示；闪卡及父容器按 viewport 限宽；录音直接请求麦克风，Safari 无转写能力时使用 MediaRecorder 录音回放。自动审计 PASS，用户后续实机确认录音及相关手机端项目正常。

### USER-REAL-001

- 来源：用户 Mac Safari / iPhone Safari / PowerPoint / Keynote 实机验收（2026-07-11 21:17–21:49）
- 基线：`main / b944085 / 用户当前线上版本`
- 等级：P1
- 状态：FIXED（缓存 `20260711-11` 自动回归 PASS，等待重新部署后的实机复核）
- 涉及文件：`frontend/app.js`、`frontend/index.html`、`frontend/styles.css`、`frontend/data/dictionary.json`
- 发现：错误假名、纯假名重复注音、生词编辑占位、手机闪卡越界、录音无反馈、弹窗操作错位及多个移动端布局问题。
- 复现方式或证据：用户提供 14 张 Mac 与 iPhone 截图，并确认 PPTX、备份和移动下载的真实结果。
- 证据层级：真实设备验收。
- 预期结果：纠正内容错误，所有可见操作均有真实行为，窄屏无横向越界或遮挡。
- 处理结论：已纠正 `丁寧` 旧覆盖并加入 `でも`；假名默认关闭，纯假名不导出 ruby；接入正式生词编辑弹窗、阅读页保存语法和手机统一主菜单；修复手机闪卡、打字顺序、试听、首页次操作、工具栏、导出按钮与不支持语音识别时的打字回退。缓存 `20260711-11` 的 390/430/1280 回归 PASS、无横向溢出或控制台错误，仍需更新线上版本后由相同设备复核。

### CONTENT-001

- 来源：用户 Mac Safari PDF 实测
- 基线：`main / b944085 / 用户当前线上版本`
- 等级：P1
- 状态：FIXING
- 涉及文件：`frontend/app.js`
- 发现：任意 PDF 的本地逐词拼接会形成看似完整但不可靠的中文翻译，复杂 PDF 的断行与假名覆盖有限。
- 复现方式或证据：用户实机截图显示错误翻译、断行和无假名。
- 证据层级：真实设备验收。
- 预期结果：不展示虚假翻译；明确 MVP 的本地翻译边界；复杂 PDF 解析留作专项增强。
- 处理结论：本轮已移除未知句子的词义拼接，只对内置且可核验的句子给译文；复杂 PDF 版面重建和完整翻译服务仍未完成，不标记 PASS。

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

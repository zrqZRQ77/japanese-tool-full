# ChatGPT 网页端审查报告

## 审查信息

- 审查时间：2026-07-11（Round 02 只读审查）
- 审查轮次：Round 02
- 代码基线：`main / 5a7cd286077e8683478736a7738e41f70a6658f9 + 当前未提交修改 / 缓存 20260711-08`，基线时间为 2026-07-11 19:50 CST
- 审查范围：Round 01 问题处理、当前 Chromium 自动审计及视觉证据、三份正式上线资料、`frontend/app.js`、`frontend/index.html`、`frontend/tools/check.mjs`、`frontend/tools/ui-audit.mjs`，以及 EXPORT-001、SEC-001 和剩余动态测试边界。本轮没有执行浏览器、PDF、文件导出或真实设备测试。
- 本轮是否修改业务文件：否
- 本轮是否编辑或删除已有审查报告：否

## 总体结论

当前 `10-52-21-510Z` 产物足以证明报告列出的本地 Chromium 自动化步骤完成且结果为 PASS，并能支持 TEST-002 的 `built-in` 分词模式记录、语法笔记刷新后保留及删除后从 localStorage 移除。代码也已把 Chromium 默认启动策略改为不指定系统浏览器路径，EXPORT-001、SEC-001 和 DATA-001 的修复方向及静态防回归断言均成立。

但本轮仍不能支持“无条件上线”。`PRE_LAUNCH_TEST_REPORT.md` 仍把当前缓存写成 BLOCKED、把最新有效证据写成 `20260711-07`，与当前基线、最新 PASS 和 `20260711-08` 视觉产物直接矛盾，因此 DOC-001 不能进入 VERIFIED，TEST-001 的正式资料闭环也需重新核对。三个 viewport 步骤只证明当时页面没有横向溢出，实际状态为 first-visit、无阅读结果且主要应用区域尺寸为 0，不能证明手机核心流程或下拉菜单已经通过。审计报告本身也没有记录浏览器可执行文件来源、浏览器版本、提交号或缓存版本，所以 TEST-003 中“默认 bundled Chromium”可由代码确认，而“本次运行确实使用 bundled Chromium 且精确归属于当前缓存”仍依赖 `CURRENT_BASELINE.md` 的执行记录，报告不能独立自证。

此外发现一个需要本地 Codex 优先复现的新安全风险：恶意备份可以向阅读历史写入未限制协议的 `url`，该值随后直接成为可点击链接的 `href`。HTML 转义不能替代 URL 协议白名单；`javascript:`、`data:` 等协议是否可形成可利用行为需浏览器动态确认。未发现新的确定性 P0，但在该风险和既有 P1 动态验证完成前，不应宣告 P1 为零。

## Round 01 与当前问题状态复核

| 编号 | 本轮独立复核结论 | 建议状态 |
|---|---|---|
| DOC-001 | 三份正式资料未完全同步；测试报告仍保留旧缓存 PASS/BLOCKED 结论和旧视觉版本。 | 不进入 VERIFIED；建议 Codex 重新置为 CONFIRMED / FIXING，或继续 FIXED 但明确尚未完成 |
| TEST-001 | 当前基线资料能区分沙箱 BLOCKED 与沙箱外 PASS，但正式测试报告仍把当前缓存写成 BLOCKED，闭环不完整。 | 建议随 DOC-001 重新复核，不宜仅凭问题队列保持 VERIFIED |
| TEST-002 | 页面暴露 tokenizer mode，最新 JSON 和 Markdown 均记录 `built-in`，当前阅读步骤动态通过。 | 可以保持 VERIFIED |
| COPY-001 | 当前 meta 文案为“导出可导入 Anki 的生词文件”，静态检查也防止旧文案回归。 | 可以保持 VERIFIED；实际 TSV 内容和 Anki 导入仍是独立 PENDING |
| DEPLOY-001 | 构建脚本已包含 `analytics.js` 并校验 `index.html` 的本地资源，README 与根目录部署路径一致；本轮未重新执行线上验收。 | 现有 VERIFIED 仍有静态及既有线上证据支持 |
| DATA-001 | `resetLevelTest()` 已改用 `safeStorage.removeItem()`，静态断言成立；禁用 localStorage 时的实际行为没有动态证据。 | 保持 FIXED；不建议整体进入 VERIFIED |
| TEST-003 | 默认启动代码已不再自动选择系统 Chrome；最新审计完成 PASS。报告未记录实际 executable source、浏览器版本、提交号和缓存版本。 | 核心审计 PASS 可确认；bundled Chromium 和当前缓存归属依赖基线执行记录，建议补强证据后再视为完全自证 |
| EXPORT-001 | 远程分词关闭时 `collectExportRubyUnits()` 直接使用页面现有标注，静态断言成立。 | 保持 FIXED；实际 PPTX、PNG、JPEG 文件与无远程字典请求仍需动态测试 |
| SEC-001 | 历史文章恢复已从纯文本重新渲染，单双引号已转义，静态断言成立。 | 保持 FIXED；恶意输入和恶意备份 XSS 动态测试完成前不得标 VERIFIED |

## 问题清单

### DOC-001：正式测试报告仍与 Round 02 当前基线矛盾

- 建议等级：P2
- 证据层级：静态代码与文档审查
- 涉及文件：`PRE_LAUNCH_TEST_REPORT.md`、`PRE_LAUNCH_CHECKLIST.md`、`MVP_LOGIC_CLOSURE_REVIEW.md`、`.ai-coordination/CURRENT_BASELINE.md`、`.ai-coordination/CODEX_STATUS.md`
- 发现：`PRE_LAUNCH_TEST_REPORT.md` 顶部仍写“最近有效完整审计”为 `20260711-07`、当前 `20260711-08` 为 BLOCKED；FLOW-AUTO、TEST-002、TEST-003、最终门槛和最终结论仍沿用该旧状态，视觉证据也仍指向 `20260711-07-states`。当前基线则记录 `10-52-21-510Z` 为沙箱外 PASS，并存在 `20260711-08` 两套视觉 manifest。`MVP_LOGIC_CLOSURE_REVIEW.md` 已清楚标注历史性质，`PRE_LAUNCH_CHECKLIST.md` 也保留了大量 PENDING，但三份资料尚未形成统一、可追溯的当前状态。
- 证据位置：`PRE_LAUNCH_TEST_REPORT.md` 第 7～15、104～106、338～356、388～393 行；`.ai-coordination/CURRENT_BASELINE.md` 第 15～24 行；`frontend/visual-snapshots/20260711-08/manifest.json`；`frontend/visual-snapshots/20260711-08-states/manifest.json`
- 可能影响：上线判断会错误地把已完成的当前 Chromium 回归视为 BLOCKED，同时也可能让读者误以为旧缓存的视觉结果就是当前证据；问题状态、门槛勾选和后续测试排序会继续失真。
- 建议：以 `CURRENT_BASELINE.md` 为本轮事实源一次性更新正式测试报告中的基线、FLOW-AUTO、VISUAL-AUTO、问题状态、最终门槛和最终结论；同时保留 PDF、备份、导出、XSS、Safari、iPhone 和线上专项为 PENDING，不要用当前 Chromium PASS 覆盖这些边界。
- 是否必须实际运行确认：否
- 是否可能阻止上线：待确认

### TEST-004：三个 viewport 步骤没有覆盖所声称的手机核心流程

- 建议等级：P2
- 证据层级：本地运行与自动化测试产物审查
- 涉及文件：`frontend/tools/ui-audit.mjs`、`frontend/audit-screenshots/2026-07-11T10-52-21-510Z/ui-audit-report.json`、`PRE_LAUNCH_TEST_REPORT.md`
- 发现：viewport 循环在每个尺寸重新 `goto()`，随后对 `.nav-vocab` 的点击失败会被 `.catch(() => {})` 静默吞掉，只断言 `overflowX`。最新 JSON 中 390、430 和 1280 三个 viewport 都是 `firstVisit: true`、`hasReading: false`、`tokenizerMode: not-run`，且 `.sidebar-nav`、`.sidebar-brand`、`.app-content` 的宽高均为 0。该证据可以支持“这个初始状态没有横向溢出”，不能支持正式测试报告中“手机主流程和下拉菜单 PASS”或“大屏手机主流程 PASS”的表述。
- 证据位置：`frontend/tools/ui-audit.mjs` 第 353～368 行；最新 JSON 第 835～972 行；`PRE_LAUNCH_TEST_REPORT.md` 第 237～246 行
- 可能影响：移动端核心界面、底部导航、菜单、阅读结果和生词流程的布局问题可能没有被当前 viewport PASS 捕获，导致用过窄证据替代真实覆盖。
- 建议：每个 viewport 先显式完成或恢复一个确定的应用状态，再断言关键区域可见、尺寸大于 0、导航可点击、菜单打开且核心按钮未被遮挡；点击失败不得静默忽略。报告应把当前结果改写为“初始页面无横向溢出”，直到新流程通过。
- 是否必须实际运行确认：是
- 是否可能阻止上线：否；真实 iPhone Safari 仍可能阻止上线

### TEST-005：当前 UI 审计报告缺少浏览器与基线来源元数据

- 建议等级：P2
- 证据层级：静态代码与自动化测试产物审查
- 涉及文件：`frontend/tools/ui-audit.mjs`、`frontend/audit-screenshots/2026-07-11T10-52-21-510Z/ui-audit-report.md`、`frontend/audit-screenshots/2026-07-11T10-52-21-510Z/ui-audit-report.json`
- 发现：代码默认不传 `executablePath`，只有显式设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 时才使用自定义浏览器，因此默认策略确实指向 Playwright bundled Chromium。但是产物只记录 URL、步骤和结果，没有记录环境变量是否为空、实际浏览器可执行文件来源、浏览器版本、提交号、工作区状态或缓存版本。仅查看该报告无法独立判断它是否使用了 bundled Chromium，也无法确认页面资源就是 `20260711-08`。
- 证据位置：`frontend/tools/ui-audit.mjs` 第 19、118～145、397～405 行；`10-52-21-510Z` 的 Markdown 和 JSON 头部及 summary
- 可能影响：后续代码继续变化后，测试产物可能被错误归属到其他缓存或浏览器；TEST-003 的 VERIFIED 结论依赖外部人工记录，而不是报告自身可追溯。
- 建议：在 JSON/Markdown 中记录 `browser.version()`、是否使用自定义 executable、当前 CSS/JS cache version、Git commit、是否存在未提交修改，以及执行命令或运行模式。不得把“脚本默认策略”写成“该次运行实际来源”的唯一证据。
- 是否必须实际运行确认：是
- 是否可能阻止上线：否

### SEC-002：恶意备份中的阅读历史 URL 未限制协议

- 建议等级：P1（待本地 Codex 复现确认）
- 证据层级：静态代码与文档审查
- 涉及文件：`frontend/app.js`
- 发现：备份导入会把 `history` 交给 `normalizeReadingHistoryList()`；`normalizeReadingHistoryItem()` 对 `item.url` 只执行 `String()`，没有复用项目已有的 `readingQueueUrl()` 的 `http:` / `https:` 白名单。历史列表随后把该值经 `escapeHtml()` 后直接写入 `<a href>`。单双引号转义可以防止跳出属性，但不能阻止 `javascript:`、`data:` 或其他非预期协议。该输入可随恶意备份持久化，并在用户点击“打开文章链接”时触发浏览器处理。
- 证据位置：`frontend/app.js` 第 6552～6560、6865～6879、7002～7035 行；作为对照，`readingQueueUrl()` 第 1736～1743 行已正确限制为 HTTP(S)
- 可能影响：恶意备份可能生成具有主动内容或欺骗性的持久化链接；是否能够在目标浏览器执行脚本、打开恶意数据页面或形成其他利用，需要动态验证。由于这是安全边界问题，在确认和修复前不能宣告未解决 P1 为零。
- 建议：在历史规范化时使用与阅读清单相同的 URL 白名单，仅保留 `http:` / `https:`；无效协议应清空并不渲染链接。增加静态断言，并用 `javascript:`、`data:text/html`、大小写和空白混淆等恶意备份进行浏览器动态测试。
- 是否必须实际运行确认：是
- 是否可能阻止上线：是

## 无法通过本轮审查确认

- 实际点击：本轮没有亲自运行项目。现有自动审计只能确认脚本明确执行并断言的步骤；不能证明空输入、错误输入、长文、完整闪卡一轮、生词刷新持久化、备份恢复闭环或全部导航流程。
- PDF：正常文字型、扫描型、加密、损坏、复杂排版、空文件和大文件 PDF 的真实解析、失败降级、输入重置及进入阅读工作台结果均无法确认。
- 导出：PPTX、PNG、JPEG、CSV 和 Anki TSV 的实际下载、文件可打开性、内容完整性、日文和假名字体、编码、图片清晰度、PPTX 可编辑性以及 TSV 导入 Anki 的字段映射均无法确认；也无法通过静态检查证明导出过程中没有发起 Kuromoji 字典请求。
- 备份与安全：完整备份导出、覆盖恢复、刷新后持久化、重复项处理、损坏备份提示、恶意 `annotatedHtml`、正文/标题/语法字段 XSS，以及本报告 SEC-002 的 URL 协议风险均无法通过本轮静态审查确认。
- DATA-001：localStorage 被禁用或抛出异常时，水平测试重置是否不中断、UI 是否保持一致，无法确认。
- TTS：真实日语音色、播放/停止、速度、无音色降级和不同浏览器表现无法确认。
- 浏览器兼容：Mac Safari、iPhone Safari、移动端真实下载、触摸操作、微信内置浏览器、Firefox、键盘导航和 VoiceOver 无法确认；390/430 Chromium viewport 不替代真实 iPhone Safari。
- 线上环境：当前未提交 `20260711-08` 版本是否已经部署、生产缓存是否刷新、线上资源 404、控制台、弱网、首次访问、PDF、备份和导出行为无法确认。已有旧线上验收不能自动覆盖当前未提交修改。

## 建议 Codex 优先处理

1. 先复现并处理 SEC-002，同时完成 SEC-001 的恶意输入/恶意备份动态测试；在安全结论明确前，不要勾选“没有未解决的 P1”。
2. 同步 `PRE_LAUNCH_TEST_REPORT.md` 到 `20260711-08 / 10-52-21-510Z`，修正 FLOW-AUTO、VISUAL-AUTO、TEST-002、TEST-003、最终门槛和结论，并把 viewport 证据降格为其真实覆盖范围。
3. 补强 UI 审计的浏览器/缓存/提交元数据和三个 viewport 的真实应用状态，然后依次执行 PDF、备份恢复、PPTX/PNG/JPEG/CSV/TSV、localStorage 异常、Mac Safari、iPhone Safari 和当前线上版本验收。

## 需要用户决定

无。

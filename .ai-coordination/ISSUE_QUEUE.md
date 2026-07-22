# 唯一问题队列

> 由本地 Codex维护。网页端报告中的问题必须由 Codex复现、去重和定级后才能进入本队列。

## 当前问题

### 2026-07-22 当前队列摘要

- 当前 Production：`dpl_2DD7vb4PHQWCKuK7ANWCDTxUv9Lq`，状态 `Ready`。
- 当前 main：`cdfd3716c60b8fb45b84d33e079aa5f49d604788`。
- 当前没有已确认的 P0/P1 Production 阻断。
- `LANGUAGE-SAFARI-001` 已由 2026-07-22 Production 电脑与手机真实设备抽查关闭。
- `CONTENT-001` 属于已撤销的公开 PDF 路线，保留为历史 DEFERRED，不进入当前 MVP 任务。
- `DICT-COVERAGE-001` 已被 `DICT-COVERAGE-002`、统一 JMdict 查询和语言审计覆盖。
- `UI-INTERNAL-001` 已被统一生词字段迁移、显示格式化和导出门禁覆盖。

### RELEASE-VOCAB-MODULARIZATION-20260722

- 来源：`app.js` 生词系统模块化第二轮
- 等级：P1
- 状态：VERIFIED / RELEASED
- 涉及文件：`frontend/vocab-store.js`、`vocab-list.js`、`vocab-review.js`、`vocab-export.js`、`frontend/app.js`、构建/缓存/测试文件
- 处理结论：71 个候选函数完成唯一实现迁移；`app.js` 减少 986 行；本地自动化、Preview 人工验收、PR #1、main 合并和 Production 发布均完成。
- Production 证据：`dpl_2DD7vb4PHQWCKuK7ANWCDTxUv9Lq`；正式域名在线烟雾测试 PASS。

### LEXICAL-DETAIL-VOCAB-001

- 来源：词汇形态统一与语言质量计划阶段三（2026-07-17）
- 等级：P1
- 状态：FIXED（专项、旧数据迁移与完整 UI 自动化 PASS）
- 涉及文件：`frontend/lexical-record.js`、详情/收藏集成文件、`frontend/app.js`、专项与浏览器测试
- 发现：详情页、收藏、快照和旧生词数据此前分别保存零散字段，无法稳定保留正文形、原形、原形读音、词性、活用及实际查询命中信息。
- 预期结果：详情和收藏共同消费统一记录；旧本地数据自动补齐新字段且不破坏等级、复习进度、导出和编辑。
- 处理结论：已提交 `e00bb53`；统一保存 schemaVersion=1 的词汇字段，旧 `pos` 保持同步，普通词与活用词采用不同的安全编辑继承规则。
- 自动证据：`frontend/tools/lexical-record.test.mjs`、旧生词迁移 UI 审计、`寝ます` 详情与收藏真浏览器断言、功能及五视口审计均 PASS。

### LEXICAL-LOOKUP-PLAN-001

- 来源：词汇形态统一与语言质量计划阶段二（2026-07-17）
- 等级：P1
- 状态：FIXED（专项、词典浏览器与完整 UI 自动化 PASS）
- 涉及文件：`frontend/lexical-lookup.js`、`frontend/lexical-lookup-integration.js`、`frontend/app.js`、查询与浏览器测试
- 发现：中文、JLPT 和 JMdict 之前分别消费简单字符串数组，候选来源、优先级、数据源权限和词性约束不明确；纯假名与同音词容易产生跨词性误配。
- 预期结果：建立统一查询计划，按正文精确形、原形、复合词、受约束读音和安全回退查询，并由三个数据源共同消费。
- 处理结论：已提交 `aee462a`；功能词和专有名词不再使用读音猜测，JLPT 不使用读音/复合词/回退候选，普通纯假名词仅在词性严格匹配时允许读音命中。
- 自动证据：`frontend/tools/lexical-lookup-plan.test.mjs`、`frontend/tools/jmdict-browser.test.mjs`、功能及五视口 UI 审计均 PASS。

### LEXICAL-MODEL-001

- 来源：词汇形态统一与语言质量计划阶段一（2026-07-17）
- 等级：P1
- 状态：FIXED（自动化与真实 Worker 浏览器审计 PASS）
- 涉及文件：`frontend/app.js`、`frontend/tools/check.mjs`、`frontend/tools/kuromoji-app-consistency.test.mjs`
- 发现：正文形式、正文读音、原形、原形读音、词性、活用和复合词来源此前分散在多个字段与函数中，难以保证后续中文、JLPT 和 JMdict 使用一致上下文。
- 预期结果：建立统一 `LexicalAnalysis`，并由正文渲染、详情、功能词判断和合并词共同消费。
- 处理结论：已提交 `7194a54`；正文读音优先采用 token 实际读音，原形读音不覆盖正文；功能词、专有名词、复合词与来源标识均有模型级回归。
- 后续边界：查询候选优先级和词性约束属于阶段二 `buildLexicalLookupPlan()`，本项不提前实现。

### DICT-CHINESE-COVERAGE-002

- 来源：用户截图任务（2026-07-17）
- 等级：P1
- 状态：FIXED（本地自动化 PASS，等待下一 Preview 抽查）
- 涉及文件：`frontend/data/chinese-definitions-source.json`、版本化中文索引、词典测试
- 发现：`寝る`、`無償` 缺少离线中文释义；专有名词未命中时缺少明确边界说明。
- 预期结果：补齐两词中文释义；专名未命中时明确说明未收录且不猜测含义。
- 处理结论：新增版本化数据 `20260717`；`寝る=睡觉、就寝`、`無償=免费、无偿（不收取费用）`。专名无可靠结果时明确提示未收录且不会猜测。

### FURIGANA-INFLECTION-001

- 来源：用户截图任务（2026-07-17）
- 等级：P1
- 状态：FIXED（真实 Worker 浏览器审计 PASS）
- 涉及文件：`frontend/app.js`、Kuromoji 一致性与 UI 测试
- 发现：活用形使用原形词典释义时，原形读音可能覆盖正文 token 读音，例如 `読ん` 显示为 `よむ`。
- 预期结果：正文 `読ん` 显示 `よん`；词典查询仍使用原形 `読む`。
- 处理结论：正文 token 读音与词典原形读音分离；浏览器审计确认 `読ん=よん`、查询键 `読む`。

### JLPT-INFLECTION-001

- 来源：用户截图任务（2026-07-17）
- 等级：P1
- 状态：FIXED（VM 与真实 Worker 浏览器审计 PASS）
- 涉及文件：`frontend/app.js`、学习索引与 Kuromoji 测试
- 发现：礼貌形合并时覆盖 `basic_form`，导致活用形无法稳定继承原形的 JLPT 参考等级。
- 预期结果：礼貌形和其他活用形保留原形查询键，并继承原形的可靠参考等级；原形无可靠等级时仍不猜测。
- 处理结论：礼貌形合并保留首个动词 token 的 `basic_form`；`読ん` 与 `寝ます` 均继承原形 N5，无可靠原形等级时继续显示暂无参考等级。

### UI-TTS-VOICE-DEDUP-001

- 来源：用户截图任务（2026-07-17）
- 等级：P2
- 状态：FIXED（Safari 能力模拟与响应式审计 PASS）
- 涉及文件：`frontend/app.js`、UI 审计
- 发现：Safari 可能返回重复音色对象，当前列表未去重。
- 预期结果：按规范化音色名称与语言去重，保持当前选择和朗读逻辑不变。
- 处理结论：音色按规范化名称＋语言去重，重复系统对象不再生成重复选项；单词/全文朗读与当前选择逻辑保持通过。

### UI-COPY-READING-001

- 来源：第二轮 Mac/iPhone Safari 真实设备验收（2026-07-16）
- 等级：P2
- 状态：FIXED（自动化 PASS，等待新 Preview 文案抽查）
- 涉及文件：`frontend/index.html`、`frontend/tools/check.mjs`
- 发现：阅读页显示“完成阅读后，可以用这篇文章生成练习。”，但当前公开页面没有对应文章练习生成入口。
- 预期结果：只描述当前真实可用的词语详情、读音、释义和收藏操作；不删除隐藏练习模块代码。
- 处理结论：已改为“点击正文中的词语，可以查看读音、释义并加入生词本。”；旧承诺文案静态防回归 PASS。

### SAFARI-COLD-START-001

- 来源：第二轮 Mac Safari 真实设备验收（2026-07-16）
- 等级：P0
- 状态：FIXED（自动化 PASS，等待 Mac Safari 新 Preview 冷启动复测）
- 涉及文件：`frontend/app.js`、Kuromoji 与 UI 自动化测试
- 发现：第一次生成假名曾显示红色错误，第二次手动重试成功。
- 预期结果：首次失败自动重试一次；中间显示非红色提示；第二次仍失败才显示唯一最终错误；保留手动重试，禁止无限循环或并行 Worker。
- 外部状态：核心假名功能 PASS；新 Preview 仍需 Mac Safari 冷启动定向复测。
- 处理结论：首次失败自动清理旧 client 并重试一次；重试中为非红色状态；第二次失败只显示一个最终错误，手动重试保持可用。竞态、生命周期与浏览器模拟均 PASS。

### UI-TTS-SETTINGS-001

- 来源：第二轮真实设备验收（2026-07-16）
- 等级：P2
- 状态：FIXED（自动化与 390/430/1280/1440/1920 响应式审计 PASS）
- 涉及文件：`frontend/index.html`、`frontend/app.js`、`frontend/hero-menu-refresh.css`、UI 审计
- 发现：设置项标题与下拉框文本重复，下拉框和试听按钮未形成紧凑同行布局，桌面右侧留白过多。
- 预期结果：下拉框直接显示实际当前速度/音色；桌面与试听按钮同行并等高；390/430 无横向溢出。
- 处理结论：下拉摘要实时显示选中值；桌面同行等高，窄屏安全堆叠；五个视口均无横向溢出。

### DICT-AUXILIARY-MASU-001

- 来源：第二轮词语详情真实设备验收（2026-07-16）
- 等级：P1
- 状态：FIXED（静态、VM 与浏览器自动化 PASS，等待新 Preview 文章抽查）
- 涉及文件：`frontend/app.js`、Kuromoji 一致性测试、UI 审计
- 发现：上下文中的礼貌助动词 `ます` 错配为 JMdict 名词 “measuring container; measuring box; square on a grid”，并错误显示 JLPT N3。
- 预期结果：优先使用 Kuromoji 上下文词性；显示礼貌助动词说明、助动词、暂无参考等级且不提供收藏；`あります`、`開きます`、`起きます` 保持整词。
- 处理结论：助动词 `ます` 在词典查询前被识别为语法功能，不再命中名词释义或 N3；三类礼貌动词整词回归 PASS。

### PERF-SAFARI-001

- 来源：用户 Mac Safari 真实 Preview 验收（2026-07-15）
- 基线：`preview-20260715-04 / dpl_5xGZ87W82spvjrqYWu7LKYSqLkKM`
- 等级：P0
- 状态：FIXED（本地自动回归 PASS，等待 Mac Safari Preview 复测）
- 涉及文件：`frontend/index.html`、`frontend/design-system.css`、`frontend/app.js`、`frontend/tools/check.mjs`、`frontend/tools/ui-audit.mjs`、Kuromoji 测试
- 发现：Mac Safari 首次生成假名需要数分钟；状态文本位于隐藏控制区，用户点击后看不到处理中反馈。
- 预期结果：点击后立即显示可见状态；进入阅读页后空闲预热 Worker；记录 init/tokenize/round-trip 指标；热加载不重复构建词典。
- 处理结论：状态区已移出隐藏容器；点击后立即显示进度并提供长等待说明；输入和开始阅读时后台预热 Worker；记录 `initMs`、`tokenizeMs`、`roundTripMs`；完成后显示实际耗时且不暴露内部技术名。缓存升级为 `20260715-01`。
- 自动证据：`frontend/audit-screenshots/2026-07-15T05-42-36-670Z/ui-audit-report.md` 与 `2026-07-15T05-42-55-247Z/ui-audit-report.md`，均 PASS。
- 外部状态：仍需新 Preview 的 Mac Safari 冷启动与热启动实测；不得仅凭 Chromium 标记性能 PASS。

### DICT-COVERAGE-001

- 来源：用户 Mac/iPhone Safari 真实文章验收（2026-07-15）
- 等级：P0
- 状态：VERIFIED（已由 DICT-COVERAGE-002、统一 JMdict 查询与语言审计覆盖）
- 涉及文件：`frontend/data/dictionary.json`、`frontend/app.js`、词典构建脚本与覆盖测试
- 发现：当前本地词典只有 126 条；`autoLookupTokenMeaning()` 没有真实第二层查询；`時価総額`、`総額`、`金融機関`、`半導体` 等常见内容词无中文释义。
- 预期结果：建立可离线部署的真实词典索引，支持 surface/basic form 与复合词查询；未命中时准确说明边界。
- 处理结论：历史缺口已通过版本化离线中文索引、JMdict 本地回退、统一查询计划与语言审计处理；后续“扩大中文覆盖”属于新的数据扩展任务，不沿用本问题的旧实现假设。

### UI-INTERNAL-001

- 来源：用户真实 Preview 验收（2026-07-15）
- 等级：P1
- 状态：VERIFIED（统一字段迁移、显示格式化与导出门禁 PASS）
- 涉及文件：`frontend/app.js`、数据迁移与 UI 测试
- 发现：内部等级/来源值 `kuromoji` 可直接显示在生词页。
- 预期结果：内部 source 与用户可见 JLPT 分级分离；未知等级显示“未分级”；迁移既有本地生词数据。
- 处理结论：内部来源与用户可见 JLPT 等级已分离；旧数据自动迁移，未分级显示和 CSV/TSV 导出均由静态与浏览器测试覆盖。

### USER-REAL-005

- 来源：用户 Mac Safari 真实粘贴文本验收（2026-07-13）
- 基线：`main / b84b3cd / 缓存 20260712-07`
- 等级：P1
- 状态：FIXED（本地自动回归 PASS，等待 Mac Safari 同文复测）
- 发现：单换行段落被合并；内置小词典之外的正文不可点击、无假名、无法收藏；任意文章没有通用本地译文但翻译按钮反馈不清。
- 处理结论：缓存 `20260713-01` 保留每个输入换行并渲染独立段落；使用 Safari 支持的 `Intl.Segmenter` 让未知日语词也可点击、补读音和收藏；没有可靠本地译文时明确提示，不生成虚假翻译。远程 Kuromoji 继续关闭，避免 Safari 卡死。
- 证据：`frontend/audit-screenshots/2026-07-13T02-27-13-585Z/ui-audit-report.md`
- 外部状态：Mac Safari 完整端到端闭环继续 `PENDING`。

### DOC-R05-001 / DOC-R05-002

- 来源：ChatGPT 网页端 Round 05
- 基线：`main / b84b3cd / 缓存 20260712-07`
- 等级：P2
- 状态：VERIFIED
- 处理结论：当前态资料统一到 `b84b3cd / 20260712-07 / https://yomeru.japanese-hub.com`；历史 PDF Beta 决策保留但明确为已撤销，当前公开输入仅粘贴日语文本。

### EVID-R05-001

- 来源：ChatGPT 网页端 Round 05
- 等级：P2
- 状态：VERIFIED（内容连续性绑定；非 clean commit 重跑）
- 证据：`frontend/audit-screenshots/2026-07-12T15-21-30-699Z/ui-audit-report.md`
- 处理结论：报告记录父提交 `6892c259` 的 dirty worktree；该工作树变更随后提交为 `b84b3cd`。保留原报告不修改，并明确证据边界。

### ONLINE-R05-001

- 来源：ChatGPT 网页端 Round 05
- 等级：PENDING
- 状态：BLOCKED BY TEST ENVIRONMENT
- 处理结论：不把线上抓取阻断推测为失败或 PASS；Mac Safari 完整端到端闭环继续 `PENDING`。

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
- 预期结果（历史）：使用普通用户可理解的能力边界文案；该 PDF Beta 公开方案已于 2026-07-12 撤销。
- 是否阻止上线：否。
- 处理结论（历史）：当时完成 PDF Beta 文案修复；随后已撤下全部公开 PDF 入口，当前公开输入仅粘贴日语文本。

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
- 状态：DEFERRED / HISTORICAL
- 涉及文件：`frontend/app.js`
- 发现：任意 PDF 的本地逐词拼接会形成看似完整但不可靠的中文翻译，复杂 PDF 的断行与假名覆盖有限。
- 复现方式或证据：用户实机截图显示错误翻译、断行和无假名。
- 证据层级：真实设备验收。
- 预期结果：不展示虚假翻译；明确 MVP 的本地翻译边界；复杂 PDF 解析留作专项增强。
- 处理结论：已移除未知句子的词义拼接；公开 PDF Beta 已撤销，当前公开输入仅粘贴日语文本。复杂 PDF 版面重建和完整翻译服务保留在未来功能池，不进入当前 MVP 队列。

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

### DICT-COVERAGE-002

- 来源：第二轮离线中文与 JLPT 参考数据任务
- 基线：`stabilize/safari-dictionary-20260715 / aa0da55`
- 等级：P0
- 状态：VERIFIED
- 涉及文件：`frontend/app.js`、`frontend/data/chinese-definitions/20260716/`、`frontend/data/jlpt-reference/20260716/`
- 发现：第一轮未收录词只允许 JMdict 英文回退，且等级字段缺少独立可追溯参考源。
- 证据层级：可重复数据构建、静态测试、本地 Chromium 动态测试、响应式审计
- 证据位置：提交 `2d449f0`、`f680f92`；`frontend/audit-screenshots/2026-07-16T14-08-06-523Z/`
- 处理结论：中文分片优先、JMdict 次级回退；JLPT 冲突形不猜测；详情、收藏、筛选、闪卡、CSV/TSV/备份字段一致，全部自动化 PASS。

### DEPLOY-PREVIEW-002

- 来源：第二轮 Preview 候选发布
- 基线：应用提交 `f680f92` / 候选 SHA-256 `df4d415c3f0cbc9658044232ab119022df491d6a4c0f10a4a37fb38ef3ccff39`
- 等级：P1
- 状态：VERIFIED
- 涉及文件：`.vercel/output/`、协调状态文件
- 发现：prebuilt 构建与 146 文件逐项哈希门禁均已通过，但外部上传保护要求用户再次明确授权后才允许部署 Preview。
- 证据层级：本地构建与执行环境发布保护
- 预期结果：仅运行 `npx vercel deploy --prebuilt`，记录 Preview URL、Deployment ID、target=`preview`、status=`Ready`；不得使用 `--prod`。
- 处理结论：用户再次明确授权后已运行 `npx vercel deploy --prebuilt`；Preview `https://japanese-tool-6uuktjcym-zrq-projects1.vercel.app`，Deployment ID `dpl_5rmgnmSGekWbFk5HAN2HDSwAN66t`，target=`preview`，status=`Ready`。Production 未触碰。

### LANGUAGE-CORPUS-001

- 来源：词形系统重构阶段四
- 基线：`stabilize/safari-dictionary-20260715 / d8fef33`
- 等级：P1
- 状态：VERIFIED
- 涉及文件：`frontend/test-data/language-corpus/20260717-01/`、`frontend/tools/language-corpus.test.mjs`、`frontend/tools/language-corpus-browser.test.mjs`、`frontend/package.json`
- 发现：此前只有专项回归，没有覆盖基础词、活用、功能词、歧义、复合词、专名混排和新闻文本的固定批量语言基线。
- 复现方式或证据：`npm run test:language-corpus`。
- 证据层级：确定性数据校验、纯函数测试、真实 Kuromoji Worker、本地离线索引、Chromium UI。
- 预期结果：260 个固定案例满足完整 schema、唯一性与分类计数；代表性子集进入真实 Worker、词典/JLPT 与 UI 层；未知值不猜测。
- 处理结论：260 个案例与 260/32/40/16 分层自动测试全部通过；12 个 Safari 案例只登记为人工 `PENDING`；代码提交为 `1dbb1e6`。

### LANGUAGE-SAFARI-001

- 来源：词形系统重构阶段四
- 基线：语料版本 `20260717-01`；Production `dpl_2DD7vb4PHQWCKuK7ANWCDTxUv9Lq`
- 等级：P2
- 状态：VERIFIED
- 涉及文件：`frontend/test-data/language-corpus/20260717-01/cases.json`、`manifest.json`、`.ai-coordination/REAL_DEVICE_ACCEPTANCE_CHECKLIST.md`
- 发现：Codex 自动化环境不能替代真实 Mac/iPhone Safari 的语言案例验收。
- 证据层级：自动化门禁＋Production 真实设备人工验收。
- 预期结果：在真实电脑与手机环境抽查首次/热加载、收藏刷新、闪卡评分、导出和移动端布局。
- 处理结论：用户于 2026-07-22 确认电脑与手机 Production 实测均无问题；首次与热加载、生词刷新、闪卡评分、CSV/Anki 和移动端布局全部记为 PASS。

### LANGUAGE-AUDIT-001

- 来源：词形系统重构阶段五
- 基线：`stabilize/safari-dictionary-20260715 / 1626c3f`
- 等级：P1
- 状态：VERIFIED
- 涉及文件：`frontend/tools/language-audit.mjs`、`frontend/package.json`、`frontend/test-data/language-corpus/20260717-01/`
- 发现：阶段四已有固定案例，但缺少统一量化指标、公开 Beta 门槛、失败清单和可追溯报告。
- 复现方式或证据：`npm run audit:language`；`frontend/language-audit-results/2026-07-17T12-55-10-902Z/`。
- 证据层级：真实 Kuromoji Worker、本地离线索引、Playwright Chromium、Markdown/JSON 报告。
- 预期结果：输出 token、读音、原形、词性、中文、JMdict、未命中、JLPT、安全错误和失败案例，并在门槛未满足时返回非零。
- 处理结论：审计工具已提交为 `e358d13`；阶段六接入通用上下文读音解析后最终报告为 `frontend/language-audit-results/2026-07-17T13-30-11-367Z/`，260/260 已知案例与全部质量门槛 PASS。

### LANGUAGE-READING-CONTEXT-001

- 来源：阶段五首次全量语言审计
- 基线：语料 `20260717-01` / 审计提交 `e358d13`
- 等级：P0
- 状态：VERIFIED
- 涉及文件：`frontend/app.js`、`frontend/test-data/contextual-reading/20260717-01/`、`frontend/tools/contextual-reading.test.mjs`、`frontend/tools/language-audit.mjs`
- 发现：正文读音正确率仅 96.34%，未达到 98% 门槛；`七時`、`開く`（2 个语境）、`生`、`一日`、`人気`、`市場`、`今日中`、`避難所` 共 9 个案例可重复失败。
- 复现方式或证据：运行 `npm run audit:language`，查看最终报告的 Failures 表。
- 证据层级：260 个固定案例、1148 个真实 Worker token、本地 Chromium 自动化。
- 预期结果：按通用上下文规则修复，不为单个案例写生产硬编码；正文读音至少 98%，已知回归 100%。
- 处理结论：已在合并与形态分析前按词元上下文统一解析读音，并用 15 个真实 Worker 正反例防止过度匹配。最终正文读音 246/246（100%）、已知回归 260/260（100%）；未向生产词库添加虚构释义或等级。

### LANGUAGE-ARTICLE-STRESS-001

- 来源：词形系统重构阶段六
- 基线：`stabilize/safari-dictionary-20260715 / a572309`
- 等级：P1
- 状态：VERIFIED
- 涉及文件：`frontend/test-data/article-stress/20260717-01/`、`frontend/tools/article-stress-audit.mjs`、`frontend/package.json`、`frontend/tools/verify-all.mjs`
- 发现：固定 260 案例通过后仍需验证多文体长文本、累计 1000 个以上可点击 token、段落重建和完整 UI Worker 模式。
- 复现方式或证据：`npm run audit:articles`；`frontend/article-stress-results/2026-07-17T13-41-21-065Z/`。
- 证据层级：确定性文章语料、真实 Kuromoji Worker、完整 Chromium UI。
- 预期结果：不少于 20 篇、覆盖六类文体、不少于 1000 个可点击 token，全部 Worker 成功且 UI 不降级。
- 处理结论：20 篇、6 类、Worker/UI 各 2131 个可点击 token，20/20 成功，段落重建与 `kuromoji-worker` 模式均 PASS；真实 Safari 不由 Chromium 代替，继续登记在 `LANGUAGE-SAFARI-001`。

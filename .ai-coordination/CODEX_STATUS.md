# Codex 当前状态

- 当前阶段：Production 发布收尾与任务基线重置
- 当前文档分支：`chore/release-baseline-20260722`
- 当前 main：`87ba6bb1d2d7bb5921bbf5df46f53df83dba5084`
- 正式线上地址：`https://yomeru.japanese-hub.com`
- Production Deployment：`dpl_2DD7vb4PHQWCKuK7ANWCDTxUv9Lq`
- Production 状态：`Ready`
- 回滚点：`dpl_R6cpkaGkqYijPdgqgqShtSQT2gFe`
- 当前缓存：`20260722-01`
- 公开 MVP：仅粘贴日语文本；不恢复 PDF 公开入口
- 生词系统第二轮模块化：实现、自动化、Preview、人工验收、PR、main 合并与 Production 发布全部完成
- 当前发布结论：`RELEASED / OBSERVE`
- 当前代码阻断：无 P0/P1 Production 阻断
- 当前人工项：可选的 Mac/iPhone Safari Production 精简抽查
- 下一产品任务：尚未正式排期；优先候选为离线中文释义覆盖扩展的缺口统计与数据源设计
- 停止规则：真实 Production 回归、不可逆文件归属冲突或需要用户真实设备操作时暂停
- 最后更新时间：2026-07-22 CST

> 以下内容为历史阶段记录，不代表当前分支、发布状态或下一任务。

## 2026-07-16 第二轮状态

- 总体实现：完成；应用候选提交 `f680f92`，数据提交 `2d449f0`。
- 离线中文：156 词条、281 查询形、16 分片、32,807 字节；中文优先于 JMdict，浏览器运行时无翻译 API。
- JLPT 参考：8,131 源行、13,385 个无冲突查询形、排除 533 个跨等级冲突形；仅显示“参考等级”。
- 生词数据：已加入 `meaningLanguage`、`meaningSource`、`levelSource`，旧数据迁移、手工释义保护、未分级筛选、闪卡与导出一致性已覆盖。
- 缓存版本：`20260716-03`；Kuromoji 版本化目录保持 `20260714-01`。
- 自动化：`check`、`test:kuromoji`、`test:dictionary`、`audit:ui`、学习数据构建、前端构建、Vercel prebuilt 全部 PASS。
- 构建一致性：`dist/` 与 Vercel static 各 146 文件，零路径/hash 差异；聚合 SHA-256 `df4d415c3f0cbc9658044232ab119022df491d6a4c0f10a4a37fb38ef3ccff39`。
- Preview：`https://japanese-tool-6uuktjcym-zrq-projects1.vercel.app`；Deployment ID `dpl_5rmgnmSGekWbFk5HAN2HDSwAN66t`；target=`preview`；status=`Ready`。
- Production：未部署、未修改 alias/域名，`https://yomeru.japanese-hub.com` 保持不变。
- 当前结论：`HOLD`；下一步仅为第二轮 Mac/iPhone Safari 真机验收。

## 2026-07-16 第二轮真实设备验收后补丁

- Mac Safari 与 iPhone Safari 核心功能验收：PASS。
- 已确认：离线中文优先、JMdict 英文回退、JLPT 参考等级、查询中自动收藏、生词本、假名、单词/全文朗读、移动端布局和内部字段保护。
- Mac Safari 冷启动事实：第一次假名生成曾失败一次，第二次重试成功；核心功能通过，但首次冷启动稳定性仍需补丁。
- 当前本地补丁：`UI-COPY-READING-001`、`SAFARI-COLD-START-001`、`UI-TTS-SETTINGS-001`、`DICT-AUXILIARY-MASU-001`。
- Production：未部署、未修改 alias/域名，`https://yomeru.japanese-hub.com` 保持不变。
- 当前结论：`HOLD`；四项补丁通过完整门禁后只部署新的 Preview，再由 Mac/iPhone Safari 定向复测。

## 2026-07-16 验收后补丁 Preview

- 修复提交：`f36e73d63c23`；缓存版本：`20260716-04`。
- 四项本地补丁与自动化门禁：PASS。
- 构建一致性：`dist/` 与 Vercel static 各 146 文件，零路径/hash 差异；聚合 SHA-256 `68f9616849d578d63b5d16d496dc082c7cc40f9e08246bba991fcb1c9a9b4403`。
- Preview：`https://japanese-tool-o9vdyyfbm-zrq-projects1.vercel.app`；Deployment ID `dpl_5FFrbuh8CVs7YGLo2sKzhmYCGD7Q`；target=`preview`；status=`Ready`。
- Production：`dpl_HYpzrVrM4KGnKNfHjKVqDokkjGfw`，target=`production`，status=`Ready`；正式域名与 alias 未改变。
- 当前结论：`HOLD`；等待 Mac/iPhone Safari 对四项补丁做定向复测，不发布 Production。

## 2026-07-17 活用形与音色去重本地补丁

- 已完成：`DICT-CHINESE-COVERAGE-002`、`FURIGANA-INFLECTION-001`、`JLPT-INFLECTION-001`、`UI-TTS-VOICE-DEDUP-001`。
- 学习数据版本：`20260717`；中文索引 158 词条、285 查询形；新增 `寝る`、`無償`。
- 前端缓存版本：`20260717-01`；Kuromoji 版本化资源仍为 `20260714-01`。
- 自动化：`check`、`test:kuromoji`、`test:dictionary`、功能 UI 审计、五视口响应式审计与 `npm run build` 全部 PASS。
- 功能审计：`frontend/audit-screenshots/2026-07-17T03-16-12-069Z/ui-audit-report.md`。
- 响应式审计：`frontend/audit-screenshots/2026-07-17T03-14-04-833Z/ui-audit-report.md`。
- 当前状态：修复已提交为 `0b7c829`；形态质量计划已提交为 `5c92e07`；尚未部署新 Preview。Production 未操作，发布状态继续 `HOLD`。

## 2026-07-17 统一词语形态模型阶段一

- 阶段提交：`7194a54`（`refactor: introduce unified lexical analysis model`）。
- 前端缓存版本：`20260717-02`；学习数据版本仍为 `20260717`；Kuromoji 资源版本仍为 `20260714-01`。
- 已建立统一 `LexicalAnalysis`：正文形式与读音、原形与原形读音、主/细分词性、活用类型与活用形、功能词、专有名词、复合词及合并前来源标识。
- 已接入：Kuromoji 与 Worker token、礼貌形/复合词合并、未知词回退、详情页词形展示、语法功能词判断和页面 token 缓存。
- 强制规则：正文读音优先采用分词器的实际 token 读音；词典原形读音不得覆盖正文读音。
- 自动化：`check`、`test:kuromoji`、`test:dictionary`、功能 UI 审计、390/430/1280/1440/1920 响应式审计、学习数据构建、前端构建和 Vercel prebuilt 全部 PASS。
- 功能审计：`frontend/audit-screenshots/2026-07-17T06-49-42-536Z/ui-audit-report.md`。
- 响应式审计：`frontend/audit-screenshots/2026-07-17T06-50-13-110Z/ui-audit-report.md`。
- 构建一致性：`dist/` 与 Vercel static 各 168 文件，缺失/多余/hash 不一致均为 0；聚合 SHA-256 `84c752923c4940dc872ba3736786a21a1227f78b6044f0e6cf5b13f9f158e71f`。
- Preview：本阶段未部署；Production、正式域名和 alias 未操作。
- 当前结论：阶段一完成；下一步进入阶段二 `buildLexicalLookupPlan()`，统一中文、JLPT 和 JMdict 的查询候选与安全规则。发布状态继续 `HOLD`。

## 2026-07-17 统一词典查询计划阶段二

- 阶段提交：`aee462a`（`refactor: centralize lexical lookup planning`）。
- 前端缓存版本：`20260717-04`；学习数据版本仍为 `20260717`；Kuromoji 资源版本仍为 `20260714-01`。
- 已建立 `buildLexicalLookupPlan()`：候选类型为 `exactSurface`、`lemma`、`compound`、`reading`、`fallback`，并记录优先级、词性、数据源权限、读音匹配权限和词性强制匹配规则。
- 中文释义、JLPT 参考等级和 JMdict 英文回退现在共同消费同一份查询计划；内置词条初始化、详情和收藏也不再使用旧的 `[word, reading]` 查询方式。
- 安全规则：功能词与专有名词禁用读音同音猜测和 JLPT 继承；普通纯假名词仅在词性严格匹配时允许读音命中；复合词和读音候选不参与 JLPT 猜测。
- 自动化：`check`、`test:kuromoji`、`test:dictionary`、功能 UI 审计、390/430/1280/1440/1920 响应式审计、学习数据构建、前端构建和 Vercel prebuilt 全部 PASS。
- 查询计划专项测试：`frontend/tools/lexical-lookup-plan.test.mjs`；真实浏览器词典测试已确认页面 token 保存 schemaVersion=1 的查询计划和实际匹配类型。
- 功能审计：`frontend/audit-screenshots/2026-07-17T07-37-46-246Z/ui-audit-report.md`。
- 响应式审计：`frontend/audit-screenshots/2026-07-17T07-37-58-637Z/ui-audit-report.md`。
- 构建一致性：`dist/` 与 Vercel static 各 170 文件，缺失/多余/hash 不一致均为 0；聚合 SHA-256 `370888f6c8e864b72f9b1c768da52a0d879d3e18251a7f9af6dcfd34bcd43fee`。
- Preview：本阶段未部署；Production、正式域名和 alias 未操作。
- 当前结论：阶段二完成；下一步进入阶段三“统一详情、收藏和等级继承”。发布状态继续 `HOLD`。

## 2026-07-17 统一详情与收藏记录阶段三

- 阶段提交：`e00bb53`（`refactor: unify lexical detail and vocabulary records`）。
- 前端缓存版本：`20260717-05`；学习数据版本仍为 `20260717`；Kuromoji 资源版本仍为 `20260714-01`。
- 已建立统一详情记录：正文形/读音、原形/原形读音、主/细分词性、活用类型/活用形、释义与来源、JLPT 与来源、实际查询命中词及命中类型。
- 收藏、生词快照、自动收藏、内置词收藏和手动编辑均保存统一字段；旧 `pos` 字段继续与 `partOfSpeech` 同步，保持旧代码与备份兼容。
- 旧生词迁移：加载时自动补齐 `lexicalSchemaVersion=1`、`baseForm`、`baseReading`、词性和活用字段，并在发生变化后重新持久化。
- 编辑兼容：普通词的原形随正文编辑更新；活用词编辑正文时保留独立原形和原形读音。
- 专项测试：`frontend/tools/lexical-record.test.mjs`；浏览器审计确认 `寝ます → 寝る（ねる）` 详情及收藏字段完整。
- 自动化：`check`、`test:kuromoji`、`test:dictionary`、功能 UI 审计、390/430/1280/1440/1920 响应式审计、学习数据构建、前端构建和 Vercel prebuilt 全部 PASS。
- 功能审计：`frontend/audit-screenshots/2026-07-17T08-09-11-416Z/ui-audit-report.md`。
- 响应式审计：`frontend/audit-screenshots/2026-07-17T08-09-25-606Z/ui-audit-report.md`。
- 构建一致性：`dist/` 与 Vercel static 各 173 文件，缺失/多余/hash 不一致均为 0；聚合 SHA-256 `2d8b6ace3f7e8ab6f6cbe5c1bcfea9d88ec6153e5e7f1818a5c0ac71a300d022`。
- Preview：本阶段未部署；Production、正式域名和 alias 未操作。
- 当前结论：阶段三完成；下一步进入阶段四“建立批量语言测试集”。发布状态继续 `HOLD`。

## 2026-07-17 固定语言语料与分层测试阶段四

- 代码提交：`1dbb1e6`（`test: add versioned language quality corpus`）。
- 语料版本：`20260717-01`；总数 260，分类为 40/60/30/30/25/25/20/30。
- 测试层：纯函数 260、真实 Worker 32、离线中文/JMdict/JLPT 40、浏览器 UI 16、Safari 人工待验 12。
- `npm run test:language-corpus` 已新增并接入 `npm test` 与 `verify:all`；快速 `check` 未增加浏览器负担；阶段五 `audit:language` 尚未实施。
- 门禁：`check`、`test:language-corpus`、`test:kuromoji`、`test:dictionary`、学习数据构建、前端构建、Vercel prebuilt 均 PASS。UI 功能与 390/430/1280/1440/1920 响应式审计的最终独立报告均 PASS；组合执行曾遇本机请求中止噪声，失败步骤与 Issues 为 0。
- UI 证据：`frontend/audit-screenshots/2026-07-17T10-45-11-070Z/`、`frontend/audit-screenshots/2026-07-17T10-47-52-664Z/`。
- 构建一致性：`dist/` 与 `.vercel/output/static/` 各 173 文件；缺失 0、多余 0、SHA-256 不一致 0；生产 bundle 未变化，聚合 SHA-256 保持 `2d8b6ace3f7e8ab6f6cbe5c1bcfea9d88ec6153e5e7f1818a5c0ac71a300d022`。
- 当前结论：阶段四完成；下一步为阶段五独立语言质量审计。未部署、未修改域名或 alias，发布状态继续 `HOLD`。

## 2026-07-17 语言质量审计阶段五

- 审计实现提交：`e358d13`；命令：`npm run audit:language`。
- 最终证据：`frontend/language-audit-results/2026-07-17T12-55-10-902Z/`。
- 规模：260 个固定案例、1148 个实际 token、260/260 目标定位成功。
- PASS 指标：原形 100%、词性 100%、已收录中文 100%、JLPT 100%；同音禁配、功能词误配、专名猜测均为 0。
- FAIL 指标：正文读音 96.34%（门槛 98%）；已知案例 96.54%（门槛 100%）。
- 剩余问题：`七時`、`開く`（2 个语境）、`生`、`一日`、`人気`、`市場`、`今日中`、`避難所` 共 9 个上下文读音错误。
- 中文覆盖单独报告：JMdict 回退 79.03%，完全未命中 20.97%；未用虚构中文释义提高覆盖率。
- 其他自动化、UI 五视口、学习数据、前端构建和 Vercel prebuilt 均 PASS；`dist`/Vercel static 为 173/173，路径与逐文件 hash 一致。
- 当前结论：阶段五审计工具完成，但语言质量门禁为 `FAIL`；不进入 Preview/Production，发布保持 `HOLD / NO-GO`。下一步进入阶段六的通用读音修复与真实文章压力测试。

## 2026-07-17 上下文读音与文章压力测试阶段六

- 代码提交：`b649f65`（`test: add contextual reading and article stress audit`）。
- 自动化实现：完成；阶段五的 9 个上下文读音失败已通过通用词元上下文规则关闭，并新增 15 个真实 Worker 正反例。
- 语言审计：最终 `PASS`；260 个案例、1148 个实际 token、正文读音 100%、原形 100%、词性 100%、已知中文 100%、JLPT 100%、已知回归 100%，同音/功能词/专名严重错误为 0。
- 文章压力集：版本 `20260717-01`，20 篇、6 类文体；真实 Worker 与完整 UI 各 2131 个可点击 token，20/20 成功，段落重建正确，无浏览器错误。
- 命令：新增 `npm run test:contextual-reading` 与 `npm run audit:articles`，并接入完整 `verify:all`；快速 `check` 保持轻量。
- 缓存版本：`20260717-06`；学习数据版本 `20260717`；Kuromoji 资源版本 `20260714-01`。
- 自动化：`check`、`test:language-corpus`、`test:kuromoji`、`test:dictionary`、`audit:ui`、`audit:language`、`audit:articles`、学习数据构建、前端构建和 Vercel prebuilt 全部 PASS；390/430/1280/1440/1920 响应式无回归。
- UI 证据：`frontend/audit-screenshots/2026-07-17T13-55-48-418Z/`、`frontend/audit-screenshots/2026-07-17T13-56-12-929Z/`。
- 语言证据：`frontend/language-audit-results/2026-07-17T13-30-11-367Z/`；文章证据：`frontend/article-stress-results/2026-07-17T13-41-21-065Z/`。
- 构建一致性：`dist/` 与 `.vercel/output/static/` 各 173 文件；缺失 0、多余 0、SHA-256 不一致 0；聚合 SHA-256 `da796256f132c92a2bfb2b815dde6bdfcee0475a3189caa64a23e66a816d614c`。
- 当前结论：阶段六自动化与文章压力门禁完成；真实 Mac/iPhone Safari 定向复测仍为 `PENDING`，需用户授权新的 Preview 后执行。未部署 Preview/Production，未修改域名或 alias，发布继续 `HOLD`。

## 2026-07-17 阶段六 Preview 真机候选

- 部署基线 HEAD：`f02241b179b8d9a4132bbd5b958c62c3087dc31f`。
- 候选内容：173 个 Vercel prebuilt 静态文件；部署前与 `dist/` 路径及逐文件 SHA-256 完全一致。
- Preview：`https://japanese-tool-epvn8940w-zrq-projects1.vercel.app`。
- Deployment ID：`dpl_DfNcADhEvtzZCQcRKrBRZ6RRz7V6`。
- Vercel inspect：target=`preview`；status=`Ready`。
- Production：未部署；正式域名和 Production alias 未修改。
- 当前结论：发布继续 `HOLD`；停止自动操作，等待用户在真实 Mac Safari 与 iPhone Safari 上完成阶段六定向验收。

# 词汇形态统一与语言质量测试计划

> 创建时间：2026-07-17  
> 当前分支：`stabilize/safari-dictionary-20260715`  
> 创建时 HEAD：`f371e46`  
> 当前状态：阶段三“统一详情、收藏和等级继承”已完成；阶段四“建立批量语言测试集”待开始  
> 发布约束：Production 保持不变，发布状态继续 `HOLD`

## 一、计划目的

当前阅读、假名、点击查词、中文优先、JMdict 英文回退、JLPT 参考等级、收藏和朗读链路已经成型，但词汇层仍存在以下系统性风险：

1. 正文表层形、正文实际读音和词典原形之间缺少统一的数据模型。
2. 中文、JLPT、JMdict 查询目前共享简单候选数组，但没有明确标记候选来源和优先级。
3. 活用形、同音词、功能词、复合词和专有名词的处理规则仍分散在不同函数中。
4. 中文词库覆盖率较低，容易通过逐词补丁掩盖结构性问题。
5. 当前测试以已知问题回归为主，尚不能量化真实文章中的整体语言质量。

本计划的目标是：

- 建立统一词语形态模型；
- 建立统一、可解释的查询计划；
- 将正文读音、原形查询、中文释义、英文回退和 JLPT 等级统一起来；
- 建立批量质量测试和可量化语言审计；
- 避免继续以单词特例方式无限修补。

## 二、执行前置条件

开始本计划前，先处理当前 2026-07-17 小补丁候选：

1. 完整检查当前未提交差异。
2. 重新运行完整测试链。
3. 将以下修复形成独立提交，不与形态重构混合：
   - `DICT-CHINESE-COVERAGE-002`
   - `FURIGANA-INFLECTION-001`
   - `JLPT-INFLECTION-001`
   - `UI-TTS-VOICE-DEDUP-001`
4. 如需部署，只部署 Preview。
5. Production、正式域名和 alias 不得修改。

## 三、非目标

本计划不包含：

- 重做阅读页 UI；
- 恢复 PDF 公开入口；
- 引入在线翻译 API；
- 引入付费词典 API；
- 修改朗读、收藏、生词本和导出业务逻辑；
- 合并到 `main`；
- 部署 Production；
- 为每一个未命中词人工编写解释。

## 四、阶段一：建立统一词语形态模型

预计时间：1 个工作日。

### 4.1 统一数据结构

每个正文 token 统一生成一份 `LexicalAnalysis`，至少包含：

```text
surface              正文实际形式，例如：読ん
surfaceReading       正文实际读音，例如：よん
lemma                词典原形，例如：読む
lemmaReading         原形读音，例如：よむ
partOfSpeech         主词性
partOfSpeechDetail   细分词性
conjugationType      活用类型
conjugationForm      活用形
isFunctionWord       是否语法功能词
isProperNoun         是否专有名词
isCompound           是否合并词或复合词
sourceTokenIds       合并前 token 标识
```

### 4.2 强制规则

1. 正文 ruby 只使用 `surfaceReading`。
2. 词典查询主要使用 `lemma`，不得反向覆盖正文读音。
3. JLPT 查询优先使用可靠的 `lemma`。
4. 详情页可同时显示正文形和原形，但不得混用两个读音。
5. 合并礼貌形时保留首个动词的原形、词性和活用信息。
6. 功能词和专有名词必须保留上下文类型，不得降级为纯字符串查询。

### 4.3 建议代码边界

优先新增纯函数，而不是继续扩张 `getTokenInfo()`：

```text
analyzeLexicalToken(token)
mergeLexicalTokens(tokens)
normalizeLexicalAnalysis(analysis)
```

原有 UI 函数只消费统一分析结果。

## 五、阶段二：建立统一词典查询计划

预计时间：1–2 个工作日。

### 5.1 新增查询计划结构

新增统一函数：

```text
buildLexicalLookupPlan(analysis)
```

返回有明确类型和优先级的候选项：

```text
exactSurface    精确正文形式
lemma           原形
compound        可靠复合词
reading         受词性约束的读音候选
fallback        最终安全回退
```

每个候选至少记录：

```text
term
kind
priority
partOfSpeech
allowChinese
allowJlpt
allowJmdict
allowReadingMatch
```

### 5.2 查询顺序

默认顺序：

1. 精确表层词；
2. 原形；
3. 可靠复合词；
4. 受词性限制的读音查询；
5. 安全回退。

### 5.3 安全规则

1. 助动词、助词和系动词不得通过读音命中普通同音名词。
2. `ます`、`です` 等功能词优先使用语法说明。
3. 完整动词不得拆成独立助动词释义。
4. 专有名词未命中时明确说明，不猜测现实世界含义。
5. 读音命中必须受到词性约束；高歧义纯假名不得直接采用第一条结果。
6. 中文、JLPT 和 JMdict 必须使用同一份查询计划，避免三套不同顺序。
7. 复合词回退不得破坏现有中文优先和 JMdict 英文回退。

## 六、阶段三：统一详情、收藏和等级继承

预计时间：1 个工作日。

### 6.1 详情数据

详情页统一消费：

```text
surface
surfaceReading
lemma
partOfSpeech
conjugation
meaning
meaningLanguage
meaningSource
jlptLevel
jlptSource
lookupMatchedTerm
lookupMatchedKind
```

### 6.2 收藏数据

收藏时至少保留：

```text
word                 正文形式
reading              正文实际读音
baseForm             原形
baseReading          原形读音（如可靠）
meaning
meaningLanguage
meaningSource
level
levelSource
partOfSpeech
conjugationForm
```

不改变现有本地存储兼容性；旧数据继续迁移。

### 6.3 JLPT 继承规则

1. 表层形有可靠等级时可直接使用。
2. 表层形无等级时查询原形。
3. 功能词不从同音普通词继承等级。
4. 原形无可靠等级时显示“暂无参考等级”，不得猜测。

## 七、阶段四：建立批量语言测试集

预计时间：1–2 个工作日。

### 7.1 第一版规模

建立 200–300 个固定案例，后续逐步扩展至 1,000 个以上。

建议初始分布：

- 基础词和简单句：40
- 五段、一段及不规则动词活用：70
- 形容词和形容动词活用：30
- 助动词、助词、系动词和功能词：30
- 同音、多义和词性歧义：30
- 复合词与固定搭配：30
- 专有名词、数字、英文混排：30
- 新闻与真实文章片段：40

### 7.2 必测活用

至少覆盖：

```text
読む → 読ん、読んだ、読んで、読まない
書く → 書いて、書いた
行く → 行った、行きます
待つ → 待って、待った
寝る → 寝ます、寝ない、寝た
食べる → 食べます、食べられる
する → します、した、させる
来る → 来ます、来ない、来なかった
高い → 高く、高かった、高くない
静かだ → 静かです、静かだった
```

### 7.3 每个案例记录字段

```text
sentence
surface
expectedSurfaceReading
expectedLemma
expectedPartOfSpeech
expectedConjugation
expectedMeaningClass
expectedJlptLevel
allowReadingLookup
mustNotContain
```

### 7.4 测试层级

1. 纯函数单元测试；
2. Kuromoji Worker 一致性测试；
3. 离线中文与 JMdict 查询测试；
4. 浏览器 UI 测试；
5. Safari 真机抽查。

## 八、阶段五：新增语言质量审计

预计时间：1 个工作日。

新增命令：

```bash
npm run audit:language
```

### 8.1 输出指标

至少输出：

- token 总数；
- 正文读音正确率；
- 原形识别正确率；
- 词性正确率；
- 中文释义命中率；
- JMdict 英文回退率；
- 完全未命中率；
- JLPT 继承成功率；
- 同音词错误匹配数；
- 功能词错误匹配数；
- 专有名词错误猜测数；
- 失败案例清单。

### 8.2 第一版质量门槛

公开 Beta 候选的建议门槛：

- 正文读音正确率：至少 98%；
- 原形识别正确率：至少 97%；
- 已收录词的中文释义正确率：至少 95%；
- 同音词严重错误：0；
- 功能词误配普通名词：0；
- 专有名词虚构解释：0；
- JLPT 错误等级：0；
- 已知回归测试：100% PASS。

中文覆盖率单独报告，不用虚假释义提高命中率。

## 九、阶段六：真实文章压力测试

预计时间：1–2 个工作日。

### 9.1 文章类别

至少覆盖：

- 日常生活；
- 教育；
- 新闻；
- 商业财经；
- 科技；
- 日本机构公告。

### 9.2 测试规模

第一轮抽查不少于：

- 20 篇文章；
- 1,000 个可点击 token；
- Mac Safari 和 iPhone Safari 各进行定向复测。

### 9.3 处理原则

发现问题时：

1. 先判断是否为通用规则问题；
2. 优先修正统一形态或查询逻辑；
3. 只有确认是数据覆盖缺口时才增加词条；
4. 不允许为了提高通过率加入不可靠解释；
5. 每个真实问题必须转为自动回归案例。

## 十、完整门禁

每个阶段完成后运行相关测试；最终必须完整运行：

```bash
cd frontend
npm run check
npm run test:kuromoji
npm run test:dictionary
npm run audit:ui
npm run audit:language

cd ..
npm run learning-data:build
npm run build
npx vercel build
```

并继续执行：

- 390、430、1280、1440、1920 响应式审计；
- `dist/` 与 `.vercel/output/static/` 路径及 SHA-256 对比；
- Preview-only 部署；
- Mac/iPhone Safari 定向验收。

## 十一、提交策略

建议拆分为独立提交：

1. `refactor: introduce unified lexical analysis model`
2. `refactor: centralize dictionary lookup planning`
3. `test: add Japanese morphology quality corpus`
4. `test: add language quality audit`
5. `docs: record lexical quality candidate`

不得把数据大规模扩充、形态重构和 UI 改版混入同一提交。

## 十二、预计时间

从当前小补丁稳定提交后开始计算：

- 统一形态模型：1 天；
- 统一查询计划：1–2 天；
- 详情、收藏与 JLPT 一致性：1 天；
- 第一版 200–300 案例测试集：1–2 天；
- 语言质量审计：1 天；
- 真实文章压力测试与修复：1–2 天。

第一版结构性完成时间：约 5–8 个工作日。

中文覆盖提升至较可靠公开 Beta：预计还需 2–4 周持续扩充和验证，但不应阻塞形态架构先完成。

## 十三、完成定义

本计划只有在以下条件全部满足时才能标记完成：

1. 正文读音与原形读音完全分离；
2. 中文、JLPT、JMdict 使用统一查询计划；
3. 功能词与同音普通词不会误配；
4. 活用形稳定继承原形释义和等级；
5. 专有名词未命中时不猜测；
6. 至少 200–300 个固定语言案例全部通过；
7. `audit:language` 能输出量化报告；
8. 真实文章压力测试达到既定质量门槛；
9. 现有 Safari、朗读、收藏、生词本、导出和移动端功能无回归；
10. Production 保持不变，发布结论仍由真实设备验收决定。

## 十四、执行记录

### 2026-07-17 阶段一完成

- 代码提交：`7194a54`（`refactor: introduce unified lexical analysis model`）。
- 已完成：`normalizeLexicalAnalysis()`、`analyzeLexicalToken()`、`mergeLexicalTokens()`。
- 模型字段：`surface`、`surfaceReading`、`lemma`、`lemmaReading`、主/细分词性、活用类型、活用形、功能词、专有名词、复合词、来源标识。
- 接入范围：正文 token、Worker token、未知词、礼貌形/复合词、详情页、语法功能词判断和页面缓存。
- 缓存版本：`20260717-02`。
- 门禁：`check`、`test:kuromoji`、`test:dictionary`、`audit:ui`、学习数据构建、前端构建、Vercel prebuilt 全部 PASS。
- 构建一致性：168/168 文件，零路径或 hash 差异；聚合 SHA-256 `84c752923c4940dc872ba3736786a21a1227f78b6044f0e6cf5b13f9f158e71f`。
- 部署：未部署 Preview；Production 未操作；状态继续 `HOLD`。
- 下一步：执行阶段二 `buildLexicalLookupPlan()`，不在阶段一中提前扩充批量词条或重做 UI。

### 2026-07-17 阶段二完成

- 代码提交：`aee462a`（`refactor: centralize lexical lookup planning`）。
- 已完成：`buildLexicalLookupPlan()`、`buildCuratedLexicalLookupPlan()`、数据源候选筛选和词性安全条目选择。
- 候选顺序：正文精确形、原形、分隔复合词、受词性约束的读音、安全回退。
- 数据源权限：中文和 JMdict 可按规则使用复合词或读音候选；JLPT 只使用可靠正文形和原形，不使用读音、复合词或安全回退猜测。
- 安全边界：功能词和专有名词禁用读音同音查询；普通纯假名词只在词性严格匹配时允许读音命中；匹配结果记录内部候选类型但不暴露技术字段。
- 接入范围：离线中文、JLPT、JMdict、内置词条初始化、详情、收藏和查询中自动收藏。
- 缓存版本：`20260717-04`；缓存升级工具已纳入两个新查询脚本。
- 门禁：`check`、`test:kuromoji`、`test:dictionary`、`audit:ui`、学习数据构建、前端构建、Vercel prebuilt 全部 PASS。
- 构建一致性：170/170 文件，零路径或 hash 差异；聚合 SHA-256 `370888f6c8e864b72f9b1c768da52a0d879d3e18251a7f9af6dcfd34bcd43fee`。
- 部署：未部署 Preview；Production 未操作；状态继续 `HOLD`。
- 下一步：执行阶段三，统一详情页与收藏数据中的正文形、原形、原形读音、词性和活用字段，并保持旧数据兼容。

### 2026-07-17 阶段三完成

- 代码提交：`e00bb53`（`refactor: unify lexical detail and vocabulary records`）。
- 已完成：统一 `buildLexicalDetailRecord()`、收藏元数据映射、查询命中记录和旧生词字段迁移。
- 详情字段：正文形/读音、原形/原形读音、主/细分词性、活用类型/活用形、释义来源、JLPT 来源、实际命中词和命中类型。
- 收藏字段：`word`、`reading`、`baseForm`、`baseReading`、`partOfSpeech`、`partOfSpeechDetail`、`conjugationType`、`conjugationForm`、`lookupMatchedTerm`、`lookupMatchedKind`；旧 `pos` 字段继续同步保留。
- 兼容规则：旧生词加载时自动补齐 schemaVersion=1 的词汇字段并重新持久化；编辑普通词时原形随正文更新，编辑活用词时保留原形和原形读音。
- 浏览器证据：`寝ます` 详情显示 `寝る（ねる）` 与词形；收藏后保留原形、原形读音、动词词性、活用、原形命中和 N5。
- 缓存版本：`20260717-05`；缓存升级工具已覆盖全部词汇模块脚本。
- 门禁：`check`、`test:kuromoji`、`test:dictionary`、`audit:ui`、学习数据构建、前端构建、Vercel prebuilt 全部 PASS。
- 构建一致性：173/173 文件，零路径或 hash 差异；聚合 SHA-256 `2d8b6ace3f7e8ab6f6cbe5c1bcfea9d88ec6153e5e7f1818a5c0ac71a300d022`。
- 部署：未部署 Preview；Production 未操作；状态继续 `HOLD`。
- 下一步：执行阶段四，建立第一版 200–300 个固定语言案例和分层测试集。

### 2026-07-17 阶段四完成

- 代码提交：`1dbb1e6`（`test: add versioned language quality corpus`）。
- 固定语料版本：`20260717-01`；共 260 个完全确定案例，数据与清单位于 `frontend/test-data/language-corpus/20260717-01/`，不写入生产词库，也不在测试运行时随机生成。
- 分类数量：基础词和简单句 40；动词活用 60；形容词和形容动词 30；功能词 30；同音/多义/词性歧义 25；复合词与固定搭配 25；专有名词/数字/英文混排 20；新闻与真实文章片段 30。
- 分层数量：结构与纯函数 260；真实 Kuromoji Worker 32；离线中文/JMdict/JLPT 40；浏览器 UI 16；Safari 人工清单 12（状态仅为 `PENDING`，未伪造自动通过）。
- 指定活用覆盖：`読む`、`書く`、`行く`、`待つ`、`寝る`、`食べる`、`する`、`来る`、`高い`、`静か` 的要求形态均进入固定案例；32 个 Worker 子集覆盖全部题目指定的代表性活用。
- 新命令：`npm run test:language-corpus`；已接入 `npm test` 与 `verify:all`，未接入快速 `check`。阶段五的 `audit:language` 未提前实施。
- 预期校准原则：以真实 Worker 和当前离线索引为准；未收录等级使用空值，未命中复合词使用 `unknown`，未向生产词库虚构释义或等级。
- 自动化：`check`、`test:language-corpus`、`test:kuromoji`、`test:dictionary`、学习数据构建、前端构建和 Vercel prebuilt 均 PASS。UI 功能与五视口审计分别最终 PASS；组合审计曾因本机请求被中止返回 `CHECK NEEDED`，但失败步骤与 Issues 均为 0，独立重试通过。
- UI 证据：功能 `frontend/audit-screenshots/2026-07-17T10-45-11-070Z/ui-audit-report.md`；响应式 `frontend/audit-screenshots/2026-07-17T10-47-52-664Z/ui-audit-report.md`。
- 构建一致性：`dist/` 与 Vercel static 各 173 文件，缺失/多余/hash 不一致均为 0；测试数据不进入生产 bundle，阶段三候选聚合 SHA-256 保持 `2d8b6ace3f7e8ab6f6cbe5c1bcfea9d88ec6153e5e7f1818a5c0ac71a300d022`。
- 部署：未部署 Preview 或 Production；正式域名、alias 和现有 Preview 均未操作；发布状态继续 `HOLD`。
- 下一步：阶段五新增独立 `audit:language` 量化审计与报告输出，复用本阶段固定语料，不修改公开 UI。

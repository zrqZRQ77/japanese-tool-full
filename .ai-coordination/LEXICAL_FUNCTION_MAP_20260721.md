# Yomeru Lexical 函数映射与去重决策

- 日期：2026-07-21
- 当前分支：`refactor/app-js-lexical-round1`
- 基线提交：`988a040f2fade46c248a48e333f21e5a9fad6a36`
- 状态：`MAPPING_COMPLETED`
- 本文范围：只确定函数归属、删除对象、兼容边界与测试迁移；尚未删除业务代码

## 1. 结论

本轮共检查五个 lexical 文件中的 `36` 个函数：

- 只在 lexical 文件中实现：`21`
- 同时在 `frontend/app.js` 中重复实现：`15`
- 当前真实运行版本：后加载的 lexical integration 文件中的版本

当前页面加载顺序为：

```text
kuromoji-worker-poc.js
lexical-lookup.js
lexical-record.js
app.js
lexical-lookup-integration.js
lexical-detail-integration.js
lexical-vocab-integration.js
mvp-stability-fixes.js
```

因此，`app.js` 先定义旧版本，随后 integration 文件通过同名全局函数覆盖旧版本。当前功能能够工作，依赖的是这种隐式覆盖顺序，而不是清晰的模块边界。

已比较重复函数的实现。integration 文件中的版本普遍包含以下新增能力：

- typed lookup plan；
- 词性和读音匹配保护；
- 统一 lexical record；
- `lookupMatchedTerm` / `lookupMatchedKind`；
- 更完整的生词元数据；
- 手动编辑后的 lexical 字段同步；
- 分析事件记录；
- 更新词形详情。

所以本轮的原则是：

> 保留 integration 文件中的正式实现，删除 `app.js` 中对应旧副本；不反向把正式实现搬回 `app.js`。

## 2. 核心文件的唯一职责

### `lexical-record.js`

唯一负责标准 lexical 数据记录、详情记录和生词 lexical 字段。

| 函数 | 当前状态 | 决策 |
|---|---|---|
| `lexicalRecordText` | 仅此文件 | 保留 |
| `lexicalRecordLevel` | 仅此文件 | 保留 |
| `lexicalRecordAnalysis` | 仅此文件 | 保留 |
| `buildLexicalDetailRecord` | 仅此文件定义 | 保留，供 detail integration 使用 |
| `lexicalVocabMetadata` | 仅此文件定义 | 保留，供 app 与 vocab integration 使用 |
| `normalizeLexicalVocabFields` | 仅此文件定义 | 保留，供迁移与保存使用 |
| `updateEditedLexicalVocabFields` | 仅此文件定义 | 保留，供生词编辑使用 |

### `lexical-lookup.js`

唯一负责查词候选计划、来源权限、词性匹配和结果选择。

| 函数 | 当前状态 | 决策 |
|---|---|---|
| `lookupText` | 仅此文件 | 保留 |
| `lookupPosCategory` | 仅此文件 | 保留 |
| `lookupEntryPosCategories` | 仅此文件 | 保留 |
| `lookupEntryMatchesPos` | 仅此文件 | 保留 |
| `sameKanaLookupForm` | 仅此文件 | 保留 |
| `compoundLookupParts` | 仅此文件定义 | 保留 |
| `buildCuratedLexicalLookupPlan` | 仅此文件定义 | 保留 |
| `buildLexicalLookupPlan` | 仅此文件定义 | 保留 |
| `isLexicalLookupPlan` | 仅此文件定义 | 保留 |
| `legacyLookupCandidates` | 仅此文件 | 暂时保留兼容旧数组输入 |
| `lookupCandidatesForSource` | 仅此文件定义 | 保留 |
| `selectLookupEntry` | 仅此文件定义 | 保留 |

`legacyLookupCandidates` 仍依赖 `app.js` 中的 `dictionaryLookupForms`。第一轮不迁移该通用字符串辅助函数，避免扩大范围。

## 3. 需要从 `app.js` 删除的 15 个旧实现

### A. 查词接入

| 函数 | `app.js` 旧定义 | 正式来源 | 决策理由 |
|---|---:|---|---|
| `lookupOfflineChinese` | 约 4011 行 | `lexical-lookup-integration.js` | 正式版使用查词计划、来源权限和词性安全选择 |
| `lookupJlptReference` | 约 4043 行 | `lexical-lookup-integration.js` | 正式版只使用允许进入 JLPT 来源的候选 |
| `enrichInfoWithJlpt` | 约 4053 行 | `lexical-lookup-integration.js` | 与正式 JLPT 查询保持同一入口 |
| `lookupJmdictCommon` | 约 4081 行 | `lexical-lookup-integration.js` | 正式版通过 `selectLookupEntry` 做读音及词性匹配 |
| `lookupJmdictCommonWithCompoundFallback` | 约 4096 行 | `lexical-lookup-integration.js` | lexical plan 已包含复合词候选，不应再次无条件回退 |
| `autoLookupTokenMeaning` | 约 5814 行 | `lexical-lookup-integration.js` | 正式版建立 lookup plan，并记录匹配词与匹配类型 |

保留在 lookup integration 中的专用辅助函数：

- `recordLexicalLookupMatch`：仅外部文件定义，继续保留。

### B. 词语详情

| 函数 | `app.js` 旧定义 | 正式来源 | 决策理由 |
|---|---:|---|---|
| `detailInflectionHtml` | 约 5656 行 | `lexical-detail-integration.js` | 正式版渲染统一 detail record，并显示原形读音 |
| `detailMetaHtml` | 约 5719 行 | `lexical-detail-integration.js` | 正式版通过 `buildLexicalDetailRecord` 统一详情字段 |
| `refreshVisibleTokenDetail` | 约 4182 行 | `lexical-detail-integration.js` | 正式版同步更新 detail record 和词形区域 |

删除上述旧实现后，以下旧推断辅助代码将失去实际调用，应在同一批次确认后删除：

- `COMMON_BASE_FORM_OVERRIDES`
- `inferInflectionFromSurface`
- `detailInflectionRecord`

这些内容目前只服务于旧 `detailMetaHtml`，统一 detail record 已接管相同职责。

### C. 生词接入

| 函数 | `app.js` 旧定义 | 正式来源 | 决策理由 |
|---|---:|---|---|
| `requestTokenVocabSave` | 约 4192 行 | `lexical-vocab-integration.js` | 正式版使用统一 token cache 和 lexical 元数据 |
| `addToVocab` | 约 7549 行 | `lexical-vocab-integration.js` | 正式版保存统一 part of speech 与 lexical metadata |
| `addTokenToVocab` | 约 7560 行 | `lexical-vocab-integration.js` | 正式版保存 token 的完整 lexical metadata |
| `addTokenSnapshotToVocab` | 约 7567 行 | `lexical-vocab-integration.js` | 正式版兼容 `partOfSpeech` 和旧 `pos` |
| `addCustomToVocab` | 约 7592 行 | `lexical-vocab-integration.js` | 正式版规范化 lexical 字段并记录保存分析事件 |
| `submitVocabEdit` | 约 7862 行 | `lexical-vocab-integration.js` | 正式版调用 `updateEditedLexicalVocabFields` 保持编辑后一致性 |

保留在 vocab integration 中的专用辅助函数：

- `lexicalTokenCache`：统一读取 token cache，继续保留。

## 4. 必须继续保持全局可调用的函数

当前仍使用普通 `<script>` 和 HTML 内联事件，因此以下函数名必须继续存在于全局作用域：

- `addCustomToVocab`
- `addToVocab`
- `requestTokenVocabSave`
- `addTokenToVocab`
- `addTokenSnapshotToVocab`
- `submitVocabEdit`

第一轮不会改成 `type="module"`，也不需要额外建立 `window.Yomeru` API。删除 `app.js` 旧副本后，`lexical-vocab-integration.js` 中的普通函数声明仍会提供相同全局名称。

其他重复函数主要通过 app 内部函数或 integration 文件相互调用，同样保留现有全局名称，避免同时修改调用方。

## 5. 加载时序风险检查

`app.js` 末尾会立即执行 `initializeApp()`，而 integration 文件在其后加载。

已检查 `initializeApp()` 及其直接调用路径：没有发现它在当前同步执行阶段直接调用上述 15 个重复函数。重复函数主要在以下时机触发：

- 用户点击词语或收藏按钮；
- Kuromoji 结果生成后的词典查询；
- 动态生成详情或编辑表单后的事件；
- 后续异步任务。

因此，删除 `app.js` 旧定义在结构上可行，但每个删除批次后仍必须进行真实浏览器流程验证，不能只依赖静态判断。

## 6. integration 文件仍依赖的 `app.js` 基础能力

第一轮去重不等于 integration 文件已经完全独立。它们仍需要 `app.js` 提供以下类别的能力：

### 数据加载与基础词典

- `loadChineseDefinitionShard`
- `offlineShardFor`
- `loadJlptReferenceIndex`
- `loadJmdictCommonShard`
- `jmdictCommonShardFor`
- `dictionaryLookupForms`
- `katakanaToHiragana`

### 页面和详情渲染

- `escapeHtml`
- `detailReadingDisplayHtml`
- `detailBadgesHtml`
- `formatVisibleVocabLevel`
- `chineseMeaningHtml`
- `jmdictMeaningHtml`
- `jmdictEnglishMeaning`
- `syncTokenSaveButton`
- `finishPendingTokenVocabSave`

### 生词系统

- `DICT`
- `vocabData`
- `VOCAB_EDIT_TARGET`
- `CURRENT_ARTICLE_URL`
- `SAMPLE_FLOW_ACTIVE`
- `vocabIdentityKey`
- `displayVocabMeaning`
- `normalizeVocabItem`
- `currentVocabSourceTitle`
- `saveVocab`
- `renderVocab`
- `renderSampleFlow`
- `closeVocabEditDialog`
- `showToast`
- `trackAnalyticsEvent`

这些依赖将在以后“真正模块化”阶段通过 service 或明确接口进一步拆分；本轮只消除重复定义，不扩大到状态管理重构。

## 7. 必须同步修改的测试

现有测试有三处仍把旧实现位置写死为 `app.js`。

### `frontend/tools/check.mjs`

需要调整：

- `requestTokenVocabSave` 的断言改为检查 `lexicalVocabIntegrationJs`；
- `autoLookupTokenMeaning` 的断言改为检查 `lexicalLookupIntegrationJs`；
- `submitVocabEdit` 的 metadata 更新断言改为检查 `lexicalVocabIntegrationJs`；
- `finishPendingTokenVocabSave` 仍检查 `appJs`；
- 增加断言：15 个正式函数不得再次定义在 `app.js` 中。

### `frontend/tools/kuromoji-build-cache.test.mjs`

需要调整：

- 从构建后的 `dist/lexical-vocab-integration.js` 检查 `requestTokenVocabSave`；
- 从该文件检查 `addTokenSnapshotToVocab`；
- `app.js` 只检查动态生成的 `requestTokenVocabSave(${tokenId})` 调用字符串。

### `frontend/tools/kuromoji-app-consistency.test.mjs`

需要调整：

- 单独读取 `lexical-vocab-integration.js`；
- 从该文件抽取 `addTokenSnapshotToVocab`；
- 不再要求函数正文存在于 `app.js`。

## 8. 推荐实施批次

### 批次 0：先迁移测试归属

- 修改上述三个测试文件；
- 增加“`app.js` 不得重复定义 15 个函数”的门禁；
- 此时先不删除函数，门禁可暂时只生成重复清单，随后与批次 1 一起启用。

### 批次 1：删除查词旧实现

删除：

- `lookupOfflineChinese`
- `lookupJlptReference`
- `enrichInfoWithJlpt`
- `lookupJmdictCommon`
- `lookupJmdictCommonWithCompoundFallback`
- `autoLookupTokenMeaning`

### 批次 2：删除详情旧实现

删除：

- `detailInflectionHtml`
- `detailMetaHtml`
- `refreshVisibleTokenDetail`
- `COMMON_BASE_FORM_OVERRIDES`
- `inferInflectionFromSurface`
- `detailInflectionRecord`

### 批次 3：删除生词旧实现

删除：

- `requestTokenVocabSave`
- `addToVocab`
- `addTokenToVocab`
- `addTokenSnapshotToVocab`
- `addCustomToVocab`
- `submitVocabEdit`

每个批次必须独立提交、独立测试、可独立回滚。

## 9. 每批验证要求

至少执行：

```text
根目录：npm run build
frontend：npm run check
frontend：npm run test:dictionary
frontend：npm run test:language-corpus
frontend：npm run test:kuromoji
frontend：npm run verify:flows
```

另外搜索确认：

- 每个已迁移函数只剩一个定义；
- `dist/` 包含全部 integration 文件；
- HTML 内联事件仍能找到全局函数；
- 词语详情、查词、生词保存和编辑流程行为不变。

## 10. 本阶段完成情况

- 五个 lexical 文件函数清单：完成
- `app.js` 重复定义清单：完成
- 加载顺序与覆盖机制：完成
- canonical ownership：完成
- 全局兼容边界：完成
- 测试迁移范围：完成
- 批次 0 测试归属迁移：完成
- 批次 1 查词旧实现删除：完成
- 批次 2 详情旧实现与旧推断辅助项删除：完成
- 批次 3 生词保存、快照和编辑旧实现删除：完成
- 批次 1 `app.js` 减少：130 行
- 批次 2 `app.js` 减少：83 行
- 批次 3 `app.js` 减少：112 行
- 相对 Production 基线累计减少：325 行
- 15 个重复函数唯一实现门禁：完成并通过
- HTML/动态生词入口全局归属检查：完成并通过
- 生词首次保存、重复阻止、metadata 保留和编辑生命周期回归测试：完成并通过
- 真实浏览器刷新持久化：完成并通过
- 最终本地构建、函数唯一性和部署文件检查：完成并通过

本地实现与验收已完成；下一步仅为 Vercel Preview 验收。

# Yomeru 生词系统函数映射（app.js 模块化第二轮）

Updated: 2026-07-22
Branch: `refactor/app-js-vocab-round2`
Source baseline: `dadf3af2b5981df170e9a13465a8b292f786eb75`
Scope: Phase 1 函数映射已完成；Phase 3–6 已迁移 store/list/review/export，Phase 7 本地验收完成。

## 1. 结论

- 第二轮评估的生词系统候选函数共 **71 个**；14 个 store、28 个 list、20 个 review 和 9 个 export 函数已分别唯一实现于四个新模块，`frontend/app.js` 不再保留重复实现。
- 核心可变状态共 **6 组**：`vocabData`、`VOCAB_FILTER`、`VOCAB_JLPT_FILTER`、`VOCAB_EDIT_TARGET`、生词练习页状态、闪卡复习状态。
- 唯一生词持久化键是 `reading_vocab_list`；读取优先走 `window.storage`，否则使用 `safeStorage`（localStorage 兼容层）。
- `frontend/lexical-vocab-integration.js` 直接读取/修改 `vocabData` 和 `VOCAB_EDIT_TARGET`，并调用 store/list 全局函数。第二轮必须保持普通 `<script>` 与兼容全局名称，不能直接把状态封装成外部不可见的私有变量。
- `exportLearningBackup` / `importLearningBackup` / `backupData` / `restoreData` 是跨生词、阅读、语法、练习、设置的完整数据能力，不属于 `vocab-export.js`。
- 当前 HTML 已没有 `vocabSourceFilter`、`vocabList`、`vocabEmptyMsg` 等部分旧节点，但 `app.js` 仍保留空值保护。第二轮先标记为兼容依赖，不在迁移时顺手删除。

## 2. 状态清单

| 状态 | 当前位置 | 读写方 | 建议归属 | 约束 |
|---|---:|---|---|---|
| `vocabData` | `vocab-store.js:9` | store/list/review/export、`lexical-vocab-integration.js`、测试 | `vocab-store.js`（已完成） | 继续维持普通脚本全局词法绑定 |
| `VOCAB_FILTER` | `vocab-list.js:8` | list、HTML onclick | `vocab-list.js`（已完成） | 保持现有过滤值语义 |
| `VOCAB_JLPT_FILTER` | `vocab-list.js:9` | list、HTML onclick | `vocab-list.js`（已完成） | 保持 `all/N5…N1/ungraded` |
| `VOCAB_EDIT_TARGET` | `vocab-list.js:10` | list、`lexical-vocab-integration.js` | `vocab-list.js`（已完成） | 继续保持全局词法绑定 |
| `currentVocabPracticeIndex` / `vocabPracticeAnswerVisible` | `vocab-review.js:8-9` | practice review、store clear | `vocab-review.js`（已完成） | 继续保持普通脚本全局词法绑定 |
| `reviewQueue` / `currentCardWord` / `cardFlipped` / `reviewInitialCount` | `vocab-review.js:12-15` | flashcard review、remove/clear | `vocab-review.js`（已完成） | store 删除/清空继续兼容访问 |
| `SRS_STEPS_MIN` | `vocab-review.js:11` | 两套生词复习评分 | `vocab-review.js`（已完成） | 静态门禁确保两个评分入口共享同一常量 |

## 3. 函数清单与模块候选

标记说明：

- **V**：直接读取或写入 `vocabData` / 生词状态。
- **D**：直接操作 DOM 或生成含事件属性的 HTML。
- **S**：直接访问 `window.storage` / `safeStorage`。
- **H**：被静态或动态 HTML 事件属性直接调用。
- **X**：依赖生词模块外的共享函数/全局状态。

### 3.1 `vocab-store.js`（14）— Phase 3 已迁移

| 函数 | 原 `app.js` 位置 | V | D | S | H | 主要依赖/备注 |
|---|---:|:---:|:---:|:---:|:---:|---|
| `getAllVocab` | 526 | ✓ |  |  |  | 返回 `vocabData` 兼容视图 |
| `isDue` | 530 |  |  |  |  | `Date.now()` |
| `vocabIdentityKey` | 7227 |  |  |  |  | integration 与测试直接依赖 |
| `normalizeVocabItem` | 7231 |  |  |  |  | X：lexical record、等级、释义辅助函数 |
| `normalizeVocabList` | 7265 |  |  |  |  | X：`normalizeVocabItem`、`vocabIdentityKey` |
| `loadVocab` | 7278 | ✓ | ✓ | ✓ |  | X：`renderVocab`、`prepareVocabReview`；保持迁移后自动保存规范化数据 |
| `saveVocab` | 7294 | ✓ |  | ✓ |  | integration、list、review 直接调用 |
| `isSystemGeneratedMeaning` | 7304 |  |  |  |  | 释义显示规则 |
| `displayVocabMeaning` | 7308 |  |  |  |  | integration/list/review/export 共用 |
| `currentVocabSourceTitle` | 7313 |  |  |  |  | X：当前文章标题和 URL 状态 |
| `removeFromVocab` | 7319 | ✓ | ✓ |  | ✓ | X：确认框、list render、review queue reset |
| `vocabMasteryKey` | 7346 |  |  |  |  | list/export 共享的领域派生值 |
| `vocabSourceLabel` | 7354 |  |  |  |  | list/export 共享的来源派生值 |
| `clearAllVocab` | 7915 | ✓ | ✓ |  | ✓ | X：确认框、review/practice 状态、阅读详情重置 |

### 3.2 `vocab-list.js`（28）— Phase 4 已迁移

| 函数 | 原 `app.js` 位置 | V | D | S | H | 主要依赖/备注 |
|---|---:|:---:|:---:|:---:|:---:|---|
| `openVocabPanel` | 517 |  | ✓ |  |  | 调用 `syncVocabPanelData` |
| `closeVocabPanel` | 522 |  | ✓ |  | ✓ | 侧边面板入口 |
| `removeVocabIcon` | 534 |  | ✓ |  |  | SVG markup |
| `syncVocabPanelData` | 693 | ✓ | ✓ |  |  | X：练习状态、每日计划；动态 `removeFromVocab` onclick |
| `runVocabPrimaryAction` | 751 | ✓ | ✓ |  | ✓ | X：workspace；调用 `reviewAllVocab` |
| `vocabMatchesFilter` | 7337 |  |  |  |  | 依赖 mastery 派生值 |
| `vocabMeaningTone` | 7358 |  |  |  |  | 依赖系统释义识别 |
| `filteredVocabForPage` | 7363 | ✓ | ✓ |  |  | 搜索、来源、状态、等级过滤 |
| `setVocabFilter` | 7381 | ✓ | ✓ |  | ✓ | HTML 熟悉程度菜单 |
| `setVocabJlptFilter` | 7390 | ✓ | ✓ |  | ✓ | HTML JLPT 菜单 |
| `clearVocabFilters` | 7399 | ✓ | ✓ |  | ✓ | 清空搜索/来源/状态/等级 |
| `closeVocabFilterMenu` | 7409 |  | ✓ |  | ✓ | HTML 菜单组合调用 |
| `closeVocabManagementMenu` | 7414 |  | ✓ |  | ✓ | HTML 导出/清空组合调用 |
| `closeOpenVocabMenus` | 7419 |  | ✓ |  |  | X：document 级点击关闭逻辑 |
| `syncVocabHeaderFilters` | 7426 | ✓ | ✓ |  |  | 更新 aria 与 active 状态 |
| `renderVocabFilterSummary` | 7441 | ✓ | ✓ |  |  | 生成筛选 chip |
| `vocabWordMarkup` | 7467 |  | ✓ |  |  | ruby/reading markup |
| `vocabListMarkup` | 7475 |  | ✓ |  |  | 动态 `speakEncodedJapanese` / edit / remove onclick |
| `editVocabItem` | 7508 | ✓ |  |  | ✓ | 动态列表入口 |
| `ensureVocabEditDialog` | 7517 |  | ✓ |  |  | 动态 form `submitVocabEdit` 与 close onclick |
| `openVocabEditDialog` | 7544 | ✓ | ✓ |  |  | X：共享 dialog visibility |
| `closeVocabEditDialog` | 7553 | ✓ | ✓ |  | ✓ | integration 提交后调用 |
| `vocabMasteryLabel` | 7558 |  |  |  |  | list/export 共用显示值 |
| `syncVocabSourceFilterOptions` | 7568 | ✓ | ✓ |  |  | 当前 HTML 无 `vocabSourceFilter`，兼容保留 |
| `renderVocab` | 7579 | ✓ | ✓ |  | ✓ | 核心渲染入口；X：milestone、panel、review/list helpers |
| `vocabPracticeTag` | 7645 |  | ✓ |  |  | panel practice 状态标签 |
| `formatDue` | 7653 |  |  |  |  | 当前未发现主路径调用，迁移时先保留 |
| `updateDueCount` | 7660 | ✓ | ✓ |  |  | 当前/旧 DOM 计数与工具提示 |

### 3.3 `vocab-review.js`（20）— Phase 5 已迁移

| 函数 | 原 `app.js` 位置 | V | D | S | H | 主要依赖/备注 |
|---|---:|:---:|:---:|:---:|:---:|---|
| `getVocabPracticeItems` | 6477 | ✓ |  |  |  | store 视图与 due selector |
| `renderVocabPractice` | 6483 | ✓ | ✓ |  |  | 练习页卡片渲染 |
| `nextVocabPractice` | 6513 | ✓ | ✓ |  | ✓ | HTML 练习页入口 |
| `prevVocabPractice` | 6521 | ✓ | ✓ |  | ✓ | HTML 练习页入口 |
| `toggleVocabPracticeAnswer` | 6529 | ✓ | ✓ |  | ✓ | HTML 练习页入口 |
| `rateVocabPractice` | 6534 | ✓ | ✓ |  | ✓ | X：练习统计、错题回顾、每日计划；写 store |
| `markVocabPracticeKnown` | 6580 |  |  |  |  | `rateVocabPractice('easy')` 兼容别名 |
| `getFlashArea` | 7944 |  | ✓ |  |  | DOM selector |
| `setFlashArea` | 7948 |  | ✓ |  |  | 空态/完成态 |
| `updateFlashProgress` | 7957 | ✓ | ✓ |  |  | review state |
| `openVocabReviewPanel` | 7969 |  | ✓ |  |  | inert/aria/focus/scroll |
| `exitFlashcards` | 7983 | ✓ | ✓ |  | ✓ | HTML 退出入口；X：list render |
| `prepareVocabReview` | 7997 | ✓ | ✓ |  |  | load/workspace 初始化调用 |
| `startReview` | 8017 | ✓ | ✓ |  | ✓ | 复习到期词，受当前筛选约束 |
| `reviewAllVocab` | 8032 | ✓ | ✓ |  | ✓ | 全部/当前筛选随机 10 词 |
| `showNextCard` | 8048 | ✓ | ✓ |  |  | queue 驱动 |
| `renderCard` | 8059 | ✓ | ✓ |  |  | 动态 flip/rate/keydown 事件属性 |
| `flipCard` | 8097 | ✓ | ✓ |  | ✓ | 动态卡片入口 |
| `handleFlashCardKey` | 8103 |  | ✓ |  | ✓ | 动态键盘入口 |
| `rateCard` | 8109 | ✓ | ✓ |  | ✓ | X：练习统计、list/practice/daily render；写 store |

### 3.4 `vocab-export.js`（9）— Phase 6 已迁移

| 函数 | 原 `app.js` 位置 | V | D | S | H | 主要依赖/备注 |
|---|---:|:---:|:---:|:---:|:---:|---|
| `downloadTextFile` | 7676 |  | ✓ |  |  | Blob/URL/临时 anchor；可暂由本模块持有 |
| `todayStamp` | 7688 |  |  |  |  | 文件名日期 |
| `exportDateTime` | 7692 |  |  |  |  | ISO 时间 |
| `setInlineStatus` | 7699 |  | ✓ |  |  | 通用状态辅助，但当前主要用于导出 |
| `setVocabExportStatus` | 7709 |  | ✓ |  |  | 三个导出状态节点 |
| `runVocabExportSelect` | 7715 |  | ✓ |  |  | 当前 HTML 未发现 select 入口，兼容保留 |
| `exportVocabCsv` | 7723 | ✓ | ✓ |  | ✓ | X：确认框、toast |
| `exportVocabCsvFile` | 7739 | ✓ | ✓ |  |  | CSV 数据构建与下载 |
| `exportAnkiTsv` | 7768 | ✓ | ✓ |  | ✓ | TSV 数据构建与下载 |

## 4. 明确排除的相邻函数

以下函数不放入四个生词模块：

- `exportLearningBackup`
- `importLearningBackup`
- `backupData`
- `restoreData`
- `clearHistory`

原因：它们同时读写阅读历史、语法本、练习统计、学习目标、队列、TTS 与界面设置。第二轮只把它们视为 `vocab-store` 的调用方（读取/替换生词数据并调用保存/渲染），不扩大为完整数据模块重构。

以下 integration/阅读入口保留在原文件，但属于硬依赖：

- `frontend/lexical-vocab-integration.js`：`requestTokenVocabSave`、`addToVocab`、`addTokenToVocab`、`addTokenSnapshotToVocab`、`addCustomToVocab`、`submitVocabEdit`。
- `frontend/app.js:5739`：`saveSelectedTextToVocab`。

## 5. `vocabData` 依赖图

### 直接写入

- `loadVocab`
- `removeFromVocab`
- `clearAllVocab`
- `importLearningBackup`（跨领域，保留原处）
- `addCustomToVocab`（integration）
- `submitVocabEdit`（integration，对对象原地修改）
- `rateVocabPractice`
- `rateCard`

### 直接读取

- panel/list/filter/render/export/review 全部主路径。
- `frontend/lexical-vocab-integration.js` 的重复检查、保存与编辑检查。
- `frontend/tools/vocab-persistence-browser.test.mjs` 在刷新后直接检查全局 `vocabData`。
- `frontend/tools/kuromoji-app-consistency.test.mjs` 在 VM 上下文直接提供并断言 `vocabData`。

### 建议的兼容策略

第一迁移批次不引入 class/store framework。保留：

```js
let vocabData = [];
```

并让四个普通脚本共享同一全局词法环境。后续如果需要收口写操作，再单独引入 `replaceVocabData` / `updateVocabItem` / `resetVocabReviewState`，不能在本轮迁移时同时改变数据模型。

## 6. Storage / localStorage 依赖

| 键 | 读 | 写 | 路径 | 约束 |
|---|---|---|---|---|
| `reading_vocab_list` | `loadVocab` | `saveVocab` | 优先 `window.storage.get/set(key, false)`；fallback `safeStorage.getItem/setItem` | JSON 数组格式、规范化后自动回写行为必须不变 |

完整备份函数还访问多种 `reading_*` 键，但不属于 `vocab-store.js`。第二轮测试必须保证其通过 `vocabData` + `saveVocab()` 继续工作。

## 7. DOM 依赖

### 当前生词主页/侧面板实际节点

- `vocabSearchInput`
- `vocabPrimaryAction`
- `vocabActiveFilters`
- `vocabClearFilters`
- `vocabFilteredCount`
- `vocabListPage`
- `vocabEmptyPage`
- `flashProgress`
- `flashArea`
- `vocabPanelSlide`
- `vocabCountPanel`
- `totalVocabCountPanel`
- `vocabListPanel`
- `vocabEmptyPanel`
- `dueCountPanel`
- `vocabPracticeEmpty`
- `vocabPracticeBody`
- `vocabQuizCard`
- `vocabPracticeResult`
- `vocabExportStatusPage`
- `vocabExportStatusPanel`

### 动态编辑/复习节点

- `vocabEditModal`
- `vocabEditTitle`
- `vocabEditWord`
- `vocabEditReading`
- `vocabEditMeaning`
- `.vocab-section-page`
- `.vocab-page-list`
- `.vocab-review-primary`
- `.vocab-filter-menu`
- `.vocab-management-menu`
- `.vocab-filter-menu-options [data-status]`
- `.vocab-filter-menu-options [data-level]`

### 兼容或当前未在 HTML 中发现的节点

- `vocabCountPage`
- `vocabList`
- `vocabEmptyMsg`
- `vocabCount`
- `totalVocabCount`
- `vocabSourceFilter`
- `vocabCategoryAll`
- `vocabCategoryDue`
- `vocabCategoryWeak`
- `vocabCategoryUnsure`
- `vocabCategoryPracticed`
- `vocabLibraryTotal`
- `vocabListSummaryCount`
- `dueCount`
- `vocabDueTool`
- `.vocab-filter-tab`
- `.vocab-level-filter`

本阶段只记录，不删除。

## 8. HTML onclick / 动态事件依赖

### `frontend/index.html` 静态入口

- `addCustomToVocab`
- `renderVocab`（`oninput`）
- `runVocabPrimaryAction`
- `exportVocabCsv`
- `exportAnkiTsv`
- `clearAllVocab`
- `closeVocabManagementMenu`
- `clearVocabFilters`
- `setVocabJlptFilter`
- `setVocabFilter`
- `closeVocabFilterMenu`
- `exitFlashcards`
- `prevVocabPractice`
- `toggleVocabPracticeAnswer`
- `rateVocabPractice`
- `nextVocabPractice`
- `closeVocabPanel`
- `reviewAllVocab`
- `startReview`
- `saveSelectedTextToVocab`

### `app.js` 动态 markup 入口

- `removeFromVocab`
- `editVocabItem`
- `submitVocabEdit`
- `closeVocabEditDialog`
- `speakEncodedJapanese`（外部共享）
- `flipCard`
- `handleFlashCardKey`
- `rateCard`

这些函数必须继续以普通全局函数名可解析。第二轮不把 HTML 事件全面改写为 `addEventListener`。

## 9. 脚本顺序约束

当前顺序为：

1. `lexical-lookup.js`
2. `lexical-record.js`
3. `app.js`
4. `lexical-lookup-integration.js`
5. `lexical-detail-integration.js`
6. `lexical-vocab-integration.js`

推荐迁移后的普通脚本顺序：

1. `lexical-lookup.js`
2. `lexical-record.js`
3. `vocab-store.js`
4. `vocab-list.js`
5. `vocab-review.js`
6. `vocab-export.js`
7. `app.js`
8. `lexical-lookup-integration.js`
9. `lexical-detail-integration.js`
10. `lexical-vocab-integration.js`

理由：`app.js` 当前在执行到 `loadVocab()` 时必须已经存在 store/list/review 函数；integration 又必须在 store/list 之后加载。所有新文件仍使用普通 `<script>`，不使用 `type="module"`。

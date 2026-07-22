# Yomeru app.js 模块化第二轮：生词系统主体

Updated: 2026-07-22
Workspace: `/Users/zhouruoqi/Downloads/japan/japaneselearning`
Branch: `refactor/app-js-vocab-round2`
Base: `origin/main` @ `dadf3af2b5981df170e9a13465a8b292f786eb75`
Current phase: Phase 7 — local acceptance complete

## 1. 当前结论

- 上一轮 Lexical 模块化已经发布到 Production，本轮不重新分析、不修改其成果。
- 当前本地 `HEAD` 与 `origin/main` 相同，工作区在建立本轮文档前为干净状态。
- 正式域名仍指向 Production Deployment `dpl_R6cpkaGkqYijPdgqgqShtSQT2gFe`，Target `production`，状态 `Ready`。
- 已从最新 main 建立分支：`refactor/app-js-vocab-round2`。
- Phase 1 已完成函数清单、`vocabData` / DOM / Storage / HTML 事件依赖标记、模块边界和测试基线。
- 本轮 71 个候选函数已完成迁移并通过本地整体验收；没有恢复 Stash，没有部署 Preview，没有修改 Production，没有合并 main。

## 2. 目标与非目标

### 目标

把 `frontend/app.js` 中的生词系统主体按职责迁移到：

- `frontend/vocab-store.js`
- `frontend/vocab-list.js`
- `frontend/vocab-review.js`
- `frontend/vocab-export.js`

迁移必须保持：

- 数据结构与 `reading_vocab_list` 格式不变。
- HTML inline event 全局函数名不变。
- `lexical-vocab-integration.js` 保存、编辑与重复检查行为不变。
- SRS 评分、到期时间、过滤、导出字段与文案不变。
- 普通 `<script>` 架构不变，不引入打包器或 `type="module"`。

### 非目标

- 不重构完整备份/恢复系统。
- 不重构阅读、语法、练习统计或学习计划模块。
- 不清理旧 DOM 兼容代码。
- 不改 UI、文案、数据格式、事件绑定风格或公开功能。
- 不在迁移同时引入 store framework、class、event bus 或状态管理库。
- 不做 Preview、Production 或 main 合并，除非用户另行明确授权。

## 3. 模块边界

### `vocab-store.js`

负责：

- `vocabData` 唯一状态定义。
- identity、normalize、load/save。
- 释义、来源、熟练度等纯领域派生值。
- 删除和清空的生词数据操作。

不负责：

- 列表 HTML 结构。
- 复习卡片渲染。
- CSV/Anki 内容构建。
- 完整学习数据备份。

特殊约束：

- `removeFromVocab` / `clearAllVocab` 当前同时重置 review 状态。迁移初期可保留兼容全局状态访问；稳定后再改为显式 `resetVocabReviewState`，不能在首批同时改行为。
- `lexical-vocab-integration.js` 和浏览器测试直接访问 `vocabData`，首轮迁移必须保留该名称可见。

### `vocab-list.js`

负责：

- 主生词页与侧面板打开/关闭、计数和列表渲染。
- 搜索、状态/JLPT/来源过滤。
- 编辑弹窗。
- 旧 DOM 兼容渲染与空值保护。

不负责：

- 生词持久化实现。
- SRS 队列和评分。
- 文件导出内容。

### `vocab-review.js`

负责：

- 练习页生词卡：前后翻页、显示答案、评分。
- 生词页闪卡：队列、翻面、键盘、评分、进度。
- `SRS_STEPS_MIN` 和所有生词复习专属状态。

不负责：

- 通用练习统计、每日计划、错题回顾的数据实现；继续调用现有共享 API。
- 列表筛选实现；只调用 `filteredVocabForPage()`。

### `vocab-export.js`

负责：

- CSV 和 Anki TSV 导出。
- 生词导出状态提示。
- 当前导出所需的下载、日期、字段格式辅助函数。

不负责：

- `exportLearningBackup` / `importLearningBackup`。
- `backupData` / `restoreData`。
- 阅读、语法、设置等跨领域备份。

详细函数归属见：`.ai-coordination/VOCAB_FUNCTION_MAP_20260721.md`。

## 4. 关键兼容门禁

### 4.1 全局名称

以下名称被静态 HTML、动态 markup、integration 或测试直接解析，迁移后必须继续可用：

- `vocabData`
- `VOCAB_EDIT_TARGET`
- `vocabIdentityKey`
- `normalizeVocabItem`
- `loadVocab`
- `saveVocab`
- `displayVocabMeaning`
- `currentVocabSourceTitle`
- `renderVocab`
- `removeFromVocab`
- `editVocabItem`
- `closeVocabEditDialog`
- `clearAllVocab`
- `setVocabFilter`
- `setVocabJlptFilter`
- `clearVocabFilters`
- `startReview`
- `reviewAllVocab`
- `exitFlashcards`
- `rateVocabPractice`
- `flipCard`
- `handleFlashCardKey`
- `rateCard`
- `exportVocabCsv`
- `exportAnkiTsv`

### 4.2 Storage

- 键：`reading_vocab_list`
- 优先适配：`window.storage.get/set(key, false)`
- fallback：`safeStorage.getItem/setItem`
- 规范化后检测差异并自动 `saveVocab()` 的行为必须保留。
- 解析异常时回退为空数组的行为必须保留。

### 4.3 Integration

`frontend/lexical-vocab-integration.js` 当前直接依赖：

- `vocabData`
- `VOCAB_EDIT_TARGET`
- `vocabIdentityKey`
- `normalizeVocabItem`
- `displayVocabMeaning`
- `currentVocabSourceTitle`
- `saveVocab`
- `renderVocab`
- `closeVocabEditDialog`

第二轮不得修改上一轮 integration 的业务逻辑；只允许在迁移后必要时更新脚本顺序和静态门禁。

### 4.4 HTML inline events

第二轮保留 inline handler。所有静态和动态 handler 必须继续在浏览器全局作用域解析，不能在迁移时改为模块私有函数。

## 5. 推荐脚本顺序

在不改变普通脚本架构的前提下，计划顺序：

```html
<script src="lexical-lookup.js"></script>
<script src="lexical-record.js"></script>
<script src="vocab-store.js"></script>
<script src="vocab-list.js"></script>
<script src="vocab-review.js"></script>
<script src="vocab-export.js"></script>
<script src="app.js"></script>
<script src="lexical-lookup-integration.js"></script>
<script src="lexical-detail-integration.js"></script>
<script src="lexical-vocab-integration.js"></script>
```

理由：

- `app.js` 目前在执行到 `loadVocab()` 时必须已经加载 store/list/review。
- `lexical-vocab-integration.js` 必须在 store/list 后加载。
- 四个新脚本只声明状态和函数，不在 `app.js` 之前执行依赖共享 UI 函数的业务操作。

迁移时需要同步检查：

- `frontend/index.html`
- `frontend/tools/check.mjs`
- `frontend/tools/bump-cache.mjs`
- `scripts/build-frontend.mjs`
- 任何 required file / cache version / script-order 断言。

## 6. 执行顺序

### Phase 1：映射与基线 — 已完成

- [x] 核验 Git、origin/main、Production。
- [x] 从最新 main 建立 `refactor/app-js-vocab-round2`。
- [x] 建立 71 个函数清单。
- [x] 标记状态、DOM、Storage、inline event、integration 和测试依赖。
- [x] 确认四个模块边界。
- [x] 建立迁移顺序和测试基线。
- [x] 不迁移业务代码。

### Phase 2：先建立结构与门禁 — 已完成

- [x] 新建四个非空说明性模块文件，没有复制业务函数。
- [x] 把文件加入 `index.html`、构建清单、缓存更新和 required-files 检查。
- [x] 加入脚本顺序断言：store → list → review → export → app → lexical integrations。
- [x] 增加 71 个生词函数唯一实现计数，门禁跨 `app.js` 与四个新模块统计。
- [x] 统一主 CSS/JS 缓存版本为 `20260721-01`。
- [x] `npm run build`、`npm run check`、`npm run test:vocab-persistence`、`npm run test:dictionary` 全部 PASS。
- [x] `frontend/app.js`、Lexical integration 业务代码和 Production 配置零改动。

### Phase 3：迁移 `vocab-store.js` — 已完成

- [x] 迁移 `vocabData`、identity、normalization、load/save 和纯派生函数。
- [x] 迁移 `removeFromVocab` 与 `clearAllVocab`，暂保留对 review 状态的现有兼容访问。
- [x] 从 `app.js` 删除 14 个相同实现，71 个候选函数继续保持唯一实现来源。
- [x] `app.js` 从 9,473 行减少到 9,321 行，本阶段净减少 152 行。
- [x] 保持 `reading_vocab_list`、`window.storage` / `safeStorage` fallback 和 legacy 自动回写不变。
- [x] 缓存版本提升为 `20260721-02`。
- [x] build、check、vocab persistence、dictionary、Kuromoji 全部 PASS。
- [x] UI 生词相关流程 PASS；仍只有两个既有布局阻断。

### Phase 4：迁移 `vocab-list.js` — 已完成

- [x] 迁移过滤、markup 和纯显示辅助函数。
- [x] 迁移生词主页、侧面板、编辑弹窗及三组列表状态。
- [x] 从 `app.js` 删除 28 个相同实现，71 个候选函数继续保持唯一实现来源。
- [x] 保留旧 DOM 空值保护、动态 markup 和全部 inline handler 全局名称。
- [x] `app.js` 从 9,321 行减少到 8,912 行，本阶段净减少 409 行。
- [x] 缓存版本提升为 `20260721-03`。
- [x] build、check、vocab persistence、dictionary、Kuromoji 全部 PASS。
- [x] UI 生词相关流程 PASS；仍只有两个既有布局阻断。

### Phase 5：迁移 `vocab-review.js` — 已完成

- [x] 迁移闪卡 review state、队列、卡片函数与 inline handler 全局入口。
- [x] 迁移练习页生词卡状态与 7 个练习函数。
- [x] 从 `app.js` 删除 20 个相同实现，71 个候选函数继续保持唯一实现来源。
- [x] 两套评分继续共享 `SRS_STEPS_MIN`，并保持 repetition/interval/dueAt 与练习统计语义。
- [x] 增加共享 review 状态与 SRS 时间表静态门禁。
- [x] `app.js` 从 8,912 行减少到 8,604 行，本阶段净减少 308 行。
- [x] 缓存版本提升为 `20260721-04`。
- [x] build、check、vocab persistence、dictionary、Kuromoji 全部 PASS。
- [x] UI 生词相关流程 PASS；仍只有两个既有布局阻断。

### Phase 6：迁移 `vocab-export.js` — 已完成

- [x] 迁移 9 个 CSV/Anki 与直接辅助函数。
- [x] 保持 CSV header、BOM、字段顺序、等级显示、复习状态、TSV header 和文件名不变。
- [x] 完整备份/恢复函数留在 `app.js`，复用迁移后的下载与日期辅助函数。
- [x] 新增浏览器导出测试，覆盖空列表、CSV/TSV 下载内容、转义、状态提示和完整备份恢复。
- [x] `app.js` 从 8,604 行减少到 8,487 行，本阶段净减少 117 行。
- [x] 缓存版本统一提升为 `20260722-01`。

### Phase 7：本地整体验收 — 已完成

- [x] 71 个候选函数全部只保留一个实现源。
- [x] 构建产物包含四个新模块，缓存版本一致。
- [x] 生词保存→刷新→页面渲染通过。
- [x] lexical 详情→加入→编辑通过。
- [x] 列表、复习、删除、清空、CSV/TSV 导出、完整备份恢复通过。
- [x] 语言语料、真实 Worker、词典、Kuromoji 和 SRS 回归通过。
- [x] `app.js` 从 9,473 行减少到 8,487 行，累计减少 986 行。
- [x] 最终 diff 仅限本轮模块、加载构建、缓存门禁、测试和文档范围。
- [x] 停在本地分支，等待用户决定是否创建 Preview 或整理提交方案。

## 7. 最终本地验收（2026-07-22）

在 `refactor/app-js-vocab-round2`、四模块迁移完成状态下运行：

| 命令 | 结果 | 覆盖 |
|---|---|---|
| 根目录 `npm run build` | PASS | `dist/` 构建 |
| `frontend/npm run check` | PASS | 语法、required files、脚本顺序、lexical 唯一实现、vocab migration/export 静态门禁等 |
| `frontend/npm run test:vocab-persistence` | PASS | 浏览器保存、localStorage、刷新、全局 `vocabData`、列表渲染 |
| `frontend/npm run test:vocab-export` | PASS | CSV/TSV 下载、BOM、表头、字段、转义、空列表、完整备份下载与恢复 |
| `frontend/npm run test:dictionary` | PASS | lexical record/lookup/JMdict/浏览器词典与 vocab persistence |
| `frontend/npm run test:kuromoji` | PASS | Worker 生命周期、词形/等级、详情快照、生词保存/编辑、构建缓存 |
| `frontend/npm run test:language-corpus` | PASS | 260 纯逻辑、真实 Worker、词典/JLPT、渲染 UI 和上下文阅读回归 |
| `frontend/npm run verify:flows` | BLOCKED（既有基线） | 生词页与闪卡流程 PASS；两个既有布局断言阻断 |

`verify:flows` 当前阻断项：

1. TTS 设置控件断言仍报告失败，但返回 geometry 显示两个控件同一行、等高且在 viewport 内；属于既有断言/环境问题。
2. `mobile-390` hero secondary actions 行布局返回 `null`；属于上一轮已记录的既有环境阻断。

本轮生词相关 flow：

- `word detail and vocab add`：PASS
- `vocab page and flashcard`：PASS
- `delete confirmation`：PASS
- legacy vocabulary migration：PASS

Phase 7 最新 UI audit report：`frontend/audit-screenshots/2026-07-22T05-43-03-092Z/ui-audit-report.md`。结果仍仅为上述两个既有阻断，生词相关流程全部 PASS。

## 8. 每批最低验证

### 结构/门禁批

- `npm run build`
- `npm run check`
- `npm run test:vocab-persistence`

### Store/List 批

- 上述三项
- `npm run test:dictionary`
- 手动或自动：加入、重复阻止、编辑、删除、刷新持久化、搜索/筛选。

### Review 批

- 上述三项
- `npm run test:kuromoji`
- `npm run verify:flows`，只允许与已记录的两个既有阻断相同；生词 flow 必须 PASS。

### Export/最终批

- 全部上述命令
- CSV/Anki 内容检查
- 完整备份恢复回归
- `git diff --check`
- Git 状态和变更范围审计

## 9. 主要风险与处理

| 风险 | 影响 | 处理 |
|---|---|---|
| 把 `vocabData` 私有化 | integration、inline handler、浏览器测试失效 | 首轮保持全局词法绑定和函数名 |
| 脚本顺序错误 | `loadVocab` 或 integration 在定义前执行 | 增加静态顺序门禁和浏览器持久化测试 |
| store 删除/清空直接碰 review state | 拆分后 ReferenceError 或残留卡片 | 先兼容共享状态，后续再引入显式 reset API |
| 两套评分逻辑漂移 | dueAt、repetition、统计不一致 | `SRS_STEPS_MIN` 单一来源，测试两套评分 |
| 把完整备份误放入 export | 扩大范围并引入大量跨域依赖 | 明确留在 app.js |
| 迁移时顺手删除旧 DOM 兼容 | 隐藏路径回归 | 本轮仅移动，不清理 |
| HTML inline handler 不再全局可见 | 点击无响应 | 保持普通脚本与全局函数；静态 + 浏览器门禁 |
| cache/build 文件漏加 | Preview/Production 404 或旧缓存 | 同步 build、bump-cache、check、index |

## 10. 当前停止点

Phase 7 本地整体验收和 Preview 人工验收均已完成。当前停在 `refactor/app-js-vocab-round2` 本地未提交分支；下一步整理单一提交并推送该分支，未经用户再次明确授权不修改 Production、不合并 main。

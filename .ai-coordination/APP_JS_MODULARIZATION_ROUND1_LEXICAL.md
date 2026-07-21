# Yomeru `app.js` 模块化第一轮：Lexical 去重与边界整理

- 决策日期：2026-07-21
- 当前状态：`IN_PROGRESS`
- 当前完成度：`70%`
- 执行优先级：`P1`
- 是否允许修改 Production：`否`
- 当前目标：只整理 lexical 领域代码，不改变公开 Beta 功能和用户行为

## 1. 为什么先做这一轮

`frontend/app.js` 已接近一万行，同时项目已经存在以下局部模块：

- `frontend/lexical-record.js`
- `frontend/lexical-lookup.js`
- `frontend/lexical-lookup-integration.js`
- `frontend/lexical-detail-integration.js`
- `frontend/lexical-vocab-integration.js`

但部分函数仍同时存在于 `app.js` 与外部文件中，存在同名覆盖、修改两份代码、加载顺序依赖和后续维护困难等风险。

本轮不追求一次性拆完整个 `app.js`，而是先选择已有测试和已有模块基础最完整的 lexical 领域，完成第一轮安全去重，建立后续模块化的标准执行方式。

## 2. 本轮目标

在不改变以下内容的前提下，建立 lexical 领域的单一真实实现来源：

- 公开 Beta 的页面行为；
- 词语详情显示；
- 中文释义、JMdict 与 JLPT 回退逻辑；
- 假名校正与词语绑定；
- 生词添加、编辑、去重和持久化；
- `localStorage` 数据格式；
- 当前普通 `<script>` 加载方式；
- 当前 UI、文案、分析事件与导出功能。

完成后，`app.js` 中已被 lexical 模块接管的重复函数应被删除，不能保留两套实现。

## 3. 本轮范围

### 重点代码文件

- `frontend/app.js`
- `frontend/lexical-record.js`
- `frontend/lexical-lookup.js`
- `frontend/lexical-lookup-integration.js`
- `frontend/lexical-detail-integration.js`
- `frontend/lexical-vocab-integration.js`
- `frontend/index.html`
- `scripts/build-frontend.mjs`
- `frontend/tools/check.mjs`

### 重点测试文件

- `frontend/tools/lexical-record.test.mjs`
- `frontend/tools/lexical-lookup-plan.test.mjs`
- `frontend/tools/jmdict-common.test.mjs`
- `frontend/tools/jmdict-browser.test.mjs`
- `frontend/tools/language-corpus.test.mjs`
- `frontend/tools/language-corpus-browser.test.mjs`
- `frontend/tools/contextual-reading.test.mjs`
- `frontend/tools/ui-audit.mjs`
- `frontend/tools/kuromoji-build-cache.test.mjs`
- `frontend/tools/kuromoji-app-consistency.test.mjs`

## 4. 明确不做

- [ ] 不迁移 React。
- [ ] 不全面切换为 `type="module"`。
- [ ] 不修改界面和视觉设计。
- [ ] 不改变用户文案。
- [ ] 不修改现有数据格式。
- [ ] 不增加账号、登录、支付或云同步。
- [ ] 不增加批量 PPT 或教师模板。
- [ ] 不接入 AI API。
- [ ] 不拆阅读核心、导出系统、练习系统或历史模块。
- [ ] 不直接部署 Production。
- [ ] 不覆盖当前工作区中的未提交修改。

以上项目全部保持未执行，属于本轮边界，不是待完成事项。

## 5. 执行阶段与进度

### 阶段 A：确认基线与依赖关系

状态：`COMPLETED`

- [x] 读取 `AGENTS.md`、`.ai-bridge/current-plan.md` 和本文件。
- [x] 记录当前分支和全部未提交文件。
- [x] 保存当前 Production 的完整本地回滚快照和逐文件哈希清单。
- [x] 对比当前 `frontend/` 与 Production 快照，确认 174/174 个部署文件完全一致。
- [x] 检查 `frontend/app.js` 当前基线状态；重构分支建立后工作区干净。
- [x] 检查五个 `lexical-*` 文件当前基线状态；没有未提交业务修改。
- [x] 确认 `frontend/index.html` 的脚本加载顺序。
- [x] 确认 `scripts/build-frontend.mjs` 的部署文件清单。
- [x] 运行拆分前基线测试并记录结果；UI 流程审计存在环境阻断，已单独记录。

完成标准：已明确当前代码基线、重复定义和依赖关系，且尚未改动业务代码。

### 阶段 B：建立 lexical 函数清单

状态：`COMPLETED`

- [x] 列出 `app.js` 中所有 lexical 相关函数。
- [x] 列出五个 `lexical-*` 文件中的公开函数。
- [x] 标注每个函数的定义位置和调用位置。
- [x] 标注 HTML 内联调用和全局调用边界。
- [x] 标注对 `DICT`、`vocabData`、`CURRENT_ARTICLE_URL` 等全局状态的依赖。
- [x] 确认同名函数的实际覆盖顺序。
- [x] 确认共有 36 个 lexical 函数，其中 15 个在 `app.js` 中重复定义。

详细映射：[`LEXICAL_FUNCTION_MAP_20260721.md`](./LEXICAL_FUNCTION_MAP_20260721.md)

完成标准：已形成“保留、迁移、删除、兼容”的完整函数映射表。

### 阶段 C：确定单一实现来源

状态：`COMPLETED`

- [x] `lexical-record.js` 只负责标准词语记录和规范化。
- [x] `lexical-lookup.js` 只负责查词计划和结果选择。
- [x] `lexical-lookup-integration.js` 作为查词来源接入的唯一实现。
- [x] `lexical-detail-integration.js` 作为词语详情接入的唯一实现。
- [x] `lexical-vocab-integration.js` 作为 lexical 记录与生词系统衔接的唯一实现。
- [x] 明确必须继续保留的全局函数名称。
- [x] 确认第一轮继续使用普通脚本的全局声明，无须额外增加 `window` 兼容层。
- [x] 确认三个测试文件需要同步迁移函数归属断言。

完成标准：每项能力已经确定唯一目标实现文件；实际重复代码将在阶段 D 分批删除。

### 阶段 D：小批量迁移与去重

状态：`IN_PROGRESS`

实施批次：

- [x] 批次 0：修改测试，使其检查 integration 文件而不是旧 `app.js` 实现。
- [x] 批次 1：删除查词接入旧实现。
- [x] 批次 2：删除词语详情旧实现和失去调用的旧推断辅助代码。
- [ ] 批次 3：删除生词保存、快照保存和编辑旧实现。
- [x] 已从 `app.js` 删除 6 个查词旧实现。
- [x] 已从 `app.js` 删除 3 个详情旧实现和 3 个旧推断辅助项。
- [x] 搜索确认查词和详情函数只剩对应 integration 文件一处定义。
- [x] 已完成批次 1 和批次 2 的专项测试并记录。
- [x] 批次 1 已形成独立提交；批次 2 将在本轮形成独立提交。

完成标准：`app.js` 中不再保留已迁移 lexical 函数的重复副本。

### 阶段 E：构建与加载整理

状态：`NOT_STARTED`

- [ ] 确认 `index.html` 的脚本顺序与依赖一致。
- [ ] 如新增目录或文件，更新 `scripts/build-frontend.mjs`。
- [ ] 构建后确认 `dist/` 包含全部 lexical 文件。
- [ ] 确认缓存版本参数已按项目规则更新。
- [ ] 不引入 Production 部署操作。

完成标准：本地和 Preview 构建不会因为模块文件缺失或加载顺序错误而失败。

### 阶段 F：完整验证

状态：`NOT_STARTED`

必须执行：

- [ ] 根目录：`npm run build`
- [ ] `frontend`：`npm run check`
- [ ] `frontend`：`npm run test:dictionary`
- [ ] `frontend`：`npm run test:language-corpus`
- [ ] `frontend`：`npm run test:kuromoji`
- [ ] `frontend`：`npm run verify:flows`

核心行为确认：

- [ ] 粘贴文章后词语详情正常。
- [ ] 中文释义与 JMdict 回退正常。
- [ ] JLPT 显示规则不变。
- [ ] 假名校正后词语详情仍对应正确词语。
- [ ] 添加生词正常。
- [ ] 重复添加提示正常。
- [ ] 编辑生词正常。
- [ ] 刷新后生词持久化正常。
- [ ] 不影响 PPTX、PNG 和 JPEG 导出入口。
- [ ] 不影响当前公开 Beta 导航和页面。

完成标准：全部规定测试通过；无法运行的项目必须记录原因和风险，不能直接标记完成。

### 阶段 G：交付与记录

状态：`NOT_STARTED`

- [ ] 更新本文件的当前状态和完成百分比。
- [ ] 在“实际完成内容”中记录被迁移和删除的函数。
- [ ] 在“测试结果”中记录命令、结果和日期。
- [ ] 在“遗留问题”中记录尚未处理的全局依赖。
- [ ] 更新 `.ai-bridge/agent-status.md`。
- [ ] 保存实现差异或审查摘要。
- [ ] 明确下一轮建议，但不自动开始第二轮。

完成标准：后续任何代理打开项目，都能直接判断已经做了什么、还剩什么和当前是否安全。

## 6. 当前已确认事实

- `frontend/app.js` 接近一万行。
- 页面当前仍使用普通 `<script>` 加载，不是完整 ES Module 架构。
- `frontend/index.html` 当前先加载 `app.js`，再加载多个 lexical integration 文件。
- 五个 lexical 文件共定义 36 个函数，其中 15 个也存在于 `app.js`。
- 当前真实运行的是后加载的 integration 文件版本。
- integration 版本包含 typed lookup、词性保护、统一 record、完整生词 metadata 和编辑同步等正式逻辑。
- 项目已有较完整的词典、语言语料和 UI 流程测试，可作为重构安全网。
- 当前 Production 已保存到 `.ai-bridge/production-baselines/2026-07-21-dpl_7n1BZh1MWE4jKXtAm1L7bP458kpr/`。
- 当前 `frontend/` 与 Production 快照的 174 个部署文件逐字节一致，差异为 0。
- GitHub Production 基线提交：`988a040f2fade46c248a48e333f21e5a9fad6a36`。
- GitHub 备份分支：`backup/production-20260721`；固定 Tag：`production-20260721-before-app-modularization`。
- 当前开发分支：`refactor/app-js-lexical-round1`。
- 其余未提交工作已保存到命名 Stash：`pre-refactor remaining worktree 2026-07-21`。

## 7. 实际完成内容

已完成第一批业务代码删除：`app.js` 中 6 个查词旧实现已移除，正式实现继续由 `lexical-lookup-integration.js` 提供。

| 日期 | 阶段 | 完成内容 | 文件 | 状态 |
|---|---|---|---|---|
| 2026-07-21 | 计划建立 | 建立第一轮 lexical 模块化执行计划与追踪清单 | 本文件、`.ai-bridge/current-plan.md` | 完成 |
| 2026-07-21 | 阶段 A | 保存 Production 完整静态快照、哈希清单和回滚说明；确认当前 frontend 与线上 174 个文件完全一致 | `.ai-bridge/production-baselines/...`、`PRODUCTION_ROLLBACK_BASELINE_20260721.md` | 完成 |
| 2026-07-21 | 阶段 A | 创建并推送 GitHub 基线提交、备份分支和固定 Tag；将无关未提交工作存入命名 Stash；创建干净重构分支 | `988a040`、`backup/production-20260721`、`refactor/app-js-lexical-round1` | 完成 |
| 2026-07-21 | 阶段 B/C | 检查 36 个 lexical 函数，识别 15 个重复定义，确定唯一实现来源、全局兼容边界和测试迁移范围 | `LEXICAL_FUNCTION_MAP_20260721.md` | 完成 |
| 2026-07-21 | 阶段 D 批次 0/1 | 迁移测试归属断言；删除 `app.js` 中 6 个查词旧实现；增加唯一实现门禁 | `frontend/app.js`、4 个测试文件 | 完成 |
| 2026-07-21 | 阶段 D 批次 2 | 删除 `app.js` 中 3 个详情旧实现和 3 个旧推断辅助项；扩展唯一实现门禁 | `frontend/app.js`、`frontend/tools/check.mjs` | 完成 |

## 8. 测试结果

拆分前业务基线已经运行；构建、维护检查、词典和语言语料测试通过。UI 流程审计的大部分核心流程通过，但在当前环境被两个布局断言阻断，未将其伪装为 PASS。

| 日期 | 命令 | 结果 | 备注 |
|---|---|---|---|
| 2026-07-21 | `node .ai-bridge/capture-production-baseline.mjs` | PASS | 174/174 文件保存成功，失败 0，总大小 27,832,351 bytes |
| 2026-07-21 | Production 快照与当前 `frontend/` SHA-256 对比 | PASS | 一致 174、不同 0、缺失 0 |
| 2026-07-21 | 根目录 `npm run build` | PASS | 成功生成 `dist/` |
| 2026-07-21 | `frontend`：`npm run check` | PASS | 所有维护检查通过 |
| 2026-07-21 | `frontend`：`npm run test:dictionary` | PASS | lexical、索引、JMdict 与浏览器词典流程通过 |
| 2026-07-21 | `frontend`：`npm run test:language-corpus` | PASS | 260 个纯层案例、32 个 Worker、40 个词典/JLPT、16 个 UI 和 15 个上下文案例通过 |
| 2026-07-21 | `frontend`：`npm run verify:flows` | BLOCKED | 主要功能流程通过；TTS 设置标签断言与 mobile-390 次级操作布局断言未通过，报告标记为测试环境阻断 |
| 2026-07-21 | `git diff --cached --check` | PASS | 基线提交无空白错误 |
| 2026-07-21 | `npx vercel inspect https://yomeru.japanese-hub.com` | 首次 PASS；末次 BLOCKED | 首次确认部署 ID；完成后 Vercel CLI token 失效，后续元数据操作需重新登录 |
| 2026-07-21 | lexical 函数静态映射 | PASS | 36 个函数，15 个重复定义，21 个唯一实现 |
| 2026-07-21 | 批次 0/1：根目录 `npm run build` | PASS | 删除后成功生成 `dist/` |
| 2026-07-21 | 批次 0/1：`frontend` `npm run check` | PASS | 新的唯一实现门禁通过 |
| 2026-07-21 | 批次 0/1：`frontend` `npm run test:dictionary` | PASS | 中文词典、JLPT、JMdict 与浏览器回退流程通过 |
| 2026-07-21 | 批次 0/1：`frontend` `npm run test:language-corpus` | PASS | 260 个纯层案例及浏览器/上下文案例通过 |
| 2026-07-21 | 批次 0/1：`frontend` `npm run test:kuromoji` | PASS | Worker 生命周期、竞态、词形、快照与构建缓存通过 |
| 2026-07-21 | 批次 0/1：`frontend` `npm run verify:flows` | BLOCKED（与基线一致） | 核心查词、生词和阅读流程通过；仍为原有两个布局断言阻断 |
| 2026-07-21 | 批次 2：根目录 `npm run build` | PASS | 详情去重后成功生成 `dist/` |
| 2026-07-21 | 批次 2：`frontend` `npm run check` | PASS | 查词与详情共 9 个函数唯一实现门禁通过 |
| 2026-07-21 | 批次 2：`frontend` `npm run test:dictionary` | PASS | 统一 detail record、原形读音、词形与词典流程通过 |
| 2026-07-21 | 批次 2：`frontend` `npm run test:language-corpus` | PASS | 260 个纯层案例及浏览器/上下文案例通过 |
| 2026-07-21 | 批次 2：`frontend` `npm run test:kuromoji` | PASS | Worker、竞态、词形读音、详情快照与构建缓存通过 |
| 2026-07-21 | 批次 2：`frontend` `npm run verify:flows` | BLOCKED（与基线一致） | 真实文章、词语详情和生词流程通过；仍为原有两个布局断言阻断 |

## 9. 遗留问题

- Vercel CLI 当前 token 已失效；后续创建 Preview 或查询元数据前需要重新登录，但不得自动发布 Production。
- UI 流程审计的两个布局断言需要在后续本地浏览器环境复核。
- integration 文件仍依赖较多 `app.js` 全局状态和辅助函数；第一轮只去重，不进行状态管理重构。
- 生词批次对应的测试位置断言仍将在下一批继续扩展唯一实现门禁。

## 10. 完成定义

只有同时满足以下条件，才能把本任务标记为 `COMPLETED`：

1. lexical 关键函数不再在 `app.js` 和外部文件中重复实现；
2. 每项能力有明确且唯一的实现来源；
3. 旧调用链通过清晰兼容边界继续工作；
4. 公开 Beta 行为和数据格式不变；
5. 所有规定测试通过或有明确阻断记录；
6. 本文件已更新实际完成内容、测试结果、遗留问题和完成百分比；
7. 未经授权不得部署 Production。

## 11. 当前进度

- 计划与边界定义：`100%`
- 基线与函数映射：`100%`
- 代码执行：`70%`
- 测试验证：`75%`
- 本轮总体完成度：`70%`

下一步执行阶段 D 的批次 3：删除 `app.js` 中 6 个生词旧实现，确认 HTML 内联调用继续由 `lexical-vocab-integration.js` 提供全局函数，扩展唯一实现门禁并运行同等级验证。

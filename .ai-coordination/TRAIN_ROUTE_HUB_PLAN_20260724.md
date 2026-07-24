# Yomeru 电车路线主页与多路线扩展计划

Updated: 2026-07-24
Status: draft_pr_preview_ready_user_acceptance_pending
Owner: Codex / ChatGPT

## 当前执行快照

- Phase 0–8：100%
- 总体完成度：100%
- 分支：`feat/train-route-hub`
- 最新功能提交：`1943d84`
- 远端分支：已推送
- Preview：`https://japanese-tool-pfjqm73jq-zrq-projects1.vercel.app`
- Preview Deployment：`dpl_9A2gt9xtxBkN7FSP2e2CasSsZVWJ` / Ready
- Draft PR：`#8` / Draft
- 用户反馈微调：已删除主页说明文字并简化右侧路线示意图
- Production：未修改

## 1. 项目目标

将现有单一路线电车日语输入挑战升级为可持续扩展的多路线模块：

- `/challenge/train`：电车游戏路线主页；
- `/challenge/train/play?route=<routeId>`：通用路线挑战页；
- 保留现有“新宿 → 上野”路线；
- 新增两条路线；
- 三条路线共用同一套挑战、IME、计时、成绩卡、分享和本地成绩逻辑；
- 原 `/challenge/train` 链接继续可访问，不出现 404；
- 用户可以从路线主页查看路线信息、挑战状态和最佳成绩后进入挑战。

本项目预计 4–6 个工作日。开发、测试、截图检查、Draft PR 和 Preview 可以按阶段连续完成，不需要每个小阶段重复申请批准。

## 2. 当前基线

- 主项目：`/Users/zhouruoqi/Downloads/japan/japaneselearning`
- 电车 worktree：`/Users/zhouruoqi/Downloads/japan/japaneselearning-train`
- 现有电车分支：`feat/train-typing-challenge`，已合并，不继续直接开发。
- 新开发分支目标：`feat/train-route-hub`，必须从执行时最新的 `origin/main` 创建。
- 2026-07-24 最近一次核验的 `origin/main`：`6a821a65d56af7576e4312ef4b1df33eb6d889f4`。执行前必须重新核验，不得直接依赖该记录。
- 主工作区存在 16 项既有 `frontend/visual-snapshots` 删除记录：不得恢复、扩大或混入新提交。
- 旧 Stash 不恢复。
- 已完成的电车输入框、手机保存按钮、`賢い` 元数据和“复习完成”修复不得重新分析或重复修改。

## 3. 第一版范围

### 包含

1. 通用路线配置和路线注册表。
2. 路线主页。
3. 保留现有山手线新宿 → 上野路线。
4. 新增一条同线路或相近难度的短路线。
5. 新增一条不同线路的短路线。
6. 路线级独立成绩、最近记录和挑战次数。
7. `yomeru_train_typing_v1` 到新结构的安全迁移。
8. 路线级分享链接和成绩卡。
9. 桌面、窄屏、手机和成绩卡完整视觉验收。

### 不包含

- 排行榜、登录、后端或云端成绩；
- 多人模式、换乘挑战或混合线路；
- 山手线完整一圈或超过 20 站的长路线；
- 铁路运营机构 Logo 或官方线路图复制；
- Production 发布；
- vocabulary 运行时接入或中文词库文件修改。

## 4. 路由与页面结构

```text
/challenge/train
  电车游戏路线主页

/challenge/train/play?route=yamanote-north-short
  现有新宿 → 上野路线

/challenge/train/play?route=<new-route-a>
  新路线 A

/challenge/train/play?route=<new-route-b>
  新路线 B
```

兼容要求：

- 旧 `/challenge/train` 链接变为路线主页，但必须保持可用；
- 路线主页优先展示原有新宿 → 上野路线；
- 新分享链接必须包含具体 `routeId`；
- 不存在或损坏的 `routeId` 应显示明确错误并返回路线主页，不得白屏。

## 5. 路线数据模型

路线配置应至少支持：

```json
{
  "schemaVersion": 2,
  "routeId": "yamanote-north-short",
  "lineNameZh": "山手线",
  "lineNameJa": "山手線",
  "titleZh": "新宿 → 上野",
  "difficulty": "beginner",
  "recommendedJlpt": "N5–N4",
  "themeKey": "yamanote",
  "source": {},
  "stations": [],
  "share": {}
}
```

通用引擎不得继续写死：

- 13 个站；
- 新宿、上野；
- 山手线名称；
- 固定路线数据地址；
- 平均每站除以 13；
- 固定分享文案；
- 固定成绩存储键；
- 仅适用于现有路线的进度布局。

## 6. 新路线选择标准

第一版采用“一条同类路线＋一条不同线路”的组合：

- 新路线 A：与现有路线相近，8–15 站，用于验证不同站数和同线路复用；
- 新路线 B：东京地区另一条铁路或地铁短路线，8–15 站，用于验证不同线路主题和用户偏好；
- 站序、日文表记、读音和运营主体必须通过官方来源重新核验；
- 接受答案使用人工白名单，不做模糊匹配；
- 常见中日字形变体只能逐词人工加入；
- 不复制官方线路图，不使用运营机构 Logo。

精确路线区间可以在 Phase 4 开始时按以上标准确定，不构成用户阻断；若需要长路线、换乘或超出东京地区，则必须重新申请范围批准。

## 7. 执行阶段

### Phase 0：计划与交接

状态：100%

完成标准：

- 写入本专项计划；
- 更新 `.ai-bridge/current-plan.md`、`agent-status.md`、`decisions.md` 和 `open-questions.md`；
- 不修改业务代码；
- 不 commit、push、合并或部署。

### Phase 1：基线核验与新分支

状态：100%

任务：

1. 核验主工作区、电车 worktree、GitHub `origin/main`、PR、Preview 和 Production。
2. 确认电车 worktree 干净，旧分支已合并。
3. 从执行时最新 `origin/main` 创建 `feat/train-route-hub`。
4. 记录现有电车功能和测试基线。
5. 不触碰主工作区 16 项快照删除。

完成标准：新分支基线清楚、工作区干净、现有测试结果已记录。

### Phase 2：通用路线引擎

状态：100%

任务：

1. 建立路线注册表和统一数据结构。
2. 将现有路线迁移到新结构。
3. 让站数、起终点、名称、难度、分享和成绩卡来自配置。
4. 支持动态桌面进度和手机进度。
5. 保持两种输入模式、IME、提示、计时、错误重试和分享行为不变。
6. 暂不开发新路线主页和新路线。

完成标准：现有新宿 → 上野路线在新引擎中无功能和视觉回归。

### Phase 3：路线主页

状态：100%

任务：

1. 将 `/challenge/train` 改为路线主页。
2. 路线卡片显示线路、起终点、站数、难度、推荐 JLPT、挑战次数和最佳成绩。
3. 支持未挑战、已有成绩、推荐和新路线状态。
4. 路线卡片使用纵向移动端布局，不依赖横向滑动。
5. 提供进入路线和返回 Yomeru 的明确路径。

完成标准：主页在桌面、820px 和 390px 均无溢出、遮挡或重复信息。

### Phase 4：新增路线 A

状态：100%

任务：

1. 按官方来源选择并核验 8–15 站的同类短路线。
2. 建立路线数据、答案白名单、来源和专项测试。
3. 验证不同站数、长站名和结果统计。
4. 完成桌面、窄屏、手机和成绩卡截图检查。

完成标准：路线 A 可完整挑战、保存、分享并独立记录成绩。

### Phase 5：新增路线 B

状态：100%

任务：

1. 选择东京地区不同线路的 8–15 站短路线。
2. 建立独立主题，但保持 Yomeru 统一视觉系统。
3. 完成数据核验、答案白名单和专项测试。
4. 完成桌面、窄屏、手机和成绩卡截图检查。

完成标准：路线 B 可完整挑战，且不会与前两条路线混用成绩或分享数据。

### Phase 6：成绩结构升级与迁移

状态：100%

目标结构：

```json
{
  "schemaVersion": 2,
  "routes": {
    "yamanote-north-short": {
      "bestByMode": {},
      "recentResults": [],
      "totalChallenges": 0
    }
  },
  "lastRouteId": "yamanote-north-short"
}
```

任务：

1. 将旧 `yomeru_train_typing_v1` 单路线成绩归入原路线。
2. 保持纯挑战与练习提示记录分离。
3. 不读取或覆盖 `reading_vocab_list` 等学习数据。
4. 损坏数据安全回退。
5. 验证升级后刷新和返回主页仍显示正确成绩。

完成标准：旧用户成绩不丢失，三条路线成绩完全隔离。

### Phase 7：完整测试和视觉交付

状态：100%

功能覆盖：

- 路线主页和三条路线入口；
- 两种输入模式；
- IME 候选保护；
- 正确、错误和快速 Enter；
- 提示模式；
- 完成结算；
- 路线级成绩；
- v1 → v2 迁移；
- PNG 成绩卡；
- Web Share、复制和下载回退；
- 旧 `/challenge/train` 链接；
- 原阅读、生词和导出功能回归。

视觉流程必须严格执行 `VISUAL_DELIVERY_WORKFLOW.md`：

```text
功能测试
→ 桌面截图
→ 820px 窄屏截图
→ 390px 手机截图
→ 成绩卡截图
→ 内部逐图检查
→ 发现问题继续修改和重拍
→ 全部通过后才能提供候选
```

完成标准：自动测试通过，视觉报告无错误，内部逐图检查通过。

### Phase 8：Draft PR 与 Preview

状态：100%

任务：

1. 确认 diff 只包含本项目文件和交接文档。
2. 不混入主工作区历史快照删除或 vocabulary 修改。
3. 创建 Draft PR。
4. 创建 Preview。
5. 完成 Preview 基础烟雾测试。
6. 向用户提交桌面和手机验收地址。

完成标准：Draft PR 和 Preview Ready，等待用户最终验收。

## 8. 文件边界

优先修改：

- `frontend/challenge/train/`
- `frontend/challenge/train/routes/`
- 电车专项测试和视觉审核脚本
- 必要的 `frontend/package.json`
- 必要的 `scripts/build-frontend.mjs`
- 必要的 `frontend/tools/check.mjs`
- 本专项计划与 `.ai-bridge` 交接文件

默认不修改：

- `frontend/app.js`
- `frontend/index.html`，除非只增加明确的电车入口且无法在独立页面完成
- `frontend/vocab-store.js`
- `frontend/vocab-list.js`
- `frontend/vocab-review.js`
- `frontend/vocab-export.js`
- 中文词库数据、审核队列和 PR #6 文件
- Production 配置、环境变量和正式域名

## 9. 与 vocabulary 并行开发规则

vocabulary worktree 可以同时进行数据审核，但双方不得同时修改共享运行时代码。

电车分支可能涉及的共享文件：

- `scripts/build-frontend.mjs`
- `frontend/package.json`
- `frontend/tools/check.mjs`
- 缓存或 required-files 门禁

合并顺序：

1. 电车路线 Draft PR 完成并通过 Preview 验收；
2. 用户批准后合并电车 PR；
3. vocabulary 分支同步最新 `main`；
4. vocabulary 再进入运行时接入阶段。

遇到共享文件冲突时不得猜测解决，先停止并汇报。

## 10. 授权边界

在本项目已批准范围内，可以不重复申请批准而连续执行：

- 创建新分支；
- 通用化路线引擎；
- 开发主页和两条路线；
- 修改本地数据、测试和视觉文件；
- 运行测试；
- 生成并内部检查截图；
- 修复发现的问题；
- commit、push；
- 创建 Draft PR；
- 创建 Preview。

必须获得用户明确批准：

- 将 Draft PR 改为 Ready；
- 合并到 `main`；
- 部署或修改 Production；
- 修改正式域名、数据库、环境变量；
- 删除 worktree、远端分支或重要历史文件；
- 扩大到排行榜、账号、后端、长路线或换乘玩法。

## 11. 最终验收标准

项目只有同时满足以下条件才可进入用户 Preview 验收：

1. 三条路线均可完整完成两种输入模式。
2. 原路线无明显功能和视觉回归。
3. 旧成绩迁移成功，路线成绩相互隔离。
4. 主页和挑战页在桌面、窄屏和手机无溢出、遮挡、重叠或异常留白。
5. 所有成绩卡可读且路线信息正确。
6. 自动测试和视觉报告通过。
7. 没有混入 vocabulary、Production 或历史快照删除。
8. Draft PR 和 Preview 均处于 Ready 状态，但不合并、不发布 Production。

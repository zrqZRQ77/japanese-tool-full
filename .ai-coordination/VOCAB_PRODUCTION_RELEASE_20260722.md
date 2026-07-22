# Yomeru 生词系统模块化第二轮 Production 发布记录

Date: 2026-07-22 CST

## 发布范围

- 将 71 个生词系统候选函数从 `frontend/app.js` 拆分到：
  - `frontend/vocab-store.js`（14）
  - `frontend/vocab-list.js`（28）
  - `frontend/vocab-review.js`（20）
  - `frontend/vocab-export.js`（9）
- `frontend/app.js` 从 9,473 行减少到 8,487 行，累计减少 986 行。
- 保持普通脚本全局名称、inline handler、`reading_vocab_list`、SRS 语义、CSV/Anki 格式和完整备份恢复边界不变。

## Git 与审查

- 功能提交：`6f3791170480c3949bcf0783d8d95f769cf4a60c`
- 分支：`refactor/app-js-vocab-round2`
- Pull Request：`#1`
- PR 状态：Merged
- main merge commit：`87ba6bb1d2d7bb5921bbf5df46f53df83dba5084`

## Preview

- Deployment：`dpl_2h4Vadn1rzNgbQLvJTmvLFmbNfwL`
- Target / Status：`preview / Ready`
- URL：`https://japanese-tool-8eo2taahb-zrq-projects1.vercel.app`
- 人工验收：用户确认通过

## Production

- Deployment：`dpl_2DD7vb4PHQWCKuK7ANWCDTxUv9Lq`
- Target / Status：`production / Ready`
- Deployment URL：`https://japanese-tool-ojv7ljaib-zrq-projects1.vercel.app`
- 正式域名：`https://yomeru.japanese-hub.com`
- 当前缓存：`20260722-01`

## 回滚点

- 上一 Production：`dpl_R6cpkaGkqYijPdgqgqShtSQT2gFe`
- 上一版本在发布后未删除，可作为短期回滚目标。

## 发布前验证

- 根目录 `npm run build`：PASS
- `frontend/npm run check`：PASS
- `frontend/npm run test:vocab-persistence`：PASS
- `frontend/npm run test:vocab-export`：PASS
- `frontend/npm run test:dictionary`：PASS
- `frontend/npm run test:kuromoji`：PASS
- `frontend/npm run test:language-corpus`：PASS
- `git diff --check`：PASS

## Production 在线烟雾测试

- 首页：HTTP 200
- 页面标题与 reading 初始视图：正常
- `vocab-store.js`、`vocab-list.js`、`vocab-review.js`、`vocab-export.js`：均以 `20260722-01` 加载
- 全局函数：store/list/review/export 均可调用
- 隔离浏览器生词链路：保存、localStorage、列表显示、闪卡队列与卡片显示 PASS
- 烟雾测试使用新的隔离浏览器上下文，不影响真实用户数据。

## 已知非阻断项

- `verify:flows` 仍报告两个既有布局断言：TTS 设置同行断言与 mobile-390 首页次操作断言。
- 生词添加、列表、闪卡和删除流程均 PASS；上述两项未作为本轮 Production 阻断。

## 发布后动作

1. 状态为 `RELEASED / OBSERVE`，不重复部署。
2. 可选执行 Mac/iPhone Safari Production 精简抽查，并记录到 `REAL_DEVICE_ACCEPTANCE_CHECKLIST.md`。
3. 稳定观察后删除已合并的功能分支。
4. 新产品任务重新排期；当前优先候选为离线中文释义覆盖扩展的缺口统计与数据源设计。

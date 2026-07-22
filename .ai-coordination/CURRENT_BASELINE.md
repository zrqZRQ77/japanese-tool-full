# 当前审查基线

> 未执行的项目不得从其他基线继承 PASS；历史 Preview、旧分支和旧 HOLD 结论不得覆盖本节。

## 2026-07-22 Production 基线

- 基线时间：2026-07-22 CST
- 当前发布分支：`main`
- 当前文档分支：`docs/production-device-acceptance-20260722`
- 当前 main：`cdfd3716c60b8fb45b84d33e079aa5f49d604788`
- Production 代码合并提交：`87ba6bb1d2d7bb5921bbf5df46f53df83dba5084`
- 生词模块化提交：`6f3791170480c3949bcf0783d8d95f769cf4a60c`
- Pull Request：`#1`，已合并
- 正式线上地址：`https://yomeru.japanese-hub.com`
- Production Deployment：`dpl_2DD7vb4PHQWCKuK7ANWCDTxUv9Lq`
- Production Target / Status：`production / Ready`
- 上一 Production 回滚点：`dpl_R6cpkaGkqYijPdgqgqShtSQT2gFe`
- 当前页面缓存版本：`20260722-01`
- 当前公开输入：仅粘贴日语文本；PDF、DOCX、网页抓取继续为未公开技术储备

## 当前代码结构

- `frontend/app.js`：8,487 行；第二轮模块化累计减少 986 行。
- 71 个生词系统候选函数已唯一实现于：
  - `frontend/vocab-store.js`（14）
  - `frontend/vocab-list.js`（28）
  - `frontend/vocab-review.js`（20）
  - `frontend/vocab-export.js`（9）
- 普通 `<script>`、inline handler、`reading_vocab_list`、SRS 语义、CSV/Anki 格式和完整备份兼容边界保持不变。

## 已完成验证

- 根目录 `npm run build`：PASS
- `frontend/npm run check`：PASS
- `frontend/npm run test:vocab-persistence`：PASS
- `frontend/npm run test:vocab-export`：PASS
- `frontend/npm run test:dictionary`：PASS
- `frontend/npm run test:kuromoji`：PASS
- `frontend/npm run test:language-corpus`：PASS
- Preview 人工验收：PASS
- Production 在线烟雾测试：HTTP 200；四个 vocab 模块加载；隔离浏览器中的保存、localStorage、列表和闪卡队列 PASS
- Production 真实设备抽查：电脑与手机均由用户确认无问题；首次/热加载、生词刷新、闪卡评分、CSV/Anki 和移动端布局 PASS
- `verify:flows`：生词流程 PASS；仍只有既有 TTS 设置行断言与 mobile-390 首页次操作断言阻断

## 当前发布判断

- 状态：`RELEASED / VERIFIED`
- 本轮模块化、PR、main 合并、Production 发布与真实设备抽查均已完成。
- 不需要再次创建 Preview、再次合并 main 或再次发布 Production。
- 只有发现新的真实回归时才重新进入修复流程。

## 接下来顺序

1. 提交并合并本次 Production 真实设备验收记录。
2. 已合并的 `refactor/app-js-vocab-round2` 本地分支已删除；远端分支删除完成后结束本轮清理。
3. 新产品任务需要重新排期；当前建议候选为离线中文释义覆盖扩展的缺口统计与数据源设计。

## 生成物规则

审计截图、阶段结果、证据、历史 review、`Reference_Books` 与 `tmp` 保留本地但不进入源码基线。

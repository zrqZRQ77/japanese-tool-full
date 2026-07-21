# Yomeru Lexical 模块化 Production 发布记录

- 发布日期：2026-07-21
- 发布状态：`PASSED`
- 发布来源分支：`refactor/app-js-lexical-round1`
- 发布源提交：`e9219eb1cf76c24e26bb3950f4871c019b25835d`
- Production Tag：`production-20260721-lexical-round1`
- 新 Production Deployment：`dpl_R6cpkaGkqYijPdgqgqShtSQT2gFe`
- 新部署 URL：`https://japanese-tool-okcpkahu8-zrq-projects1.vercel.app`
- 正式域名：`https://yomeru.japanese-hub.com`
- 上一 Production Deployment：`dpl_7n1BZh1MWE4jKXtAm1L7bP458kpr`
- 上一部署 URL：`https://japanese-tool-8k21dh6lu-zrq-projects1.vercel.app`
- 上一版本回滚 Tag：`production-20260721-before-app-modularization`

## 1. 发布内容

本次为纯代码结构重构，不增加或删除公开功能：

- 从 `frontend/app.js` 删除 15 个重复 lexical 函数；
- 查词、详情、生词分别保留对应 integration 文件的唯一实现；
- 删除 3 个只服务旧详情逻辑的辅助项；
- `app.js` 从 9,797 行减少到 9,472 行，累计减少 325 行；
- 保持普通 `<script>`、UI、文案、数据格式、导出入口和正式域名不变。

## 2. 发布前验证

- 根目录 `npm run build`：PASS
- `frontend` `npm run test:dictionary`：PASS
- 真实浏览器生词刷新持久化：PASS
- Preview Deployment `dpl_FE4g1NaarXce64UsGzetKpWoPceu`：Ready
- Preview `app.js` 与 5 个 lexical 文件和本地 `dist/`：逐字节一致

## 3. Production 部署

执行普通 Vercel Production 部署，结果：

- Target：`production`
- Status：`Ready`
- Alias：`https://yomeru.japanese-hub.com`
- 未修改其他正式域名配置

## 4. Production 静态文件验证

线上文件与发布前本地 `dist/` SHA-256 完全一致：

| 文件 | SHA-256 |
|---|---|
| `index.html` | `34df2f2f373d03767898587b2e63e9e19250e5625847a96dbd74569365e1020b` |
| `app.js` | `b1aa25fe6d4277dd856b0d227836e10a61f95775594de1ae37cf16913d5b8d08` |
| `lexical-lookup.js` | `3bbf1dac8e33fcab2705d21493766dd5a0343d1b5cfead2e4bfac93c7c99b4ef` |
| `lexical-record.js` | `212dfd8bdb491a25c220797377a7c1ebd7f691983f7d1c3344b3f5faff08e010` |
| `lexical-lookup-integration.js` | `f0004a63074b755c3351ef35edde227f327703331376e7906d429dd057b94e6e` |
| `lexical-detail-integration.js` | `5979fc4f92ae5ebac31b16d8174b008eb640f4bac38826fd2b3a7a1c397ccc6e` |
| `lexical-vocab-integration.js` | `31ff942939e7e546a517abe5efaae1eee00500685692e63da2347f3b417c0098` |

## 5. Production 真实浏览器烟雾测试

在独立 Playwright 浏览器上下文中对正式域名验证：

- 页面正常加载，标题包含 `読める`；
- 首次添加生词成功；
- 重复添加被阻止；
- 生词写入浏览器 localStorage；
- 刷新后应用重新加载该生词；
- 生词页面 DOM 仍显示该词；
- 示例阅读成功生成 7 个 token；
- 词语详情可以打开；
- 导出窗口可以打开。

测试使用隔离浏览器存储，结束后清除测试生词，不影响真实用户数据。

## 6. 回滚保护

上一 Production Deployment 仍为 `Ready`：

- Deployment：`dpl_7n1BZh1MWE4jKXtAm1L7bP458kpr`
- URL：`https://japanese-tool-8k21dh6lu-zrq-projects1.vercel.app`
- Git Tag：`production-20260721-before-app-modularization`
- 本地静态快照：`.ai-bridge/production-baselines/2026-07-21-dpl_7n1BZh1MWE4jKXtAm1L7bP458kpr/`

如果正式站出现关键回归，应优先重新提升上一部署或把正式 Alias 指回上一部署，不应临时手工拼接代码修复。

## 7. 发布结论

Lexical 模块化第一轮已发布到 Production，并通过远程文件一致性与正式域名真实浏览器烟雾测试。下一步应先保持观察，不自动开始新的大规模拆分。

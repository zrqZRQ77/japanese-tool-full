# Yomeru Lexical 模块化 Preview 验收

- 日期：2026-07-21
- 状态：`PASSED`
- 分支：`refactor/app-js-lexical-round1`
- Preview Deployment ID：`dpl_FE4g1NaarXce64UsGzetKpWoPceu`
- Preview URL：`https://japanese-tool-b8n01oq27-zrq-projects1.vercel.app`
- Vercel 状态：`Ready`
- Target：`preview`
- Production 操作：`无`

## 1. 访问说明

该 Preview 启用了 Vercel SSO 保护，普通未登录请求会跳转 Vercel 登录页。验收使用已登录的 Vercel CLI 自动保护绕过读取实际部署文件，没有修改访问策略、域名或 Production。

## 2. 构建验证

Vercel Preview 构建成功：

- 安装依赖成功；
- 执行根目录 `npm run build` 成功；
- `scripts/build-frontend.mjs` 成功生成 `dist/`；
- 部署状态为 `Ready`。

## 3. 远程文件一致性

通过已登录的 `vercel curl` 读取受保护 Preview 文件，并与本地已完成完整测试的 `dist/` 比较 SHA-256。

| 文件 | SHA-256 | 结果 |
|---|---|---|
| `app.js` | `b1aa25fe6d4277dd856b0d227836e10a61f95775594de1ae37cf16913d5b8d08` | 一致 |
| `lexical-lookup.js` | `3bbf1dac8e33fcab2705d21493766dd5a0343d1b5cfead2e4bfac93c7c99b4ef` | 一致 |
| `lexical-record.js` | `212dfd8bdb491a25c220797377a7c1ebd7f691983f7d1c3344b3f5faff08e010` | 一致 |
| `lexical-lookup-integration.js` | `f0004a63074b755c3351ef35edde227f327703331376e7906d429dd057b94e6e` | 一致 |
| `lexical-detail-integration.js` | `5979fc4f92ae5ebac31b16d8174b008eb640f4bac38826fd2b3a7a1c397ccc6e` | 一致 |
| `lexical-vocab-integration.js` | `31ff942939e7e546a517abe5efaae1eee00500685692e63da2347f3b417c0098` | 一致 |

## 4. HTML 验证

Preview `index.html` 与本地 `dist/index.html` 验证结果：

- 排除 Vercel 自动注入的 Preview Feedback 脚本后，正文内容一致；
- 仅存在文件尾部换行差异，归一化后完全一致；
- lexical 脚本加载顺序正确：
  1. `lexical-lookup.js`
  2. `lexical-record.js`
  3. `app.js`
  4. `lexical-lookup-integration.js`
  5. `lexical-detail-integration.js`
  6. `lexical-vocab-integration.js`
- HTML 中 `addCustomToVocab(...)` 内联入口存在；
- Preview `app.js` 中动态编辑表单的 `submitVocabEdit(event)` 入口存在。

## 5. 功能等价依据

Yomeru 当前为静态前端部署。Preview 的 HTML、`app.js` 和全部 lexical 脚本与本地已测试产物一致，因此 Preview 运行的是同一组代码字节。

对应本地已通过：

- 构建与维护门禁；
- 中文词典、JLPT、JMdict 回退；
- 词语详情与词形；
- 生词首次保存、重复阻止与编辑；
- 新增生词后刷新持久化真实浏览器测试；
- Kuromoji Worker、竞态和详情快照；
- 语言语料与真实文章流程。

UI 审计仍有两个拆分前已存在的布局断言被当前测试环境阻断，没有新增 lexical 功能回归。

## 6. Production 安全确认

本次仅创建 Preview：

- 没有使用 `--prod`；
- 没有修改 `main`；
- 没有修改正式域名或 Alias；
- `https://yomeru.japanese-hub.com` 仍指向原 Production Deployment `dpl_7n1BZh1MWE4jKXtAm1L7bP458kpr`。

## 7. 结论

Lexical 模块化第一轮的本地实现、测试、构建和 Preview 内容验收全部完成。该分支尚未合并到 `main`，也未发布到 Production。任何 Production 发布必须另行获得用户明确授权。

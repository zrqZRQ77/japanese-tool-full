# Yomeru Production 回滚基线（2026-07-21）

- 状态：`CAPTURED`
- 用途：在 `app.js` 模块化开始前，保存当前正式线上版本的可恢复静态快照和校验证据
- 是否修改 Production：`否`
- 是否修改正式域名或 Alias：`否`
- GitHub 基线状态：`PUSHED`
- GitHub 基线提交：`988a040f2fade46c248a48e333f21e5a9fad6a36`
- GitHub 备份分支：`backup/production-20260721`
- Git Tag：`production-20260721-before-app-modularization`

## 1. 当前正式部署

- 正式地址：`https://yomeru.japanese-hub.com`
- Vercel Project：`japanese-tool`
- Project ID：`prj_q0qbdFtT477SIRM8QDH5wvGPgBp5`
- Production Deployment ID：`dpl_7n1BZh1MWE4jKXtAm1L7bP458kpr`
- Deployment URL：`https://japanese-tool-8k21dh6lu-zrq-projects1.vercel.app`
- 部署状态：`Ready`
- 部署来源：Vercel CLI 上传的 Production 快照
- 部署元数据关联分支：`stabilize/safari-dictionary-20260715`
- 部署元数据关联提交：`ad35c5b655e393586797e0d3c76cf9f782feb853`
- 部署元数据：`gitDirty=1`

`gitDirty=1` 表示该 Production 当时包含本地未提交状态，不能只依靠关联 Git 提交一比一还原。因此本次额外下载了线上真实静态文件。

## 2. 本地完整快照

本地保险目录：

```text
.ai-bridge/production-baselines/2026-07-21-dpl_7n1BZh1MWE4jKXtAm1L7bP458kpr/
```

目录内容：

```text
dist/                 线上公开静态文件
manifest.json         每个文件的大小、SHA-256、Content-Type、ETag
local-comparison.json 当前 frontend 与线上快照的逐文件比较结果
README.md             快照摘要与使用限制
```

`.ai-bridge/` 已在 `.gitignore` 中排除，因此该完整快照只保存在当前电脑，不会上传到 GitHub，也不会进入 Vercel 构建。

## 3. 快照结果

- 抓取时间：`2026-07-21T10:27:18.023Z`
- 预期文件：`174`
- 成功保存：`174`
- 失败文件：`0`
- 总大小：`27,832,351 bytes`
- `index.html` SHA-256：`34df2f2f373d03767898587b2e63e9e19250e5625847a96dbd74569365e1020b`
- `app.js` 大小：`398,384 bytes`
- `app.js` SHA-256：`2335a53abdc4124e6060cddfb58a3f18206af20fb820b7fb79ac1d1cc28c5d8c`

保存范围包含：

- HTML、JavaScript、CSS；
- 品牌 SVG 和图片；
- 中文释义分片；
- JLPT 参考数据；
- JMdict 分片；
- Kuromoji Worker、运行库和词典文件；
- 当前导出、词语详情、生词和稳定性补丁相关脚本。

## 4. 当前本地与 Production 的关系

将快照中的 174 个文件与当前 `frontend/` 对应文件逐字节比较，结果为：

- 完全一致：`174`
- 内容不同：`0`
- 本地缺失：`0`

因此，在本次抓取时：

> 当前 `frontend/` 中实际会部署的公开静态文件，与正式线上版本完全一致。

该结论只覆盖 Production 静态文件，不代表测试脚本、协调文档、后端代码、Git 历史和其他未部署文件也完全一致。

## 5. GitHub 固定基线

已将当前可部署源码固化并推送到 GitHub：

```text
Commit: 988a040f2fade46c248a48e333f21e5a9fad6a36
Branch: backup/production-20260721
Tag: production-20260721-before-app-modularization
```

该提交只包含当前 Production 对应的部署文件、构建配置和维护检查文件，没有合并到 `main`。创建 Tag 后，后续即使分支继续变化，也可以从该提交恢复拆分前源码。

其余尚未提交的后端、营销和产品决策文件已保存到命名 Stash：

```text
pre-refactor remaining worktree 2026-07-21
```

当前重构分支为：

```text
refactor/app-js-lexical-round1
```

## 6. 回滚原则

发生模块化回归时，优先顺序如下：

1. 如果原 Deployment 仍保留在 Vercel，优先把正式 Alias 恢复到 `dpl_7n1BZh1MWE4jKXtAm1L7bP458kpr`。
2. 如果原 Deployment 已过期或被删除，使用本地快照目录中的 `dist/` 创建恢复部署。
3. 任何恢复到 Production 的操作，都必须获得用户明确授权。
4. 不得在模块化开发过程中自动运行 Production 部署、修改正式域名或修改 Production Alias。
5. Preview 验收通过前，Production 保持现状。

## 7. Vercel 访问状态

快照抓取前，Vercel CLI 已成功确认正式域名指向：

```text
dpl_7n1BZh1MWE4jKXtAm1L7bP458kpr
```

快照完成后的再次元数据查询出现：

```text
The specified token is not valid. Use `vercel login` to generate a new token.
```

这不影响已经保存的 174 个公开文件和哈希结果，也没有改变 Production。后续如需查询部署元数据、创建 Preview 或执行发布，需要先重新登录 Vercel；不得借此自动发布 Production。

## 8. 后续模块化执行约束

开始 lexical 去重前：

- 以本文件和本地完整快照作为线上回滚基线；
- 在独立开发分支或当前非 `main` 分支小批量修改；
- 每轮比较核心行为和测试结果；
- 只生成 Preview 进行验收；
- 未经明确授权，不合并到 `main`，不运行带 Production 目标的部署命令。

## 9. 当前结论

Production 已完成本地保险，当前线上版本不会因后续本地代码修改而自动变化。可以进入 `APP_JS_MODULARIZATION_ROUND1_LEXICAL.md` 的阶段 A，继续检查未提交差异、加载顺序和拆分前测试基线。

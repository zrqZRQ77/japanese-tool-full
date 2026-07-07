# 视觉版本档案

本文件用于记录网站视觉设计的可回溯版本。以后每次稳定一个视觉版本，都应在这里追加一条记录，并尽量配套截图与文件快照。

截图保留规则：优先由用户手动截图，放入 `manual-inbox`；只保留最新两版相关截图，旧于两版的截图包可以删除，避免资源越积越多。

## 回退优先级

1. 先看本文件中的版本记录，确认要回到哪一个方向。
2. 再看对应截图路径或文字说明，确认视觉目标。
3. 最后使用对应的文件快照恢复 `frontend/index.html`、`frontend/app.js`、`frontend/design-system.css`。

## 现有资源

- 总体视觉总结：`/Users/zhouruoqi/Downloads/japaneselearning/VISUAL_SCREENSHOT_SUMMARY.md`
- HTML 视觉总结：`/Users/zhouruoqi/Downloads/japaneselearning/visual-screenshot-summary.html`
- 历史自动截图目录：`/Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/`
- 最近两版视觉截图目录：`/Users/zhouruoqi/Downloads/japaneselearning/frontend/visual-snapshots/`
- 用户手动截图收件箱：`/Users/zhouruoqi/Downloads/japaneselearning/frontend/visual-snapshots/manual-inbox/`
- 当前稳定快照：
  - `/Users/zhouruoqi/Downloads/japaneselearning/frontend/index.20260704-17.html`
  - `/Users/zhouruoqi/Downloads/japaneselearning/frontend/app.20260704-17.js`
  - `/Users/zhouruoqi/Downloads/japaneselearning/frontend/design-system.20260704-17.css`
- 早前备份：
  - `/Users/zhouruoqi/Downloads/japaneselearning/frontend/index.20260704-current.html`
  - `/Users/zhouruoqi/Downloads/japaneselearning/frontend/design-system.20260704-current.css`

## 手动截图规则

从下一次修改开始，Codex 默认不主动生成截图。每次修改完成后，Codex 应提示用户：

1. 需要截哪些页面。
2. 当前版本号是什么。
3. 截图文件应该怎么命名。
4. 截图应该放到哪个文件夹。

手动截图统一放到：

```text
/Users/zhouruoqi/Downloads/japaneselearning/frontend/visual-snapshots/manual-inbox/
```

命名格式：

```text
版本号-页面名.png
```

示例：

```text
20260704-19-home.png
20260704-19-vocab.png
20260704-19-grammar.png
20260704-19-reading.png
```

常用页面名：

- `home`
- `reading`
- `vocab`
- `grammar`
- `practice`
- `discover`
- `test`
- `history`
- `settings`

小改动只需要截受影响页面。稳定大版本如果用户愿意，再截完整页面组。

## 自动截图备用方案

如果用户明确要求 Codex 自动截图，才使用下面的命令：

```bash
cd /Users/zhouruoqi/Downloads/japaneselearning/frontend
npm run visual:snapshot
```

它会按当前缓存版本创建：

```text
frontend/visual-snapshots/YYYYMMDD-NN/
```

每个截图包包含这些页面：

- 首页
- 阅读页
- 生词本
- 语法本
- 练习页
- 资料页
- 水平测试
- 学习历史
- 设置与帮助

截图包会自动只保留最新两版，旧版会从 `frontend/visual-snapshots/` 删除。

如果截图是通过 Codex 内置浏览器手动生成的，可以单独运行清理命令：

```bash
cd /Users/zhouruoqi/Downloads/japaneselearning/frontend
npm run visual:prune
```

目前不是每一个旧微版本都有完整截图。原因是 2026-07-04 下午的自动截图脚本在当前环境中被浏览器启动限制拦住，报告位置：

- `/Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-04T07-36-52-094Z/ui-audit-report.md`

已有历史截图可作为恢复参考，尤其是：

- `/Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-03T06-38-42-279Z/01-initial.png`
- `/Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-03T06-38-42-279Z/02-reading.png`
- `/Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-03T06-38-42-279Z/04-flashcard.png`
- `/Users/zhouruoqi/Downloads/japaneselearning/frontend/audit-screenshots/2026-07-03T06-38-42-279Z/05-typing.png`

## 版本记录

| 版本 | 日期 | 主要方向 | 文件快照 | 截图状态 |
| --- | --- | --- | --- | --- |
| `20260704-09` | 2026-07-04 | 恢复到“扁平工作台版”的基础方向，保留 Y-Route Logo。 | 已按“只保留最近两版”规则清理 | 无完整新截图；参考文字总结。 |
| `20260704-12` | 2026-07-04 | 阅读页加入小工具栏，阅读正文减少默认大面积词语背景。 | 未单独快照 | 参考旧图 `02-reading.png`；无新截图。 |
| `20260704-13` | 2026-07-04 | 生词本加入闪卡入口；阅读页右侧生词区移到生词本流程。 | 未单独快照 | 参考旧图 `04-flashcard.png`；无新截图。 |
| `20260704-14` | 2026-07-04 | 练习页改为打字工作台，顶部三段切换，右侧句型列表。 | 未单独快照 | 参考旧图 `05-typing.png`；新截图脚本受限。 |
| `20260704-15` | 2026-07-04 | 首页按钮区去掉明显背景，只保留输入框为核心视觉区域。 | 未单独快照 | 无新截图。 |
| `20260704-16` | 2026-07-04 | 首页按钮 hover 去掉下划线；输入框增加极浅紫；“网站特点”区域与输入区自然分隔。 | 未单独快照 | 无新截图。 |
| `20260704-17` | 2026-07-04 | 首页输入区颜色收敛为深灰与统一主紫；辅助按钮字号更小，整体更和谐。 | 已按“只保留最近两版”规则清理 | 已保存完整页面截图：`frontend/visual-snapshots/20260704-17/`。 |
| `20260704-18` | 2026-07-04 | 删除语法本、生词本、阅读完成提示、资料页、学习历史、设置与帮助等页面中的说明性文案，只保留操作入口和状态信息。 | 已按“只保留最近两版”规则清理 | 已保存完整页面截图：`frontend/visual-snapshots/20260704-18/`。 |
| `20260704-19` | 2026-07-04 | 阅读页删除顶部练习进度卡；分析结果改为显示在小工具栏按钮内；右侧详解标题去掉“词义卡片”；左侧搜索图标垂直居中。 | 已按“只保留最近两版”规则清理 | 等待用户手动截图，建议放入 `frontend/visual-snapshots/manual-inbox/20260704-19-reading.png`。 |
| `20260704-20` | 2026-07-04 | 阅读页彻底去掉顶部进度卡视觉；保留“去练习”作为正文结束后的右下角下一步按钮，避免顶部横幅干扰阅读。 | 已按“只保留最近两版”规则清理 | 等待用户手动截图，建议放入 `frontend/visual-snapshots/manual-inbox/20260704-20-reading.png`。 |
| `20260704-21` | 2026-07-04 | 阅读页将顶部学习进度板彻底改为隐藏内部节点；删除正文上方“点击带颜色的词语，查看读音和释义。”提示文字。 | 已按“只保留最近两版”规则清理 | 等待用户手动截图，建议放入 `frontend/visual-snapshots/manual-inbox/20260704-21-reading.png`。 |
| `20260704-22` | 2026-07-04 | 阅读页工具栏按钮恢复 hover 说明；将重新分析按钮换成更标准的圆形刷新图标。 | 已按“只保留最近两版”规则清理 | 等待用户手动截图，建议放入 `frontend/visual-snapshots/manual-inbox/20260704-22-reading.png`。 |
| `20260704-23` | 2026-07-04 | 阅读页右侧工具按钮语义从“重新分析”改为“更换文章”；按钮改为文件导入图标并打开导入区。 | `index.20260704-23.html`、`app.20260704-23.js`、`design-system.20260704-23.css` | 等待用户手动截图，建议放入 `frontend/visual-snapshots/manual-inbox/20260704-23-reading.png`。 |
| `20260704-24` | 2026-07-04 | 阅读页“更换文章”按钮使用用户上传的 `refresh.png` 图标资源。 | `index.20260704-24.html`、`app.20260704-24.js`、`design-system.20260704-24.css` | 等待用户手动截图，建议放入 `frontend/visual-snapshots/manual-inbox/20260704-24-reading.png`。 |
| `20260704-25` | 2026-07-04 | 删除生词本、语法本、资料、学习历史、设置与帮助页面顶部的大标题说明，只保留操作区和页面内容。 | `index.20260704-25.html`、`app.20260704-25.js`、`design-system.20260704-25.css` | 等待用户手动截图，建议放入 `frontend/visual-snapshots/manual-inbox/20260704-25-vocab.png`、`20260704-25-grammar.png`、`20260704-25-discover.png`、`20260704-25-history.png`、`20260704-25-settings.png`。 |
| `20260704-26` | 2026-07-04 | 生词本按 Claude 风格继续减噪：顶部只保留一个动态主行动，空状态和闪卡说明缩短，统计改为轻量状态文本。 | `index.20260704-26.html`、`app.20260704-26.js`、`design-system.20260704-26.css` | 等待用户手动截图，建议放入 `frontend/visual-snapshots/manual-inbox/20260704-26-vocab.png`。 |
| `20260704-27` | 2026-07-04 | 生词本继续按 Claude 组件组织调整：搜索框上移为顶部工作栏，统计合并为一行轻状态，导出管理下移，复习模式与列表模式分离。 | `index.20260704-27.html`、`app.20260704-27.js`、`design-system.20260704-27.css` | 等待用户手动截图，建议放入 `frontend/visual-snapshots/manual-inbox/20260704-27-vocab.png`。 |
| `20260704-28` | 2026-07-04 | 生词本列表行按 Claude 组件组织继续整理：五列表格收为词条、释义来源、状态操作三段布局，操作弱化，移动端单列显示。 | `index.20260704-28.html`、`app.20260704-28.js`、`design-system.20260704-28.css` | 等待用户手动截图，建议放入 `frontend/visual-snapshots/manual-inbox/20260704-28-vocab.png`。 |
| `20260704-29` | 2026-07-04 | 生词本闪卡复习舞台按 Claude 方向减噪：去掉重阴影和黑色进度气泡，卡片改为安静纸面，评分按钮改为轻边框状态按钮。 | `index.20260704-29.html`、`app.20260704-29.js`、`design-system.20260704-29.css` | 等待用户手动截图，建议放入 `frontend/visual-snapshots/manual-inbox/20260704-29-vocab-review.png`。 |

## 当前版本说明：`20260704-29`

当前版本的首页目标：

- 左上角只显示图形 Logo。
- 主标题保持 `読める · 日语阅读辅助`。
- 首屏视觉焦点是大输入框。
- 输入框区域只使用深灰和统一主紫，不再混入多种紫色层级。
- `上传文件`、`导入链接`、`使用示例` 是辅助动作，字号更小，hover 只用颜色反馈。
- `开始阅读` 是主动作，保留按钮形态。
- `网站特点` 与输入区之间通过轻分割线和留白自然过渡。

当前版本的阅读页目标：

- 左侧导航顶部只显示图形 Logo。
- 阅读正文默认保持干净。
- 小工具栏保留，紫色只用于当前工具、焦点、标签和主动作。
- 生词相关流程转入生词本，不再挤在阅读页右侧。
- 顶部练习进度卡不显示，减少阅读区上方干扰。
- 点击小工具栏 `分析` 后，难度结果直接显示在按钮内，不再在正文下方生成分析卡片。
- 右侧详解卡只保留 `详解` 标签，不显示额外说明标题。
- `去练习` 放在正文结束后的右下角，作为读完后的自然下一步入口。
- 正文上方不再显示“点击带颜色的词语，查看读音和释义。”说明文字。
- 阅读页小工具栏按钮在鼠标悬浮和键盘聚焦时显示功能说明。
- 工具栏里的原刷新按钮改为 `更换文章`，使用文件导入图标，点击后打开文章/链接导入区。
- `更换文章` 按钮图标改用用户上传的 `frontend/assets/icons/refresh.png`。

当前版本的工作台页面目标：

- 生词本、语法本、资料、学习历史、设置与帮助进入页面后不再显示顶部大标题说明。
- 页面顶部优先显示当前可操作区域，例如闪卡复习、语法搜索、添加链接、继续阅读、界面设置。
- 生词本顶部只保留一个动态主行动；统计信息保持轻量，不做小卡片集合。
- 生词本顶部改为搜索框 + 动态行动按钮，列表模式和闪卡复习模式分开显示。
- 生词本列表行从后台表格式布局改为更安静的词条布局，来源并入释义区，状态和操作收在右侧。
- 生词本闪卡复习舞台改为低噪音纸面卡片，进度、退出和评分按钮都弱化处理。

当前版本的练习页目标：

- 默认进入 `打字` 工作台。
- 顶部保留 `选择题 / 复述 / 打字` 三段切换。
- 左侧输入练习，右侧句型列表。
- 布局参考 `05-typing.png`，但保持当前扁平工作台方向。

## 后续归档规则

以后每次视觉版本稳定后，建议执行：

1. 更新缓存版本，例如 `20260704-18`。
2. 复制快照，并只保留最近两版文件快照：
   - `frontend/index.版本号.html`
   - `frontend/app.版本号.js`
   - `frontend/design-system.版本号.css`
3. 提示用户手动截图：
   - 说明需要截图的页面。
   - 给出 `版本号-页面名.png` 文件名。
   - 要求放入 `frontend/visual-snapshots/manual-inbox/`。
4. 在本文件追加版本记录。
5. 再运行 `npm run check`。

# Codex 当前状态

- 当前阶段：稳定化与工作流重置
- 当前分支：`stabilize/safari-dictionary-20260715`
- 起点提交：`main / b84b3cd5a345132fd27db90efa295f8791049f36`
- 正式线上地址：`https://yomeru.japanese-hub.com`
- 当前 Preview：`https://japanese-tool-o9vdyyfbm-zrq-projects1.vercel.app`
- 公开 MVP：仅粘贴日语文本；不恢复 PDF 公开入口
- 当前真实状态：Mac Safari 功能可用但首次假名等待数分钟；iPhone Safari 核心流 PASS
- 当前 P0：Safari 首次加载反馈与性能；词典覆盖不足
- 当前 P1：清理 `kuromoji` 等内部技术字段
- 当前发布结论：HOLD；不部署 Production
- 已完成：基线提交 `03f4ff2`；Safari 可见进度、后台预热与耗时指标本地自动回归 PASS
- 正在执行：形成 Safari 性能修复独立提交
- 下一步：独立处理词典覆盖，不混入其他 UI 或导出功能
- 停止规则：真实产品失败、不可逆文件归属冲突或需要真实设备操作时暂停
- 最后更新时间：2026-07-15 CST

## 2026-07-16 第二轮状态

- 总体实现：完成；应用候选提交 `f680f92`，数据提交 `2d449f0`。
- 离线中文：156 词条、281 查询形、16 分片、32,807 字节；中文优先于 JMdict，浏览器运行时无翻译 API。
- JLPT 参考：8,131 源行、13,385 个无冲突查询形、排除 533 个跨等级冲突形；仅显示“参考等级”。
- 生词数据：已加入 `meaningLanguage`、`meaningSource`、`levelSource`，旧数据迁移、手工释义保护、未分级筛选、闪卡与导出一致性已覆盖。
- 缓存版本：`20260716-03`；Kuromoji 版本化目录保持 `20260714-01`。
- 自动化：`check`、`test:kuromoji`、`test:dictionary`、`audit:ui`、学习数据构建、前端构建、Vercel prebuilt 全部 PASS。
- 构建一致性：`dist/` 与 Vercel static 各 146 文件，零路径/hash 差异；聚合 SHA-256 `df4d415c3f0cbc9658044232ab119022df491d6a4c0f10a4a37fb38ef3ccff39`。
- Preview：`https://japanese-tool-6uuktjcym-zrq-projects1.vercel.app`；Deployment ID `dpl_5rmgnmSGekWbFk5HAN2HDSwAN66t`；target=`preview`；status=`Ready`。
- Production：未部署、未修改 alias/域名，`https://yomeru.japanese-hub.com` 保持不变。
- 当前结论：`HOLD`；下一步仅为第二轮 Mac/iPhone Safari 真机验收。

## 2026-07-16 第二轮真实设备验收后补丁

- Mac Safari 与 iPhone Safari 核心功能验收：PASS。
- 已确认：离线中文优先、JMdict 英文回退、JLPT 参考等级、查询中自动收藏、生词本、假名、单词/全文朗读、移动端布局和内部字段保护。
- Mac Safari 冷启动事实：第一次假名生成曾失败一次，第二次重试成功；核心功能通过，但首次冷启动稳定性仍需补丁。
- 当前本地补丁：`UI-COPY-READING-001`、`SAFARI-COLD-START-001`、`UI-TTS-SETTINGS-001`、`DICT-AUXILIARY-MASU-001`。
- Production：未部署、未修改 alias/域名，`https://yomeru.japanese-hub.com` 保持不变。
- 当前结论：`HOLD`；四项补丁通过完整门禁后只部署新的 Preview，再由 Mac/iPhone Safari 定向复测。

## 2026-07-16 验收后补丁 Preview

- 修复提交：`f36e73d63c23`；缓存版本：`20260716-04`。
- 四项本地补丁与自动化门禁：PASS。
- 构建一致性：`dist/` 与 Vercel static 各 146 文件，零路径/hash 差异；聚合 SHA-256 `68f9616849d578d63b5d16d496dc082c7cc40f9e08246bba991fcb1c9a9b4403`。
- Preview：`https://japanese-tool-o9vdyyfbm-zrq-projects1.vercel.app`；Deployment ID `dpl_5FFrbuh8CVs7YGLo2sKzhmYCGD7Q`；target=`preview`；status=`Ready`。
- Production：`dpl_HYpzrVrM4KGnKNfHjKVqDokkjGfw`，target=`production`，status=`Ready`；正式域名与 alias 未改变。
- 当前结论：`HOLD`；等待 Mac/iPhone Safari 对四项补丁做定向复测，不发布 Production。

## 2026-07-17 活用形与音色去重本地补丁

- 已完成：`DICT-CHINESE-COVERAGE-002`、`FURIGANA-INFLECTION-001`、`JLPT-INFLECTION-001`、`UI-TTS-VOICE-DEDUP-001`。
- 学习数据版本：`20260717`；中文索引 158 词条、285 查询形；新增 `寝る`、`無償`。
- 前端缓存版本：`20260717-01`；Kuromoji 版本化资源仍为 `20260714-01`。
- 自动化：`check`、`test:kuromoji`、`test:dictionary`、功能 UI 审计、五视口响应式审计与 `npm run build` 全部 PASS。
- 功能审计：`frontend/audit-screenshots/2026-07-17T03-16-12-069Z/ui-audit-report.md`。
- 响应式审计：`frontend/audit-screenshots/2026-07-17T03-14-04-833Z/ui-audit-report.md`。
- 当前状态：本地修复完成，尚未提交、尚未部署新 Preview；Production 未操作，发布状态继续 `HOLD`。

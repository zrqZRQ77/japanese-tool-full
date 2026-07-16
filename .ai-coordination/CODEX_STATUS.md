# Codex 当前状态

- 当前阶段：稳定化与工作流重置
- 当前分支：`stabilize/safari-dictionary-20260715`
- 起点提交：`main / b84b3cd5a345132fd27db90efa295f8791049f36`
- 正式线上地址：`https://yomeru.japanese-hub.com`
- 当前 Preview：`https://japanese-tool-diueoo9o6-zrq-projects1.vercel.app`
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
- Preview：`PENDING`；上传动作被外部发布保护拦截，需用户再次明确授权上传 146 个 prebuilt 文件。
- Production：未部署、未修改 alias/域名，`https://yomeru.japanese-hub.com` 保持不变。
- 当前结论：`HOLD`；下一步仅为 Preview 上传及第二轮 Mac/iPhone Safari 真机验收。

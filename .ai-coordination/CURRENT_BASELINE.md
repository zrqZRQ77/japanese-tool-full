# 当前审查基线

> 未执行的项目不得从其他基线继承 PASS。

- 基线时间：2026-07-15 CST
- 当前工作分支：`stabilize/safari-dictionary-20260715`
- 起点提交：`main / b84b3cd5a345132fd27db90efa295f8791049f36`
- 当前代码状态：包含 2026-07-13 至 2026-07-15 已验证但尚未形成基线提交的 Worker、Safari、移动端和发布候选修复
- 正式线上地址：`https://yomeru.japanese-hub.com`
- 当前隔离 Preview：`https://japanese-tool-diueoo9o6-zrq-projects1.vercel.app`
- Preview Deployment：`dpl_5xGZ87W82spvjrqYWu7LKYSqLkKM`
- 当前公开输入：仅粘贴日语文本；PDF 底层代码为普通用户不可达的技术储备
- 最新本地功能审计：`frontend/audit-screenshots/2026-07-15T05-42-36-670Z/ui-audit-report.md`｜PASS
- 最新本地响应式审计：`frontend/audit-screenshots/2026-07-15T05-42-55-247Z/ui-audit-report.md`｜PASS
- 当前页面缓存版本：`20260715-01`
- Safari 性能修复：可见进度、后台预热和耗时指标已完成本地回归；真实 Mac Safari 性能仍待新 Preview 复测
- 用户 Mac Safari：核心流可完成；首次生成假名等待数分钟，性能与反馈不合格
- 用户 iPhone Safari（MLE23CH/A，iOS 26.4.2）：首次、二次、慢网、读音、收藏与稳定性均 PASS
- 已确认数据问题：本地词典仅 126 条，未真正接入完整词典查询；部分词无中文释义
- 已确认 UI 问题：生词页可能直接显示内部等级值 `kuromoji`
- 当前发布判断：`HOLD`；Production 不变
- 连续任务顺序：建立 Git 基线 → Safari 加载反馈与预热 → 词典覆盖 → 技术字段清理 → 自动化与真实设备验收
- 生成物规则：审计截图、阶段四结果、证据、历史 review、Reference_Books 与 tmp 保留本地但不进入源码基线

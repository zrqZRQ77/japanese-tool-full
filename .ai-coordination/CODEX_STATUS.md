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
- 已完成：确认仓库边界；创建独立稳定化分支；收敛生成物忽略规则
- 正在执行：已通过 build、maintenance check 与 Kuromoji 测试，准备形成可回滚基线提交
- 下一步：只处理 Safari 预热与可见进度，不混入词典或 UI 其他改动
- 停止规则：真实产品失败、不可逆文件归属冲突或需要真实设备操作时暂停
- 最后更新时间：2026-07-15 CST

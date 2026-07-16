# 真实设备验收清单

## 当前候选版本

- Preview：`https://japanese-tool-nlctq0019-zrq-projects1.vercel.app`
- Preview Deployment ID：`dpl_EGRZueDbgJzrJVnXR17SsVacAzpZ`
- 候选代码提交：`2e24c4f`
- 候选整体 SHA-256：`fe8bf67279f8ac05f066281283df247ae95a2c66209fc10334c9bc26eb07424e`
- Production：`https://yomeru.japanese-hub.com`
- Production 操作：无
- 发布状态：`HOLD`

## 第一轮重点复测：iPhone Safari

设备：`MLE23CH/A`  
iOS：`26.4.2`

1. 打开新 Preview，确认手机媒体音量不是零。
2. 点击一个单词右侧的朗读按钮：
   - 点击后应出现“正在准备日语朗读”的反馈；
   - 应能听到日语声音；
   - 不应使用明显的英语音色。
3. 点击整篇文章朗读：
   - 长文章应连续分段朗读；
   - 不应只读第一句后停止；
   - 不应无声、卡死或白屏。
4. 在释义仍显示“正在查询词典……”时立刻点击收藏：
   - 按钮应提示“释义加载完成后自动加入生词本”；
   - 释义完成后应自动收藏，无需第二次点击；
   - 生词本应保存最终读音和最终释义。
5. 对没有查到释义的词点击收藏：
   - 应允许保存；
   - 释义显示为“释义待补充”。
6. 检查词语详情：
   - 来源小字显示“词典来源：JMdict”；
   - 不再重复显示 `JMdict / EDRDG`；
   - 没有参考等级的词显示“暂无参考等级”。
7. 检查生词本和闪卡：
   - 不显示 `kuromoji`、`worker`、`tokenizer`、`fallback`；
   - 收藏结果没有重复；
   - 读音和释义与详情一致。

记录（用户于 2026-07-16 完成真实 iPhone Safari 复测）：

- 单词朗读：PASS
- 整篇文章朗读：PASS
- 查询中自动收藏：PASS
- 查询失败后收藏：自动化 PASS，真实设备本轮未单独反馈
- 来源与等级文案：PASS
- 备注：用户确认以上四项实际表现均正常。

## Mac Safari 补充复测

1. 确认原有假名功能仍正常，`三菱` 为 `みつびし`，`UFJ` 无错误假名。
2. 记录同一文章第二次热加载耗时。
3. 测试单词朗读和整篇文章朗读。
4. 测试查询中点击收藏，确认加载完成后自动进入生词本。
5. 确认未知等级显示“暂无参考等级”。

记录：

- 热加载假名时间：
- 单词朗读：PASS / FAIL
- 整篇文章朗读：PASS / FAIL
- 查询中自动收藏：PASS / FAIL
- 备注或截图：

## 发布门槛

第一轮 iPhone Safari 真实设备验收已通过。当前继续保持 `HOLD`，原因是第二轮中文释义覆盖与 JLPT 参考等级数据尚未完成。不得部署 Production、修改正式域名、修改 Production alias 或合并到 `main`。

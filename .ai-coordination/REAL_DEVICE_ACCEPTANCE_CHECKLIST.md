# 真实设备验收清单

## 当前 Production 精简抽查（2026-07-22）

- Production：`https://yomeru.japanese-hub.com`
- Deployment ID：`dpl_2DD7vb4PHQWCKuK7ANWCDTxUv9Lq`
- main：`87ba6bb1d2d7bb5921bbf5df46f53df83dba5084`
- 缓存版本：`20260722-01`
- 发布状态：`RELEASED / VERIFIED`
- 自动化与在线 Chromium 烟雾测试：PASS
- Production 真实设备抽查：Mac/电脑与手机均由用户确认无问题

本节是发布后精简观察，不要求重复全部历史验收。建议在 Mac Safari 与 iPhone Safari 各抽查：

1. 清除站点数据后首次生成假名，确认有可见进度且不会白屏。
2. 同一文章第二次生成，确认热加载可接受。
3. 收藏一个词，刷新后仍存在，读音、释义和参考等级一致。
4. 打开闪卡并完成一次评分，确认队列与完成状态正常。
5. 至少下载一次 CSV 或 Anki TSV；需要时再抽查完整备份恢复。
6. 手机 390/430 宽度无明显横向溢出或不可操作按钮。

记录：

- Mac Safari 首次假名：PASS
- Mac Safari 热加载：PASS
- iPhone Safari 生词刷新：PASS
- 闪卡评分：PASS
- CSV / Anki：PASS
- 移动端布局：PASS
- 备注或截图：用户于 2026-07-22 确认电脑与手机 Production 实测均无问题。

若本节未发现真实回归，不需要重新创建 Preview、重新合并 main 或重新发布 Production。

---

以下为历史候选版本与验收记录，仅用于追溯。

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

## 第二轮候选真机清单

- 候选 ID：`preview-candidate-20260716-round-02-f680f92-df4d415c`
- 应用提交：`f680f92`
- 整体 SHA-256：`df4d415c3f0cbc9658044232ab119022df491d6a4c0f10a4a37fb38ef3ccff39`
- Preview：`https://japanese-tool-6uuktjcym-zrq-projects1.vercel.app`
- Preview Deployment ID：`dpl_5rmgnmSGekWbFk5HAN2HDSwAN66t`
- Preview 状态：`Ready`

部署 Preview 后，在 iPhone Safari 与 Mac Safari 各执行：

1. 点击 `読書`、`来月`，确认首先显示中文释义与 `释义来源：Yomeru 离线中文词库`。
2. 点击中文未命中的词，确认只在未命中后显示 `英文释义` 与 `词典来源：JMdict`。
3. 在释义加载中点击收藏，确认最终保存中文释义、`meaningLanguage=zh`、离线中文来源及参考等级。
4. 确认 `読書=N3`、`来月=N5`；专业词未命中时显示 `暂无参考等级`，不猜测等级。
5. 确认生词本、闪卡、CSV、TSV、完整备份恢复不出现 Worker/tokenizer 等技术字段。
6. 390/430 宽度无横向溢出、白屏、自动刷新或布局回归；桌面端同步抽查。

当前状态：自动化门禁 PASS；真实设备第二轮结果 `PENDING`。Production 保持不变，发布状态 `HOLD`。

## 第二轮真实设备验收结果（2026-07-16）

### 候选版本

- Preview：`https://japanese-tool-6uuktjcym-zrq-projects1.vercel.app`
- Deployment ID：`dpl_5rmgnmSGekWbFk5HAN2HDSwAN66t`
- Deployment Target：`preview`
- Deployment Status：`Ready`
- 部署记录提交：`12e14ab`
- Production：`https://yomeru.japanese-hub.com`
- Production 操作：无
- 发布状态：`HOLD`

### 验收设备

- Mac Safari：PASS
- iPhone Safari：PASS

### 已确认 PASS 的功能

1. 离线中文释义：`新しい` 显示“新的”，`読書` 显示“读书、阅读”，`本`、`時間`、`新聞` 等词能显示中文；中文命中时优先于 JMdict 英文，并明确标注“Yomeru 离线中文词库”。结果：PASS。
2. JMdict 英文回退：`学習`、`スペース`、`無償` 等中文未命中词能显示本地 JMdict 英文释义；浏览器运行时未调用 Jisho、在线翻译或其他在线词典 API。结果：PASS。
3. JLPT 参考等级：页面使用“JLPT 参考等级”；`新しい=N5`、`読書=N3`、`学習=N3`，`三菱` 显示“暂无参考等级”，且未伪装为官方 JLPT 词表或显示 tokenizer 内部来源。结果：PASS。
4. 生词本：收藏、最终中文或英文回退释义、N5–N1 或“暂无参考等级”均正确，详情与生词本一致，旧技术字段未显示。结果：PASS。
5. 查询期间自动收藏：查询完成后自动保存最终释义，不保存加载占位文字，不产生重复收藏。结果：PASS。
6. 假名：`三菱=みつびし`、`UFJ` 无错误假名；Mac Safari 第二次生成成功，iPhone Safari 正常，编辑与显示功能未被词典修改破坏。核心功能：PASS。Mac Safari 第一次冷启动曾出现一次加载失败，第二次重试成功；该稳定性问题继续修复，不否定核心功能验收。
7. 日语朗读：Mac/iPhone Safari 单词与整篇文章朗读均正常；iPhone 能连续分段朗读，未出现只读第一句、无声或白屏。结果：PASS。
8. 手机与桌面布局：Mac/iPhone Safari 页面、生词本、详情和正文正常，无明显横向溢出、白屏、严重遮挡或不可操作按钮。结果：PASS。
9. 内部字段保护：用户界面未发现 `kuromoji`、`worker`、`tokenizer`、`fallback`。结果：PASS。

### 本轮发现但尚待修复的问题

- `UI-COPY-READING-001`：阅读页仍承诺不存在的文章练习入口。状态：本地修复中。
- `SAFARI-COLD-START-001`：Mac Safari 第一次生成假名曾失败，第二次重试成功。状态：核心功能通过，本地稳定性补丁修复中。
- `UI-TTS-SETTINGS-001`：朗读速度与音色的标题、当前值和试听按钮布局重复且松散。状态：本地轻量布局修复中。
- `DICT-AUXILIARY-MASU-001`：助动词 `ます` 错配 JMdict 名词 “measuring container” 并显示 N3。状态：本地词典歧义补丁修复中。

### 发布结论

第二轮中文释义、JMdict 回退、JLPT 参考等级、生词本、朗读、假名和移动端核心功能已通过真实设备验收。完成上述四项补丁并生成新 Preview 前，不部署 Production、不修改正式域名或 Production alias、不合并到 `main`。发布状态：`HOLD`。

## 验收后补丁 Preview 定向复测

- Preview：`https://japanese-tool-o9vdyyfbm-zrq-projects1.vercel.app`
- Deployment ID：`dpl_5FFrbuh8CVs7YGLo2sKzhmYCGD7Q`
- 候选提交：`f36e73d63c23`
- 候选 SHA-256：`68f9616849d578d63b5d16d496dc082c7cc40f9e08246bba991fcb1c9a9b4403`
- 状态：`Ready / preview`

只需定向复测：

1. Mac Safari 清除该 Preview 网站数据后首次生成假名，确认首次异常会自动重试，页面不先显示红色错误；若两次均失败，只显示“假名生成没有完成，请点击重新生成。”，点击后可手动重试。
2. 点击上下文中的 `ます`，确认显示“礼貌助动词，用于构成动词的礼貌表达”、助动词、暂无参考等级，且没有收藏按钮；同时抽查 `あります`、`開きます`、`起きます` 保持整词。
3. 阅读完成区确认新文案为“点击正文中的词语，可以查看读音、释义并加入生词本。”。
4. Mac/iPhone 设置页确认速度与音色下拉框显示当前实际值；Mac 与试听按钮同行，iPhone 无横向溢出。

Production 仍为 `dpl_HYpzrVrM4KGnKNfHjKVqDokkjGfw`，未修改正式域名或 Production alias。发布状态继续 `HOLD`。

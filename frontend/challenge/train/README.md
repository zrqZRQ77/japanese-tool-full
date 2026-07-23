# Yomeru 电车日语输入挑战：A1 静态原型

## 当前范围

- 新宿到上野的山手线短路线，共 13 个连续站点。
- 开始、挑战、结果三个静态页面状态。
- 390px、430px 和桌面响应式基线。
- 站名、假名、罗马字和允许答案的人工核验数据。
- IME composition、计时、计分和本地数据规则基线。

当前是静态原型。真实答案判断、计时、列车移动、成绩保存、图片生成和分享将在 A2/A3 实现。

页面状态可通过 `?state=start`、`?state=play`、`?state=result` 查看。底部切换器只用于开发验收。

## 答案与 IME 规则

1. `compositionstart` 到 `compositionend` 期间不允许 Enter 提交。
2. 同时检查 `KeyboardEvent.isComposing`，避免 Safari 和移动端误提交。
3. 比较前执行首尾空格清理、全角/半角空格移除和 Unicode NFKC 规范化。
4. 汉字→假名模式只接受 `acceptedKana` 中人工列出的平假名。
5. 假名→汉字模式只接受 `acceptedKanji` 中人工列出的写法。
6. 不做编辑距离、同音字或宽松模糊匹配。
7. 一次 Enter 最多处理一次提交；动画期间不得重复前进。

## 计时与计分规则

- 点击“发车”时记录 `startedAt`，此前不计时。
- 使用 `performance.now()` 计算经过时间；切到后台再回来仍按真实经过时间计算。
- 记录正确/错误提交、每站用时、最佳连续、正确字符数和 CPM。
- `accuracy = correct / (correct + wrong)`。
- `cpm = correctChars / elapsedMinutes`。
- 成绩比较顺序：完成状态 → 正确率 → 完成时间 → CPM。
- 没有真实服务端统计时不显示用户百分位。

## 本地数据边界

唯一命名空间：`yomeru_train_typing_v1`。

只保存最佳成绩、最近 5 次、总挑战次数和最近难度。禁止读取或覆盖 `reading_vocab_list`、阅读历史、生词复习状态和完整备份数据。

## 版权边界

站名和线路顺序作为事实数据使用。线路图、列车图标、页面布局和后续动效均为原创；不使用铁路运营机构 Logo，不复制官方线路图或其他打字游戏的视觉与代码。

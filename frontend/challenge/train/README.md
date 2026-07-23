# Yomeru 电车日语输入挑战：A2 核心游戏

## 当前实现

- 新宿到上野的山手线短路线，共 13 个连续站点。
- 两种模式：汉字→假名、假名→汉字。
- 点击“发车”后才开始计时，输入框自动聚焦。
- 日语 IME composition 期间 Enter 不提交。
- 严格答案判断、错误后继续修改、正确后只前进一站。
- 实时用时、进度、正确率、连续正确数和路线位置。
- 完成时间、平均每站用时、CPM、最佳连续和本机最佳纪录。
- 独立 localStorage 保存最佳成绩、最近 5 次、总挑战次数和最近难度。
- 390px、430px 和桌面响应式布局。

成绩卡图片和系统分享将在 A3 实现。

## 答案与 IME 规则

1. `compositionstart` 到 `compositionend` 期间不允许 Enter 提交。
2. 同时检查 `KeyboardEvent.isComposing`，避免 Safari 和移动端误提交。
3. 比较前执行首尾空格清理、全角/半角空格移除和 Unicode NFKC 规范化。
4. 汉字→假名模式只接受 `acceptedKana` 中人工列出的平假名。
5. 假名→汉字模式只接受 `acceptedKanji` 中人工列出的写法。
6. 不做编辑距离、同音字或宽松模糊匹配。
7. 正确提交后的短暂移动锁定期间，连续 Enter 不会跳过站点。
8. 错误答案不清空输入，也不会结束游戏。

## 计时与计分规则

- 点击“发车”时记录 `startedAt`，此前计时保持为 0。
- 使用 `performance.now()` 计算真实经过时间；切到后台再回来仍按经过时间计算。
- 记录 `correctSubmissions`、`wrongSubmissions`、`stationTimes[]`、`bestStreak` 和 `correctChars`。
- `accuracy = correct / (correct + wrong)`。
- `cpm = correctChars / elapsedMinutes`。
- 成绩比较顺序：正确率更高 → 完成时间更短 → CPM 更高。
- 最后一站只能触发一次结算。
- 没有真实服务端统计时不显示用户百分位。

## 本地数据边界

唯一命名空间：`yomeru_train_typing_v1`。

结构：

```json
{
  "schemaVersion": 1,
  "bestByMode": {},
  "recentResults": [],
  "totalChallenges": 0,
  "lastMode": "kanji-to-kana"
}
```

只保存最佳成绩、最近 5 次、总挑战次数和最近难度。损坏或旧格式数据会安全回退为空状态。

禁止读取或覆盖：

- `reading_vocab_list`
- 阅读历史
- 生词复习状态
- Yomeru 完整备份数据

## 版权边界

站名和线路顺序作为事实数据使用。线路图、列车图标、页面布局和动效均为原创；不使用铁路运营机构 Logo，不复制官方线路图或其他打字游戏的视觉与代码。

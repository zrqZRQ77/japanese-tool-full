# Yomeru 电车日语输入挑战：多路线版本

## 页面结构

- `/challenge/train`：路线选择主页。
- `/challenge/train/play?route=yamanote-north-short`：山手线新宿 → 上野，13 站。
- `/challenge/train/play?route=yamanote-east-short`：山手线上野 → 品川，11 站。
- `/challenge/train/play?route=ginza-east-short`：银座线浅草 → 银座，11 站。

路线主页显示线路、区间、站数、难度、推荐 JLPT、挑战次数和最佳纯挑战成绩。旧 `/challenge/train` 链接继续有效，但现在进入路线主页。

## 通用路线引擎

路线注册表位于：

```text
challenge/train/routes/index.json
```

每条路线独立 JSON 至少包含：

- `routeId`；
- 中日文线路名称；
- 起终点和副标题；
- 难度和推荐 JLPT；
- 主题颜色；
- 分享文案；
- 官方核验来源；
- 按顺序排列的站点及严格答案白名单。

挑战引擎不再写死 13 站、新宿、上野、山手线名称、平均每站除数或固定分享地址。桌面和手机进度、结果页、成绩卡和分享内容均根据当前路线动态生成。

## 游戏规则

- 两种模式：汉字 → 假名、假名 → 汉字。
- 日语 IME composition 期间不会提交。
- 正确后只前进一站，错误答案保留并允许继续修改。
- 练习提示按站记录，纯挑战和练习模式成绩分开。
- 平均每站按当前路线总用时 ÷ 当前路线站数计算。
- 每条路线分别保存挑战次数、最近 5 次和两种模式的最佳成绩。
- 结果卡为 1080×1350 PNG，显示当前路线名称、起终点和站数对应的路线点。
- Preview 分享当前部署地址；Production 分享正式域名和具体 `routeId`。

## 本地数据

当前命名空间：

```text
yomeru_train_typing_v2
```

结构：

```json
{
  "schemaVersion": 2,
  "routes": {
    "yamanote-north-short": {
      "bestByMode": {},
      "recentResults": [],
      "totalChallenges": 0,
      "lastMode": "kanji-to-kana"
    }
  },
  "lastRouteId": "yamanote-north-short",
  "migratedFromV1": true
}
```

首次读取时会将旧 `yomeru_train_typing_v1` 成绩安全迁移到 `yamanote-north-short`。不会读取或覆盖：

- `reading_vocab_list`；
- 阅读历史；
- 生词复习状态；
- Yomeru 完整备份数据。

## 验证

```bash
cd frontend
npm run test:train-static
npm run visual:train
```

功能测试覆盖：

- 路线主页和三条路线；
- 三条路线的两种输入模式；
- IME、错误重试和动态站数；
- v1 → v2 迁移；
- 路线成绩隔离；
- 无效路线错误页；
- 成绩卡、系统分享和路线链接。

视觉审核覆盖 1440px、820px、390px 的主页、开始、答题、提示、结果和手机保存后状态，并单独生成三张成绩卡。

## 版权边界

站名和线路顺序作为事实数据使用，并记录运营机构公开来源。路线图、路线主页、列车图标、成绩卡和交互动效均为 Yomeru 原创；不使用铁路运营机构 Logo，不复制官方线路图。

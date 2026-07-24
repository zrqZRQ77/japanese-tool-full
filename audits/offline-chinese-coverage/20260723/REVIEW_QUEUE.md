# Yomeru 离线中文释义人工审核队列

Generated: 2026-07-23T00:00:00.000Z
First assisted review batch: 2026-07-24

## 队列规则

- 未处理项目保持 `pending`，中文候选为空。
- `drafted` 表示已逐项核验证据并形成中文草稿，但仍未满足仓库要求的最终人工批准门禁。
- JMdict 英文释义只作审核证据，不能直接替代中文审核。
- 歧义词、多读音、多 JMdict 条目和宽泛义项必须逐义项处理。
- 无 JMdict 证据的项目需要独立人工调查。
- 只有状态改为 `approved` 且有证据、人工审核人和审核时间，才能进入正式中文数据。

## 摘要

- 总项目：96
- P0：5
- P1：43
- P2：21
- P3：27
- 已逐项审核并形成草稿：70
- drafted：68
- approved：0
- pending：26
- blocked：2
- 待处理 P0/P1/P2/P3：0/0/0/26
- 有 JMdict 证据：68
- 需独立人工调查：28
- 歧义审核：46
- 同形异读组：3

## 同形异读隔离

- 一日：いちにち / ついたち
- 開く：あく / ひらく
- 人気：にんき / ひとけ

## 前 40 项

| ID | 优先级 | 状态 | 词 | 读音 | 次数 | JLPT | 中文草稿 | 审核类型 | 风险 |
|---|---|---|---|---|---:|---|---|---|---|
| zh-review-001 | P0 | drafted | 帰る | かえる | 3 | N5 | 回去；回家；返回原处 | sense-disambiguation | ambiguity, broad-sense-range |
| zh-review-002 | P0 | drafted | 書く | かく | 3 | N5 | 写；书写；创作（文章等） | high-frequency-lexical | — |
| zh-review-003 | P0 | drafted | 静か | しずか | 3 | N5 | 安静；寂静；平静 | sense-disambiguation | broad-sense-range |
| zh-review-004 | P0 | drafted | 待つ | まつ | 3 | N5 | 等；等待；期待 | sense-disambiguation | broad-sense-range |
| zh-review-005 | P0 | drafted | 来る | くる | 3 | — | 来；到来；来到 | sense-disambiguation | broad-sense-range |
| zh-review-006 | P1 | drafted | 飲む | のむ | 2 | N5 | 喝；吞服（药物） | sense-disambiguation | broad-sense-range |
| zh-review-007 | P1 | drafted | 古い | ふるい | 2 | N5 | 旧的；古老的；陈旧的 | sense-disambiguation | broad-sense-range |
| zh-review-008 | P1 | drafted | 呼ぶ | よぶ | 2 | N5 | 叫；呼喊；叫来；称呼 | sense-disambiguation | broad-sense-range |
| zh-review-009 | P1 | drafted | 降る | ふる | 2 | N5 | 下（雨、雪等） | sense-disambiguation | broad-sense-range |
| zh-review-010 | P1 | drafted | 座る | すわる | 2 | N5 | 坐；坐下 | sense-disambiguation | broad-sense-range |
| zh-review-011 | P1 | drafted | 撮る | とる | 2 | N5 | 拍摄；录制 | high-frequency-lexical | — |
| zh-review-012 | P1 | drafted | 持つ | もつ | 2 | N5 | 拿；携带；拥有 | sense-disambiguation | broad-sense-range |
| zh-review-013 | P1 | drafted | 暑い | あつい | 2 | N5 | （天气、环境）炎热的 | sense-disambiguation | broad-sense-range |
| zh-review-014 | P1 | drafted | 乗る | のる | 2 | N5 | 乘坐；上（车、船等） | sense-disambiguation | broad-sense-range |
| zh-review-015 | P1 | drafted | 青い | あおい | 2 | N5 | 蓝色的；青绿色的；青涩的 | sense-disambiguation | broad-sense-range |
| zh-review-016 | P1 | drafted | 聞く | きく | 2 | N5 | 听；听说；询问 | sense-disambiguation | broad-sense-range |
| zh-review-017 | P1 | drafted | 便利 | べんり | 2 | N5 | 方便；便利；实用 | high-frequency-lexical | — |
| zh-review-018 | P1 | drafted | 冷たい | つめたい | 2 | N5 | 冰凉的；冷淡的 | sense-disambiguation | broad-sense-range |
| zh-review-019 | P1 | drafted | 話す | はなす | 2 | N5 | 说；说话；交谈；讲述 | sense-disambiguation | broad-sense-range |
| zh-review-020 | P1 | drafted | 会う | あう | 2 | — | 见面；遇见 | high-frequency-lexical | — |
| zh-review-021 | P1 | drafted | 開く | あく | 2 | — | （门、店等）开；空出来、有空位 | sense-disambiguation | ambiguity, broad-sense-range, same-written-form-multiple-readings |
| zh-review-022 | P1 | drafted | 終わる | おわる | 2 | — | 结束；完毕 | sense-disambiguation | broad-sense-range |
| zh-review-023 | P1 | drafted | 買う | かう | 2 | — | 买；购买 | sense-disambiguation | broad-sense-range |
| zh-review-024 | P1 | drafted | 一日 | いちにち | 1 | N5 | 一天；一整天 | sense-disambiguation | ambiguity, same-written-form-multiple-readings |
| zh-review-025 | P1 | drafted | 雨 | あめ | 1 | N5 | 雨；雨天 | sense-disambiguation | ambiguity |
| zh-review-026 | P1 | drafted | 駅 | えき | 1 | N5 | 车站；火车站 | high-frequency-lexical | — |
| zh-review-027 | P1 | drafted | 音楽 | おんがく | 1 | N5 | 音乐 | high-frequency-lexical | — |
| zh-review-028 | P1 | drafted | 家 | いえ | 1 | N5 | 房子；家；住所 | sense-disambiguation | broad-sense-range |
| zh-review-029 | P1 | drafted | 花 | はな | 1 | N5 | 花；花朵 | sense-disambiguation | ambiguity, broad-sense-range |
| zh-review-030 | P1 | drafted | 机 | つくえ | 1 | N5 | 桌子；书桌 | high-frequency-lexical | — |
| zh-review-031 | P1 | drafted | 橋 | はし | 1 | N5 | 桥；桥梁 | sense-disambiguation | ambiguity |
| zh-review-032 | P1 | drafted | 犬 | いぬ | 1 | N5 | 狗；犬 | sense-disambiguation | broad-sense-range |
| zh-review-033 | P1 | drafted | 公園 | こうえん | 1 | N5 | 公园 | high-frequency-lexical | — |
| zh-review-034 | P1 | drafted | 昨日 | きのう | 1 | N5 | 昨天 | high-frequency-lexical | — |
| zh-review-035 | P1 | drafted | 仕事 | しごと | 1 | N5 | 工作；职业；任务 | sense-disambiguation | broad-sense-range |
| zh-review-036 | P2 | drafted | 施行 | しこう | 1 | N1 | 施行；实施；执行（法律、政策等） | sense-disambiguation | broad-sense-range |
| zh-review-037 | P1 | drafted | 紙 | かみ | 1 | N5 | 纸；纸张 | sense-disambiguation | ambiguity |
| zh-review-038 | P1 | drafted | 写真 | しゃしん | 1 | N5 | 照片；摄影 | sense-disambiguation | broad-sense-range |
| zh-review-039 | P2 | drafted | 審議 | しんぎ | 1 | N1 | 审议；讨论研究 | high-frequency-lexical | — |
| zh-review-040 | P1 | drafted | 水 | みず | 1 | N5 | 水；凉水 | sense-disambiguation | broad-sense-range |

## 审核动作

1. 确认目标词形、基本形和读音。
2. 对照语料案例和 JMdict 证据划分义项。
3. 必要时使用 Wikidata、Wiktionary 或 Tatoeba 的隔离证据层补充核验。
4. 独立编写自然、简洁、适合学习者的中文释义。
5. 填写审核人、时间、决定、置信度和必要备注。
6. AI 辅助结果只能保留为 drafted；最终人工复核通过并通过数据质量门禁后，才允许进入正式中文发布层。

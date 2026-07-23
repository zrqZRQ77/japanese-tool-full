# Yomeru 离线中文释义人工审核队列

Generated: 2026-07-23T00:00:00.000Z

## 队列规则

- 所有项目初始状态为 `pending`。
- `candidateChinese` 初始为空，不自动生成正式中文释义。
- JMdict 英文释义只作审核证据，不能直接替代中文审核。
- 歧义词、多读音、多 JMdict 条目和宽泛义项必须逐义项处理。
- 无 JMdict 证据的项目需要独立人工调查。
- 只有状态改为 `approved` 且有证据、审核人和审核时间，才能进入正式中文数据。

## 摘要

- 总项目：93
- P0：6
- P1：42
- P2：19
- P3：26
- 有 JMdict 证据：67
- 需独立人工调查：26
- 歧义审核：45

## 前 40 项

| ID | 优先级 | 词 | 读音 | 次数 | JLPT | 审核类型 | 英文证据 | 风险 |
|---|---|---|---|---:|---|---|---|---|
| zh-review-001 | P0 | 帰る | かえる | 3 | N5 | sense-disambiguation | to return; to come home; to go home; to go back | ambiguity, broad-sense-range |
| zh-review-002 | P0 | 書く | かく | 3 | N5 | high-frequency-lexical | to write; to compose; to pen; to draw | — |
| zh-review-003 | P0 | 静か | しずか | 3 | N5 | sense-disambiguation | quiet; silent; slow; unhurried | broad-sense-range |
| zh-review-004 | P0 | 待つ | まつ | 3 | N5 | sense-disambiguation | to wait; to await; to look forward to; to anticipate | broad-sense-range |
| zh-review-005 | P0 | 開く | あく | 3 | — | sense-disambiguation | to open (e.g. doors); to open (e.g. business, etc.); to be empty; to be vacant | ambiguity, broad-sense-range |
| zh-review-006 | P0 | 来る | くる | 3 | — | sense-disambiguation | to come (spatially or temporally); to approach; to arrive; to come back | broad-sense-range |
| zh-review-007 | P1 | 一日 | いちにち | 2 | N5 | sense-disambiguation | one day; all day (long); the whole day; from morning till night | ambiguity |
| zh-review-008 | P1 | 飲む | のむ | 2 | N5 | sense-disambiguation | to drink; to swallow; to take (medicine); to smoke (tobacco) | broad-sense-range |
| zh-review-009 | P1 | 古い | ふるい | 2 | N5 | sense-disambiguation | old; aged; ancient; antiquated | broad-sense-range |
| zh-review-010 | P1 | 呼ぶ | よぶ | 2 | N5 | sense-disambiguation | to call out (to); to call; to invoke; to summon (a doctor, etc.) | broad-sense-range |
| zh-review-011 | P1 | 降る | ふる | 2 | N5 | sense-disambiguation | to fall (of rain, snow, ash, etc.); to come down; to form (of frost); to beam down (of sunlight or moonlight) | broad-sense-range |
| zh-review-012 | P1 | 座る | すわる | 2 | N5 | sense-disambiguation | to sit (down); to have a seat; to be seated; to kneel (on the floor) | broad-sense-range |
| zh-review-013 | P1 | 撮る | とる | 2 | N5 | high-frequency-lexical | to take (a photograph); to record (audio or video); to film; to shoot | — |
| zh-review-014 | P1 | 持つ | もつ | 2 | N5 | sense-disambiguation | to hold (in one's hand); to take; to carry; to possess | broad-sense-range |
| zh-review-015 | P1 | 暑い | あつい | 2 | N5 | sense-disambiguation | hot; warm; sultry; heated | broad-sense-range |
| zh-review-016 | P1 | 乗る | のる | 2 | N5 | sense-disambiguation | to get on (train, plane, bus, ship, etc.); to get in; to board; to take | broad-sense-range |
| zh-review-017 | P1 | 青い | あおい | 2 | N5 | sense-disambiguation | blue; azure; green; pale (facial color) | broad-sense-range |
| zh-review-018 | P1 | 聞く | きく | 2 | N5 | sense-disambiguation | to hear; to listen (e.g. to music); to ask; to enquire | broad-sense-range |
| zh-review-019 | P1 | 便利 | べんり | 2 | N5 | high-frequency-lexical | convenient; handy; useful | — |
| zh-review-020 | P1 | 冷たい | つめたい | 2 | N5 | sense-disambiguation | cold (to the touch); chilly; icy; freezing | broad-sense-range |
| zh-review-021 | P1 | 話す | はなす | 2 | N5 | sense-disambiguation | to talk; to speak; to converse; to chat | broad-sense-range |
| zh-review-022 | P1 | 会う | あう | 2 | — | high-frequency-lexical | to meet; to encounter; to see; to have an accident | — |
| zh-review-023 | P1 | 終わる | おわる | 2 | — | sense-disambiguation | to end; to come to an end; to finish; to close | broad-sense-range |
| zh-review-024 | P1 | 人気 | にんき | 2 | — | sense-disambiguation | popularity; public favor; condition (e.g. market); tone | ambiguity, broad-sense-range |
| zh-review-025 | P1 | 買う | かう | 2 | — | sense-disambiguation | to buy; to purchase; to value (highly); to think highly of | broad-sense-range |
| zh-review-026 | P1 | 雨 | あめ | 1 | N5 | sense-disambiguation | rain; rainy day; rainy weather; the November suit (in hanafuda) | ambiguity |
| zh-review-027 | P1 | 駅 | えき | 1 | N5 | high-frequency-lexical | railway station; train station; staging post on a highway (in pre-modern Japan); counter for railway stations and bus stations | — |
| zh-review-028 | P1 | 音楽 | おんがく | 1 | N5 | high-frequency-lexical | music | — |
| zh-review-029 | P1 | 家 | いえ | 1 | N5 | sense-disambiguation | house; residence; dwelling; home | broad-sense-range |
| zh-review-030 | P1 | 花 | はな | 1 | N5 | sense-disambiguation | flower; blossom; bloom; petal | ambiguity, broad-sense-range |
| zh-review-031 | P1 | 机 | つくえ | 1 | N5 | high-frequency-lexical | desk | — |
| zh-review-032 | P1 | 橋 | はし | 1 | N5 | sense-disambiguation | bridge | ambiguity |
| zh-review-033 | P1 | 犬 | いぬ | 1 | N5 | sense-disambiguation | dog (Canis (lupus) familiaris); canine; squealer; rat | broad-sense-range |
| zh-review-034 | P1 | 公園 | こうえん | 1 | N5 | high-frequency-lexical | (public) park | — |
| zh-review-035 | P1 | 昨日 | きのう | 1 | N5 | high-frequency-lexical | yesterday | — |
| zh-review-036 | P1 | 仕事 | しごと | 1 | N5 | sense-disambiguation | work; job; labor; labour | broad-sense-range |
| zh-review-037 | P2 | 施行 | しこう | 1 | N1 | sense-disambiguation | putting in force (a law); putting into operation; putting into effect; enforcement | broad-sense-range |
| zh-review-038 | P1 | 紙 | かみ | 1 | N5 | sense-disambiguation | paper | ambiguity |
| zh-review-039 | P1 | 写真 | しゃしん | 1 | N5 | sense-disambiguation | photograph; photo; picture; photography | broad-sense-range |
| zh-review-040 | P2 | 審議 | しんぎ | 1 | N1 | high-frequency-lexical | deliberation; discussion; consideration | — |

## 审核动作

1. 确认目标词形和读音。
2. 对照语料案例和 JMdict 证据划分义项。
3. 必要时使用 Wikidata、Wiktionary 或 Tatoeba 的隔离证据层补充核验。
4. 独立编写自然、简洁、适合学习者的中文释义。
5. 填写审核人、时间、决定和必要备注。
6. 通过数据质量门禁后才允许进入正式中文发布层。

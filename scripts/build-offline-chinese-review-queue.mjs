#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const AUDIT_DIR = resolve(ROOT, 'audits/offline-chinese-coverage/20260723');
const JMDICT_DIR = resolve(ROOT, 'frontend/data/jmdict-common/20260713');
const GAPS_PATH = resolve(AUDIT_DIR, 'high-priority-gaps.json');
const GENERATED_AT = '2026-07-23T00:00:00.000Z';
const REVIEWED_AT = '2026-07-24';
const REVIEWER = 'OpenAI ChatGPT / CodexPro assisted lexical review';

const MANUAL_REVIEW_DRAFTS = {
  '帰る\u0000かえる': {
    candidateChinese: '回去；回家；返回原处',
    confidence: '高',
    notes: '基本形：帰る；词性：五段ラ行自动词（JMdict v5r/vi）。核心义限定为回去、回家、返回原处，不纳入棒球等专门义。多义与混淆：同音名词「蛙（かえる）」必须按日文表记隔离。证据：JLPT N5；JMdict 1221270，CC BY-SA 4.0，仅作词形、读音、词性和语义范围证据。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '書く\u0000かく': {
    candidateChinese: '写；书写；创作（文章等）',
    confidence: '高',
    notes: '基本形：書く；词性：五段カ行动词、他动词（JMdict v5k/vt）。核心义限定为写、书写和创作文字内容。多义与混淆：同音的「描く」「掻く」以及其他「かく」词条不得由读音覆盖；本草稿不纳入绘画义。证据：JLPT N5；JMdict 1343950，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '静か\u0000しずか': {
    candidateChinese: '安静；寂静；平静',
    confidence: '高',
    notes: '基本形：静か；词性：ナ形容词/形容动词（JMdict adj-na；当前语料解析器表面词性显示为名词）。核心义覆盖环境安静、寂静及状态平静，不扩展为所有“缓慢、从容”语境。多义与混淆：无需要合并的同形异读词。证据：JLPT N5；JMdict 1381820，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '待つ\u0000まつ': {
    candidateChinese: '等；等待；期待',
    confidence: '高',
    notes: '基本形：待つ；词性：五段タ行动词，可作自动词或他动词（JMdict v5t/vi/vt）。核心义覆盖等待、等候和期待；不把“依赖、需要”等低频结构直接并入核心释义。多义与混淆：与同音名词「松（まつ）」按表记隔离。证据：JLPT N5；JMdict 1410590，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '来る\u0000くる': {
    candidateChinese: '来；到来；来到',
    confidence: '高',
    notes: '基本形：来る；词性：カ变自动词（JMdict vk/vi，另有助动词用法）。核心释义只覆盖独立动词“来、到来、来到”，不把「〜てくる」等补助动词语法义混入词条核心义。多义与混淆：表记和读音对应明确，无需按同音词扩展。证据：本地 JLPT 参考未提供等级；JMdict 1547720，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '開く\u0000あく': {
    candidateChinese: '（门、店等）开；空出来、有空位',
    confidence: '中高',
    notes: '基本形：開く；目标读音：あく；词性：五段カ行动词，本审核限定自动词用法（JMdict v5k/vi；证据记录同时含 vt 标签）。核心义覆盖门打开、店开门营业，以及时间、空间或座位空出来。多义与混淆：同一表记的「開く（ひらく）」必须拆分为独立词条；不得用本草稿覆盖“打开书本、召开”等 ひらく 用法，也不得仅凭读音覆盖「空く」。语料 LQ-175 属于 ひらく，修正分组后已移出本词条。证据：本地 JLPT 参考未提供等级；JMdict 1586270，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：中高。'
  },
  '飲む\u0000のむ': {
    candidateChinese: '喝；吞服（药物）',
    confidence: '高',
    notes: '基本形：飲む；词性：五段マ行动词、他动词（JMdict v5m/vt）。核心义覆盖喝饮料及吞服药物；不把吸烟、吞没或压抑情绪等引申义并入基础释义。多义与混淆：无需要合并的同形异读词。证据：JLPT N5；JMdict 1169870，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '古い\u0000ふるい': {
    candidateChinese: '旧的；古老的；陈旧的',
    confidence: '高',
    notes: '基本形：古い；词性：イ形容词（JMdict adj-i）。核心义覆盖年代久、使用时间长或观念陈旧；不扩展为与词形无关的“长时间”副词义。多义与混淆：表记和读音对应明确。证据：JLPT N5；JMdict 1265070，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '呼ぶ\u0000よぶ': {
    candidateChinese: '叫；呼喊；叫来；称呼',
    confidence: '高',
    notes: '基本形：呼ぶ；词性：五段バ行动词、他动词（JMdict v5b/vt）。核心义覆盖出声叫、召来某人以及称呼或命名；不将品牌化等低频引申义扩大为核心义。多义与混淆：表记和读音对应明确。证据：JLPT N5；JMdict 1266440，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '降る\u0000ふる': {
    candidateChinese: '下（雨、雪等）',
    confidence: '高',
    notes: '基本形：降る；词性：五段ラ行自动词（JMdict v5r/vi）。核心义限定为雨、雪、灰等从空中落下，符合当前语料；阳光照射、幸运降临等引申义不并入基础释义。多义与混淆：与同音「振る（ふる）」及其他同音词按表记隔离。证据：JLPT N5；JMdict 1282790，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '座る\u0000すわる': {
    candidateChinese: '坐；坐下',
    confidence: '高',
    notes: '基本形：座る；词性：五段ラ行自动词（JMdict v5r/vi）。核心义限定为坐、坐下或就座；任职、占据职位等引申义不并入基础释义。多义与混淆：表记和读音对应明确。证据：JLPT N5；JMdict 1291800，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '撮る\u0000とる': {
    candidateChinese: '拍摄；录制',
    confidence: '高',
    notes: '基本形：撮る；词性：五段ラ行动词、他动词（JMdict v5r/vt）。核心义覆盖拍照、摄影以及录制音频或视频。多义与混淆：同音的「取る」「採る」「捕る」等必须按表记隔离，不能由读音查询覆盖。证据：JLPT N5；JMdict 1298790，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '持つ\u0000もつ': {
    candidateChinese: '拿；携带；拥有',
    confidence: '中高',
    notes: '基本形：持つ；词性：五段タ行动词，可作自动词或他动词（JMdict v5t/vi/vt）。核心义覆盖手持、携带和拥有；维持、耐久、承担等扩展义暂不并入基础释义。多义与混淆：语义范围较宽，但表记和读音对应明确。证据：JLPT N5；JMdict 1315720，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：中高。'
  },
  '暑い\u0000あつい': {
    candidateChinese: '（天气、环境）炎热的',
    confidence: '高',
    notes: '基本形：暑い；词性：イ形容词（JMdict adj-i）。核心义严格限定天气、气温或环境炎热，不覆盖「熱い」的物体温度、感情热烈，也不覆盖「厚い」。多义与混淆：与同音「熱い」「厚い」按日文表记隔离。证据：JLPT N5；JMdict 1343460，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '乗る\u0000のる': {
    candidateChinese: '乘坐；上（车、船等）',
    confidence: '高',
    notes: '基本形：乗る；词性：五段ラ行自动词（JMdict v5r/vi）。核心义限定为登上并乘坐交通工具，符合当前语料；踩上物体、顺势、参与等引申义不并入基础释义。多义与混淆：同音「載る（のる）」等按表记隔离。证据：JLPT N5；JMdict 1355120，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '青い\u0000あおい': {
    candidateChinese: '蓝色的；青绿色的；青涩的',
    confidence: '中高',
    notes: '基本形：青い；词性：イ形容词（JMdict adj-i）。核心义覆盖蓝色、日语传统色彩范围中的青绿色，以及果实未熟或经验不足的“青涩”；脸色苍白等语境属于次级义，不扩大为所有灰色表达。多义与混淆：颜色范围与中文“蓝/绿”不能机械一一对应，需保留语境限制。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：中高。'
  },
  '聞く\u0000きく': {
    candidateChinese: '听；听说；询问',
    confidence: '高',
    notes: '基本形：聞く；词性：五段カ行动词、他动词（JMdict v5k/vt）。核心义覆盖听声音、听说消息和向他人询问。多义与混淆：必须与同音「効く（起作用）」「利く（灵验、好用）」等按表记隔离，不允许只凭读音覆盖。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '便利\u0000べんり': {
    candidateChinese: '方便；便利；实用',
    confidence: '高',
    notes: '基本形：便利；词性：ナ形容词（JMdict adj-na）。核心义覆盖使用方便、便利和实用，不扩大为抽象的“有利”。多义与混淆：词形、读音和语义范围明确。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '冷たい\u0000つめたい': {
    candidateChinese: '冰凉的；冷淡的',
    confidence: '高',
    notes: '基本形：冷たい；词性：イ形容词（JMdict adj-i）。核心义区分接触温度低的“冰凉”和态度、感情上的“冷淡”，不与天气寒冷的「寒い」混用。多义与混淆：语义有物理与情感两类，但均由同一词形和读音承载。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '話す\u0000はなす': {
    candidateChinese: '说；说话；交谈；讲述',
    confidence: '高',
    notes: '基本形：話す；词性：五段サ行动词、他动词（JMdict v5s/vt）。核心义覆盖说话、交谈、讲述或说明内容。多义与混淆：与同音「放す（放开）」「離す（分开）」必须按表记隔离。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '会う\u0000あう': {
    candidateChinese: '见面；遇见',
    confidence: '高',
    notes: '基本形：会う；词性：五段ワ行动词、自动词（JMdict v5u/vi）。核心义限定为人与人见面或遇见，不纳入事故、坏事等通常由「遭う」承担的语义。多义与混淆：必须与同音「合う（符合、合适）」「遭う（遭遇）」按表记隔离。证据：本地 JLPT 参考未提供等级；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '終わる\u0000おわる': {
    candidateChinese: '结束；完毕',
    confidence: '高',
    notes: '基本形：終わる；词性：五段ラ行动词，主要作自动词，也存在他动词及接尾用法（JMdict v5r/vi/vt/suf）。核心义限定为事情、工作或时间结束、完毕；不与「終える」的主动完成用法混同。多义与混淆：当前语料均为自动词结束义。证据：本地 JLPT 参考未提供等级；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '買う\u0000かう': {
    candidateChinese: '买；购买',
    confidence: '高',
    notes: '基本形：買う；词性：五段ワ行动词、他动词（JMdict v5u/vt）。核心义限定为用金钱购买商品或服务；“高度评价”“招致不满”等引申义不并入基础释义。多义与混淆：必须与同音「飼う（饲养）」按表记隔离。证据：本地 JLPT 参考未提供等级；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '一日\u0000いちにち': {
    candidateChinese: '一天；一整天',
    confidence: '高',
    notes: '基本形：一日；目标读音：いちにち；词性：名词、副词（JMdict n/adv）。核心义限定为一天或一整天。多义与混淆：同一表记的「一日（ついたち，每月一日）」必须保持独立记录，不得由表记查询混合返回。证据：JLPT N5；JMdict 精确词形与目标读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '一日\u0000ついたち': {
    candidateChinese: '每月一日；一号',
    confidence: '高',
    notes: '基本形：一日；目标读音：ついたち；词性：名词（JMdict 证据记录同时包含 n/adv）。核心义限定为月份中的第一天，即一号。多义与混淆：同一表记的「一日（いちにち，一天）」必须保持独立记录，不得由表记查询混合返回。证据：JLPT N5；JMdict 精确词形与目标读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '雨\u0000あめ': {
    candidateChinese: '雨；雨天',
    confidence: '高',
    notes: '基本形：雨；词性：名词（JMdict n）。核心义覆盖雨和下雨的天气，不纳入花札牌组等专门义。多义与混淆：必须与同音「飴（糖果）」按表记隔离。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '駅\u0000えき': {
    candidateChinese: '车站；火车站',
    confidence: '高',
    notes: '基本形：駅；词性：名词，另有计数用法（JMdict n/ctr）。核心义限定为铁路或电车车站，不纳入古代驿站与计数词用法。多义与混淆：现代基础语境明确。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '音楽\u0000おんがく': {
    candidateChinese: '音乐',
    confidence: '高',
    notes: '基本形：音楽；词性：名词（JMdict n）。核心义为音乐，词形、读音和语义范围明确。多义与混淆：未发现需要隔离的同形或同音词。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '家\u0000いえ': {
    candidateChinese: '房子；家；住所',
    confidence: '高',
    notes: '基本形：家；目标读音：いえ；词性：名词（JMdict n）。核心义限定为房屋、住所和作为生活场所的家，不纳入家族、血统、姓氏等扩展义。多义与混淆：同一汉字还可能读作「うち」「け」并承载不同语义，必须按读音与语境隔离。证据：JLPT N5；JMdict 精确词形与目标读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '花\u0000はな': {
    candidateChinese: '花；花朵',
    confidence: '高',
    notes: '基本形：花；词性：名词，也可作「の」形容修饰（JMdict n/adj-no）。核心义限定为花、花朵或花开，不纳入美人、精华、插花等引申或专门义。多义与混淆：必须与同音「鼻（はな）」按表记隔离。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '机\u0000つくえ': {
    candidateChinese: '桌子；书桌',
    confidence: '高',
    notes: '基本形：机；词性：名词（JMdict n）。核心义为桌子，基础学习语境中通常指书桌。多义与混淆：词形、读音和语义明确。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '橋\u0000はし': {
    candidateChinese: '桥；桥梁',
    confidence: '高',
    notes: '基本形：橋；词性：名词（JMdict n）。核心义为桥或桥梁。多义与混淆：必须与同音「箸（筷子）」「端（边、端）」按表记隔离，不能只凭读音返回。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '犬\u0000いぬ': {
    candidateChinese: '狗；犬',
    confidence: '高',
    notes: '基本形：犬；词性：名词及名词前缀（JMdict n/n-pref）。核心义限定为动物“狗、犬”，不纳入告密者、间谍等贬义引申。多义与混淆：基础语境明确。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '公園\u0000こうえん': {
    candidateChinese: '公园',
    confidence: '高',
    notes: '基本形：公園；词性：名词（JMdict n）。核心义为公共公园，词形、读音和语义范围明确。多义与混淆：与同音「講演」「公演」按表记隔离。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '昨日\u0000きのう': {
    candidateChinese: '昨天',
    confidence: '高',
    notes: '基本形：昨日；目标读音：きのう；词性：名词、副词（JMdict n/adv）。核心义为昨天。多义与混淆：同一表记还存在书面读音「さくじつ」，必须按读音与语体隔离；本记录只处理基础口语读音。证据：JLPT N5；JMdict 精确词形与目标读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '仕事\u0000しごと': {
    candidateChinese: '工作；职业；任务',
    confidence: '高',
    notes: '基本形：仕事；词性：名词，也可与「する」构成动词表达（JMdict n/vi/vs）。核心义覆盖工作、职业和具体任务，不扩大为所有商业活动。多义与混淆：语义范围较宽但核心边界明确。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '紙\u0000かみ': {
    candidateChinese: '纸；纸张',
    confidence: '高',
    notes: '基本形：紙；词性：名词（JMdict n）。核心义为纸或纸张。多义与混淆：必须与同音「髪（头发）」「神（神）」按表记隔离，不能只凭读音覆盖。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '写真\u0000しゃしん': {
    candidateChinese: '照片；摄影',
    confidence: '高',
    notes: '基本形：写真；词性：名词（JMdict n）。核心义覆盖照片以及摄影这一活动或领域；电影、活动影像等历史或扩展义不并入基础释义。多义与混淆：现代学习语境明确。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '水\u0000みず': {
    candidateChinese: '水；凉水',
    confidence: '高',
    notes: '基本形：水；词性：名词（JMdict n）。核心义限定为水，尤其与热水「湯」相对的常温或凉水；体液、洪水、相扑用水等扩展义不并入基础释义。多义与混淆：基础语境明确。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '切る\u0000きる': {
    candidateChinese: '切；剪；关闭（电源等）',
    confidence: '中高',
    notes: '基本形：切る；词性：五段ラ行动词、他动词，另有接尾用法（JMdict v5r/vt/suf）。核心义覆盖切断、剪切，以及关闭电源或中断连接等常见引申；手术、断交、期限等细分义不全部展开。多义与混淆：必须与同音「着る（穿）」按表记隔离。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：中高。'
  },
  '窓\u0000まど': {
    candidateChinese: '窗；窗户',
    confidence: '高',
    notes: '基本形：窓；词性：名词（JMdict n）。核心义为窗或窗户，词形、读音和语义范围明确。多义与混淆：无需要合并的同形异读词。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '着る\u0000きる': {
    candidateChinese: '穿；穿上（衣服）',
    confidence: '高',
    notes: '基本形：着る；词性：一段动词、他动词（JMdict v1/vt）。核心义限定为穿上衣服，尤其是上半身或覆盖身体的服装；承担责任、背黑锅等引申义不并入基础释义。多义与混淆：必须与同音「切る（切、剪）」按表记隔离。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '電車\u0000でんしゃ': {
    candidateChinese: '电车；列车',
    confidence: '高',
    notes: '基本形：電車；词性：名词（JMdict n）。核心义为以电力驱动的铁路列车，基础语境可译为电车或列车。多义与混淆：词形和读音明确。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '猫\u0000ねこ': {
    candidateChinese: '猫',
    confidence: '高',
    notes: '基本形：猫；词性：名词（JMdict n）。核心义限定为动物“猫”，不纳入三味线、艺伎、手推车等俗语或历史扩展义。多义与混淆：基础语境明确。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '箸\u0000はし': {
    candidateChinese: '筷子',
    confidence: '高',
    notes: '基本形：箸；词性：名词（JMdict n）。核心义为筷子。多义与混淆：必须与同音「橋（桥）」「端（边、端）」按表记隔离，不能只凭读音返回。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '髪\u0000かみ': {
    candidateChinese: '头发',
    confidence: '高',
    notes: '基本形：髪；词性：名词（JMdict n）。核心义限定为头发。多义与混淆：必须与同音「紙（纸）」「神（神）」按表记隔离。证据：JLPT N4；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '鼻\u0000はな': {
    candidateChinese: '鼻子',
    confidence: '高',
    notes: '基本形：鼻；词性：名词（JMdict n）。核心义为鼻子。多义与混淆：必须与同音「花（花朵）」按表记隔离。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  },
  '料理\u0000りょうり': {
    candidateChinese: '烹饪；菜肴；料理',
    confidence: '高',
    notes: '基本形：料理；词性：名词，也可与「する」构成他动词表达（JMdict n/vs/vt）。核心义覆盖烹饪行为、菜肴和料理类别；处理事务、管理等引申义不并入基础释义。多义与混淆：语义范围明确且符合当前语料。证据：JLPT N5；JMdict 精确词形与读音证据，CC BY-SA 4.0。中文来源与许可证边界：Yomeru 独立中文草稿，AI 辅助 draft-only，不复制商业词典；需人工复核后方可进入正式中文层。审核结论：建议批准；置信度：高。'
  }
};

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function loadJmdictIndex() {
  const files = (await readdir(JMDICT_DIR)).filter(file => /^shard-\d+\.json$/.test(file)).sort();
  const index = new Map();
  for (const file of files) {
    const shard = await readJson(resolve(JMDICT_DIR, file));
    for (const [form, entries] of Object.entries(shard)) {
      const existing = index.get(form) || [];
      index.set(form, [...existing, ...entries]);
    }
  }
  return index;
}

function matchingEntries(gap, index) {
  const entries = [...(index.get(gap.word) || []), ...(index.get(gap.reading) || [])];
  const byId = new Map();
  for (const entry of entries) {
    const key = String(entry.id || `${entry.w}:${entry.r}:${(entry.g || []).join('|')}`);
    if (!byId.has(key)) byId.set(key, entry);
  }
  const uniqueEntries = [...byId.values()];
  const exact = uniqueEntries.filter(entry => entry.w === gap.word && (!gap.reading || entry.r === gap.reading));
  const headword = uniqueEntries.filter(entry => entry.w === gap.word);
  const selected = exact.length ? exact : (headword.length ? headword : uniqueEntries.filter(entry => entry.r === gap.reading));
  return selected.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function priorityTier(gap) {
  if (gap.count >= 3) return 'P0';
  if (gap.count >= 2 || gap.jlptLevels.some(level => ['N5', 'N4'].includes(level))) return 'P1';
  if (gap.jmdictAvailable) return 'P2';
  return 'P3';
}

function riskFlags(gap, entries) {
  const flags = [];
  if (gap.categories.includes('ambiguity')) flags.push('ambiguity');
  if (entries.length > 1) flags.push('multiple-jmdict-entries');
  const readings = unique(entries.map(entry => entry.r));
  if (readings.length > 1) flags.push('multiple-readings');
  const glossGroups = unique(entries.flatMap(entry => entry.g || []));
  if (glossGroups.length >= 6) flags.push('broad-sense-range');
  if (!entries.length) flags.push('no-jmdict-evidence');
  if (gap.categories.includes('proper-nouns')) flags.push('proper-name');
  if (gap.categories.includes('unknown')) flags.push('unknown-token');
  return flags;
}

function reviewType(gap, entries, flags) {
  if (!entries.length) return 'manual-research-required';
  if (flags.includes('proper-name')) return 'entity-disambiguation';
  if (flags.some(flag => ['ambiguity', 'multiple-jmdict-entries', 'multiple-readings', 'broad-sense-range'].includes(flag))) return 'sense-disambiguation';
  if (gap.count >= 2 || gap.jlptLevels.length) return 'high-frequency-lexical';
  return 'standard-lexical';
}

function queueItem(gap, index, position) {
  const entries = matchingEntries(gap, index);
  const flags = riskFlags(gap, entries);
  const englishGlosses = unique(entries.flatMap(entry => entry.g || [])).slice(0, 16);
  const partsOfSpeech = unique(entries.flatMap(entry => entry.p || [])).sort();
  const review = MANUAL_REVIEW_DRAFTS[`${gap.word}\u0000${gap.reading || ''}`];
  const base = {
    queueId: `zh-review-${String(position + 1).padStart(3, '0')}`,
    priority: priorityTier(gap),
    word: gap.word,
    reading: gap.reading || null,
    corpusFrequency: gap.count,
    corpusCategories: gap.categories,
    jlptLevels: gap.jlptLevels,
    exampleCaseIds: gap.examples,
    reviewType: reviewType(gap, entries, flags),
    riskFlags: flags,
    evidence: entries.length ? [{
      sourceId: 'jmdict-edrdg',
      license: 'CC-BY-SA-4.0',
      entryIds: entries.map(entry => String(entry.id)),
      headwords: unique(entries.map(entry => entry.w)),
      readings: unique(entries.map(entry => entry.r)),
      partsOfSpeech,
      englishGlosses,
      sourceUrl: 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project',
      retrievedAt: '2026-07-23'
    }] : [],
    candidateChinese: null,
    reviewerStatus: 'pending',
    reviewer: null,
    reviewedAt: null,
    decision: null,
    rejectionReason: null,
    notes: flags.includes('no-jmdict-evidence')
      ? '需要独立人工调查；不得由 AI 自动生成正式释义。'
      : 'JMdict 英文只作审核证据；中文措辞必须独立人工确认。'
  };

  if (!review) return base;
  return {
    ...base,
    candidateChinese: review.candidateChinese,
    reviewerStatus: 'drafted',
    reviewer: REVIEWER,
    reviewedAt: REVIEWED_AT,
    decision: 'recommend-approve',
    notes: review.notes
  };
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = typeof key === 'function' ? key(item) : item[key];
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

const [gapPayload, jmdictIndex] = await Promise.all([readJson(GAPS_PATH), loadJmdictIndex()]);
const items = gapPayload.items.map((gap, index) => queueItem(gap, jmdictIndex, index));
const readingsByWord = new Map();
for (const item of items) {
  const readings = readingsByWord.get(item.word) || new Set();
  if (item.reading) readings.add(item.reading);
  readingsByWord.set(item.word, readings);
}
const sameWrittenFormGroups = [...readingsByWord.entries()]
  .filter(([, readings]) => readings.size > 1)
  .map(([word, readings]) => ({ word, readings: [...readings].sort((a, b) => a.localeCompare(b, 'ja')) }))
  .sort((a, b) => a.word.localeCompare(b.word, 'ja'));
const sameWrittenWords = new Set(sameWrittenFormGroups.map(group => group.word));
for (const item of items) {
  if (sameWrittenWords.has(item.word) && !item.riskFlags.includes('same-written-form-multiple-readings')) {
    item.riskFlags.push('same-written-form-multiple-readings');
  }
}

const pendingItems = items.filter(item => item.reviewerStatus === 'pending');
const draftedItems = items.filter(item => item.reviewerStatus === 'drafted');
const approvedItems = items.filter(item => item.reviewerStatus === 'approved');
const rejectedItems = items.filter(item => item.reviewerStatus === 'rejected');
const queue = {
  schemaVersion: 1,
  generatedAt: GENERATED_AT,
  baseline: {
    mainCommit: '6a821a65d56af7576e4312ef4b1df33eb6d889f4',
    coverageAudit: '20260723',
    jmdictDataVersion: '20260713',
    sourceRegistry: 'audits/offline-chinese-coverage/20260723/source-registry.json'
  },
  policy: {
    officialChineseLayer: 'human-reviewed-yomeru-curated-only',
    automaticApprovalAllowed: false,
    aiDraftAllowed: true,
    aiDraftPublishAllowed: false,
    requiredReviewerStatus: 'approved',
    requiredEvidenceCount: 1
  },
  summary: {
    totalItems: items.length,
    priorityCounts: countBy(items, 'priority'),
    remainingPriorityCounts: countBy(pendingItems, 'priority'),
    draftedPriorityCounts: countBy(draftedItems, 'priority'),
    reviewTypeCounts: countBy(items, 'reviewType'),
    reviewerStatusCounts: countBy(items, 'reviewerStatus'),
    reviewedItems: items.length - pendingItems.length,
    pendingItems: pendingItems.length,
    draftedItems: draftedItems.length,
    approvedItems: approvedItems.length,
    rejectedItems: rejectedItems.length,
    blockedItems: 0,
    withJmdictEvidence: items.filter(item => item.evidence.length).length,
    manualResearchRequired: items.filter(item => !item.evidence.length).length,
    ambiguityReview: items.filter(item => item.reviewType === 'sense-disambiguation').length,
    sameWrittenFormGroups: sameWrittenFormGroups.length,
    candidateChineseFilled: items.filter(item => item.candidateChinese).length
  },
  sameWrittenFormGroups,
  items
};

const markdown = [
  '# Yomeru 离线中文释义人工审核队列',
  '',
  `Generated: ${GENERATED_AT}`,
  `First assisted review batch: ${REVIEWED_AT}`,
  '',
  '## 队列规则',
  '',
  '- 未处理项目保持 `pending`，中文候选为空。',
  '- `drafted` 表示已逐项核验证据并形成中文草稿，但仍未满足仓库要求的最终人工批准门禁。',
  '- JMdict 英文释义只作审核证据，不能直接替代中文审核。',
  '- 歧义词、多读音、多 JMdict 条目和宽泛义项必须逐义项处理。',
  '- 无 JMdict 证据的项目需要独立人工调查。',
  '- 只有状态改为 `approved` 且有证据、人工审核人和审核时间，才能进入正式中文数据。',
  '',
  '## 摘要',
  '',
  `- 总项目：${queue.summary.totalItems}`,
  `- P0：${queue.summary.priorityCounts.P0 || 0}`,
  `- P1：${queue.summary.priorityCounts.P1 || 0}`,
  `- P2：${queue.summary.priorityCounts.P2 || 0}`,
  `- P3：${queue.summary.priorityCounts.P3 || 0}`,
  `- 已逐项审核并形成草稿：${queue.summary.reviewedItems}`,
  `- drafted：${queue.summary.draftedItems}`,
  `- approved：${queue.summary.approvedItems}`,
  `- pending：${queue.summary.pendingItems}`,
  `- blocked：${queue.summary.blockedItems}`,
  `- 待处理 P0/P1/P2/P3：${queue.summary.remainingPriorityCounts.P0 || 0}/${queue.summary.remainingPriorityCounts.P1 || 0}/${queue.summary.remainingPriorityCounts.P2 || 0}/${queue.summary.remainingPriorityCounts.P3 || 0}`,
  `- 有 JMdict 证据：${queue.summary.withJmdictEvidence}`,
  `- 需独立人工调查：${queue.summary.manualResearchRequired}`,
  `- 歧义审核：${queue.summary.ambiguityReview}`,
  `- 同形异读组：${queue.summary.sameWrittenFormGroups}`,
  '',
  '## 同形异读隔离',
  '',
  ...sameWrittenFormGroups.map(group => `- ${group.word}：${group.readings.join(' / ')}`),
  '',
  '## 前 40 项',
  '',
  '| ID | 优先级 | 状态 | 词 | 读音 | 次数 | JLPT | 中文草稿 | 审核类型 | 风险 |',
  '|---|---|---|---|---|---:|---|---|---|---|',
  ...items.slice(0, 40).map(item => `| ${item.queueId} | ${item.priority} | ${item.reviewerStatus} | ${item.word} | ${item.reading || ''} | ${item.corpusFrequency} | ${item.jlptLevels.join(', ') || '—'} | ${item.candidateChinese || '—'} | ${item.reviewType} | ${item.riskFlags.join(', ') || '—'} |`),
  '',
  '## 审核动作',
  '',
  '1. 确认目标词形、基本形和读音。',
  '2. 对照语料案例和 JMdict 证据划分义项。',
  '3. 必要时使用 Wikidata、Wiktionary 或 Tatoeba 的隔离证据层补充核验。',
  '4. 独立编写自然、简洁、适合学习者的中文释义。',
  '5. 填写审核人、时间、决定、置信度和必要备注。',
  '6. AI 辅助结果只能保留为 drafted；最终人工复核通过并通过数据质量门禁后，才允许进入正式中文发布层。'
].join('\n');

await mkdir(AUDIT_DIR, { recursive: true });
await Promise.all([
  writeFile(resolve(AUDIT_DIR, 'review-queue.json'), `${JSON.stringify(queue, null, 2)}\n`),
  writeFile(resolve(AUDIT_DIR, 'REVIEW_QUEUE.md'), `${markdown}\n`)
]);

process.stdout.write(`Review queue built: ${items.length} items, ${queue.summary.draftedItems} drafted, ${queue.summary.withJmdictEvidence} with JMdict evidence.\n`);

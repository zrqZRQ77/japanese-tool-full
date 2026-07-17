#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const VERSION = '20260717-01';
const OUTPUT = resolve('test-data/language-corpus', VERSION);
const categories = [
  ['basic', '基础词和简单句', 40],
  ['verbs', '五段、一段及不规则动词活用', 60],
  ['adjectives', '形容词和形容动词活用', 30],
  ['function_words', '助动词、助词、系动词和功能词', 30],
  ['ambiguity', '同音、多义和词性歧义', 25],
  ['compounds', '复合词与固定搭配', 25],
  ['proper_mixed', '专有名词、数字、英文混排', 20],
  ['news', '新闻与真实文章片段', 30]
];

const item = (sentence, surface, surfaceReading, lemma, lemmaReading, partOfSpeech, conjugationType = '', conjugationForm = '', meaningClass = 'context-dependent', jlptLevel = '', extra = {}) => ({
  sentence, surface, surfaceReading, lemma, lemmaReading, partOfSpeech,
  conjugationType, conjugationForm, meaningClass, jlptLevel, ...extra
});

const data = {
  basic: [
    item('私は学生です。','私','わたし','私','わたし','名詞','','','known-chinese','N5'),
    item('本を読みます。','本','ほん','本','ほん','名詞','','','known-chinese','N5'),
    item('学校へ行きます。','学校','がっこう','学校','がっこう','名詞','','','known-chinese','N5'),
    item('今日は晴れです。','今日','きょう','今日','きょう','名詞','','','known-chinese',''),
    item('時間を確認します。','時間','じかん','時間','じかん','名詞','','','known-chinese','N5'),
    item('友達と話します。','友達','ともだち','友達','ともだち','名詞','','','known-chinese','N5'),
    item('図書館で勉強します。','図書館','としょかん','図書館','としょかん','名詞','','','known-chinese','N5'),
    item('新聞を読みました。','新聞','しんぶん','新聞','しんぶん','名詞','','','known-chinese','N5'),
    item('来月旅行します。','来月','らいげつ','来月','らいげつ','名詞','','','known-chinese','N5'),
    item('先生に質問します。','先生','せんせい','先生','せんせい','名詞','','','known-chinese','N5'),
    item('朝ごはんを食べます。','朝ごはん','あさごはん','朝ごはん','あさごはん','名詞','','','known-chinese','N5'),
    item('映画を見ます。','映画','えいが','映画','えいが','名詞','','','known-chinese','N5'),
    item('週末は休みます。','週末','しゅうまつ','週末','しゅうまつ','名詞','','','known-chinese','N4'),
    item('新しい本を買います。','新しい','あたらしい','新しい','あたらしい','形容詞','形容詞・イ段','基本形','known-chinese','N5'),
    item('親切な人です。','親切','しんせつ','親切','しんせつ','名詞','','','known-chinese','N4'),
    item('丁寧に説明します。','丁寧','ていねい','丁寧','ていねい','名詞','','','known-chinese','N4'),
    item('予定を決めます。','予定','よてい','予定','よてい','名詞','','','known-chinese','N4'),
    item('部屋に猫がいます。','猫','ねこ','猫','ねこ','名詞','','','jmdict-fallback','N5'),
    item('公園を歩きます。','公園','こうえん','公園','こうえん','名詞','','','jmdict-fallback','N5'),
    item('水を飲みます。','水','みず','水','みず','名詞','','','jmdict-fallback','N5'),
    item('駅で待ちます。','駅','えき','駅','えき','名詞','','','jmdict-fallback','N5'),
    item('電車に乗ります。','電車','でんしゃ','電車','でんしゃ','名詞','','','jmdict-fallback','N5'),
    item('家に帰ります。','家','いえ','家','いえ','名詞','','','jmdict-fallback','N5'),
    item('日本語を学びます。','日本語','にほんご','日本語','にほんご','名詞','','','jmdict-fallback','N5'),
    item('毎朝七時に起きます。','毎朝','まいあさ','毎朝','まいあさ','名詞','','','known-chinese','N5'),
    item('七時に出発します。','七時','しちじ','七時','しちじ','名詞','','','known-chinese','N5'),
    item('音楽を聞きます。','音楽','おんがく','音楽','おんがく','名詞','','','jmdict-fallback','N5'),
    item('写真を撮ります。','写真','しゃしん','写真','しゃしん','名詞','','','jmdict-fallback','N5'),
    item('料理を作ります。','料理','りょうり','料理','りょうり','名詞','','','jmdict-fallback','N5'),
    item('仕事が終わりました。','仕事','しごと','仕事','しごと','名詞','','','jmdict-fallback','N5'),
    item('昨日は雨でした。','昨日','きのう','昨日','きのう','名詞','','','jmdict-fallback','N5'),
    item('明日は休みです。','明日','あした','明日','あした','名詞','','','jmdict-fallback',''),
    item('午前九時に開きます。','午前','ごぜん','午前','ごぜん','名詞','','','known-chinese','N5'),
    item('午後六時に閉まります。','午後','ごご','午後','ごご','名詞','','','known-chinese','N5'),
    item('机の上にあります。','机','つくえ','机','つくえ','名詞','','','jmdict-fallback','N5'),
    item('小さな犬がいます。','犬','いぬ','犬','いぬ','名詞','','','jmdict-fallback','N5'),
    item('手紙を書きます。','手紙','てがみ','手紙','てがみ','名詞','','','jmdict-fallback','N5'),
    item('日本へ来ました。','日本','にほん','日本','にほん','名詞','','','jmdict-fallback','N5'),
    item('質問に答えます。','質問','しつもん','質問','しつもん','名詞','','','jmdict-fallback','N5'),
    item('窓を開けます。','窓','まど','窓','まど','名詞','','','jmdict-fallback','N5')
  ],
  verbs: [
    item('毎晩、本を読む。','読む','よむ','読む','よむ','動詞','五段・マ行','基本形','known-chinese','N5'),
    item('本を読んで寝ます。','読ん','よん','読む','よむ','動詞','五段・マ行','連用タ接続','known-chinese','N5'),
    item('昨日、本を読んだ。','読んだ','よんだ','読む','よむ','動詞','五段・マ行','連用タ接続','known-chinese','N5'),
    item('記事を読んでください。','読んで','よんで','読む','よむ','動詞','五段・マ行','連用タ接続','known-chinese','N5'),
    item('今日は新聞を読まない。','読まない','よまない','読む','よむ','動詞','五段・マ行','未然形','known-chinese','N5'),
    item('手紙を書く。','書く','かく','書く','かく','動詞','五段・カ行イ音便','基本形','jmdict-fallback','N5'),
    item('名前を書いてください。','書いて','かいて','書く','かく','動詞','五段・カ行イ音便','連用タ接続','jmdict-fallback','N5'),
    item('昨日、日記を書いた。','書いた','かいた','書く','かく','動詞','五段・カ行イ音便','連用タ接続','jmdict-fallback','N5'),
    item('学校へ行く。','行く','いく','行く','いく','動詞','五段・カ行促音便','基本形','known-chinese','N5'),
    item('昨日、駅へ行った。','行った','いった','行く','いく','動詞','五段・カ行促音便','連用タ接続','known-chinese','N5'),
    item('毎日学校へ行きます。','行きます','いきます','行く','いく','動詞','五段・カ行促音便','連用形','known-chinese','N5'),
    item('ここで待つ。','待つ','まつ','待つ','まつ','動詞','五段・タ行','基本形','jmdict-fallback','N5'),
    item('少し待ってください。','待って','まって','待つ','まつ','動詞','五段・タ行','連用タ接続','jmdict-fallback','N5'),
    item('一時間待った。','待った','まった','待つ','まつ','動詞','五段・タ行','連用タ接続','jmdict-fallback','N5'),
    item('十一時に寝る。','寝る','ねる','寝る','ねる','動詞','一段','基本形','known-chinese','N5'),
    item('毎晩十一時に寝ます。','寝ます','ねます','寝る','ねる','動詞','一段','連用形','known-chinese','N5'),
    item('昼は寝ない。','寝ない','ねない','寝る','ねる','動詞','一段','未然形','known-chinese','N5'),
    item('昨日は早く寝た。','寝た','ねた','寝る','ねる','動詞','一段','連用形','known-chinese','N5'),
    item('朝ごはんを食べる。','食べる','たべる','食べる','たべる','動詞','一段','基本形','known-chinese','N5'),
    item('毎朝パンを食べます。','食べます','たべます','食べる','たべる','動詞','一段','連用形','known-chinese','N5'),
    item('この魚は食べられる。','食べられる','たべられる','食べる','たべる','動詞','一段','未然形','known-chinese','N5'),
    item('宿題をする。','する','する','する','する','動詞','サ変・スル','基本形','jmdict-fallback','N5'),
    item('毎日勉強します。','します','します','する','する','動詞','サ変・スル','連用形','jmdict-fallback','N5'),
    item('昨日掃除した。','した','した','する','する','動詞','サ変・スル','連用形','jmdict-fallback','N5'),
    item('先生は学生に練習させる。','させる','させる','する','する','動詞','サ変・スル','未然レル接続','jmdict-fallback','N5'),
    item('友達が来る。','来る','くる','来る','くる','動詞','カ変・来ル','基本形','jmdict-fallback','N5'),
    item('来週、日本へ来ます。','来ます','きます','来る','くる','動詞','カ変・来ル','連用形','jmdict-fallback','N5'),
    item('今日は来ない。','来ない','こない','来る','くる','動詞','カ変・来ル','未然形','jmdict-fallback','N5'),
    item('昨日は来なかった。','来なかった','こなかった','来る','くる','動詞','カ変・来ル','未然形','jmdict-fallback','N5'),
    item('水を飲む。','飲む','のむ','飲む','のむ','動詞','五段・マ行','基本形','jmdict-fallback','N5'),
    item('薬を飲んだ。','飲んだ','のんだ','飲む','のむ','動詞','五段・マ行','連用タ接続','jmdict-fallback','N5'),
    item('音楽を聞く。','聞く','きく','聞く','きく','動詞','五段・カ行イ音便','基本形','jmdict-fallback','N5'),
    item('先生に聞いてみる。','聞いて','きいて','聞く','きく','動詞','五段・カ行イ音便','連用タ接続','jmdict-fallback','N5'),
    item('家へ帰る。','帰る','かえる','帰る','かえる','動詞','五段・ラ行','基本形','jmdict-fallback','N5'),
    item('昨日帰った。','帰った','かえった','帰る','かえる','動詞','五段・ラ行','連用タ接続','jmdict-fallback','N5'),
    item('写真を撮る。','撮る','とる','撮る','とる','動詞','五段・ラ行','基本形','jmdict-fallback','N4'),
    item('写真を撮った。','撮った','とった','撮る','とる','動詞','五段・ラ行','連用タ接続','jmdict-fallback','N4'),
    item('駅で会う。','会う','あう','会う','あう','動詞','五段・ワ行促音便','基本形','jmdict-fallback',''),
    item('昨日友達に会った。','会った','あった','会う','あう','動詞','五段・ワ行促音便','連用タ接続','jmdict-fallback',''),
    item('窓を開ける。','開ける','あける','開ける','あける','動詞','一段','基本形','jmdict-fallback',''),
    item('店を開きます。','開きます','ひらきます','開く','ひらく','動詞','五段・カ行イ音便','連用形','known-chinese',''),
    item('ドアが開く。','開く','あく','開く','あく','動詞','五段・カ行イ音便','基本形','jmdict-fallback',''),
    item('電車に乗る。','乗る','のる','乗る','のる','動詞','五段・ラ行','基本形','jmdict-fallback','N5'),
    item('電車に乗った。','乗った','のった','乗る','のる','動詞','五段・ラ行','連用タ接続','jmdict-fallback','N5'),
    item('毎朝起きる。','起きる','おきる','起きる','おきる','動詞','一段','基本形','known-chinese','N5'),
    item('七時に起きます。','起きます','おきます','起きる','おきる','動詞','一段','連用形','known-chinese','N5'),
    item('椅子に座る。','座る','すわる','座る','すわる','動詞','五段・ラ行','基本形','jmdict-fallback','N5'),
    item('椅子に座った。','座った','すわった','座る','すわる','動詞','五段・ラ行','連用タ接続','jmdict-fallback','N5'),
    item('荷物を持つ。','持つ','もつ','持つ','もつ','動詞','五段・タ行','基本形','jmdict-fallback','N5'),
    item('荷物を持っている。','持って','もって','持つ','もつ','動詞','五段・タ行','連用タ接続','jmdict-fallback','N5'),
    item('日本語を話す。','話す','はなす','話す','はなす','動詞','五段・サ行','基本形','jmdict-fallback','N5'),
    item('ゆっくり話した。','話した','はなした','話す','はなす','動詞','五段・サ行','連用形','jmdict-fallback','N5'),
    item('雨が降る。','降る','ふる','降る','ふる','動詞','五段・ラ行','基本形','jmdict-fallback','N5'),
    item('雨が降った。','降った','ふった','降る','ふる','動詞','五段・ラ行','連用タ接続','jmdict-fallback','N5'),
    item('仕事が終わる。','終わる','おわる','終わる','おわる','動詞','五段・ラ行','基本形','jmdict-fallback','N5'),
    item('仕事が終わった。','終わった','おわった','終わる','おわる','動詞','五段・ラ行','連用タ接続','jmdict-fallback','N5'),
    item('本を買う。','買う','かう','買う','かう','動詞','五段・ワ行促音便','基本形','jmdict-fallback',''),
    item('本を買った。','買った','かった','買う','かう','動詞','五段・ワ行促音便','連用タ接続','jmdict-fallback',''),
    item('名前を呼ぶ。','呼ぶ','よぶ','呼ぶ','よぶ','動詞','五段・バ行','基本形','jmdict-fallback','N4'),
    item('名前を呼んだ。','呼んだ','よんだ','呼ぶ','よぶ','動詞','五段・バ行','連用タ接続','jmdict-fallback','N4')
  ],
  adjectives: [
    item('この山は高い。','高い','たかい','高い','たかい','形容詞','形容詞・アウオ段','基本形','jmdict-fallback','N5'),
    item('値段が高く感じる。','高く','たかく','高い','たかい','形容詞','形容詞・アウオ段','連用テ接続','jmdict-fallback','N5'),
    item('昨日は高かった。','高かった','たかかった','高い','たかい','形容詞','形容詞・アウオ段','連用タ接続','jmdict-fallback','N5'),
    item('この店は高くない。','高くない','たかくない','高い','たかい','形容詞','形容詞・アウオ段','連用テ接続','jmdict-fallback','N5'),
    item('図書館は静かだ。','静かだ','しずかだ','静か','しずか','名詞','','','jmdict-fallback','N5'),
    item('この部屋は静かです。','静かです','しずかです','静か','しずか','名詞','','','jmdict-fallback','N5'),
    item('昨日は静かだった。','静かだった','しずかだった','静か','しずか','名詞','','','jmdict-fallback','N5'),
    item('新しい本です。','新しい','あたらしい','新しい','あたらしい','形容詞','形容詞・イ段','基本形','known-chinese','N5'),
    item('新しく建てました。','新しく','あたらしく','新しい','あたらしい','形容詞','形容詞・イ段','連用テ接続','known-chinese','N5'),
    item('古い家です。','古い','ふるい','古い','ふるい','形容詞','形容詞・イ段','基本形','jmdict-fallback','N5'),
    item('家が古かった。','古かった','ふるかった','古い','ふるい','形容詞','形容詞・イ段','連用タ接続','jmdict-fallback','N5'),
    item('今日は暑い。','暑い','あつい','暑い','あつい','形容詞','形容詞・イ段','基本形','jmdict-fallback','N5'),
    item('昨日は暑かった。','暑かった','あつかった','暑い','あつい','形容詞','形容詞・イ段','連用タ接続','jmdict-fallback','N5'),
    item('水が冷たい。','冷たい','つめたい','冷たい','つめたい','形容詞','形容詞・アウオ段','基本形','jmdict-fallback','N5'),
    item('水は冷たくない。','冷たくない','つめたくない','冷たい','つめたい','形容詞','形容詞・アウオ段','連用テ接続','jmdict-fallback','N5'),
    item('問題は難しい。','難しい','むずかしい','難しい','むずかしい','形容詞','形容詞・イ段','基本形','jmdict-fallback','N4'),
    item('試験は難しかった。','難しかった','むずかしかった','難しい','むずかしい','形容詞','形容詞・イ段','連用タ接続','jmdict-fallback','N4'),
    item('この問題は易しい。','易しい','やさしい','易しい','やさしい','形容詞','形容詞・イ段','基本形','jmdict-fallback',''),
    item('説明は簡単だ。','簡単だ','かんたんだ','簡単だ','かんたんだ','形容動詞','形容動詞・ダ','基本形','jmdict-fallback','N5'),
    item('操作は簡単です。','簡単です','かんたんです','簡単だ','かんたんだ','形容動詞','形容動詞・ダ','連用形','jmdict-fallback','N5'),
    item('町は便利だ。','便利だ','べんりだ','便利だ','べんりだ','形容動詞','形容動詞・ダ','基本形','jmdict-fallback','N5'),
    item('この道具は便利です。','便利です','べんりです','便利だ','べんりだ','形容動詞','形容動詞・ダ','連用形','jmdict-fallback','N5'),
    item('先生は親切だ。','親切だ','しんせつだ','親切だ','しんせつだ','形容動詞','形容動詞・ダ','基本形','known-chinese','N4'),
    item('先生は親切です。','親切です','しんせつです','親切だ','しんせつだ','形容動詞','形容動詞・ダ','連用形','known-chinese','N4'),
    item('説明が丁寧だ。','丁寧だ','ていねいだ','丁寧だ','ていねいだ','形容動詞','形容動詞・ダ','基本形','known-chinese','N4'),
    item('丁寧に話します。','丁寧に','ていねいに','丁寧だ','ていねいだ','形容動詞','形容動詞・ダ','連用形','known-chinese','N4'),
    item('元気な子です。','元気な','げんきな','元気だ','げんきだ','形容動詞','形容動詞・ダ','体言接続','jmdict-fallback','N5'),
    item('今日は元気です。','元気です','げんきです','元気だ','げんきだ','形容動詞','形容動詞・ダ','連用形','jmdict-fallback','N5'),
    item('空が青い。','青い','あおい','青い','あおい','形容詞','形容詞・アウオ段','基本形','jmdict-fallback','N5'),
    item('空は青くなった。','青く','あおく','青い','あおい','形容詞','形容詞・アウオ段','連用テ接続','jmdict-fallback','N5')
  ],
  function_words: [
    item('本を読みます。','を','を','を','を','助詞','','','function-word','', {allowReadingLookup:false,mustNotContain:['N3','量具','measuring container']}),
    item('学校へ行きます。','へ','へ','へ','へ','助詞','','','function-word','', {allowReadingLookup:false}),
    item('図書館で勉強します。','で','で','で','で','助詞','','','function-word','', {allowReadingLookup:false}),
    item('友達と話します。','と','と','と','と','助詞','','','function-word','', {allowReadingLookup:false}),
    item('机の上です。','の','の','の','の','助詞','','','function-word','', {allowReadingLookup:false}),
    item('猫がいます。','が','が','が','が','助詞','','','function-word','', {allowReadingLookup:false}),
    item('今日は雨です。','は','は','は','は','助詞','','','function-word','', {allowReadingLookup:false}),
    item('私も行きます。','も','も','も','も','助詞','','','function-word','', {allowReadingLookup:false}),
    item('七時に起きます。','に','に','に','に','助詞','','','function-word','', {allowReadingLookup:false}),
    item('本だけ買います。','だけ','だけ','だけ','だけ','助詞','','','function-word','', {allowReadingLookup:false}),
    item('水しかありません。','しか','しか','しか','しか','助詞','','','function-word','', {allowReadingLookup:false}),
    item('雨から雪になった。','から','から','から','から','助詞','','','function-word','', {allowReadingLookup:false}),
    item('九時まで働きます。','まで','まで','まで','まで','助詞','','','function-word','', {allowReadingLookup:false}),
    item('彼より背が高い。','より','より','より','より','助詞','','','function-word','', {allowReadingLookup:false}),
    item('本を読みます。','ます','ます','ます','ます','助動詞','特殊・マス','基本形','function-word','', {allowReadingLookup:false,mustNotContain:['N3','量具','measuring container']}),
    item('昨日読みました。','ました','ました','ます','ます','助動詞','特殊・マス','連用形','function-word','', {allowReadingLookup:false}),
    item('学生です。','です','です','です','です','助動詞','特殊・デス','基本形','function-word','', {allowReadingLookup:false}),
    item('学生でした。','でした','でした','です','です','助動詞','特殊・デス','連用形','function-word','', {allowReadingLookup:false}),
    item('本ではない。','ない','ない','ない','ない','助動詞','特殊・ナイ','基本形','function-word','', {allowReadingLookup:false}),
    item('本を読んだ。','だ','だ','だ','だ','助動詞','特殊・ダ','基本形','function-word','', {allowReadingLookup:false}),
    item('雨だった。','だった','だった','だ','だ','助動詞','特殊・ダ','連用形','function-word','', {allowReadingLookup:false}),
    item('食べている。','いる','いる','いる','いる','助動詞','一段','基本形','function-word','', {allowReadingLookup:false}),
    item('行ってみる。','みる','みる','みる','みる','助動詞','一段','基本形','function-word','', {allowReadingLookup:false}),
    item('読めば分かる。','ば','ば','ば','ば','助詞','','','function-word','', {allowReadingLookup:false}),
    item('雨でも行く。','でも','でも','でも','でも','接続詞','','','function-word','N5', {allowReadingLookup:false}),
    item('しかし、雨だった。','しかし','しかし','しかし','しかし','接続詞','','','function-word','N4', {allowReadingLookup:false}),
    item('そして家に帰った。','そして','そして','そして','そして','接続詞','','','function-word','N4', {allowReadingLookup:false}),
    item('この本をください。','この','この','この','この','連体詞','','','function-word','N5', {allowReadingLookup:false}),
    item('その人は先生です。','その','その','その','その','連体詞','','','function-word','N5', {allowReadingLookup:false}),
    item('あの店は有名です。','あの','あの','あの','あの','連体詞','','','function-word','N5', {allowReadingLookup:false})
  ],
  ambiguity: [
    item('家に帰る。','帰る','かえる','帰る','かえる','動詞','五段・ラ行','基本形','jmdict-fallback','N5', {mustNotContain:['蛙','frog']}),
    item('池に蛙がいる。','蛙','かえる','蛙','かえる','名詞','','','jmdict-fallback','', {mustNotContain:['返回','to return']}),
    item('橋を渡る。','橋','はし','橋','はし','名詞','','','jmdict-fallback','N5', {mustNotContain:['箸','筷子']}),
    item('箸を使う。','箸','はし','箸','はし','名詞','','','jmdict-fallback','N5', {mustNotContain:['桥','bridge']}),
    item('花が咲く。','花','はな','花','はな','名詞','','','jmdict-fallback','N5', {mustNotContain:['鼻','nose']}),
    item('鼻が痛い。','鼻','はな','鼻','はな','名詞','','','jmdict-fallback','N5', {mustNotContain:['花','flower']}),
    item('雨が降る。','雨','あめ','雨','あめ','名詞','','','jmdict-fallback','N5', {mustNotContain:['飴','candy']}),
    item('飴を食べる。','飴','あめ','飴','あめ','名詞','','','jmdict-fallback','', {mustNotContain:['雨','rain']}),
    item('紙に書く。','紙','かみ','紙','かみ','名詞','','','jmdict-fallback','N5', {mustNotContain:['神','god']}),
    item('神を祭る。','神','かみ','神','かみ','名詞','','','jmdict-fallback','', {mustNotContain:['纸','paper']}),
    item('髪を切る。','髪','かみ','髪','かみ','名詞','','','jmdict-fallback','N5', {mustNotContain:['纸','神']}),
    item('木を切る。','切る','きる','切る','きる','動詞','五段・ラ行','基本形','jmdict-fallback','N5', {mustNotContain:['穿','wear']}),
    item('服を着る。','着る','きる','着る','きる','動詞','一段','基本形','jmdict-fallback','N5', {mustNotContain:['切','cut']}),
    item('店が開く。','開く','あく','開く','あく','動詞','五段・カ行イ音便','基本形','jmdict-fallback','', {mustNotContain:['ひらく']}),
    item('本を開く。','開く','ひらく','開く','ひらく','動詞','五段・カ行イ音便','基本形','jmdict-fallback','', {mustNotContain:['あく']}),
    item('生の魚です。','生','なま','生','なま','名詞','','','jmdict-fallback','', {mustNotContain:['せい','しょう']}),
    item('学生の生活。','生','せい','生','せい','接尾詞','','','context-dependent','', {mustNotContain:['なま']}),
    item('一日を過ごす。','一日','いちにち','一日','いちにち','名詞','','','jmdict-fallback','N5', {mustNotContain:['ついたち']}),
    item('四月一日です。','一日','ついたち','一日','ついたち','名詞','','','jmdict-fallback','N5', {mustNotContain:['いちにち']}),
    item('人気がある。','人気','にんき','人気','にんき','名詞','','','jmdict-fallback','N4', {mustNotContain:['ひとけ']}),
    item('人気のない道。','人気','ひとけ','人気','ひとけ','名詞','','','jmdict-fallback','', {mustNotContain:['にんき']}),
    item('市場を調査する。','市場','しじょう','市場','しじょう','名詞','','','known-chinese','N4', {mustNotContain:['いちば']}),
    item('朝の市場へ行く。','市場','いちば','市場','いちば','名詞','','','jmdict-fallback','N4', {mustNotContain:['しじょう']}),
    item('今日中に終える。','今日中','きょうじゅう','今日中','きょうじゅう','名詞','','','jmdict-fallback','', {mustNotContain:['こんにちちゅう']}),
    item('上手に話す。','上手','じょうず','上手','じょうず','名詞','','','jmdict-fallback','N5', {mustNotContain:['うわて']})
  ],
  compounds: [
    item('読書室を利用する。','読書室','どくしょしつ','読書室','どくしょしつ','名詞','','','known-chinese','', {isCompound:true}),
    item('利用時間を確認する。','利用時間','りようじかん','利用時間','りようじかん','名詞','','','known-chinese','', {isCompound:true}),
    item('金融機関が発表した。','金融機関','きんゆうきかん','金融機関','きんゆうきかん','名詞','','','known-chinese','', {isCompound:true}),
    item('時価総額が増えた。','時価総額','じかそうがく','時価総額','じかそうがく','名詞','','','known-chinese','', {isCompound:true}),
    item('半導体メモリーを生産する。','半導体メモリー','はんどうたいめもりー','半導体メモリー','はんどうたいめもりー','名詞','','','unknown','', {isCompound:true}),
    item('国際競争力を高める。','国際競争力','こくさいきょうそうりょく','国際競争力','こくさいきょうそうりょく','名詞','','','known-chinese','', {isCompound:true}),
    item('知財戦略を見直す。','知財戦略','ちざいせんりゃく','知財戦略','ちざいせんりゃく','名詞','','','known-chinese','', {isCompound:true}),
    item('産学連携を進める。','産学連携','さんがくれんけい','産学連携','さんがくれんけい','名詞','','','known-chinese','', {isCompound:true}),
    item('人工知能を研究する。','人工知能','じんこうちのう','人工知能','じんこうちのう','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('情報通信技術を活用する。','情報通信技術','じょうほうつうしんぎじゅつ','情報通信技術','じょうほうつうしんぎじゅつ','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('少子高齢化が進む。','少子高齢化','しょうしこうれいか','少子高齢化','しょうしこうれいか','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('地球温暖化を防ぐ。','地球温暖化','ちきゅうおんだんか','地球温暖化','ちきゅうおんだんか','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('経済成長が続く。','経済成長','けいざいせいちょう','経済成長','けいざいせいちょう','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('労働市場が変化する。','労働市場','ろうどうしじょう','労働市場','ろうどうしじょう','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('公共交通機関を使う。','公共交通機関','こうきょうこうつうきかん','公共交通機関','こうきょうこうつうきかん','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('研究開発費を増やす。','研究開発費','けんきゅうかいはつひ','研究開発費','けんきゅうかいはつひ','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('医療保険制度を改革する。','医療保険制度','いりょうほけんせいど','医療保険制度','いりょうほけんせいど','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('自然災害に備える。','自然災害','しぜんさいがい','自然災害','しぜんさいがい','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('再生可能エネルギーを使う。','再生可能エネルギー','さいせいかのうえねるぎー','再生可能エネルギー','さいせいかのうえねるぎー','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('電子部品を輸出する。','電子部品','でんしぶひん','電子部品','でんしぶひん','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('地方自治体が支援する。','地方自治体','ちほうじちたい','地方自治体','ちほうじちたい','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('大学院生が発表する。','大学院生','だいがくいんせい','大学院生','だいがくいんせい','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('外国人観光客が増えた。','外国人観光客','がいこくじんかんこうきゃく','外国人観光客','がいこくじんかんこうきゃく','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('高速道路が開通した。','高速道路','こうそくどうろ','高速道路','こうそくどうろ','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('携帯電話を充電する。','携帯電話','けいたいでんわ','携帯電話','けいたいでんわ','名詞','','','jmdict-fallback','', {isCompound:true})
  ],
  proper_mixed: [
    item('三菱UFJ銀行を利用する。','三菱','みつびし','三菱','みつびし','名詞','','','proper-noun-unresolved','', {proper:true,allowReadingLookup:false,mustNotContain:['猜测']}),
    item('三菱UFJ銀行を利用する。','UFJ','','UFJ','','名詞','','','numeric-or-latin','', {proper:true,allowReadingLookup:false}),
    item('東京大学で研究する。','東京大学','とうきょうだいがく','東京大学','とうきょうだいがく','名詞','','','proper-noun-unresolved','', {proper:true,allowReadingLookup:false}),
    item('大阪市が発表した。','大阪市','おおさかし','大阪市','おおさかし','名詞','','','proper-noun-unresolved','', {proper:true,allowReadingLookup:false}),
    item('山田太郎さんが話した。','山田太郎','やまだたろう','山田太郎','やまだたろう','名詞','','','proper-noun-unresolved','', {proper:true,allowReadingLookup:false}),
    item('NHKが報じた。','NHK','','NHK','','名詞','','','numeric-or-latin','', {proper:true,allowReadingLookup:false}),
    item('OpenAIの技術を紹介する。','OpenAI','','OpenAI','','名詞','','','numeric-or-latin','', {proper:true,allowReadingLookup:false}),
    item('iPhone 17を使う。','iPhone','','iPhone','','名詞','','','numeric-or-latin','', {proper:true,allowReadingLookup:false}),
    item('2026年7月17日です。','2026','にせんにじゅうろく','2026','にせんにじゅうろく','名詞','','','numeric-or-latin','', {allowReadingLookup:false}),
    item('価格は3,500円です。','3,500','さんぜんごひゃく','3,500','さんぜんごひゃく','名詞','','','numeric-or-latin','', {allowReadingLookup:false}),
    item('G7の主要国が協議した。','G7','じーせぶん','G7','じーせぶん','名詞','','','numeric-or-latin','', {proper:true,allowReadingLookup:false}),
    item('AI技術を活用する。','AI','えーあい','AI','えーあい','名詞','','','numeric-or-latin','', {allowReadingLookup:false}),
    item('CPUの性能を測る。','CPU','しーぴーゆー','CPU','しーぴーゆー','名詞','','','numeric-or-latin','', {allowReadingLookup:false}),
    item('Wi-Fiに接続する。','Wi-Fi','わいふぁい','Wi-Fi','わいふぁい','名詞','','','numeric-or-latin','', {allowReadingLookup:false}),
    item('東京都千代田区にある。','千代田区','ちよだく','千代田区','ちよだく','名詞','','','proper-noun-unresolved','', {proper:true,allowReadingLookup:false}),
    item('富士山に登る。','富士山','ふじさん','富士山','ふじさん','名詞','','','proper-noun-unresolved','', {proper:true,allowReadingLookup:false}),
    item('JR東日本が運行する。','JR東日本','じぇいあーるひがしにほん','JR東日本','じぇいあーるひがしにほん','名詞','','','proper-noun-unresolved','', {proper:true,allowReadingLookup:false}),
    item('キッズドアが支援した。','キッズドア','きっずどあ','キッズドア','きっずどあ','名詞','','','proper-noun-unresolved','', {proper:true,allowReadingLookup:false}),
    item('ChatGPTを利用する。','ChatGPT','','ChatGPT','','名詞','','','numeric-or-latin','', {proper:true,allowReadingLookup:false}),
    item('第1四半期の結果です。','第1四半期','だいいちしはんき','第1四半期','だいいちしはんき','名詞','','','numeric-or-latin','', {allowReadingLookup:false})
  ],
  news: [
    item('政府は新たな経済対策を発表した。','政府','せいふ','政府','せいふ','名詞','','','jmdict-fallback','N3'),
    item('企業の設備投資が増加した。','増加','ぞうか','増加','ぞうか','名詞','','','known-chinese','N3'),
    item('市場では株価が上昇した。','上昇','じょうしょう','上昇','じょうしょう','名詞','','','known-chinese','N1'),
    item('金融機関が融資を拡大する。','金融機関','きんゆうきかん','金融機関','きんゆうきかん','名詞','','','known-chinese','', {isCompound:true}),
    item('半導体の需要が回復した。','半導体','はんどうたい','半導体','はんどうたい','名詞','','','known-chinese','', {isCompound:true}),
    item('大学と企業が共同研究を始めた。','共同研究','きょうどうけんきゅう','共同研究','きょうどうけんきゅう','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('特許の国際競争力を分析した。','国際競争力','こくさいきょうそうりょく','国際競争力','こくさいきょうそうりょく','名詞','','','known-chinese','', {isCompound:true}),
    item('知財戦略の見直しを求めた。','知財戦略','ちざいせんりゃく','知財戦略','ちざいせんりゃく','名詞','','','known-chinese','', {isCompound:true}),
    item('物価の上昇率が鈍化した。','上昇率','じょうしょうりつ','上昇率','じょうしょうりつ','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('雇用情勢は緩やかに改善した。','雇用情勢','こようじょうせい','雇用情勢','こようじょうせい','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('中央銀行は金利を据え置いた。','中央銀行','ちゅうおうぎんこう','中央銀行','ちゅうおうぎんこう','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('輸出額は前年を上回った。','輸出額','ゆしゅつがく','輸出額','ゆしゅつがく','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('訪日客数が過去最高となった。','訪日客数','ほうにちきゃくすう','訪日客数','ほうにちきゃくすう','名詞','','','unknown','', {isCompound:true}),
    item('新制度は来月から施行される。','施行','しこう','施行','しこう','名詞','','','jmdict-fallback','N1'),
    item('自治体は避難所を開設した。','避難所','ひなんじょ','避難所','ひなんじょ','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('大雨による被害が拡大した。','被害','ひがい','被害','ひがい','名詞','','','jmdict-fallback','N3'),
    item('気象庁は警戒を呼びかけた。','気象庁','きしょうちょう','気象庁','きしょうちょう','名詞','','','proper-noun-unresolved','', {proper:true,allowReadingLookup:false}),
    item('鉄道各社は運転を見合わせた。','見合わせた','みあわせた','見合わせる','みあわせる','動詞','一段','連用形','jmdict-fallback',''),
    item('新幹線は通常通り運行している。','運行','うんこう','運行','うんこう','名詞','','','jmdict-fallback','N2'),
    item('医療機関の負担を軽減する。','医療機関','いりょうきかん','医療機関','いりょうきかん','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('研究チームが成果を公表した。','研究チーム','けんきゅうちーむ','研究チーム','けんきゅうちーむ','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('生成AIの利用指針をまとめた。','生成AI','せいせいえーあい','生成AI','せいせいえーあい','名詞','','','numeric-or-latin','', {isCompound:true}),
    item('個人情報の保護を強化する。','個人情報','こじんじょうほう','個人情報','こじんじょうほう','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('サイバー攻撃への対策を急ぐ。','サイバー攻撃','さいばーこうげき','サイバー攻撃','さいばーこうげき','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('再生可能エネルギーの比率を高める。','比率','ひりつ','比率','ひりつ','名詞','','','jmdict-fallback','N2'),
    item('温室効果ガスの排出量を削減する。','排出量','はいしゅつりょう','排出量','はいしゅつりょう','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('国会では法案の審議が続いた。','審議','しんぎ','審議','しんぎ','名詞','','','jmdict-fallback','N1'),
    item('選挙の投票率は前回を下回った。','投票率','とうひょうりつ','投票率','とうひょうりつ','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('海外市場で販売を開始する。','海外市場','かいがいしじょう','海外市場','かいがいしじょう','名詞','','','jmdict-fallback','', {isCompound:true}),
    item('無償の支援策を発表した。','無償','むしょう','無償','むしょう','名詞','','','known-chinese','')
  ]
};

function expectedKinds(entry){
  const kinds = ['exactSurface'];
  if(entry.lemma !== entry.surface) kinds.push('lemma');
  if(entry.isCompound && /[・･/／\s]/u.test(`${entry.surface}${entry.lemma}`)) kinds.push('compound');
  const functionWord = /助詞|助動詞|接続詞|連体詞/.test(entry.partOfSpeech);
  const proper = Boolean(entry.proper);
  const written = /[^\u3040-\u30ffー]/u.test(`${entry.surface}${entry.lemma}`);
  if(entry.allowReadingLookup !== false && !functionWord && !proper && written && (entry.surfaceReading || entry.lemmaReading)) kinds.push('reading');
  return [...new Set(kinds)];
}

const cases = [];
const workerCaseKeys = new Set([
  'verbs::読ん', 'verbs::読んだ', 'verbs::読んで', 'verbs::読まない',
  'verbs::書いて', 'verbs::書いた', 'verbs::行った', 'verbs::行きます',
  'verbs::待って', 'verbs::待った', 'verbs::寝ます', 'verbs::寝ない', 'verbs::寝た',
  'verbs::食べます', 'verbs::食べられる', 'verbs::します', 'verbs::した', 'verbs::させる',
  'verbs::来ます', 'verbs::来ない', 'verbs::来なかった',
  'adjectives::高く', 'adjectives::高かった', 'adjectives::高くない',
  'adjectives::静かです', 'adjectives::静かだった',
  'basic::私', 'function_words::ます', 'ambiguity::橋', 'compounds::読書室',
  'proper_mixed::三菱', 'news::政府'
]);
for(const [categoryIndex, [category, label, expectedCount]] of categories.entries()){
  const entries = data[category];
  if(entries.length !== expectedCount) throw new Error(`${category} expected ${expectedCount}, got ${entries.length}`);
  entries.forEach((entry, index)=>{
    const testLayers = ['pure'];
    if(workerCaseKeys.has(`${category}::${entry.surface}`)) testLayers.push('worker');
    if(index < 5) testLayers.push('dictionary');
    if(index < 2) testLayers.push('ui');
    if(index === 0 || (index === 1 && categoryIndex < 4)) testLayers.push('safari-manual');
    cases.push({
      id:`LQ-${String(cases.length + 1).padStart(3, '0')}`,
      category,
      sentence:entry.sentence,
      surface:entry.surface,
      expectedSurfaceReading:entry.surfaceReading,
      expectedLemma:entry.lemma,
      expectedLemmaReading:entry.lemmaReading,
      expectedPartOfSpeech:entry.partOfSpeech,
      expectedConjugationType:entry.conjugationType,
      expectedConjugationForm:entry.conjugationForm,
      expectedMeaningClass:entry.meaningClass,
      expectedJlptLevel:entry.jlptLevel,
      allowReadingLookup:entry.allowReadingLookup !== false,
      expectedLookupKinds:expectedKinds(entry),
      mustNotContain:Array.isArray(entry.mustNotContain) ? entry.mustNotContain : [],
      testLayers
    });
  });
}

const layerCounts = Object.fromEntries(['pure','worker','dictionary','ui','safari-manual'].map(layer=>[
  layer, cases.filter(entry=>entry.testLayers.includes(layer)).length
]));
const manifest = {
  schemaVersion:1,
  corpusVersion:VERSION,
  generatedAt:'2026-07-17T00:00:00.000Z',
  deterministic:true,
  totalCases:cases.length,
  categories:Object.fromEntries(categories.map(([key, label, count])=>[key,{label,count}])),
  layers:layerCounts,
  safariManualStatus:'PENDING',
  notes:[
    'Expected JLPT levels are reference values only; empty values mean unknown or intentionally ungraded.',
    'No production dictionary entries are generated from this corpus.',
    'Safari manual cases are inventory only and are never reported as automated PASS.'
  ]
};

await mkdir(OUTPUT, {recursive:true});
await writeFile(resolve(OUTPUT, 'cases.json'), `${JSON.stringify(cases, null, 2)}\n`);
await writeFile(resolve(OUTPUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({output:OUTPUT,total:cases.length,categories:Object.fromEntries(categories.map(([key,,count])=>[key,count])),layers:layerCounts}, null, 2));

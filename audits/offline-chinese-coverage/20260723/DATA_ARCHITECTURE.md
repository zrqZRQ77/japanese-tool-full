# Yomeru 词义与等级数据关系

## 当前三层结构

### 1. 人工中文释义层

- 源文件：`frontend/data/dictionary.json` 与 `frontend/data/chinese-definitions-source.json`
- 构建产物：`frontend/data/chinese-definitions/20260717/`
- 规模：158 条索引词条、285 个检索形式、16 个分片
- 角色：运行时优先返回中文释义
- 维护方式：项目人工整理与人工审核，不由浏览器实时翻译

### 2. JMdict 英文回退层

- 数据目录：`frontend/data/jmdict-common/20260713/`
- 规模：22,617 条 common 词条、50,580 个检索形式、64 个分片
- 语言：英文 `eng`
- 角色：人工中文未命中时提供英文释义，不覆盖已有中文
- 许可证记录：`frontend/data/jmdict-common/EDRDG-LICENSE.html` 与目录内 `SOURCE.md`

### 3. JLPT 等级参考层

- 数据目录：`frontend/data/jlpt-reference/20260717/`
- 规模：8,131 条来源词条、13,385 个检索形式
- 角色：只提供 N5–N1 参考等级，不提供词义
- 注意：社区维护参考列表，不是 JLPT 官方词汇表

## 查询顺序

1. 以表面形、基本形和读音尝试人工中文索引。
2. 中文未命中时查询 JMdict common 英文释义。
3. 独立查询 JLPT 参考等级并附加到词汇记录。
4. 功能词、数字/拉丁字符、未解析专有名词和上下文依赖项使用专门规则，不自动猜测正式中文词义。

## 本阶段边界

B1 只生成审计脚本和报告，不修改：

- `frontend/app.js`
- `frontend/index.html`
- `frontend/vocab-store.js`
- `frontend/vocab-list.js`
- `frontend/vocab-review.js`
- `frontend/vocab-export.js`
- 运行时查询与 UI

后续 B2 先完成许可证和数据源设计；B3 再建立首批人工审核清单。电车挑战发布前不进行中文词库运行时接入。

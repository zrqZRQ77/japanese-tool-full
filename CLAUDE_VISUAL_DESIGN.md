# Claude 风格视觉设计规范

这份文件是本项目本地保存的 Claude 风格视觉参考。它不是项目当前唯一设计系统，也不是要完全替换 `DESIGN.md`；它的作用是给视觉方向做对照：当你想让页面更接近 Claude 的气质时，可以参考这里的颜色、组件、搭配和页面组织方式。

外部参考入口：

- Claude design.md: https://getdesign.md/claude/design-md
- 本项目视觉对比页: `frontend/design-reference.html`
- 本项目主设计规范: `DESIGN.md`

## 1. 视觉关键词

Claude 风格的重点不是“炫”，而是安静、清楚、像一块可长期使用的编辑工作台。

核心气质：

1. 温和纸面感。
2. 低视觉噪音。
3. 内容优先。
4. 留白充足。
5. 主行动清楚。
6. 少装饰、少阴影、少大色块。
7. 组件像编辑器，不像营销页或后台仪表盘。

## 2. 颜色系统

Claude 风格适合使用暖中性色作为大面积底色，用陶土色或暖棕橙作为少量强调。不要把整页做成高饱和主题。

### 推荐色板

| Token | 值 | 用途 |
| --- | --- | --- |
| `--claude-page` | `#FAF7F2` | 页面背景，暖纸色 |
| `--claude-paper` | `#FFFDF8` | 主内容面、输入区、卡片 |
| `--claude-surface` | `#F3EEE7` | 次级面板、轻分组 |
| `--claude-surface-strong` | `#EDE4D8` | 更明显的分隔区 |
| `--claude-line` | `#E7DED1` | 默认边框、分割线 |
| `--claude-line-strong` | `#D5C8B8` | 强边框、选中边框 |
| `--claude-ink` | `#2F2A24` | 主文字 |
| `--claude-muted` | `#6F665B` | 次要文字 |
| `--claude-faint` | `#948A7D` | 弱提示、placeholder |
| `--claude-accent` | `#B65F3D` | 主按钮、当前状态、重点操作 |
| `--claude-accent-hover` | `#9F4F32` | 主按钮 hover |
| `--claude-accent-soft` | `#F7E6DC` | 浅强调底色、选中态 |
| `--claude-success` | `#6B7A45` | 成功、完成、掌握 |
| `--claude-warning` | `#A36A24` | 需要注意、待复习 |
| `--claude-error` | `#A3483D` | 错误、危险操作 |
| `--claude-error-soft` | `#F6DEDA` | 错误浅底 |

### 颜色使用规则

1. 页面大背景使用 `--claude-page`，主内容面使用 `--claude-paper`。
2. 强调色只用于主按钮、链接、当前项、焦点和少量标签。
3. 不用纯黑文字，主文字使用暖黑 `#2F2A24`。
4. 不用大面积高饱和色块。
5. 普通卡片只用边框和浅纸面区分，不靠阴影。
6. 错误色只表示真正错误，不表示学习难度。

## 3. 字体与排版

Claude 风格的排版像编辑器：标题柔和，正文清楚，阅读舒适。

### 推荐字体

| Token | 字体 | 用途 |
| --- | --- | --- |
| `--claude-font-ui` | `Inter`, `PingFang SC`, `Noto Sans SC`, sans-serif | 界面正文、按钮、表单 |
| `--claude-font-serif` | `ui-serif`, `Georgia`, `Times New Roman`, `Noto Serif SC`, serif | 大标题、编辑感标题 |
| `--claude-font-mono` | `ui-monospace`, `SFMono-Regular`, `Menlo`, monospace | token、代码、短技术信息 |

### 字号阶梯

| Token | 值 | 用途 |
| --- | --- | --- |
| `--claude-text-xs` | `12px` | 标签、辅助信息 |
| `--claude-text-sm` | `14px` | 按钮、小说明 |
| `--claude-text-md` | `15px` | UI 正文 |
| `--claude-text-lg` | `18px` | 面板标题 |
| `--claude-text-xl` | `24px` | 页面标题 |
| `--claude-text-hero` | `40px` | 少量主视觉标题 |

### 排版规则

1. 标题不要过度巨大，除非是首屏主标题。
2. 普通 UI 不使用负字距。
3. 正文行高建议 `1.65 - 1.8`。
4. 标题行高建议 `1.15 - 1.3`。
5. 一屏内最多一个大标题。
6. 不使用多种字体风格混搭。

## 4. 间距与圆角

Claude 风格靠留白建立秩序，不靠厚重容器。

### 间距

| Token | 值 | 用途 |
| --- | --- | --- |
| `--claude-space-1` | `4px` | 极小修正 |
| `--claude-space-2` | `8px` | 图标与文字 |
| `--claude-space-3` | `12px` | 按钮组、小表单 |
| `--claude-space-4` | `16px` | 控件组、紧凑卡片 |
| `--claude-space-5` | `24px` | 标准面板内边距 |
| `--claude-space-6` | `32px` | 主内容区 |
| `--claude-space-7` | `48px` | 页面区块 |

### 圆角

| Token | 值 | 用途 |
| --- | --- | --- |
| `--claude-radius-sm` | `4px` | 标签、小控件 |
| `--claude-radius-md` | `7px` | 按钮、输入框 |
| `--claude-radius-lg` | `8px` | 卡片、面板 |
| `--claude-radius-pill` | `999px` | 极少量状态胶囊 |

规则：

1. 普通卡片最大圆角 `8px`。
2. 不大量使用胶囊形按钮。
3. 不做超大圆角卡片。
4. 输入框、按钮、卡片圆角要同一体系。

## 5. 阴影与边框

Claude 风格优先使用边框和留白，不优先使用阴影。

推荐：

```css
--claude-shadow-soft: 0 1px 2px rgba(47, 42, 36, .05);
--claude-shadow-popover: 0 12px 32px rgba(47, 42, 36, .10);
```

使用规则：

1. 页面普通卡片不加阴影，或只用极轻阴影。
2. 浮层、菜单、弹窗可以使用 `--claude-shadow-popover`。
3. hover 不上浮、不放大。
4. hover 只改变边框、底色或文字颜色。

## 6. 组件规范

### 主按钮

用途：当前页面最重要的动作。

视觉：

- 背景：`--claude-accent`
- 文字：`#FFFDF8`
- 高度：`40px - 44px`
- 圆角：`7px`
- 字重：`650 - 700`

示例：

```css
.claude-button-primary {
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid #B65F3D;
  border-radius: 7px;
  background: #B65F3D;
  color: #FFFDF8;
  font-weight: 680;
}
```

搭配规则：

1. 同一操作区只放一个主按钮。
2. 不把多个按钮都做成强调色。
3. 主按钮旁边的辅助操作使用次按钮或文字按钮。

### 次按钮

用途：辅助操作、取消、导入、筛选。

视觉：

- 背景：`--claude-surface`
- 边框：`--claude-line`
- 文字：`--claude-ink`

```css
.claude-button-secondary {
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid #E7DED1;
  border-radius: 7px;
  background: #F3EEE7;
  color: #2F2A24;
  font-weight: 650;
}
```

### 文字按钮

用途：最低强调动作，如示例、查看、清除筛选。

视觉：

- 无背景。
- 无边框或透明边框。
- 文字使用 `--claude-accent`。

### 输入框

用途：搜索、正文输入、链接输入、表单。

视觉：

- 背景：`--claude-paper`
- 边框：`--claude-line`
- focus 边框：`--claude-accent`
- focus ring：浅陶土色透明环。

```css
.claude-input {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #E7DED1;
  border-radius: 7px;
  background: #FFFDF8;
  color: #2F2A24;
}

.claude-input:focus {
  outline: none;
  border-color: #B65F3D;
  box-shadow: 0 0 0 3px rgba(182, 95, 61, .14);
}
```

### 卡片 / 面板

用途：独立内容块、列表容器、输入工作区。

视觉：

- 背景：`--claude-paper`
- 边框：`--claude-line`
- 圆角：`8px`
- 阴影：无或极轻。

规则：

1. 不做卡片套卡片。
2. 页面级区域不要全部漂浮。
3. 卡片内只放同一类任务。
4. 信息密度高时优先用列表，不用卡片集合。

### 标签 / 状态

用途：当前状态、分类、小型元信息。

视觉：

- 背景：`--claude-accent-soft`
- 文字：`--claude-accent`
- 圆角：`4px - 7px`
- 高度：`28px - 32px`

规则：

1. 标签不抢按钮注意力。
2. 同屏标签颜色不要太多。
3. 只用状态色表达实际意义。

### 列表

用途：生词本、历史、资料、语法收藏。

视觉：

- 容器：纸面 + 边框。
- 列表项：透明背景或轻 surface。
- 分割线：`--claude-line`。
- hover：浅 surface，不上浮。

规则：

1. 工具型页面优先列表工作台。
2. 列表上方只保留搜索、筛选和一个主行动。
3. 空状态短，不写长说明。

### 工具栏

用途：阅读页、编辑器、筛选器。

视觉：

- 背景：`--claude-surface`
- 边框：`--claude-line`
- 按钮：方形或小圆角，不做大胶囊。
- 当前项：浅强调底色。

规则：

1. 工具栏按钮尽量用图标或短文字。
2. hover/focus 要轻。
3. 工具栏不做大面积品牌色。

## 7. 组件搭配模式

### 页面顶部

Claude 风格页面顶部推荐：

1. 左侧是标题或当前任务。
2. 右侧最多一个主按钮。
3. 不放大段说明。
4. 状态信息放在标题下方或列表上方，以轻文本呈现。

适合：

```text
[页面标题]                         [主按钮]
12 已收藏 · 3 到期
```

不适合：

```text
超大标题
一整段解释文字
[主按钮] [第二个主按钮] [第三个主按钮]
```

### 列表工作台

结构：

1. 主行动区。
2. 轻量状态。
3. 搜索和筛选。
4. 列表。
5. 折叠的低频管理功能。

适合用于：

- 生词本
- 语法本
- 阅读历史
- 资料清单

### 阅读工作台

结构：

1. 文章导入或正文。
2. 小工具栏。
3. 阅读正文。
4. 右侧或底部详情。

规则：

1. 正文是视觉主角。
2. 标注默认轻，hover/点击再强调。
3. 解释面板不写长标题。
4. 工具按钮短、稳定、不跳动。

### 设置页

结构：

1. 直接显示表单和操作。
2. 低频危险操作放后面。
3. 不写“这个页面可以做什么”的说明。

## 8. 页面级规则

### 首页

Claude 风格首页应该像一个安静的输入工作台：

1. 第一屏核心是输入框。
2. 标题短，不写营销口号。
3. 上传、导入、示例是辅助动作。
4. 功能介绍放在首屏之后。
5. 不使用巨大装饰图、渐变背景、过多卡片。

### 生词本

Claude 风格生词本应该像词汇列表工作台：

1. 顶部只有一个动态主行动。
2. 统计是轻文本，不是重卡片。
3. 搜索和筛选靠近列表。
4. 导出、清空收进低频管理区。
5. 空状态短。
6. 复习说明短或不显示。

### 语法本

1. 搜索框优先。
2. 收藏语法列表用安静卡片或列表。
3. 语法解释内容层级清楚。
4. 不用过多彩色标签。

### 练习页

1. 当前练习模式是主角。
2. 切换按钮清楚但不喧宾夺主。
3. 正确/错误反馈清楚但克制。
4. 不做游戏化大色块。

### 历史页

1. 先展示最近记录。
2. 图表和统计保持轻量。
3. 删除/清空是低频危险操作。
4. 不做 dashboard 式堆满。

## 9. 不应该出现

避免：

1. 大面积渐变。
2. 装饰性光斑、玻璃拟态。
3. 过多阴影和上浮 hover。
4. 卡片套卡片。
5. 同屏多个主按钮。
6. 大段解释文案。
7. 页面顶部超大说明标题。
8. 过多胶囊按钮。
9. 颜色每个模块都不同。
10. 按钮和标签文字挤出容器。

## 10. 和本项目的关系

本项目当前不是纯 Claude 风格，而是：

```text
Claude 气质 + Material 3 token + 日语阅读工作台需求
```

使用方式：

1. 如果要改当前网站，先看 `DESIGN.md`。
2. 如果要判断某页是否足够安静、克制、像 Claude，可以看本文件。
3. 如果要看视觉对比，打开 `frontend/design-reference.html`。
4. 如果要改真实组件样式，改 `frontend/design-system.css`，不要只改参考页。

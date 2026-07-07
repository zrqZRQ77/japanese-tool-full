# 网页设计明显错误检查报告

## 一、布局和结构问题

### 1.1 发现的问题 🔴

#### 问题1：CSS版本号不一致
- **位置**: index.html line 16
- **当前**: `styles.css?v=20260628-11`
- **JS版本**: `app.js?v=20260628-10`
- **问题**: 版本号不统一，可能导致缓存混乱
- **修复**: 统一为同一版本号

#### 问题2：侧边栏固定宽度可能导致移动端问题
```css
/* 侧边栏 280px 固定宽度 */
.app-sidebar {
  width: 280px;
  position: fixed;
}
```
- **问题**: 在小屏幕上占据过多空间
- **建议**: 添加移动端响应式（隐藏或汉堡菜单）

#### 问题3：Hero首屏在非首次访问时的处理
```html
<body data-view="reading" class="first-visit">
```
- **问题**: `first-visit` class控制Hero显示，但逻辑可能不清晰
- **需要验证**: 刷新页面时是否会回到Hero还是保持上次状态

---

## 二、可访问性问题

### 2.1 发现的问题 🟡

#### 问题1：关闭按钮缺少aria-label
```html
<button class="btn-icon" onclick="closeVocabPanel()">×</button>
```
- **已有**: 部分有 `aria-label="关闭生词本"`
- **问题**: 不一致，有些关闭按钮缺少
- **建议**: 统一添加

#### 问题2：颜色对比度
```css
color: var(--ainezumi);  /* 藍鼠色 */
```
- **需要检查**: 灰色文字与浅色背景的对比度是否符合WCAG AA标准（4.5:1）

#### 问题3：焦点状态不明显
- **问题**: 部分交互元素的`:focus`状态可能不够明显
- **建议**: 添加明显的focus outline

---

## 三、用户体验问题

### 3.1 发现的问题 🟡

#### 问题1：多个"返回首页"入口
- 左上角logo点击返回
- 但没有明确的提示用户会清空内容
- **建议**: 添加工具提示或二次确认

#### 问题2：空状态文案不统一
```javascript
// 多种空状态表达：
"还没有收藏的词"
"先在「阅读」标签里分析一段文本"
"分析文本后，这里会显示导出效果"
```
- **建议**: 统一语气和格式

#### 问题3：按钮禁用状态缺失
```html
<button onclick="generateCloze()">生成挖空测试</button>
```
- **问题**: 点击后没有禁用，可能重复点击
- **建议**: 添加loading状态和禁用

---

## 四、性能问题

### 4.1 发现的问题 🟡

#### 问题1：所有脚本在head加载
```html
<script src="config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
```
- **问题**: 阻塞渲染，首屏加载慢
- **建议**: 
  - 移到body底部
  - 或添加`defer`属性
  - 按需加载（pptxgenjs只在导出时需要）

#### 问题2：kuromoji词典文件很大
- **问题**: 首次加载需要下载几MB的词典
- **建议**: 添加加载进度提示

---

## 五、响应式设计问题

### 5.1 需要检查 🟡

#### 问题1：移动端媒体查询不完整
```css
@media (max-width: 768px) {
  .typing-grid { grid-template-columns: 1fr; }
}
```
- **问题**: 只有少数组件有响应式
- **建议**: 检查所有页面在320px、375px、768px的表现

#### 问题2：固定宽度可能溢出
```css
.vocab-panel-slide {
  width: 400px;
}
```
- **问题**: 在小屏幕上400px可能太宽
- **建议**: 使用`max-width: 400px; width: 90vw;`

---

## 六、语义化HTML问题

### 6.1 发现的问题 🟢

#### 问题1：缺少语义化标签
```html
<div class="app-sidebar">  <!-- 应该用 <nav> -->
<div class="hero-intro">   <!-- 应该用 <section> -->
```
- **建议**: 使用HTML5语义化标签
  - `<nav>` for 导航
  - `<main>` for 主内容
  - `<section>` for 区块
  - `<article>` for 文章内容

---

## 七、JavaScript问题

### 7.1 发现的问题 🟡

#### 问题1：内联事件处理器
```html
<button onclick="analyzeFromHero()">
<button onclick="loadSampleFromHero()">
```
- **问题**: 混合HTML和JS，不利于维护
- **建议**: 使用addEventListener（非紧急）

#### 问题2：全局函数污染
```javascript
function analyzeFromHero() { }
function loadSampleFromHero() { }
// 2900+行的全局函数
```
- **建议**: 使用模块化或IIFE包装（非紧急）

#### 问题3：localStorage没有容量检测
```javascript
localStorage.setItem('reading_workspace', view);
```
- **问题**: localStorage满了会抛出QuotaExceededError
- **建议**: 添加try-catch

---

## 八、内容和文案问题

### 8.1 发现的问题 📝

#### 问题1：中日文混用不一致
```html
<h1>読める、わかる、続けられる</h1>  <!-- 日文 -->
<p>日语阅读辅助工具</p>              <!-- 中文 -->
```
- **不是错误**: 但需要确认这是有意的设计

#### 问题2：标点符号不统一
- 有些用顿号「、」
- 有些用逗号「，」
- **建议**: 统一风格

---

## 九、安全性问题

### 9.1 已检查 ✅

#### 已有保护：
- ✅ `escapeHtml()` 函数存在且正确
- ✅ innerHTML使用大部分有转义
- ✅ 文件上传有大小和类型限制

#### 需要改进：
```javascript
// 需要检查所有innerHTML使用是否都转义了用户输入
out.innerHTML = html;  // 这个html是从哪里来的？
```

---

## 十、视觉设计问题

### 10.1 需要检查 🎨

#### 问题1：颜色变量使用
```css
--shusha: 朱砂色 (200, 72, 67)
--kinari: 生成色
--ainezumi: 藍鼠色
```
- **需要验证**: 所有颜色组合的对比度

#### 问题2：字体回退
```css
font-family: 'Noto Sans JP', sans-serif;
```
- **问题**: Google Fonts可能被墙
- **建议**: 添加系统字体回退
```css
font-family: 'Noto Sans JP', 'Hiragino Sans', 'MS Gothic', sans-serif;
```

---

## 最严重的问题（需要立即修复）

### 🔴 高优先级

1. **版本号不一致** - CSS v11, JS v10
2. **移动端侧边栏没有响应式** - 280px固定宽度在手机上占一大半
3. **脚本阻塞渲染** - 所有script在head，影响首屏
4. **localStorage没有异常处理** - 满了会崩溃

### 🟡 中优先级

5. **按钮缺少loading/disabled状态** - 可能重复点击
6. **颜色对比度未验证** - 可能不符合可访问性标准
7. **空状态文案不统一** - 用户体验不一致
8. **关闭按钮aria-label缺失** - 可访问性问题

### 🟢 低优先级

9. **语义化HTML** - 用div代替nav/main/section
10. **内联事件处理器** - onclick混在HTML里
11. **字体回退策略** - Google Fonts被墙时的备选

---

## 建议的修复顺序

1. **立即修复**: 版本号统一、移动端侧边栏
2. **本周修复**: localStorage异常处理、按钮状态、脚本加载优化
3. **下次迭代**: 语义化HTML、可访问性完善、性能优化

# 网页上线前检查清单

## MVP 核心产品原则

> **MVP 暂时不依赖自有后端，而不是永久不做后端。**

当前上线版本以验证“粘贴日语文本 → 阅读辅助 → 收藏与练习”的核心价值为目标。现有后端代码可以作为技术储备保留，但不作为公开 MVP 的部署条件、运行依赖或页面承诺。

当前边界：

- 粘贴日语文本是核心输入，在浏览器中处理。
- 文字型 PDF 由浏览器本地解析，作为 Beta 次级能力；解析失败时回退到复制粘贴文本。
- Word / DOCX、网页正文自动抓取、扫描 PDF OCR 和服务器解析兜底不在公开 MVP 中开放。
- 学习记录、生词和设置保存在浏览器本地。
- 暂不提供账号、云同步、会员、额度、Pro 或付费升级。
- 是否启用后端，应在核心流程得到真实用户验证后，依据需求、稳定性、版权、隐私和成本重新决策。

## MVP 变更记录

以后每次改变公开功能边界、入口层级、数据处理方式或上线条件时，都应在本表记录“改了什么”和“为什么”。纯代码整理且不影响用户或产品边界的修改不必记录。

| 日期 | 改变 | 原因 |
|---|---|---|
| 2026-07-10 | MVP 输入边界收口为粘贴文本和文字型 PDF Beta | 降低文件兼容、服务器部署、隐私和版权风险，先验证核心阅读价值 |
| 2026-07-10 | 隐藏 Word / DOCX、网页自动抓取和服务器解析兜底 | 这些能力需要后端、真实文件联调和额外合规审查，不应成为 MVP 阻断项 |
| 2026-07-10 | 移除 Pro、免费额度和升级相关入口 | 当前没有账号、支付和升级闭环，避免向用户展示无法完成的承诺 |
| 2026-07-10 | 首页直接显示“阅读示例”和“开始阅读”，PDF Beta 移入“更多” | 突出唯一核心路径，同时保留 PDF 的次级可发现性 |
| 2026-07-10 | 移除“推荐、最快、最稳定”等输入宣传文案 | 减少冗余说明，让用户直接理解并使用输入区域 |
| 2026-07-11 | 明确“暂时不依赖后端，不等于永久不做后端” | 区分 MVP 产品边界与未来技术规划，避免误删已有技术储备或过早部署 |
| 2026-07-11 | 日语朗读默认优先 Hattori，并统一速度、音色菜单标题和样式 | 提高默认体验，使设置控件符合全站设计规范且更易理解 |
| 2026-07-11 | 设置页将“数据保存说明”改为面向用户的“数据与隐私”说明 | 用“当前浏览器、当前设备”表达实际结果，避免向普通用户暴露服务器、后端和本地解析等技术概念 |
| 2026-07-11 | 全局搜索移除“调整今日目标”，并更新“学习历史”说明 | 隐藏的目标设置不应继续通过搜索暴露；搜索描述必须与当前学习历史页面一致 |
| 2026-07-11 | 阅读结果导出收口为 PPTX、PNG、JPEG，并删除未接入的 DOCX 代码 | PPTX 已提供可编辑输出；避免为未验证的 DOCX 兼容性扩大 MVP 测试和维护范围 |

---

## 一、基础元信息

### 1.1 缺失项 🔴
- [ ] **favicon.ico** - 浏览器标签页图标缺失
- [ ] **description** meta标签 - SEO描述缺失
- [ ] **keywords** meta标签 - SEO关键词缺失
- [ ] **Open Graph标签** - 社交媒体分享预览缺失
- [ ] **manifest.json** - PWA配置缺失

### 1.2 已有项 ✅
- [x] DOCTYPE声明
- [x] charset UTF-8
- [x] viewport设置
- [x] 页面title

---

## 二、性能优化

### 2.1 需要优化 🟡
- [ ] **外部库CDN** - kuromoji、pptxgenjs等使用CDN，无fallback
- [ ] **字体加载** - Google Fonts可能被墙，需要本地备份
- [ ] **CSS/JS压缩** - 未压缩，文件体积较大
- [ ] **图片优化** - 检查是否有未压缩的图片
- [ ] **懒加载** - 语法词典等数据可以按需加载

### 2.2 建议 💡
```html
<!-- 添加preload关键资源 -->
<link rel="preload" href="app.js" as="script">
<link rel="preload" href="styles.css" as="style">

<!-- CDN fallback -->
<script>
  if (!window.kuromoji) {
    document.write('<script src="/libs/kuromoji.js"><\/script>');
  }
</script>
```

---

## 三、响应式和移动端

### 3.1 需要测试 🟡
- [ ] **移动端布局** - 检查320px、375px、768px断点
- [ ] **触摸操作** - 按钮大小是否足够（最小44x44px）
- [ ] **横屏适配** - 手机横屏时的布局
- [ ] **侧边栏** - 移动端侧边栏应该收起

### 3.2 已发现问题
```css
/* styles.css已有部分响应式，但可能不完整 */
@media (max-width: 768px) {
  .typing-grid { grid-template-columns: 1fr; }
}
/* 需要检查其他页面的响应式 */
```

---

## 四、可访问性 (a11y)

### 4.1 需要改进 🟡
- [ ] **颜色对比度** - 检查文字和背景对比度是否符合WCAG AA标准
- [ ] **键盘导航** - 能否用Tab键导航所有交互元素
- [ ] **aria标签** - 部分已有，但需要完善
- [ ] **焦点可见性** - focus状态是否明显
- [ ] **屏幕阅读器** - 测试VoiceOver/NVDA

### 4.2 已有改进空间
```html
<!-- 部分元素有aria-label，但不完整 -->
<button aria-label="关闭生词本">×</button>
<!-- 建议添加role和aria-live -->
```

---

## 五、功能完整性

### 5.1 需要测试 ⚠️
- [x] **MVP 不依赖自有后端** - 公开核心流程和文字型 PDF Beta 均可在浏览器中运行；现有后端仅作为未来技术储备
- [x] **Pro / 免费额度文案闭环** - 正式前端已移除“Pro 可无限使用”、免费额度和无升级入口的承诺，避免出现无法升级的死路
- [ ] **PDF Beta** - 测试正常文字型、扫描型、加密、损坏、复杂排版和大文件 PDF；失败时能回退到粘贴文本
- [ ] **文本分析** - 空输入、超长输入、特殊字符
- [ ] **生词本** - 添加、删除、导出（CSV/Anki）
- [ ] **复习系统** - 间隔重复算法是否正确
- [ ] **语音朗读** - TTS功能在不同浏览器
- [ ] **打字练习** - 输入验证、评分逻辑
- [ ] **历史记录** - localStorage容量限制
- [ ] **备份恢复** - JSON导入/导出

### 5.2 边界情况
```javascript
// 需要测试的边界情况：
- 上传0字节文件
- 上传超过限制的 PDF 文件
- localStorage满了怎么办
- 网络断开时的行为
- 并发操作（同时点击多个按钮）
```

---

## 六、错误处理

### 6.1 需要添加 🔴
- [ ] **全局错误捕获** - window.onerror
- [ ] **网络错误提示** - fetch失败时的友好提示
- [ ] **文件解析失败** - PDF 本地解析出错时的提示和粘贴文本回退路径
- [ ] **浏览器兼容性提示** - 不支持的浏览器警告
- [ ] **加载失败重试** - CDN资源加载失败的处理

### 6.2 建议代码
```javascript
// 全局错误处理
window.onerror = function(msg, url, line, col, error) {
  console.error('Global error:', msg, url, line, col, error);
  // 可选：发送到错误跟踪服务
  return false;
};

// 资源加载失败
window.addEventListener('error', function(e) {
  if (e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK') {
    console.error('Resource failed to load:', e.target.src || e.target.href);
  }
}, true);
```

---

## 七、浏览器兼容性

### 7.1 需要测试 🟡
- [ ] **Chrome/Edge** - 主流浏览器
- [ ] **Firefox** - 检查CSS Grid和Flexbox
- [ ] **Safari** - 特别是iOS Safari
- [ ] **移动端浏览器** - 微信内置、UC、QQ浏览器

### 7.2 可能的问题
- CSS变量在旧浏览器不支持
- LocalStorage在隐私模式可能被禁用
- Web Speech API浏览器支持有限
- File API在旧浏览器可能有问题

---

## 八、安全性

### 8.1 需要检查 🟡
- [ ] **XSS防护** - 用户输入是否正确转义
- [ ] **innerHTML使用** - 是否有注入风险
- [ ] **外部链接** - 添加rel="noopener noreferrer"
- [ ] **敏感数据** - localStorage中不应存储敏感信息

### 8.2 已发现
```javascript
// app.js中有escapeHtml函数，但需要确保所有用户输入都经过转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

---

## 九、内容和文案

### 9.1 需要检查 📝
- [ ] **拼写检查** - 中文、日文、英文
- [ ] **文案一致性** - "生词本"vs"词汇表"
- [ ] **帮助文档** - 首次使用引导
- [ ] **错误提示** - 是否清晰友好
- [ ] **空状态** - 所有空状态都有提示

### 9.2 发现的问题
- "読める、わかる、続けられる" - 确认日文准确性
- 部分提示文案可以更友好

---

## 十、数据和隐私

### 10.1 需要明确 ⚠️
- [x] **MVP 数据说明** - 明确学习记录保存在当前浏览器，粘贴文本和选择的 PDF 仅在当前设备处理
- [ ] **隐私政策** - 数据如何存储和使用
- [ ] **Cookie声明** - 是否使用Cookie
- [ ] **数据导出** - 用户能否导出所有数据
- [ ] **数据清除** - 提供清除所有数据的选项

---

## 十一、加载状态和反馈

### 11.1 需要添加 🟡
- [ ] **首屏加载** - 显示loading动画
- [ ] **文件上传进度** - 大文件上传时的进度条
- [ ] **分析进度** - 文本分析时的loading状态
- [ ] **按钮禁用** - 处理中的按钮应该禁用防止重复点击
- [ ] **操作成功提示** - Toast通知

### 11.2 建议
```html
<!-- 首屏loading -->
<div id="appLoader" class="app-loader">
  <div class="loader-spinner"></div>
  <p>加载中...</p>
</div>

<script>
  window.addEventListener('load', function() {
    document.getElementById('appLoader').style.display = 'none';
  });
</script>
```

---

## 十二、SEO和分享

### 12.1 需要添加 🔴
```html
<!-- 基础SEO -->
<meta name="description" content="日语阅读辅助工具，粘贴日语文本后自动标注假名和释义，支持文字型PDF Beta">
<meta name="keywords" content="日语学习,日语阅读,JLPT,N5,N4,N3,N2,N1,假名标注,Anki">

<!-- Open Graph -->
<meta property="og:title" content="读得懂 · 日语阅读辅助工具">
<meta property="og:description" content="自动标注假名和释义的日语阅读工具">
<meta property="og:image" content="https://yourdomain.com/og-image.png">
<meta property="og:url" content="https://yourdomain.com">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="读得懂 · 日语阅读辅助工具">
```

---

## 检查优先级

### 🔴 高优先级（必须修复）
1. 添加favicon
2. 添加全局错误处理
3. 添加文件上传错误提示
4. 测试所有核心功能

### 🟡 中优先级（建议修复）
1. 移动端响应式完善
2. 添加SEO meta标签
3. CDN fallback
4. 加载状态提示
5. 浏览器兼容性测试

### 🟢 低优先级（可选）
1. PWA支持
2. 性能优化（压缩）
3. 高级可访问性
4. 分析和监控

---

## 建议的测试流程

1. **本地测试**：所有功能走一遍
2. **不同设备**：桌面、平板、手机
3. **不同浏览器**：Chrome、Firefox、Safari
4. **边界情况**：大文件、空输入、断网
5. **性能测试**：Lighthouse跑分
6. **用户测试**：找几个真实用户试用

# index.html Bug 清单

## 🔴 确定性 Bug

### 1. FAQ 数量文字前后不一致

| 位置 | 文案 | 实际数量 |
|---|---|---|
| 第 139 行（更多教程区） | `完整常见问题（12 条）` | faq.html 中有 **17** 条 `<details>` |
| 第 195 行（FAQ 区底部） | `看完整常见问题（17 条）→` | ✅ 正确 |

**问题**：教程链接区写的"12 条"，但实际 faq.html 有 17 条，底部链接写的"17 条"才是对的。用户从不同入口看到两个不同数字，会困惑。

**修复**：第 139 行将 `12 条` 改为 `17 条`。

---

### 2. 价格卡片 `transition: all` 与 JS 3D 倾斜互相打架

CSS 第 374 行：
```css
.price-item { transition: all 0.4s var(--ease); }
```

CSS 第 393-394 行 hover 又叠加：
```css
.price-item:hover { transform: translateY(-3px) scale(1.01); }
```

JS 第 298-302 行 mousemove 写入内联 `transform`（含 `rotateX/rotateY`），mouseleave 时把 `card.style.transform` 清空为 `""`。

**问题**：`transition: all` 会把 JS 设置的 `rotateX/rotateY` 也纳入过渡，导致鼠标移动时 3D 倾斜出现"粘滞拖尾"感，不够跟手。此外 CSS hover 的 `translateY(-3px) scale(1.01)` 和 JS mousemove 的 `translateY(-3px) perspective(800px) rotateX/rotateY` 在 hover 态会叠加冲突——鼠标刚进入卡片时，CSS hover 触发 `scale(1.01)`，紧接着 JS mousemove 又覆盖 `transform` 把 scale 吃掉，产生抖动。

**修复**：
```css
/* 方案：transition 只过渡非 transform 的属性 */
.price-item {
  transition: border-color 0.4s var(--ease),
              box-shadow 0.4s var(--ease);
}
/* 单独处理 hover 的 transform */
.price-item {
  /* 去掉 transition: all */
}
```
或者将 hover 的 `translateY/scale` 也移入 JS 统一控制，避免两套 transform 互相覆盖。

---

## 🟡 潜在问题 / 改进建议

### 3. 缺少 favicon

`<head>` 中没有 `<link rel="icon">`。浏览器会尝试请求 `/favicon.ico`，返回 404，产生一次无意义的网络请求和 404 日志。

**修复**：添加 favicon，例如：
```html
<link rel="icon" href="./assets/avatar.jpg">
```

---

### 4. JS 中选择器 `#contact` 匹配不到任何元素

JS 第 310 行：
```js
const contact = document.querySelector("#contact, .col-right");
```

HTML 中没有 `id="contact"` 的元素（联系方式区域是 `id="contact-title"` 的 section，但 section 本身没有 `id="contact"`）。

**实际影响**：无。因为 fallback 选择器 `.col-right` 可以匹配到右侧栏，所以功能正常。但 `#contact` 是一段无效死代码，容易误导后续维护。

**修复**：要么给联系方式 section 加上 `id="contact"`，要么把 JS 中的 `#contact` 删掉。

---

### 5. 价格卡片点击滚动目标不够精准

点击价格卡片（非链接区域）时，JS 滚动到 `.col-right`（整个右侧栏），而不是直接到 `#order`（下单区）。在桌面端 `.col-right` 包含联系区和下单区，滚动到 `.col-right` 的 `start`，下单区不一定在视口内。

**修复**：将选择器改为：
```js
const contact = document.querySelector("#order");
```
让用户点击卡片后直接看到下单区域，更符合购买意图。

---

### 6. 移动端桌面导航栏 `no-mobile` 隐藏后，无替代移动端导航

`<nav class="nav no-mobile">` 在 `<1024px` 时 `display: none`。页面上没有 hamburger 菜单或移动端替代导航。移动端用户只能靠滚动才能找到"激活教程"、"保号资费"等页面入口。

**影响**：移动端可用性降低，不算严格 bug 但属于体验缺陷。

---

## ✅ 验证通过（无问题）

- 所有引用的静态资源（`avatar.jpg`、`weidian-qr.png`、`wechat-qr.jpg`）均存在
- CSS 类名（`.reveal`、`.reveal-stagger`、`.price-anim`、`.no-mobile`、`.scroll-progress`）均有对应样式定义
- `reveal-stagger` 动画覆盖了 6 个子元素（benefits 有 6 个 article），延迟完整
- `IntersectionObserver` 阈值和 `scroll-progress` 逻辑正确
- 微信弹窗 dialog 的 `showModal/close` 用法正确
- 所有外链均带 `target="_blank" rel="noopener"`，安全合规
- `<details>` / `<summary>` FAQ 语义正确
- 购买链接（链动 × 2 + 微店 × 1 + 侧栏链动 × 1）均可正常跳转

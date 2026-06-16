# 微交互打磨设计文档

**日期**：2026-06-17
**作者**：brainstorming 流程产出
**状态**：待用户批准
**目标版本**：v14

## 背景与动机

v13 内容精简后，giffgaff 站点 8 个页面（首页 + 7 个子页）UI 主体已稳定。本设计聚焦**微交互打磨**，提升用户感知品质与操作反馈密度，但不改整体结构、不引入新页面、不破坏响应式布局。

### 当前动画 / 交互资产盘点

**已有 6 个 `@keyframes`**（styles.css）：
- `aurora-shift`（背景极光 18s 循环）
- `logo-spin`（头像环 + 图双层反向旋转）
- `pulse-glow`（promo hero 光晕呼吸）
- `dot-blink`（kicker 小圆点闪烁 1.6s）
- `border-flow`（primary 价格卡边框流动）
- `shimmer`（价格卡 hover 高光横扫 0.8s）

**已有交互**：
- 入场动画：`.reveal` + `.reveal-stagger`（IntersectionObserver，支持 10+ 子元素 staggered 延迟）
- 价格卡：3D 倾斜（JS mouseenter/move/leave）+ shimmer 高光 + border-flow 边框
- 滚动：顶部 `scroll-progress` 进度条
- 弹窗：微信 dialog + showModal
- 无障碍：2 处 `prefers-reduced-motion`（avatar + 全局）

**已知问题**：
1. 价格卡 hover 时**5 个动画同时跑**（3D 倾斜 + shimmer + border-color + price-anim 数字放大 + border-flow 流光）—— 过载
2. 价格卡**缺按下态**与**已点持久反馈**
3. 入场动画**节奏单一**（所有 section 都是 fade + translateY）
4. giffgaff-apk.html 测速期间下载按钮**空白**
5. 16 处 `transition: all`（v12 修 1 处剩 16 处）—— 一致性 / 性能隐患
6. 缺 scrollspy / 节点进度点 / 回到顶部按钮

## 设计原则

1. **单一焦点**：每次只引导用户注意一件事；并发动画做减法
2. **减速不减速感**：动效时长统一在 200-500ms 区间；缓动复用 `--ease` / `--ease-bounce`
3. **反馈有始有终**：每个交互都满足「按下/hover → 结果 → 回到静息」三段
4. **无障碍优先**：所有新动效进入 `prefers-reduced-motion` 全局关闭

## 场景 1：价格卡 hover/点击反馈

### 改动

**减法**（去掉视觉过载）：
- 3D 倾斜强度减半：rotateX/Y 由 ±5°/6° 改为 ±2.5°/3°
- 删除 `border-flow` 流光（保留 shimmer 高光作为唯一动态边框效果）
- hover 时 `price-anim` 数字**不再放大**（避免数字抖动）

**加法**（补缺反馈）：
- 点击瞬间 `transform: scale(0.98)` 80ms 后弹回（按下态）
- 点击后该卡 `.is-selected` 状态保持 2s：2px 主色描边 + 微光脉冲
- 数字首次进入视口时**从 0 计数到目标价**（300ms ease-out，仅一次，hover 不再触发）

### 文件改动

- `styles.css`：价格卡 `:hover` 规则、`.is-selected` 样式、新 `@keyframes count-fade-in`
- `index.html` JS 价格卡事件：mouseup 加 active 类、scroll 时 IntersectionObserver 触发数字滚动

## 场景 2：页面加载 / 入场动效

### 改动

**节奏分层**：给每个 section 一个 `data-reveal-delay`（毫秒）
- hero：0ms
- price-panel：80ms
- benefits：160ms + stagger 60ms/项
- guide-links：240ms
- faq：320ms + stagger 40ms/项
- order-box（右侧栏）：50ms 独立入场

**方向多样化**：
- hero：`fade + scale(0.96 → 1)`
- price-panel：`fade + translateY(24px → 0)`
- benefits：`fade + translateX(-16px → 0)` 横向 stagger
- guide-links：`fade + translateY(16px → 0)` 顺序淡入
- order-box：`fade + translateX(16px → 0)` 从右滑入
- faq：`fade + translateY(12px → 0)` 紧凑节奏

**骨架屏**（giffgaff-apk.html）：
- 主下载按钮测速 1s 期间显示「⟳ 测速中…」+ shimmer 占位
- 最短显示时长 800ms（避免快网时闪烁）
- 测速完成后正常按钮文字淡入（200ms）

### 文件改动

- `styles.css`：新增 `@keyframes reveal-fade-up / reveal-slide-left / reveal-slide-right`，每个 section 配 `data-reveal-delay` CSS 变量规则
- `9 个 HTML`：各 section 加 `data-reveal="up|left|right|scale" data-reveal-delay="N"`，JS 读 data 属性生成 inline `transition-delay`
- `giffgaff-apk.html`：按钮加 `.is-loading` 状态 + shimmer 占位元素

## 场景 3：滚动联动效果

### 改动

**scroll-progress 节点标记**：
- 进度条上方叠加 5 个小圆点，对应 hero / price / benefits / faq / order 5 个 section
- 滚动到对应 section，圆点变实心 + 主色 + 12px 微缩放
- 圆点之间连细线（背景层渐变）

**scrollspy 导航高亮**（桌面端 ≥ 1024px）：
- topbar 4 个导航链接（激活教程 / 保号资费 / 语音信箱 / 立即下单）随滚动高亮当前 section
- 高亮规则：背景半透明主色 + 文字主色 + 底部 2px 主色下划线（仅此一项变化，避免导航条抖动）
- 移动端 no-mobile 隐藏，不启用 scrollspy

**浮动按钮双按钮**：
- 滚动 > 600px 时出现「↑ 顶部」按钮（与现有「↓ 下单」垂直堆叠）
- 顶部按钮点击 `window.scrollTo({top: 0, behavior: 'smooth'})`
- < 600px 时仅显示「↓ 下单」一个按钮（保持现状）

**价格卡入场 bounce**：
- 首次进入视口时 `transform: scale(0.96 → 1.02 → 1.0)` 200ms 弹一下
- 仅第一次，后续 hover 不再触发

### 文件改动

- `styles.css`：scroll-progress 圆点层、导航高亮规则、浮动按钮堆叠布局、bounce 关键帧
- `index.html` JS：scrollspy 监听（IntersectionObserver 复用）+ 浮动按钮显隐（scroll 监听）+ 价格卡 bounce（与场景 1 的 IntersectionObserver 共用）

## 场景 4：按钮 / 微交互细节

### 改动

**active 按下态**（统一规则）：
- 所有 `.buy-button` / `.outline` / `.primary` 加 `:active { transform: scale(0.96); }`
- 微信 trigger 按钮同步加 `:active` 缩放
- 反馈时长 80ms，弹回 150ms（CSS transition）

**复制按钮统一成功态**：
- `esim-qr.html` 与 `voicemail.html` 的复制按钮反馈样式统一：`<button>` 在 `navigator.clipboard.writeText` 成功后，1.5s 内显示「✓ 已复制」+ 文字主色
- 现有反馈机制保留，仅统一视觉

**微信 dialog 增强**：
- 背景加 `backdrop-filter: blur(8px)` + `rgba(0,0,0,0.4)` 半透明遮罩
- 现有「点击外部关闭」保留
- dialog 内容增加 `transform: scale(0.92 → 1) + opacity 0 → 1` 入场（180ms ease-out）

**购买按钮成功态**（链动 / 微店外链）：
- 点击瞬间 200ms 内按钮显示「✓ 已跳转」+ 主色脉冲 1 次
- ⚠️ 已知局限：外链点击瞬间就跳走，反馈可能用户看不到。**作为「保险」反馈保留**，避免外部拦截器或慢网络时用户不知是否点中
- **实施细节**：用 `setTimeout(..., 0)` 在 click handler 同步切换 `.is-success`，CSS transition 200ms 内完成视觉变化，再 `location.href = url` 触发跳转。**仅在 index.html 的 buy-button 上启用**，侧栏的链动按钮同样启用；子页面没有 buy-button 不受影响

### 文件改动

- `styles.css`：全局 `button:active` 规则、`.is-success` 状态样式、`.wechat-preview::backdrop` 模糊遮罩、对话框入场关键帧
- `index.html`：buy-button click handler 加成功态切换

## 工程层横切改进（必做）

### `transition: all` → 显式属性

把剩余 16 个 `transition: all` 全部改写为显式属性（如 `border-color 0.3s var(--ease), box-shadow 0.3s var(--ease)`），避免任何意外属性被纳入过渡。

**影响行**（styles.css）：306 / 464 / 531 / 814 / 850 / 914 / 1086 / 1131 / 1156 / 1173 / 1196 / 1396 / 1501 / 1532 / 1550 / 1729 / 1866

### 新增动效全部进 prefers-reduced-motion

`styles.css:1345` 那条全局规则下补充新 keyframes（`@keyframes count-fade-in / reveal-slide-left / reveal-slide-right / btn-bounce / dialog-pop / pulse-mark`），统一 `animation-duration: 0.01ms !important` 关闭。

### 可访问性

- scrollspy 导航高亮同步设置 `aria-current="page"`
- 浮动按钮 `aria-label` 完善（"回到顶部" / "立即下单"）
- 复制按钮成功态用 `aria-live="polite"` 通知屏幕阅读器

## 数据汇总

### 预计代码量

- `styles.css`：净增 ~115 行（+135 新关键帧/规则 / -20 删 `transition: all` 多余字符）
- `9 个 HTML`：+40 行（`data-reveal-*` 属性 + scrollspy 标记 + 成功态元素）
- `index.html` JS：+55 行（scrollspy + 浮动按钮显隐 + 价格计数 + active 反馈）
- 其他页面 JS：基本不动（动效主要为 CSS）

### 风险与缓解

| 风险 | 缓解 |
|---|---|
| 价格卡动效减法让"绚丽感"略减 | 数字滚动 + 滚动入场 bounce 补偿 |
| scrollspy 在跨页/FAQ 折叠展开时高度变化 | 用 `IntersectionObserver` 而非 `scroll` 位置算 |
| 骨架屏在快网时闪一下 | 设最短显示时长 800ms |
| 外链成功态用户看不到 | 接受局限，作为保险反馈保留 |

## 不在本设计范围

- 移动端 hamburger 菜单（v11 bug #6，超出"微交互"范围）
- 重构 / 重设计 hero / 价格卡整体结构
- 引入新 JS 库（如 GSAP / Framer Motion）
- 颜色 / 字体 / 品牌识别层面的改动
- 新页面、新功能、新内容

## 验证标准

- [ ] 视觉检查：所有新动效在 chrome / safari / firefox 桌面 + 移动端表现一致
- [ ] 无障碍：开启系统"减少动效"后，所有新动效停止
- [ ] 性能：Lighthouse Performance ≥ 90（现状基线需先测）
- [ ] 标签平衡：9 个 HTML 修改后 div/section 等开闭标签平衡
- [ ] grep 残留：scrolling spy / 浮动按钮 / 复制反馈在所有页面一致
- [ ] 数字一致性：FAQ 条数、价格、倒计时等文字与实际一致
- [ ] 跨页测试：从首页 → 任意子页 → 返回首页，所有动效无残留状态
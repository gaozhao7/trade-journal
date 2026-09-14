# 主题系统抽象改造开发规范

> 本文是 Trade Journal 主题系统后续抽象改造的执行标准。其他 AI、开发者或自动化工具在修改主题相关代码时，必须遵守本文规则。
>
> 当前阶段目标：只抽象主题系统，不新增主题，不改变现有视觉效果和交互行为。
>
> 当前主题：dark（产品默认）、light。
>
> 当前持久化方式：localStorage，key 为 journal-theme-v1。

## 1. 背景与目标

项目当前已经具备 light/dark 两种外观，但主题实现仍以二元状态为中心：Theme 只有 dark/light，Provider 直接操作 .dark class，CSS 通过 :root 与 .dark 覆盖变量，图表、Vela、导出和 Markdown 仍存在读取 .dark class 或硬编码颜色的逻辑。

本次改造只做抽象和收敛，不增加新主题：

1. 建立主题 ID、明暗基底、显示名称和 Token 集合。
2. 建立 Theme Registry，集中管理主题定义。
3. 将 DOM 契约扩展为 data-theme + .dark + color-scheme。
4. 统一首屏初始化、持久化、跨标签页同步和错误降级。
5. 让 Tailwind、Recharts、ECharts、Vela、PNG/PDF 导出一致消费主题 Token。
6. 清理硬编码颜色，为未来新增主题建立规范。

不属于本次范围：不新增主题，不改变默认 dark，不接入数据库主题偏好，不重做视觉设计，不替换现有图表库。

## 2. 设计原则

- 组件只表达语义需求，例如主文字、卡片背景、盈利色、序列色，不通过当前是不是 dark 决定业务颜色。
- Theme ID 与 ColorScheme 分离。未来 terminal 可以是独立主题 ID，同时声明 colorScheme: dark。
- CSS 变量是统一颜色契约。组件优先使用语义 Tailwind class 或 var(--token)。
- .dark 只保留给 Tailwind dark: 变体和第三方兼容，不作为业务主题判断。
- 首屏脚本必须在 React hydration 前完成主题应用，避免闪烁。
- P&L 红绿不能成为唯一信息载体，必须保留带符号文本、零轴方向、WIN/LOSS 文本和标记形状。
- 新 Token 必须验证对比度、焦点环、禁用态、选中态和色觉缺陷下的可辨识度。

## 3. 当前实现审计

### 3.1 现有文件

| 文件                                          | 当前职责                         | 问题                                                         |
| --------------------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| apps/web/src/lib/theme.ts                     | 定义 Theme、持久化 key、首屏脚本 | 只能识别 light/dark，缺少注册表和 Token 定义                 |
| apps/web/src/components/theme.tsx             | ThemeProvider、ThemeToggle       | 直接操作 .dark class，缺少 setTheme、colorScheme、注册表消费 |
| apps/web/src/app/globals.css                  | 定义 UI 和图表 Token             | :root 与 .dark 硬编码耦合，仍有散落颜色                      |
| apps/web/src/app/layout.tsx                   | 写入首屏脚本和默认 dark class    | 默认 class 与首屏脚本、Provider 状态需要统一                 |
| apps/web/src/components/charts/tokens.ts      | 从 DOM 读取图表 Token            | MutationObserver 只监听 class，fallback 固定为 dark 值       |
| apps/web/src/components/trade-chart.tsx       | Vela 价格图                      | 直接读取 .dark，硬编码 profit/loss/text/white                |
| apps/web/src/components/trade-market-data.tsx | Vela 行情图                      | 直接读取 .dark，硬编码 buy/sell/text 颜色                    |
| apps/web/src/lib/export-review.ts             | PNG/PDF 导出                     | PNG 读取 viz tokens，但 PDF 仍有固定 RGB                     |
| apps/web/src/components/review-export.tsx     | 导出预览                         | 使用 bg-white、text-slate-800、text-slate-500                |
| apps/web/src/app/globals.css 的 Markdown 样式 | 笔记渲染                         | blockquote、pre、table 使用蓝色系硬编码颜色                  |
| apps/web/tests/theme.test.ts                  | 主题单元测试                     | 只覆盖二值偏好和 .dark class 切换                            |

### 3.2 现有 Token 清单

UI Token：

```text
--background
--foreground
--card
--card-foreground
--popover
--popover-foreground
--primary
--primary-foreground
--secondary
--secondary-foreground
--muted
--muted-foreground
--accent
--accent-foreground
--destructive
--destructive-foreground
--border
--input
--ring
--radius
--brand
```

图表和可视化 Token：

```text
--viz-surface
--ink-muted
--gridline
--baseline
--profit
--profit-fill
--loss
--neutral-mid
--series-1 ... --series-8
```

本次抽象不要求立即新增视觉 Token，但应把现有 Token 纳入 ThemeDefinition.tokens 的类型约束，便于未来新增主题时做完整性检查。

### 3.3 硬编码颜色和不一致点

以下位置应在实施时逐项处理：

- apps/web/src/app/globals.css：card-sheen、journal-hover-card、journal-filter-dialog、拖拽阴影等使用 rgb(...)；dashboard-customize-switch > span 使用 #fff；Markdown 使用 #60dcca、#657386、#9eabc0、#121a27、#344155。
- apps/web/src/components/trade-chart.tsx：profit、loss、text、白色标签硬编码；document.documentElement.classList.contains("dark") 作为主题判断。
- apps/web/src/components/trade-market-data.tsx：buy、sell、白色文本硬编码；MutationObserver 只监听 class。
- apps/web/src/components/charts/tokens.ts：fallback 固定为 dark；observer 只监听 class；tooltip shadow 硬编码。
- apps/web/src/components/charts/time-heatmap.tsx：tooltip box-shadow 内联字符串硬编码。
- apps/web/src/components/account-selector.tsx：border-white/10 缺少主题语义。
- apps/web/src/components/review-export.tsx：bg-white、text-slate-800、text-slate-500。
- apps/web/src/lib/export-review.ts：PDF 默认色、副标题色、页脚色使用固定 RGB。
- apps/web/src/app/globals.css 的 journal-filter-fields 使用局部 color-scheme: light，再用 .dark 覆盖，后续应由基底驱动。

## 4. 主题领域模型

### 4.1 主题 ID

主题 ID 必须稳定、小写、语义明确，不能直接复用明暗基底作为唯一身份。当前阶段保留两个 ID：

```ts
export const THEME_IDS = ["dark", "light"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
```

未来新增主题时，应使用产品化且稳定的名称，例如：

```ts
export const THEME_IDS = ["dark", "light", "terminal", "paper"] as const;
```

不要把主题 ID 翻译成中英文名称；显示名称通过翻译 key 获取。

### 4.2 明暗基底

```ts
export type ColorScheme = "light" | "dark";
```

colorScheme 用于设置 HTML 的 color-scheme、.dark class、Vela 等只支持 dark/light 的第三方适配，以及浏览器原生控件和滚动条。

### 4.3 主题定义

建议新增：

```ts
export interface ThemeTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  brand: string;
  vizSurface: string;
  inkMuted: string;
  gridline: string;
  baseline: string;
  profit: string;
  profitFill: string;
  loss: string;
  neutralMid: string;
  series: [string, string, string, string, string, string, string, string];
}

export interface ThemeDefinition {
  id: ThemeId;
  colorScheme: ColorScheme;
  nameKey: string;
  tokens: ThemeTokens;
}
```

- nameKey 使用 next-intl 消息 key，例如 names.dark。
- tokens 必须覆盖完整集合，不允许部分主题缺省到其他主题。
- radius 可以保留全局 CSS 变量，不强制进入每种主题；未来需要按主题改变圆角时再升级为 Token。

### 4.4 Theme Registry

建议新增 apps/web/src/lib/theme-registry.ts：

```ts
import { THEME_IDS, type ThemeDefinition, type ThemeId } from "./theme";

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  dark: {
    id: "dark",
    colorScheme: "dark",
    nameKey: "names.dark",
    tokens: {
      background: "#08080a",
      foreground: "#f4f4f4",
      // 完整 Token
    },
  },
  light: {
    id: "light",
    colorScheme: "light",
    nameKey: "names.light",
    tokens: {
      background: "#f9f9f7",
      foreground: "#0b0b0b",
      // 完整 Token
    },
  },
};

export const DEFAULT_THEME_ID: ThemeId = "dark";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES[id];
}
```

Registry 必须是客户端可用模块，不引入 Node.js 专属 API。CSS 仍是实际样式来源；Registry 提供类型、fallback、元数据和测试基准。如果希望避免颜色双份维护，可只把 Registry 当元数据表，但第一阶段先完成 API 抽象，Token 双份维护另行评估。

## 5. DOM 与 CSS Token 契约

### 5.1 DOM 属性

<!-- prettier-ignore -->
```html
<!-- dark -->
<html data-theme="dark" class="dark" style="color-scheme: dark">

<!-- light -->
<html data-theme="light" style="color-scheme: light">

<!-- 未来深色主题 -->
<html data-theme="terminal" class="dark" style="color-scheme: dark">
```

- data-theme 表示当前主题 ID。
- .dark 只表示当前主题使用深色基底。
- color-scheme 与 colorScheme 一致。
- 三者必须一起更新，不允许只改其中一个。

### 5.2 CSS 选择器

globals.css 应调整为：

```css
:root {
  color-scheme: light;
}

[data-theme="light"] {
  color-scheme: light;
  /* light tokens */
}

[data-theme="dark"] {
  color-scheme: dark;
  /* dark tokens */
}

/* 兼容 Tailwind dark: 和少量第三方样式。 */
.dark {
  color-scheme: dark;
}
```

新主题必须以 data-theme 定义 Token，不能只增加 .dark 覆盖。为避免首屏脚本执行前出现错误主题，HTML 可保留默认 data-theme="dark" 和 class="dark"；脚本会按用户偏好覆盖。

### 5.3 Tailwind 映射

@theme inline 保持现有映射，并补充需要成为 Tailwind class 的语义 Token，包括 background、foreground、card、popover、primary、secondary、muted、accent、destructive、border、input、ring、brand、profit、loss、neutral-mid。组件优先使用 bg-background、text-muted-foreground、border-border 等语义类。复杂图形、SVG、canvas 和导出使用 var(--token) 或 readThemeTokens()。

### 5.4 Token 分类

每个主题必须完整提供以下分类。

UI 表面和文字：页面、正文、卡片、弹窗、主按钮、次按钮、幽灵按钮、前景、次级文字、弱化文字、边框、输入框、焦点环、危险操作、品牌强调色。

交互状态：hover 不能只靠透明度；focus-visible 必须使用 --ring；disabled 必须同时改变透明度、cursor 和至少一种视觉状态；selected/checked 必须与 hover 不同，且不能只靠颜色区分。

图表外观：容器背景、网格线、基线、坐标轴文字、Tooltip 背景/边框/阴影/文字、图例文字、空状态、加载状态。

金融语义颜色：--profit 用于盈利文字和标记；--profit-fill 用于盈利填充；--loss 用于亏损文字和标记；--neutral-mid 用于接近零值或中性值。颜色不得成为唯一语义载体。

分类序列：--series-1 到 --series-8 固定顺序使用，不得循环复用；超过 8 个分类时合并为其他；颜色在浅色和深色背景下都必须可区分。

阴影、遮罩和覆盖层：未来新增主题应增加 --shadow-card、--shadow-popover、--shadow-dialog、--shadow-drag、--overlay-backdrop。第一阶段可以不改变阴影值，但必须先把 CSS 中硬编码提取为 Token。

Markdown 和长文本：至少增加 --markdown-quote-border、--markdown-quote-text、--markdown-code-bg、--markdown-table-border。Token 必须语义命名，不能叫 blue-500。

Vela 注释：至少增加 --vela-buy、--vela-sell、--vela-label-text、--vela-profit-label-text、--vela-loss-label-text。Vela 只接受 hex 或 RGB 时，由 readThemeTokens() 解析后传入。

导出和打印：PNG 使用当前主题 Token。PDF 当前是白底文档，推荐保留独立打印主题，但把固定 RGB 改成 --export-pdf-bg、--export-pdf-fg、--export-pdf-muted、--export-pdf-rule。若使用打印主题，界面和文档不得暗示 PDF 与当前屏幕主题完全一致。

## 6. 首屏初始化

首屏脚本必须同步读取 localStorage、校验已注册主题 ID、读取 colorScheme、写入 data-theme、切换 .dark class、设置 style.color-scheme。storage 异常时必须回退默认主题，不执行网络请求或复杂计算。

推荐实现：

```ts
export const THEME_INIT_SCRIPT = `
(() => {
  const key = ${JSON.stringify(THEME_KEY)};
  const fallback = ${JSON.stringify(DEFAULT_THEME_ID)};
  const schemes = ${JSON.stringify(THEME_COLOR_SCHEMES)};
  let id = fallback;
  try {
    const saved = localStorage.getItem(key);
    if (saved && Object.prototype.hasOwnProperty.call(schemes, saved)) id = saved;
  } catch {}
  const scheme = schemes[id] || "dark";
  const root = document.documentElement;
  root.dataset.theme = id;
  root.classList.toggle("dark", scheme === "dark");
  root.style.colorScheme = scheme;
})();
`;
```

THEME_COLOR_SCHEMES 只包含 id -> colorScheme，不把完整主题对象塞入 head。

layout.tsx 应保持服务端默认主题为 dark：

```tsx
<html
  lang={locale}
  data-theme={DEFAULT_THEME_ID}
  className={THEMES[DEFAULT_THEME_ID].colorScheme === "dark" ? "dark" : undefined}
  suppressHydrationWarning
>
```

服务端不能读取用户 localStorage。首屏脚本执行后，用户偏好会覆盖默认值。suppressHydrationWarning 必须保留。

## 7. Provider 与 Hook API

### 7.1 Context 契约

```ts
export interface ThemeContextValue {
  theme: ThemeId;
  colorScheme: ColorScheme;
  ready: boolean;
  setTheme: (theme: ThemeId) => void;
  toggle: () => void;
  error: string | null;
}
```

- theme 是主题 ID。
- colorScheme 供第三方组件和调试使用。
- ready 表示 hydration 后已经读取首屏结果。
- setTheme 是未来主题选择器的主入口。
- toggle 是当前 ThemeToggle 的兼容入口。
- error 用于不能持久化时的非阻塞提示。

如果希望业务组件不读取 colorScheme，可只暴露 theme 和注册表查询函数；但 Vela、ECharts 等第三方适配层必须能拿到 colorScheme。

### 7.2 Hook

建议提供 useTheme()、useThemeDefinition() 和可选的 useThemeId()。禁止新增 useIsDark() 一类 hook，因为业务组件不应通过明暗状态判断视觉语义。

### 7.3 applyTheme

```ts
export function applyTheme(root: HTMLElement, id: ThemeId): void {
  const definition = getTheme(id);
  root.dataset.theme = definition.id;
  root.classList.toggle("dark", definition.colorScheme === "dark");
  root.style.colorScheme = definition.colorScheme;
}
```

所有写 DOM 的地方只能调用 applyTheme，不允许组件自行操作 document.documentElement.classList。测试必须覆盖三个写入。

### 7.4 Provider 生命周期

Provider 挂载后从 HTML 读取 data-theme，无效时回退默认主题，设置 ready，监听 storage 和 journal-theme-change 自定义事件，卸载时清理监听器。storage 事件中 key 匹配 THEME_KEY 时解析 newValue；key 为 null 表示 localStorage.clear()，回退默认主题。storage 不可用时仍允许当前页面切换，只显示非阻塞错误。

### 7.5 切换行为

setTheme(next) 必须校验有效 Theme ID、调用 applyTheme、更新 React state、尝试写入 localStorage，写入失败时保留当前页面状态并设置 error。toggle() 保持 dark/light 切换；未来主题选择器出现后，toggle() 不应是唯一入口。

## 8. 持久化和优先级

当前阶段保持 localStorage[journal-theme-v1] > 默认 dark。不要在本阶段加入数据库 settings.theme、Cookie、系统主题跟随、按设备或账户保存主题。

未来若需要跨设备同步，建议优先级为：用户账号 settings.theme > 当前设备 localStorage > 默认 dark。实施前必须另行设计服务端首屏防闪烁、未登录用户、多设备冲突和是否允许跟随系统。

## 9. Tailwind 兼容方案

保留：

```css
@custom-variant dark (&:is(.dark *));
```

dark: 只用于明暗基底差异，不用于表达具体主题。若样式需要特定主题 ID，优先改为 Token，而不是在组件中写 [data-theme="terminal"] 条件。确实需要主题专属 CSS 时，只能集中放在 globals.css 并用语义 Token 隔离。业务组件不允许出现 dark ? ... : ... 的颜色选择。

## 10. 图表主题

### 10.1 适用范围

Recharts：equity、daily bars、calendar daily、rolling trade、trade scatter、edge radar、drawdown bars。ECharts：heatmap 和其他 canvas 图表。SVG：gauge 和自绘图形。导出：PNG canvas。全部必须消费统一主题 Token。

### 10.2 apps/web/src/components/charts/tokens.ts

MutationObserver 必须监听：

```ts
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class", "data-theme", "style"],
});
```

主题变化时建议广播：

```ts
export const THEME_CHANGE_EVENT = "journal-theme-change";

window.dispatchEvent(
  new CustomEvent(THEME_CHANGE_EVENT, {
    detail: { theme: definition.id, colorScheme: definition.colorScheme },
  }),
);
```

- 优先监听 data-theme，同时兼容 class 和 style.color-scheme。
- 缓存上次解析结果，主题未变时不重复重绘。
- fallback 与默认主题一致，不能永远固定 dark。
- Tooltip 阴影使用 CSS Token，不在 TS 中写 rgba(...)。
- canvas 图表通过 useVizTokens()；SVG 可使用 var(--token)，但要完成浏览器验证。

### 10.3 Recharts

用 useVizTokens() 获取颜色；坐标轴、网格线、Tooltip、图例全部使用 Token；组件不写 #... 或 rgb(...)；主题切换自动重绘，不依赖刷新页面。

### 10.4 ECharts

图表组件在 useVizTokens() 变更后重新生成 option。EChart 只负责 mount、resize、dispose 和动画，不负责主题判断。chart.setTheme() 只允许由第三方适配层根据 colorScheme 调用，组件不得读取 .dark class。

### 10.5 图表容器

网格线、轴线、刻度文字使用 --viz-surface、--gridline、--baseline、--ink-muted、--foreground、--card、--border。journal-chart-frame 及坐标轴不得再写硬编码颜色。

## 11. Vela 主题映射

Vela 当前只接受 dark/light，因此必须有明确映射：

```ts
const velaTheme = themeDefinition.colorScheme;
chart.setTheme(velaTheme);
```

- 组件不直接判断 .dark class。
- 组件通过 useTheme() 获取 theme 和 colorScheme。
- 主题变化时先调用 chart.setTheme(colorScheme)，再读取 Token，重建依赖颜色的 native indicator 或标注。
- 不因主题变化重新请求市场数据，除非数据本身变化。

需要迁移的文件：apps/web/src/components/trade-chart.tsx、apps/web/src/components/trade-market-data.tsx。

Vela 标注颜色必须 Token 化：buy marker 使用 --vela-buy；sell marker 使用 --vela-sell；label text 使用 --vela-label-text；P&L label 盈利使用 --profit，亏损使用 --loss。Vela API 只接受 hex 时用 getComputedStyle() 解析，并集中封装，不在组件中写死。

## 12. 导出主题

### 12.1 PNG

使用当前主题的完整导出 Token；主题切换后重新导出使用新主题；不依赖 .dark class；标题、副标题、正文、品牌条、分隔线全部使用 Token；测试至少覆盖 light 和 dark。

### 12.2 PDF

PDF 是 pdf-lib 生成的白底文档，不能直接使用 CSS 变量。推荐定义独立导出主题，将固定 RGB 提取为具名常量或导出 Token；未来支持彩色 PDF 时复用 ThemeDefinition.tokens。必须修复正文默认色 rgb(0.16, 0.19, 0.24)、副标题色 rgb(0.4, 0.44, 0.5)、页脚色 rgb(0.5, 0.5, 0.5)。

### 12.3 导出预览

review-export.tsx 的 PDF 预览必须使用主题 Token 或明确的打印预览样式，不能把 bg-white text-slate-* 作为唯一方案。

## 13. 组件和硬编码颜色迁移

### 13.1 迁移规则

组件允许的颜色来源：Tailwind 语义类；CSS Token；useVizTokens() 解析值；第三方组件要求的映射值，但必须通过适配层获取。

禁止：

```tsx
const dark = document.documentElement.classList.contains("dark");
const color = dark ? "#0ca30c" : "#006300";
```

推荐：

```tsx
const { colorScheme } = useTheme();
const tokens = useVizTokens();
const color = tokens?.profit;
```

### 13.2 允许清单

以下硬编码颜色可保留，但必须注明原因：第三方品牌 Logo 或品牌色；第三方库无法通过 CSS 变量传入的协议颜色；打印 PDF 固定黑白灰；测试快照固定值；浏览器安全区域或原生控件颜色。允许清单必须写进代码注释或本文档，新增硬编码颜色必须经过 review。

### 13.3 审计命令

```bash
rg -n "#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|oklch\(" apps/web/src --glob '*.{ts,tsx,css}'
```

结果必须逐项分类为：已迁移为 Token、属于允许清单、需要后续处理。不能简单忽略。

### 13.4 文件迁移清单

| 文件                                            | 动作                                          |
| ----------------------------------------------- | --------------------------------------------- |
| apps/web/src/lib/theme.ts                       | 增加 ThemeId、ColorScheme、解析函数、首屏脚本 |
| apps/web/src/lib/theme-registry.ts              | 新增主题注册表                                |
| apps/web/src/components/theme.tsx               | 改为 setTheme、data-theme、事件广播           |
| apps/web/src/app/layout.tsx                     | 写入默认 data-theme、color-scheme、首屏脚本   |
| apps/web/src/app/globals.css                    | data-theme 选择器、Token 化硬编码颜色         |
| apps/web/src/components/charts/tokens.ts        | observer、fallback、shadow Token 化           |
| apps/web/src/components/trade-chart.tsx         | 删除 .dark 判断和硬编码颜色                   |
| apps/web/src/components/trade-market-data.tsx   | 删除 .dark 判断和硬编码颜色                   |
| apps/web/src/components/charts/time-heatmap.tsx | Tooltip shadow Token 化                       |
| apps/web/src/components/account-selector.tsx    | border-white/10 改为主题语义                  |
| apps/web/src/components/review-export.tsx       | 导出预览 Token 化                             |
| apps/web/src/lib/export-review.ts               | PDF/PNG 导出颜色策略                          |
| apps/web/tests/theme.test.ts                    | 扩展 Theme ID、DOM、storage 测试              |

## 14. 新主题新增规范

本节描述未来新增主题时必须遵守的流程。本次改造不得执行。

### 14.1 新增主题前必须确认

1. 新主题解决什么真实使用场景。
2. 与现有主题差异是否足够明确。
3. 是否只是换品牌色或背景色。
4. 是否破坏金融语义颜色。
5. 是否需要新 Token，而不是在组件中加条件分支。
6. 是否有对应中英文名称。
7. 是否有截图、对比度和 CVD 验证。

### 14.2 必备属性

- 唯一稳定 ID。
- colorScheme: light 或 dark。
- 中英文显示名称。
- 完整 UI Token。
- 完整图表 Token。
- 完整阴影和覆盖层 Token。
- Markdown、Vela、导出相关 Token。
- 设计来源说明。
- 对比度和可访问性验证记录。

### 14.3 新增主题步骤

新增主题不是「只注册一个定义」：颜色值同时存在于 TypeScript 注册表和 globals.css。
`ThemeId` 相关的三处声明（`THEME_IDS`、`THEME_COLOR_SCHEMES`、`THEMES`）都是
`Record<ThemeId, …>`，所以 **`tsc` 会拦住漏注册，但不会校验取值正确**——取值由测试拦住。

注意第 5 步：`nameKey` 目前只是元数据（主题选择器落地前没有任何运行时调用点），
而 `node scripts/check-i18n.mjs` 只比对两种语言的 key 集合是否一致 —— **两种语言同时漏掉
新主题名称时它会照样通过**，`check-i18n-keys.mjs` 也只能看到静态 `t("…")` 调用点。
因此名称的完整性由 `tests/theme.test.ts` 的「names every registered theme in both locales」
单独保证：它遍历 `THEME_IDS`、解析两份消息文件，断言 key 存在且非空，并反向检测
「已无主题注册却遗留的名称」。

| #   | 动作                                  | 文件                                            | 漏做时谁拦住                         |
| --- | ------------------------------------- | ----------------------------------------------- | ------------------------------------ |
| 1   | 在 `THEME_IDS` 加入新 ID              | `apps/web/src/lib/theme.ts`                     | `tsc`（`Record<ThemeId, …>` 缺 key） |
| 2   | 在 `THEME_COLOR_SCHEMES` 声明明暗基底 | `apps/web/src/lib/theme.ts`                     | `tsc`                                |
| 3   | 在 `THEMES` 注册完整定义              | `apps/web/src/lib/theme-registry.ts`            | `tsc` + Registry 完整性测试          |
| 4   | 添加 `[data-theme="<id>"]` Token 块   | `apps/web/src/app/globals.css`                  | 「CSS ↔ Registry 逐值一致」测试      |
| 5   | 添加 `Theme.names.<id>`               | `apps/web/src/i18n/messages/{zh-CN,en-US}.json` | 「Theme.names 完整性」测试（见下）   |
| 6   | 跑通第 14.5 节回归清单                | —                                               | 人工 + 下列命令                      |

```bash
node scripts/check-i18n.mjs                                  # key 对齐
node scripts/check-i18n-keys.mjs                             # 静态 key 存在
cd apps/web && ../../node_modules/.bin/tsc --noEmit
pnpm test                                                    # 含 Registry ↔ CSS 一致性与颜色守卫
pnpm --filter web build                                      # 需本机 Node 24
```

### 14.4 新主题约束

- 不允许修改业务组件为特定主题加分支。
- 不允许主题通过组件内读取 .dark 或 dataset.theme 自行判断。
- 不允许只用新背景色和品牌色冒充新主题。
- 不允许缺少 Light/Dark 基底声明。
- 不允许破坏 P&L 的非颜色信息载体。
- 不允许只验证屏幕显示而不验证图表、导出和无障碍状态。

### 14.5 新增主题回归清单

新增或修改主题后，逐项确认（不要只看界面外观）：

- [ ] 首屏脚本仍只内联 `id -> colorScheme`，未把 Token 表塞进 `<head>`（测试已断言）。
- [ ] `applyTheme` 同时写入 `data-theme`、`.dark`、`color-scheme`，三者一致。
- [ ] globals.css 的新块与 Registry 逐值一致，且没有「CSS 有而 Registry 没有」的变量。
- [ ] 浅色/深色基底下的截图对比、正文与次级文字对比度、色觉缺陷模拟。
- [ ] Recharts、ECharts、SVG 图形在运行时切换主题后自动重绘。
- [ ] Vela 价格图与行情图：`setTheme` 生效，标注颜色来自 `--vela-*`，且不重新请求行情。
- [ ] PNG 导出使用当前主题 Token；PDF 使用 `lib/export-theme.ts` 的打印主题（不跟随屏幕主题）。
- [ ] Markdown 笔记的引用、代码块、表格在两种基底下均可读。
- [ ] P&L 红绿之外仍有带符号文本、WIN/LOSS 文本与标记形状。
- [ ] `focus` / `disabled` / `hover` / `selected` 状态可辨，焦点环可见。
- [ ] 新增文案同时进入 `zh-CN` 与 `en-US`，`check-i18n.mjs` 通过。
- [ ] `Theme.names.<id>` 在两种语言中都存在、非空，且没有遗留已删除主题的名称（测试已断言）。
- [ ] 隐私模式与导出的组合行为正常。

## 15. 无障碍和可视化验证

必须检查正文、次级文字、边框、禁用态、输入框、焦点环在主背景上的对比度。盈利/亏损、分类序列和图表填充必须通过色觉缺陷模拟；不能只凭肉眼判断。

必须验证：Tab 焦点顺序；focus-visible 可见；键盘可切换主题；读屏器能读取主题控件名称；hover/selected/disabled 状态可辨；图表 Tooltip 和坐标轴文字对比度；隐私模式与导出组合行为。

## 16. 测试标准

### 16.1 单元测试

扩展 apps/web/tests/theme.test.ts，覆盖：

- 无效、缺失、dark、light 存储值。
- localStorage 抛出异常时回退 dark。
- applyTheme 写入 data-theme、.dark 和 color-scheme。
- 所有已注册主题都有完整 Token。
- Theme ID 与 nameKey 唯一。
- storage 事件同步和 clear() 回退。
- 未来新增主题无需修改业务组件即可被解析。

### 16.2 集成测试

- 首屏脚本执行前默认 dark，执行后无 FOUC。
- 切换主题后图表自动重绘。
- Vela、Recharts、ECharts 颜色一致。
- PNG 导出使用当前主题 Token。
- PDF 导出使用明确的打印主题。
- 跨标签页切换同步。
- 隐私模式不影响主题切换。

### 16.3 构建检查

```bash
pnpm --filter web typecheck
pnpm test
pnpm --filter web build
```

如果环境因 registry/network 问题无法安装依赖，必须明确记录为环境问题，不能误判为代码失败。

## 17. 分阶段实施顺序

阶段 1：领域模型和 Registry。改造 lib/theme.ts，新增 theme-registry.ts，补测试，不改变 UI。

阶段 2：DOM 契约和首屏脚本。改造 applyTheme、layout.tsx 和 globals.css 选择器，保持 dark/light 视觉不变。

阶段 3：Provider API。增加 setTheme、colorScheme、自定义事件和 storage 同步，保留 toggle 和现有 ThemeToggle 行为。

阶段 4：图表 Token 收敛。改造 charts/tokens.ts、Recharts、ECharts、trade-chart.tsx 和 trade-market-data.tsx。

阶段 5：导出和硬编码清理。改造 export-review.ts、review-export.tsx、Markdown 和 CSS 阴影；建立允许清单。

阶段 6：验证和文档更新。运行测试、typecheck、build、截图和对比度检查。

禁止把阶段 1 和阶段 4 合并成一个超大提交。每个阶段都必须保持可构建、可回滚、行为不回归。

## 18. 可直接交给其他 AI 的执行提示词

请对 Trade Journal 当前主题系统进行抽象改造，要求如下：

- 当前分支保持 replay，不回退已有国际化改动。
- 暂不新增主题，只抽象 dark/light。
- 主题身份使用 ThemeId，明暗基底使用 ColorScheme，禁止业务组件用 .dark 判断主题。
- 建立 Theme Registry，统一 ThemeDefinition、ColorScheme、nameKey、tokens。
- HTML 契约使用 data-theme + .dark + color-scheme，三者由 applyTheme 统一写入。
- localStorage key 保持 journal-theme-v1，默认 dark。
- 首屏脚本继续内联、无 FOUC，不内联完整注册表。
- charts/tokens.ts 监听 data-theme、class 和 style；移除固定 dark fallback 和硬编码 tooltip shadow。
- Vela 通过 colorScheme 映射 dark/light，颜色通过 Token 获取。
- PNG 使用当前主题 Token；PDF 使用明确的打印 Token。
- 清理组件和 CSS 中硬编码颜色，第三方例外写入允许清单。
- 新增或更新主题测试，运行 typecheck、test、build 和硬编码颜色审计。
- 不修改数据库业务模型，不接入 Cookie，不改变默认主题。

## 19. 验收清单

- [ ] 默认仍为 dark，行为无回归。
- [ ] 首屏无 FOUC。
- [ ] 用户选择可持久化。
- [ ] 跨标签页同步。
- [ ] localStorage 不可用时仍可切换。
- [ ] data-theme、.dark、color-scheme 始终一致。
- [ ] 所有 UI Token 完整。
- [ ] 所有图表在运行时主题切换后重绘。
- [ ] Vela、Recharts、ECharts 颜色一致。
- [ ] PNG 导出使用当前主题 Token。
- [ ] PDF 使用明确的打印主题。
- [ ] 无组件硬编码颜色，品牌或第三方例外已列入允许清单。
- [ ] P&L 不只靠红绿。
- [ ] focus、disabled、hover、selected 状态可辨。
- [ ] 对比度和色盲验证通过。
- [ ] 新主题无需修改业务组件。
- [ ] 新增主题只需按第 14.3 节改 5 个文件，并按第 14.5 节回归清单验证，不必改动任何业务组件。

## 20. 变更记录

| 日期       | 变更                              |
| ---------- | --------------------------------- |
| 2026-09-14 | 创建主题系统抽象改造开发规范      |
| 2026-09-14 | 阶段 1-5 落地，见第 21 节实施记录 |

## 21. 实施记录（2026-09-14）

阶段 1-5 已在 `replay` 分支落地。未新增主题，默认仍为 dark，未接入数据库主题偏好，未引入 Cookie。

### 21.1 落地内容

| 位置                                                                         | 变化                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/theme.ts`                                                               | `ThemeId` / `ColorScheme` / `isThemeId` / `themePreference` / `applyTheme` / `readThemeFromDom` / `currentThemeId` / `colorSchemeFor` / `themeHtmlAttributes` / 首屏脚本 / `THEME_CHANGE_EVENT`           |
| `lib/theme-registry.ts`                                                      | 新增。39 个颜色 Token（UI 20、图表 9、Vela 5、Markdown 4、开关 1）+ 8 个阴影/遮罩 Token，以及 `THEME_TOKEN_CSS_VARS` / `THEME_SHADOW_CSS_VARS` 映射和 `getTheme`                                          |
| `app/layout.tsx`                                                             | `data-theme` + `.dark` + `color-scheme` 由 `themeHtmlAttributes(DEFAULT_THEME_ID)` 统一产出                                                                                                               |
| `app/globals.css`                                                            | 选择器改为 `:root, [data-theme="light"]` 与 `[data-theme="dark"]`，`.dark` 仅保留 Tailwind 兼容；硬编码阴影、Markdown 配色、开关滑块、遮罩全部提取为 Token；filter 字段的局部 `color-scheme` 改由基底继承 |
| `components/theme.tsx`                                                       | Context 扩展为 `{ theme, colorScheme, ready, setTheme, toggle, error }`；新增 `useTheme` / `useThemeDefinition`；变更统一走 `applyTheme` 并广播事件                                                       |
| `components/charts/tokens.ts`                                                | observer 监听 `class` / `data-theme` / `style`；fallback 改为读取 Registry 的默认主题；`VizTokens` 增加 `tooltipShadow` 与 5 个 Vela Token                                                                |
| `trade-chart.tsx` / `trade-market-data.tsx`                                  | 删除 `.dark` 判断与硬编码色；Vela 主题取 `getTheme(currentThemeId()).colorScheme`；监听 `journal-theme-change` 重建标注，不重新请求行情                                                                   |
| `lib/export-theme.ts`                                                        | 新增打印主题常量（pdf-lib 与预览共用一份值），PDF 不再写裸 RGB                                                                                                                                            |
| `review-export.tsx` / `account-selector.tsx` / `shell.tsx` / `ui/dialog.tsx` | 导出预览改打印主题 Token；`border-white/10`、`bg-black/55`、`bg-black/60` 改语义 Token                                                                                                                    |
| `i18n/messages/*.json`                                                       | 补 `Theme.names.dark` / `Theme.names.light`（供未来主题选择器使用）                                                                                                                                       |

### 21.2 有意为之的收敛

以下四点原本是「同一语义在不同组件里各写一份字面量」，Token 化后必须统一。差异已逐一核对：

| 位置                       | 之前                                                           | 现在                                                   |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| 浅色 Vela 买入标记         | `#006300`（trade-chart）                                       | `--vela-buy: #087f23`                                  |
| 深色 Vela 买卖标记         | `#087f23` / `#bd2626`（trade-market-data，两套主题共用同一份） | `--vela-buy: #0ca30c` / `--vela-sell: #d03b3b`         |
| 浅色 Markdown 引用与代码块 | 固定深色配色（`#9eabc0` 文字、`#121a27` 代码底），浅色下不可读 | 浅色 Token（`#52514e` / `#f0efec`）；深色值不变        |
| 移动端导航遮罩             | `rgb(0 0 0 / 0.55)`                                            | `--overlay-backdrop: rgb(0 0 0 / 0.6)`，与弹窗遮罩统一 |

### 21.3 校验结果

```bash
cd apps/web && ../../node_modules/.bin/tsc --noEmit   # 通过
node scripts/check-i18n.mjs                           # key 对齐；硬编码扫描无新增
pnpm test                                             # 42 文件 / 344 用例通过（需本机 Node 24）
pnpm --filter web build                               # 通过（需本机 Node 24）
```

`tests/theme.test.ts`（14 项）覆盖：DOM 三项契约（`data-theme` / `.dark` / `color-scheme`）、服务端
`themeHtmlAttributes()` 产出、storage 异常降级、已注册 ID 的往返解析与未注册 ID 的回退、
首屏脚本不内联注册表（按内容断言，不依赖长度阈值）、Registry 完整性、
**Registry 与 globals.css 逐值一致性**（双向：CSS 有而 Registry 没有也会失败）、
**`Theme.names` 在两种语言中的完整性与无遗留**，
以及「组件内不得出现字面量颜色」的守卫。该守卫的边界已明确写入测试注释：拦截 HEX、
带字面量通道的 `rgb()/hsl()/oklch()/lab()/lch()/color()`、以及 `white` / `black` 作为属性值；
**不拦截** `rgb(var(--x))`（本身就是 Token 驱动）、`rgb(color.r, …)` 这类计算调用、
Tailwind class 里的关键字颜色（`bg-white`，关键字颜色的合规入口）、以及
`transparent` / `currentColor`（浏览器语义）。它不是完整的颜色审计器。

### 21.4 仍需人工验证

- 浅色/深色截图对比、对比度与色觉缺陷模拟（第 15 节）。
- Vela / Recharts / ECharts 在运行时与跨标签页切换主题后的一致性。
- 隐私模式与导出的组合行为。

## 22. 后续扩展待评估（当前不阻塞）

以下三项来自 2026-09-14 的两轮代码评审，经复核属于「主题数量增长后再处理」的范围，本阶段不改。

1. **构建期生成 CSS 变量。** 目前 Registry 与 `globals.css` 各维护一份颜色，靠测试保证不漂移。
   主题数量超过 2-3 个、或需要按主题批量调色时，应改为构建期由单一数据源生成两个
   `[data-theme="<id>"]` 块，彻底去掉双份维护。当前两个主题下，双份的收益（CSS 可读、可热改）
   高于成本。
2. **不把「ID + 基底」收敛进 Registry。** 曾考虑让 `THEME_COLOR_SCHEMES` 由 `THEMES` 派生，
   但 registry 需要从 `lib/theme.ts` 引入 `ThemeId`，反向派生会形成运行时循环依赖。因此维持
   「三处声明 + 类型检查拦漏注册 + 测试拦取值不一致」的方案，并把步骤写进第 14.3 节。
3. **主题变体。** `ThemeProvider` 只在主题 ID 变化时广播事件，因此「同一 ID、不同季节配色/密度」
   这类变体必须作为独立 `ThemeId` 注册（第 14.4 节已禁止组件内按主题名分支）。若未来确实需要
   同 ID 多配置，事件 detail 需要额外携带配置版本，届时再设计。
   复审另指出的「主题名称 key 没有既有兜底」缺口不属于待评估项：它已在本阶段用
   `tests/theme.test.ts` 的 names 测试关闭，说明见第 14.3 节。待主题选择器落地、
   `t(definition.nameKey)` 成为静态可见调用点后，`check-i18n-keys.mjs` 会再多一层兜底。

# 全量国际化改造开发规范

> 本文是 Trade Journal 项目后续国际化改造的执行标准。其他 AI、开发者或自动化工具在修改组件和页面时，必须遵守本文规则。
>
> 当前支持语言：`zh-CN`、`en-US`。
>
> 默认语言：`zh-CN`。
>
> 语言解析优先级：数据库 `settings.locale` > Cookie `journal-locale` > 默认值 `zh-CN`。

## 1. 改造目标

本项目必须实现完整的 UI 国际化，而不是只翻译导航或设置页。所有用户能够看到、听到、复制、搜索、悬停、聚焦或通过辅助技术读取的自然语言都必须进入翻译系统。

改造范围包括：

- `apps/web/src/app/**/*.tsx` 中的页面、布局、加载状态和登录页。
- `apps/web/src/components/**/*.tsx` 中的业务组件、表单组件、图表组件和弹窗。
- `apps/web/src/components/ui/**/*.tsx` 中的用户可见默认文案、辅助标签和无障碍属性。
- 服务端返回给用户的错误消息、校验消息和状态消息。
- Toast、Alert、Dialog、Confirm、空状态、Loading 状态和成功提示。
- `aria-label`、`title`、`placeholder`、`alt`、SVG `<title>` 和可访问性辅助文本。
- 图表的标题、坐标轴名称、Tooltip、Legend、Series 名称和数据状态文案。
- 导入、导出、Market Data、Trade Replay、AI、Prop Firm、Notebook 等模块。
- 日期、时间、数字、货币、百分比、持续时间和星期名称的本地化显示。

以下内容不需要翻译：

- 交易品种、股票代码、账户名称、Playbook 名称、用户笔记和交易备注。
- API 字段名、数据库字段名、URL、CSS class、日志中的技术标识符。
- 供应商名称、品牌名称、模型 ID、文件扩展名和协议名称。
- 代码注释中的技术术语，除非注释是用户可见文案。

## 2. 当前国际化基础设施

相关文件：

- `apps/web/src/i18n/config.ts`
- `apps/web/src/i18n/request.ts`
- `apps/web/src/i18n/messages/en-US.json`
- `apps/web/src/i18n/messages/zh-CN.json`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/api/locale/route.ts`
- `apps/web/src/app/api/settings/route.ts`
- `apps/web/next.config.ts`

当前使用 `next-intl`，且采用无 URL locale 前缀模式。不要改成 `/zh-CN/...` 或 `/en-US/...` 路由，除非另有架构决策。

服务端布局已经提供 `NextIntlClientProvider`。因此：

- Server Component 使用 `getTranslations`。
- Client Component 使用 `useTranslations`。
- 不允许组件自行读取 Cookie、数据库或 `document.documentElement.lang` 来决定显示语言。
- 不允许在组件中写 `locale === "zh-CN" ? ... : ...`，除非是确实无法由消息字典表达的语言学格式逻辑。

## 3. 翻译消息文件规范

### 3.1 文件要求

`en-US.json` 和 `zh-CN.json` 必须保持完全相同的 key 结构。新增 key 时必须同时修改两个文件。

禁止只修改一种语言。禁止通过缺少 key 让 `next-intl` 静默回退到英文或显示 key 名称。

推荐结构：

```json
{
  "Common": {},
  "Navigation": {},
  "Settings": {},
  "Dashboard": {},
  "Calendar": {},
  "Trades": {},
  "Reports": {},
  "Import": {},
  "Journal": {},
  "Notebook": {},
  "Playbooks": {},
  "Progress": {},
  "MissedTrades": {},
  "PropFirms": {},
  "MarketData": {},
  "Replay": {},
  "AI": {},
  "Validation": {},
  "Errors": {},
  "Accessibility": {}
}
```

按业务域分组，不要建立一个包含几百个扁平 key 的文件。

### 3.2 Key 命名

Key 使用稳定的语义名称，不要使用英文原文作为 key：

```json
{
  "Dashboard": {
    "title": "Dashboard",
    "emptyTitle": "Your journal is empty",
    "loadDemo": "Load demo data",
    "netPnl": "Net P&L"
  }
}
```

禁止：

```json
{
  "Dashboard": {
    "Your journal is empty": "Your journal is empty"
  }
}
```

命名建议：

- `title`：页面或区块标题。
- `description`：说明文字。
- `label`：表单字段或图表字段标签。
- `placeholder`：输入框占位提示。
- `emptyTitle`、`emptyDescription`：空状态。
- `loading`、`saving`、`deleting`、`connecting`：异步状态。
- `saveSuccess`、`deleteSuccess`：成功消息。
- `saveError`、`loadError`：错误消息。
- `aria*`：辅助技术专用文案。
- `tooltip*`、`hint*`：Tooltip 或说明文字。

### 3.3 参数化消息

动态数据必须使用 ICU 参数，不要拼接自然语言字符串：

```json
{
  "Dashboard": {
    "tradeCount": "{count, plural, =0 {No trades} one {# trade} other {# trades}}"
  }
}
```

组件：

```tsx
const t = useTranslations("Dashboard");
return <span>{t("tradeCount", { count: trades.length })}</span>;
```

带多个参数：

```json
{
  "Reports": {
    "groupSummary": "{trades} trades · Win rate {winRate}"
  }
}
```

<!-- prettier-ignore -->
```tsx
 t("groupSummary", { trades: group.trades, winRate: percent(group.winRate) })
```

不要这样写：

<!-- prettier-ignore -->
```tsx
`${count} trades · Win rate ${percent(rate)}`
```

### 3.4 富文本消息

当消息中需要链接、粗体或其他元素时，使用 `t.rich`，不要把 HTML 放入 JSON：

```json
{
  "MarketData": {
    "settingsLink": "Configure this in <settings>Settings → Market data</settings>."
  }
}
```

<!-- prettier-ignore -->
```tsx
const t = useTranslations("MarketData");
return t.rich("settingsLink", {
  settings: (chunks) => <Link href="/settings#market-data">{chunks}</Link>
});
```

## 4. Server Component 和 Client Component 用法

### 4.1 Server Component

服务端页面或组件使用：

```tsx
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("Dashboard");
  return <h1>{t("title")}</h1>;
}
```

不要在 Server Component 中导入 `useTranslations`。

### 4.2 Client Component

带有 `"use client"` 的组件使用：

```tsx
import { useTranslations } from "next-intl";

export function SaveButton() {
  const t = useTranslations("Common");
  return <button>{t("save")}</button>;
}
```

Hooks 必须在组件顶层调用，不得放进回调、条件分支或循环内。

### 4.3 非 React 工具函数

纯工具函数不要直接调用 React Hook。将翻译结果作为参数传入：

```ts
export function describeFilter(filter: Filter, translate: (key: string) => string) {
  return translate("filterLabel");
}
```

或者让工具函数返回稳定的错误码、状态码或枚举，再由组件负责翻译：

```ts
return { code: "missingSymbol" as const };
```

## 5. 页面和组件改造流程

每个 AI 改造一个页面或组件时，必须按以下顺序执行：

1. 阅读整个文件，识别所有用户可见文本，不只搜索 JSX 文本。
2. 识别字符串是否是领域数据、技术标识符或真正的 UI 文案。
3. 为该业务域选择消息命名空间。
4. 为 `en-US.json` 和 `zh-CN.json` 同时增加 key。
5. 在组件中接入 `getTranslations` 或 `useTranslations`。
6. 替换 JSX 文本、属性文本、异步状态、异常提示和确认框。
7. 替换图表配置中的标题、Legend、Tooltip 和 series 名称。
8. 替换 `aria-label`、`title`、`placeholder`、`alt` 和 SVG title。
9. 检查动态字符串是否改为参数化消息。
10. 运行 JSON 校验、类型检查、测试或至少执行 `git diff --check`。
11. 在报告中列出仍未改造的用户可见文本，不得声称“已完成”而遗漏范围。

## 6. 必须改造的文本类型

### 6.1 JSX 文本

<!-- prettier-ignore -->
```tsx
// 错误
<CardTitle>Market data</CardTitle>

// 正确
const t = useTranslations("MarketData");
<CardTitle>{t("title")}</CardTitle>
```

### 6.2 属性文案

```tsx
// 错误
<Input placeholder="Search notes" aria-label="Search notes" />

// 正确
<Input
  placeholder={t("searchPlaceholder")}
  aria-label={t("aria.searchNotes")}
/>
```

以下属性必须检查：

- `aria-label`
- `aria-description`
- `title`
- `placeholder`
- `alt`
- `data-*` 中如果会被用户或测试读取的文案
- Radix 的 `DialogTitle`、`DialogDescription`

### 6.3 状态和异步文案

<!-- prettier-ignore -->
```tsx
// 错误
{busy ? "Importing…" : "Import"}

// 正确
{busy ? t("importing") : t("import")}
```

统一覆盖：

- Loading
- Saving
- Importing
- Connecting
- Deleting
- Restoring
- Previewing
- Empty
- Success
- Error
- Unauthorized
- Retry

### 6.4 错误消息

客户端不要把后端错误直接当作最终展示文案，除非后端已经返回可本地化错误码。

推荐 API 返回：

```json
{
  "error": {
    "code": "invalidTimezone",
    "params": { "field": "timeZone" }
  }
}
```

前端：

<!-- prettier-ignore -->
```tsx
const message = isApiError(error)
  ? t(`errors.${error.code}`, error.params)
  : t("errors.network");
```

短期兼容现有 API 时，可以保留 `error: string`，但新增功能必须优先返回稳定 `code`。不要让服务端根据 Cookie 直接返回翻译后的 UI 文案，因为这会让 API 难以复用和测试。

### 6.5 Confirm 和浏览器原生对话框

禁止直接使用英文原文：

<!-- prettier-ignore -->
```tsx
if (confirm("Delete this note?")) {}
```

优先使用项目已有 Dialog 组件，并将标题、描述、取消、确认全部翻译。如果必须使用 `confirm`，也要使用翻译后的字符串：

<!-- prettier-ignore -->
```tsx
if (window.confirm(t("deleteConfirm"))) {}
```

## 7. 数字、日期和时间格式化规范

国际化改造不能只替换文字。所有用户可见的数字和时间必须与当前 locale 一致。

### 7.1 禁止的写法

<!-- prettier-ignore -->
```tsx
value.toFixed(2)
new Date(value).toLocaleString()
`${amount} USD`
`${percent}%`
```

这些写法会造成语言、货币、小数位和时区不一致。

### 7.2 推荐使用 `next-intl` formatter

```tsx
import { useFormatter, useLocale } from "next-intl";

const format = useFormatter();
const locale = useLocale();

format.number(value, { maximumFractionDigits: 2 });
format.number(rate, { style: "percent", maximumFractionDigits: 2 });
format.dateTime(date, { dateStyle: "medium", timeZone });
```

货币必须显式指定：

```tsx
format.number(amount, {
  style: "currency",
  currency: currencyCode,
  maximumFractionDigits: 2,
});
```

不要假设 `USD`、`USDT`、账户货币或报价货币可以互换。

### 7.3 时间区间和持续时间

交易持续时间、持仓时间、加载耗时等应通过统一 formatter 或消息模板显示。不要在多个组件内重复实现英文 `1h 20m` 拼接规则。

### 7.4 星期和月份

禁止固定数组：

```ts
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
```

使用 `Intl.DateTimeFormat` 根据 locale 生成，或将星期名称放入 `Calendar` 消息命名空间。

## 8. 图表国际化规范

所有图表组件必须检查：

- 图表标题。
- 副标题和说明。
- X/Y 轴名称。
- Tooltip label。
- Legend。
- Series name。
- 空数据提示。
- 隐私模式提示。
- 价格、数量、百分比、货币的格式化。
- 无障碍描述。

图表 series 的内部 ID 不翻译：

<!-- prettier-ignore -->
```ts
const series = {
  id: "netPnl",
  name: t("netPnl")
};
```

不要把翻译后的名称作为业务判断条件：

<!-- prettier-ignore -->
```tsx
// 错误
if (series.name === "Net P&L") {}

// 正确
if (series.id === "netPnl") {}
```

Recharts、ECharts、Vela 的配置对象如果在组件外定义，必须改成工厂函数，以便接收翻译函数和 locale：

```ts
export function buildChartOptions(t: Translator, locale: Locale) {
  return { ... };
}
```

## 9. 表单、枚举和业务术语

枚举的存储值保持稳定，展示值进入字典：

```ts
const directionLabels = {
  long: t("directions.long"),
  short: t("directions.short"),
};
```

不要修改数据库中已有的英文枚举值，也不要将中文写入数据库作为业务状态。

建议统一术语：

| English             | zh-CN 建议   |
| ------------------- | ------------ |
| Execution           | 成交记录     |
| Fill                | 成交         |
| Trade               | 交易         |
| Round trip          | 完整交易周期 |
| Market Replay       | 市场回放     |
| Replay speed        | 回放速度     |
| Step forward        | 前进一根     |
| Slippage            | 滑点         |
| Drawdown            | 回撤         |
| Expectancy          | 期望值       |
| Profit factor       | 盈亏因子     |
| Playbook            | 策略模板     |
| Adherence           | 执行一致性   |
| Missed trade        | 错过的交易   |
| Prop firm           | 交易考核机构 |
| Market data         | 市场数据     |
| Contract multiplier | 合约乘数     |
| MAE                 | 最大不利波动 |
| MFE                 | 最大有利波动 |

如果某个术语存在歧义，应在字典中使用一致翻译，并在 Tooltip 或说明文案中补充解释。

## 10. 组件级特殊规则

### 10.1 UI 基础组件

基础组件通常不应包含业务文案。若必须包含默认文案，例如分页、日期选择器、空状态或关闭按钮：

- 不要在组件内部硬编码英文。
- 通过 props 接收文案，或在组件内部使用对应 namespace。
- `aria-label` 必须翻译。
- 组件 API 的默认值不能依赖某个具体语言。

### 10.2 `FilterBar`

`FilterBar` 的标题、筛选器标签、重置按钮、保存视图、日期范围名称和辅助提示必须翻译。筛选值应保持稳定 ID，展示值使用字典。

### 10.3 `ThemeToggle`、`PrivacyToggle` 和导航

按钮可见文字、Tooltip、`aria-label`、展开/收起状态、暗色/亮色说明都必须翻译。不要只翻译可见文本而遗漏 Tooltip。

### 10.4 `RichEditor`、Markdown 和笔记

编辑器工具栏的 Bold、Italic、Link、Preview、Edit、Attachment 等必须翻译。用户输入的 Markdown 内容不翻译。

### 10.5 导入和 CSV

导入格式名称、字段标签、预览提示、跳过原因、警告和校验错误必须翻译。CSV 原始列名和第三方平台字段名属于数据，不要翻译；在 UI 中可以使用翻译后的字段说明。

### 10.6 AI 相关组件

AI 组件的 UI 文案必须翻译，同时向 AI 服务传递用户选择的 locale，要求模型使用对应语言回答。AI 生成的用户内容不要再次自动翻译。

### 10.7 语音输入

语音识别语言必须根据 locale 设置：

```ts
const speechLanguage = locale === "zh-CN" ? "zh-CN" : "en-US";
```

这属于行为逻辑，不应只翻译按钮。

### 10.8 SVG 和图标

SVG `<title>`、`aria-label` 和图标 Tooltip 必须翻译。品牌 SVG 的品牌名称不翻译，但如果是操作图标，必须提供本地化辅助标签。

## 11. 文件扫描和完成标准

每个改造批次完成后，至少执行以下扫描：

```bash
rg -n '>[[:space:]]*[A-Za-z][^<{]*<' apps/web/src/app apps/web/src/components --glob '*.tsx'
rg -n 'placeholder=|aria-label=|title=|alt=|confirm\(|alert\(' apps/web/src/app apps/web/src/components --glob '*.tsx'
rg -n 'toFixed\(|toLocaleString\(|const weekdays|const months' apps/web/src/app apps/web/src/components --glob '*.{ts,tsx}'
```

扫描结果允许保留以下内容，但必须人工确认：

- 品牌名和产品名。
- 交易品种、账户名和用户输入。
- CSS、SVG path、代码标识符。
- 测试 fixture 中的原始平台文本。

完成标准：

- 两个 locale JSON 的 key 集合完全一致。
- 所有用户可见自然语言都有翻译 key。
- 所有 `aria-label`、`title`、`placeholder`、`alt` 都已检查。
- 所有状态、错误、空状态、成功提示都已检查。
- 所有图表标题、Legend、Tooltip 和 series 名称都已检查。
- 所有日期、数字、货币、百分比和持续时间格式经过 locale 处理。
- 业务枚举的内部值没有被翻译或修改。
- 没有因为语言变化导致按钮、表格、图表或移动端布局溢出。
- `git diff --check` 通过。
- `pnpm --filter web typecheck` 通过。
- 相关测试通过。

## 12. 推荐执行顺序

不要一次让 AI 修改整个仓库。按以下批次执行，便于审查和回滚：

### 批次 1：基础设施

- 完善消息字典类型和 key 对齐检查。
- 建立 `Common`、`Errors`、`Accessibility`、`Validation` 命名空间。
- 建立统一数字、日期、货币和持续时间 formatter。
- 建立 API 错误 code 到翻译消息的映射。

### 批次 2：应用壳和公共组件

- `Shell`、导航、主题、隐私、FilterBar、PageTransition。
- 基础 UI 组件的默认文案、Tooltip、ARIA。
- Loading、Dialog、Select、Calendar、DatePicker。

### 批次 3：首页和交易主流程

- Dashboard。
- Calendar。
- Trades 列表和交易详情。
- Add Trade、手工录入、交易图表。

### 批次 4：导入和市场数据

- Import 页面。
- CSV 预览与错误。
- Broker 连接。
- Market Data Settings。
- Trade Replay 和 Market Replay。

### 批次 5：分析和报告

- Reports。
- Performance Trends。
- Trade Explorer。
- Calendar Insights。
- 所有图表和统计表格。

### 批次 6：笔记与行为工具

- Journal。
- Notebook。
- Playbooks。
- Progress。
- Missed Trades。
- Voice Note。

### 批次 7：AI、Prop Firm 和账户

- AI Settings、Ask Journal、Recap、Critique。
- Prop Firms、现金流水、Prop Dashboard。
- Accounts、Broker Sync。
- Export、Privacy、Login。

### 批次 8：验收和回归

- 双语言逐页人工检查。
- 移动端和桌面端检查。
- 深色和浅色主题检查。
- 空数据、有数据、加载中、错误和权限状态检查。
- 图表 Tooltip 和导出结果检查。

## 13. 给其他 AI 的执行提示词

可以将以下内容作为每次改造任务的基础提示：

```text
请按照 docs/i18n-migration-guide.md 改造指定文件。

要求：
1. 先完整阅读目标文件及其直接依赖。
2. 找出所有用户可见自然语言，包括 JSX、placeholder、title、aria-label、alt、Tooltip、Dialog、Confirm、错误、Loading、空状态、图表配置和导出文案。
3. 使用 next-intl：Server Component 使用 getTranslations，Client Component 使用 useTranslations。
4. 同时更新 apps/web/src/i18n/messages/en-US.json 和 zh-CN.json，确保 key 结构一致。
5. 动态文本使用参数化消息，不要拼接自然语言。
6. 不翻译业务数据、交易品种、数据库枚举值、API 字段名和用户输入。
7. 日期、数字、货币、百分比和持续时间必须按 locale 格式化。
8. 不要覆盖或重写无关用户改动。
9. 完成后运行 git diff --check，并报告仍未改造的用户可见文本。
10. 最终列出修改文件、消息 key、验证结果和已知遗留问题。
```

## 14. 不允许的实现方式

以下方式禁止进入主分支：

- 用 `if (locale === ...)` 散落在组件中替代消息字典。
- 用全局字符串替换批量翻译源码。
- 只修改 `zh-CN.json` 不修改 `en-US.json`。
- 将中文或英文 UI 文案写入数据库业务字段。
- 把翻译后的文本当作业务逻辑判断条件。
- 让 API 根据语言返回难以测试的自然语言错误，而没有稳定错误码。
- 用 `toFixed`、字符串拼接或固定星期数组替代本地化格式化。
- 忽略 `aria-label`、placeholder、Tooltip 和图表文案。
- 为了国际化重写无关业务逻辑或修改数据模型。
- 未完成类型检查或 diff 检查就声称该页面已完成国际化。

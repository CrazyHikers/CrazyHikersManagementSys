# 520 相亲徒步活动 — 设计文档

**日期**：2026-05-14
**活动日**：2026-05-20
**作者**：Shuhao Li（CrazyHikers）

## 1. 背景与目标

5 月 20 日（"520"）社团举办一次**相亲主题的徒步活动**。相比常规徒步活动，这次有两个特殊之处：

1. **报名表的字段更多**——20 道问卷题（基本信息、个性标签、自我介绍、对另一半的期待、生活照等），用于让领队和参与者之间相互了解。
2. **需要一个有记忆点的视觉**——常规活动详情页过于普通，希望在视觉上突出"520+徒步+相亲"的氛围。

但社团不做主动撮合：报名审批的目标只是**保证男女比例和年龄段相对均衡**，由领队按现有的"确认报名"流程审批。

## 2. 非目标（Out of Scope）

- 不做自动或人工"一对一匹配"。
- 不为该活动新建独立的用户角色 / 权限。
- 不把问卷答案写回用户 profile（这些字段属于相亲场景，不适合污染常规徒步资料）。
- 不实现表单的可视化 builder（管理员后台动态加字段）；这是单次活动，模板写死即可。

## 3. 架构概览

利用已有数据模型即可，无需 schema 迁移：

- `Activity.metadata`（JSON）新增两个键：
  - `template: "matchmaking_520"` —— 路由分流的标记
  - `slug: "520"` —— `/events/<slug>` 别名重定向的目标
- `Registration.formData`（JSON）存储 20 道问卷答案 + 上传照片的 R2 key

服务端入口 `src/app/[locale]/activities/[id]/page.tsx` 增加 template 分支：

```ts
const template = (activity.metadata as Record<string, unknown> | null)?.template;
if (template === "matchmaking_520") {
  return <Matchmaking520Landing activity={activity} ... />;
}
// fallback: 现有徒步详情布局
```

通用别名页面 `src/app/[locale]/events/[slug]/page.tsx`：按 `metadata.slug` 查活动，`redirect()` 到 `/activities/<id>`。

## 4. 数据契约

### Activity.metadata（用于这次活动）

```json
{
  "template": "matchmaking_520",
  "slug": "520",
  "privacyNotice": "您的个人信息将仅用于本次活动的组织和服务..."
}
```

### Registration.formData（每个报名者的问卷答卷）

```ts
type Matchmaking520FormData = {
  name: string;                   // Q1
  gender: "male" | "female";      // Q2
  orientation: "same" | "opposite"; // Q3
  birthYearMonth: string;         // Q4  "YYYY-MM"
  constellation: string;          // Q5
  mbti: string;                   // Q6  free-text, 大写化
  hometown: string;               // Q7
  school: string;                 // Q8
  major: string;                  // Q9
  stage: "bachelor" | "master" | "phd" | "working" | "other"; // Q10
  currentCity: string;            // Q11
  heightCm: number;               // Q12
  weightKg: number;               // Q13
  hobbies: string;                // Q14
  selfIntro: string;              // Q15
  expectations: string;           // Q16
  wechat: string;                 // Q17
  inSwitzerland: boolean;         // Q18
  photoKey: string;               // Q19 R2 object key（图片）
  interestedActivities: Array<
    "hiking" | "boardgame_offline" | "online_cp_match" | "boardgame_online"
  >;                              // Q20
  consent: true;                  // 隐私同意勾选
};
```

字段命名沿用已有 profile 的 camelCase 习惯（参考 `src/lib/profile.ts`）。

## 5. 路由

| 路径 | 作用 |
|------|------|
| `/<locale>/activities/<id>` | 主入口，按 `metadata.template` 分流到 `Matchmaking520Landing` |
| `/<locale>/events/<slug>` | 通用别名重定向，按 `metadata.slug` 查活动后 `redirect()` 到上面 |

为方便分享，对外推广的链接走 `/events/520`（更易记），最终落到同一个活动详情。

## 6. UI / UX 设计

### 6.1 着陆页（`Matchmaking520Landing`）

公开可见，未登录用户也能看到全部信息。

- **Hero 区**：山形剪影 + 心形组合图（SVG 内嵌），玫红→日落橙渐变背景；标题"5.20 一起徒步，遇见 TA"；副标题简介
- **隐私声明卡**：直接展示 `metadata.privacyNotice`，紧跟 Hero
- **活动基本信息**：日期、地点（取自 Activity.title/description）、报名截止、容量、领队（复用现有 Activity 字段）
- **流程说明卡**：3 步图标——填写问卷 → 等待领队确认 → 5/20 见面
- **行动按钮**：粘性底栏（移动端）/ Hero 内大按钮（PC）"立即报名"——根据用户登录状态走对应路径（未登录走 signin → 回跳；已登录直接进 wizard）
- **装饰**：浮动小桃心、淡色山形纹理；深色模式下用更柔的玫红和深绿
- **状态分支**：
  - 已报名 → 按钮变"查看我的报名"
  - 已截止/已满 → 按钮 disabled + 文案
  - 已登录但 profile 不完整 / 缺免责声明 → 走现有"补完资料"流程后再来

### 6.2 报名向导（`Matchmaking520Wizard`）

5 步表单，顶部进度条 + 步骤指示器：

| 步 | 标题 | 字段 |
|---|------|------|
| 1 | 基本信息 | Q1 姓名（user.name 预填可改）、Q2 性别（预填）、Q3 取向、Q4 出生年月、Q18 是否在瑞士 |
| 2 | 个性标签 | Q5 星座、Q6 MBTI、Q12 身高、Q13 体重 |
| 3 | 背景 | Q7 家乡、Q8 学校、Q9 专业、Q10 阶段、Q11 当前城市 |
| 4 | 自我介绍 | Q14 兴趣、Q15 自我介绍、Q16 期待的 TA、Q20 想参加的活动（多选） |
| 5 | 联系方式 & 照片 | Q17 微信、Q19 生活照、隐私同意勾选、提交 |

- 移动端单列；PC 端最大宽度 ~640px 居中
- 每步本地校验完成才能"下一步"
- 上一步保留已填内容
- 照片走现有 [`/api/upload`](src/app/api/upload/route.ts) presigned URL 流程，上传成功后存 R2 key 到 `formData.photoKey`，UI 上显示缩略图预览
- 提交成功后跳转到"报名成功"小页（撒花动画 + 后续说明）

### 6.3 通用前置校验（与现有保持一致）

- 未登录：进 wizard 时跳 signin，回跳到 wizard
- profile 不完整：跳 my-profile 补完
- 缺免责声明：内嵌签署流程（沿用 `WaiverSignInline`）
- 同日已有确认活动：拒绝（已有逻辑）

### 6.4 提交后的状态视图

复用现有 `RegistrationForm` 的状态视图（pending / confirmed），但封装在 matchmaking 主题里：

- pending（registered）：徽章"等待确认" + 撤回按钮（截止前）
- confirmed：徽章"已确认" + 提示"5/20 见！"
- 显示用户填写的问卷概览，可点开查看 / 编辑（编辑能力可选，先只读以减少复杂度）

## 7. 领队管理端

### 7.1 平衡看板（`BalanceCard`）

报名管理页（`registration-manager.tsx`）顶部新增一张小卡片，**仅在 template === "matchmaking_520" 时显示**：

- **性别分布**：男 X / 女 Y（已确认 / 待确认 / 总计）
- **年龄段分布**：根据 `formData.birthYearMonth` 计算当前年龄，分桶 `<=22 / 23-26 / 27-30 / 31+`，每桶按性别拆色显示
- 数据从 `registrations` 中聚合，不需要新增 API 端点（在现有报名列表页 server-side 聚合即可）

### 7.2 问卷查看抽屉

报名列表行上加"查看问卷"按钮 → 抽屉/对话框展示该报名者完整的 20 项答卷 + 照片缩略图（点击放大）。仅在 matchmaking 模板下显示该按钮。

### 7.3 审批流

完全沿用现有 `confirm/reject/withdraw` 流程，不新增逻辑。

## 8. 国际化（i18n）

- 中文为主要受众，英文同步翻译，避免上线后报错
- 命名空间 `events.matchmaking520.*`
  - `landing.title`、`landing.subtitle`、`landing.privacyNotice`、`landing.cta` 等
  - `wizard.step1.title`、`wizard.fields.<key>.label`、`wizard.fields.<key>.placeholder`
  - `wizard.options.gender.male` / `female`，`wizard.options.orientation.same` / `opposite`，`wizard.options.stage.*`，`wizard.options.interested.*`
- 选项 enum 值（如 `bachelor`、`same`）在存储和翻译键里保持英文，UI 显示走 i18n 查表

## 9. 字段验证

后端 `POST /api/activities/[id]/register/route.ts` 在 template === "matchmaking_520" 时加最小校验：

- 所有必填字段非空
- `gender`、`orientation`、`stage`、`interestedActivities` 必须在白名单
- `heightCm` ∈ [100, 250]，`weightKg` ∈ [30, 200]
- `birthYearMonth` 匹配 `^\d{4}-\d{2}$` 且年份 ∈ [1950, 当前年]
- `photoKey` 存在并以图片扩展名结尾
- 失败时返回 400 + 具体字段错误

前端 wizard 在每步本地校验，但服务端必须独立校验（前端可绕过）。

## 10. 文件清单（实现时新增/修改）

**新增**：
- `src/components/events/matchmaking-520/Matchmaking520Landing.tsx`
- `src/components/events/matchmaking-520/Matchmaking520Wizard.tsx`
- `src/components/events/matchmaking-520/steps/Step1Basic.tsx` … `Step5Contact.tsx`
- `src/components/events/matchmaking-520/BalanceCard.tsx`
- `src/components/events/matchmaking-520/AnswersDrawer.tsx`
- `src/components/events/matchmaking-520/theme.ts` —— 颜色/图形常量
- `src/app/[locale]/events/[slug]/page.tsx` —— 别名重定向
- `src/lib/events/matchmaking-520.ts` —— 类型定义 + 校验

**修改**：
- `src/app/[locale]/activities/[id]/page.tsx` —— template 分流
- `src/components/dashboard/registration-manager.tsx` —— 接入 BalanceCard 和 AnswersDrawer
- `src/app/api/activities/[id]/register/route.ts` —— matchmaking 模板特化校验
- `messages/zh.json`、`messages/en.json` —— 加 `events.matchmaking520` 命名空间

## 11. 实施节奏（6 天）

| 日 | 任务 |
|----|------|
| D1 (5/15) | 在 DB 中创建活动并写入 metadata、写 alias 重定向、着陆页骨架、template 分流 |
| D2 (5/16) | Wizard 步骤 1-3 + 字段绑定 + i18n 中文 |
| D3 (5/17) | Wizard 步骤 4-5 + 照片上传 + 提交流程 + 服务端校验 |
| D4 (5/18) | 领队端 BalanceCard + AnswersDrawer + 报名确认邮件文案 |
| D5 (5/19) | 视觉打磨、深色模式、移动端 QA、英文翻译 |
| D6 (5/20) | 当日热修预留（应该已上线） |

## 12. 风险与权衡

- **6 天 + 单次活动**：UI 不追求完美的高保真插画，用 Tailwind + 一两张 SVG 装饰即可，做到"明显比常规活动特别"就达标。
- **照片审核**：未做自动审核，依赖管理员人工筛查（与免责声明审核同流程）。
- **隐私**：微信号 + 照片为敏感信息，仅本人和领队可见。生活照走 R2 私有桶 + presigned URL，不公开 list。
- **模板机制的复用**：本次只验证"按 template 分流"的可行性，未来真的有第 2 个特殊活动再抽象成 registry/约定即可，避免过早抽象。

## 13. 后续可演进点（不在本次范围）

- 让管理员可在 admin 后台手动标记任意活动为 matchmaking 模板
- 模板注册表（templateRegistry）抽象，方便加新模板
- 报名者之间互看（在用户同意的前提下，活动结束后开放查看其他参与者卡片）

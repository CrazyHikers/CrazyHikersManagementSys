# 会员投票、自动结算与 Promotion 接入 — 设计文档

**初版日期**：2026-07-16

**扩展日期**：2026-07-17

## 1. 背景与目标

Crazy Hikers 需要一套统一的内部投票能力，用于政策决议、结构化 feedback 和领队晋升投票。管理员可以设置参与身份、截止时间、匿名或记名、选项与反馈策略；系统也可以代表 promotion 流程自动发起指定投票人名单的投票。

普通单选投票关闭后只提供结果，不替管理员自动作出政策决议。赞成/反对型投票可以选择启用自动结算，并通过最低参与比例与最低赞同比例判定 `passed`、`rejected` 或 `no_quorum`。Promotion 使用同一结算引擎，但通过后仍须管理员最终复核，系统不会仅凭投票直接修改身份。

## 2. 成功标准

- admin/dev 可以创建、编辑和发布普通单选或赞成/反对投票。
- scope 支持 `会员+`、`见习领队+`、`正式领队+` 和 `管理员`。
- 投票支持动态 role scope 或固定投票人名单。
- 投票默认匿名；管理员可以改为记名，页面必须明确展示身份模式。
- 匿名 ballot 不保存身份关联；记名 ballot 的成员、选择和 feedback 只在关闭后向 admin/dev 展示。
- 赞成/反对投票可以配置 feedback 策略和自动结算门槛。
- Promotion 新申请由 system 创建统一投票，不再创建 `PromotionVote` 或发送投票邀请邮件。
- 开放期间只显示参与人数，不向任何角色提前返回选择分布或 feedback。
- 所有选票不可修改；deadline 后停止收票。
- 发布通知只通过已配置的 Web Push、Telegram 和 Discord 各尝试一次，不重试。

## 3. 非目标

- 不提供弃权、改票、撤票、重新打开或预约开始。
- 不实现密码学匿名；数据库超级管理员仍可能通过基础设施日志进行取证。
- 不自动分析、合并、分类或审核自由文本。
- 不允许普通单选投票自动判定胜出方案。
- 不把投票引擎扩展成任意业务可注册回调的通用工作流框架；本期只接入 promotion。
- 不为旧 `PromotionVote` 数据提供迁移或兼容路径；当前没有进行中的 promotion 投票。
- 不为 promotion 的“零符合条件投票人”增加专门分支；现有业务约束保证名单非空。

## 4. 身份层级与投票资格

用户主角色仍为 `member | manager | admin | dev`。见习与正式领队通过 `ManagerProfile.intern` 区分，因此投票鉴权上下文必须包含 `role + isIntern`，不能只看 `role`。

| scope | 可查看和投票的当前身份 |
|---|---|
| `member_plus`（会员+） | member、见习领队、正式领队、admin、dev |
| `intern_manager_plus`（见习领队+） | 见习领队、正式领队、admin、dev |
| `qualified_manager_plus`（正式领队+） | 正式领队、admin、dev |
| `admin`（管理员） | admin、dev |

role scope 不做发布时快照。列表、详情、投票和结算人数均按当时身份判断；身份变化不会删除已经写入的选票。对于 promotion 等固定名单投票，资格来自发起时写入的 electorate，不随之后的身份变化而改变。

admin/dev 可以管理和查看所有投票，但固定名单投票中只有 electorate 成员可以投票。客户端隐藏按钮只改善体验，所有资格检查在服务端重复执行。

## 5. 投票类型、身份模式与 feedback

### 5.1 投票类型

- `choice`：2–10 个自定义单选项，可启用“其它”自由文本答案，不支持自动结算。
- `approval`：固定的赞成与反对语义，可自定义显示文案，允许配置 feedback 和自动结算。

赞成与反对必须使用稳定的内部 key，而不能通过显示文字猜测语义。这样中英文文案变化不会影响统计。

### 5.2 身份模式

- `anonymous = true`：默认。ballot 不保存 voter、投票时间或可与 participation 关联的标识。
- `anonymous = false`：记名。ballot 保存 voterEmail，供管理员在关闭后查看明细。

列表、详情、确认区和管理页都必须明确标注“匿名投票”或“记名投票”。开放期间 admin/dev 也不能查看选择与 voter 的对应关系。

### 5.3 Feedback 策略

赞成/反对投票支持：

- `disabled`
- `optional`
- `required_on_reject`
- `required`

feedback 是对赞成或反对选择的补充，不复用“其它”选项。长度上限 1,000 字，作为纯文本渲染。

关闭后普通参与者只看汇总，不看其他人的 feedback。管理员可以查看 feedback；记名投票中可同时看到 voter 与选择，匿名投票中只能看到无法归属到成员的 feedback。Promotion 被拒绝时，反对理由会去除投票人身份后反馈给申请人。

## 6. 数据模型

### 6.1 Poll

核心字段：

- `id`, `title`, `description`
- `kind`: `choice | approval`
- `status`: `draft | open | closed`
- `audienceMode`: `role_scope | explicit_list`
- `scope`: role scope 时必填，固定名单时为空
- `anonymous`: 默认 true
- `allowOther`: 仅 choice 使用
- `feedbackPolicy`: approval 使用
- `creatorType`: `admin | system`
- `createdByEmail`: admin 时必填，system 时为空
- `deadline`, `publishedAt`, `closedAt`
- `autoSettle`
- `minimumParticipationBps`, `minimumApprovalBps`
- `outcome`: `passed | rejected | no_quorum | null`
- `settledAt`
- `createdAt`, `updatedAt`

门槛使用 basis points（0–10,000）保存，UI 以 0–100% 展示并允许一位小数。数据库约束保证 creator、audience 和自动结算字段组合合法。system poll 创建后直接开放并锁定。

### 6.2 PollOption

- `id`, `pollId`, `label`, `sortOrder`
- `semanticKey`: approval 使用 `approve | reject`，choice 为空

choice 有 2–10 项；approval 恰好两项且 semanticKey 唯一。

### 6.3 PollElectorate

- `pollId`
- `voterEmail`
- `createdAt`

`(pollId, voterEmail)` 唯一。只用于 `explicit_list`；role scope 不写资格快照。

### 6.4 PollParticipation

- `pollId`
- `voterEmail`
- `votedAt`

`(pollId, voterEmail)` 唯一，负责一人一票和参与人数。管理员开放期间的参与名单只从此表读取。

### 6.5 PollBallot

- `id`, `pollId`
- `optionId` 或 `otherText`，二者恰好一个
- `feedback`
- `voterEmail`，只允许记名投票填写

匿名投票不保存 voterEmail 或 votedAt，也不与 participation 建立外键或共享标识。记名投票有意保存 voterEmail，并以数据库唯一约束保证一人一张 ballot。服务端和数据库约束共同保证匿名/记名与选项字段组合正确。

### 6.6 PromotionRequest

保留现有申请、资格和管理员复核字段，新增唯一 `pollId` 关联。删除 `PromotionVote` 模型和 token 投票页面/API。当前没有进行中的 promotion 投票，因此不迁移旧记录。

### 6.7 AuditLog

记录投票创建、编辑、发布、deadline 延长、提前关闭和结算，但不记录匿名 ballot 内容。system 操作用明确的 actor 类型表示，不创建虚假用户。

## 7. 写入事务与匿名边界

提交选票在同一事务中：

1. 读取投票并校验 audience、状态、deadline、选项和 feedback。
2. 创建 `PollParticipation`。
3. 创建 ballot；匿名模式省略 voterEmail，记名模式填写 voterEmail。
4. 如果固定名单已全员投票且开启自动结算，尝试幂等结算。

任一步失败则回滚。匿名模式下应用代码不得构造同时含 participation 身份和 ballot 内容的对象。记名明细使用独立的 admin-only 查询，并且只在关闭后开放。

Promotion 申请创建时，在同一事务写入 `PromotionRequest + Poll + options + electorate`，避免出现申请没有投票或投票没有业务来源。

## 8. 生命周期与修改规则

### Draft

- 仅 admin/dev 可见。
- 管理员 poll 可编辑全部配置。
- system poll 不经过可编辑草稿状态。

### Open

- 发布后内容、身份模式、受众、选项、feedback 和结算条件全部锁定。
- 管理员创建的 poll 可延长 deadline 或提前关闭。
- system promotion poll 只允许管理员查看，不允许编辑、延长或提前关闭。
- 所有人只看到参与人数；管理员可看 participation 名单，但不能看选择、票数或 feedback。

### Closed

- deadline、允许的管理员提前关闭或自动结算使投票关闭。
- 拒绝新 ballot，不能重新打开。
- scope 或 electorate 内用户看汇总结果。
- admin/dev 可查看参与名单；记名投票可额外查看成员、选择和 feedback 明细。

## 9. 自动结算

自动结算仅适用于 approval。至少一张有效票是所有自动结算的隐含条件。

- `participationRatio = participationCount / eligibleCount`
- `approvalRatio = approveCount / castBallotCount`
- 两项均达到配置门槛：`passed`
- 至少一票且参与门槛达到、赞成门槛未达到：`rejected`
- 零票或参与门槛未达到：`no_quorum`

比较使用 `>=`。role scope 的 eligibleCount 按结算时当前身份查询；explicit list 使用固定 electorate 数量。

结算触发：

- 固定名单或 role scope 的所有当前合格用户都已投票时提前结算。
- deadline 到达后由 cron 结算。
- 管理员提前关闭自己创建的 poll 时立即结算。

结算服务使用事务和 outcome 为空的条件更新保证幂等；并发的最后几张 ballot、cron 和关闭请求只能产生一次业务回写。非自动结算 approval 关闭后 outcome 保持 null，由管理员线下决定。

## 10. Promotion 接入

### 会员 → 见习领队

- system 创建、记名、approval、explicit list。
- electorate 是申请人指定的正式领队推荐人。
- feedback 为 `required_on_reject`。
- 最低参与率 100%，最低赞成率 100%。

### 见习领队 → 正式领队

- system 创建、记名、approval、explicit list。
- electorate 是发起时所有正式领队，排除申请人。
- feedback 为 `required_on_reject`。
- 引擎至少需要一票；最低赞成比例沿用 `promotion_vote_approval_ratio` 设置。

### 结果映射

- `passed` → `pending_admin_review`
- `rejected` → `rejected`
- `no_quorum` → `expired`

通过不会直接更改用户角色。管理员沿用现有复核接口最终批准或拒绝；批准后才创建/更新 ManagerProfile。拒绝时向申请人提供去身份化的反对 feedback。

新流程不发送 promotion 投票邀请邮件。指定投票人通过统一非邮件通知和 dashboard 获知投票。现有申请最终结果通知保留，属于 promotion 结果通知而不是 poll 发布通知。

## 11. 页面与交互

### 列表和详情

共同会员导航保留“投票”。role scope 按当前身份过滤，固定名单只返回给 electorate；admin/dev 可查看全部。卡片显示投票类型、受众、deadline、参与人数、身份模式和结算状态。

详情页在提交前明确提示：

- 是否记名。
- 选票不可修改。
- feedback 是否必填以及可见范围。

approval 显示赞成/反对与 feedback；choice 保持自定义选项和可选“其它”。关闭后普通用户看汇总和 outcome，不看记名明细或其他人的 feedback。

Promotion 投票详情还显示申请人、晋升类型、申请文字以及出席、主领和副领活动统计。

### 管理员创建与管理

创建页增加：

- 新的四级 scope。
- choice / approval 类型。
- 匿名 / 记名，默认匿名。
- approval feedback 策略。
- approval 自动结算开关与两个比例输入。

表单根据类型条件显示字段，非法组合不能提交。管理页开放期间仍只显示参与名单；关闭后显示汇总、outcome、门槛，以及记名投票的 admin-only 明细。

system poll 显示“System 发起”并禁用编辑、延长和提前关闭操作。

## 12. API 与服务边界

核心规则继续集中在 `src/lib/polls/`：

- actor 身份与 scope 判断。
- role scope 与 electorate 资格解析。
- 投票输入、feedback 和配置校验。
- 匿名/记名 ballot 事务。
- 结果聚合和 admin-only 记名明细。
- 幂等自动结算。
- promotion 创建适配器和结果回写。
- 按 role scope 或 electorate 选择通知受众。

现有 poll API 保留，并增加或扩展：

| 方法与路径 | 作用 |
|---|---|
| `POST /api/polls` | 创建含身份、feedback 与结算配置的草稿 |
| `POST /api/polls/<id>/vote` | 提交 choice 或 approval ballot |
| `POST /api/polls/<id>/close` | 关闭管理员 poll，并在需要时结算 |
| `GET /api/polls/<id>/participants` | admin/dev 查看参与名单 |
| `GET /api/polls/<id>/named-ballots` | admin/dev 在关闭后查看记名明细 |
| `POST /api/cron/polls` | 结算所有到期且尚未结算的自动投票 |

Promotion 申请 API 改为创建 system poll；删除 `/api/promotions/vote/<token>` 与对应页面。错误类别保持稳定：401 未登录、403 越权、404 不存在、409 重复/状态冲突、400 配置或输入错误。

## 13. 校验规则

- title：1–120 字；description 最多 4,000 字。
- choice：2–10 个唯一选项，每项 1–200 字。
- approval：恰好 approve/reject 两项。
- “其它”：仅 choice 且 allowOther 为 true，1–500 字。
- feedback：按策略校验，最多 1,000 字。
- deadline：发布时晚于当前时间；仅管理员 poll 可延长且必须严格变晚。
- 自动结算：只允许 approval；两个门槛均为 0–10,000 basis points。
- role scope 必须有 scope 且无 electorate；explicit list 必须无 scope。
- system creator 无 createdByEmail；admin creator 必须有邮箱。
- ballot option 必须属于当前 poll，且一张 ballot 只能表达一个选择。

所有客户端校验在服务端重复执行。

## 14. 通知

普通管理员投票发布后，根据 role scope 或 electorate 查询受众。Promotion system poll 创建并开放后通知固定 electorate。

- Web Push、Telegram、Discord 各尝试一次。
- 尊重 `poll_published` 偏好。
- 不发送投票邀请邮件。
- 不重试，不建立队列。
- 失败写日志，不撤销发布或申请创建。

Promotion 的既有最终结果通知保留；其不属于投票邀请通知。

## 15. 国际化与可访问性

- 中英文提供 scope、投票类型、匿名/记名、feedback 策略、门槛和 outcome 文案。
- 日期以 UTC 存储，按 locale 与用户时区显示。
- 使用原生 radio、label 和可访问的错误描述。
- 身份模式、状态和 outcome 不只依靠颜色。
- 记名确认和必填 feedback 对屏幕阅读器可感知。
- 移动端保持单列和可操作的比例输入。

## 16. 测试策略

### 领域与数据

- 四级 scope 对 member、见习领队、正式领队、admin、dev 的完整矩阵。
- role scope 动态身份和 explicit electorate 固定资格。
- anonymous ballot 无身份字段；named ballot 保存身份且只允许管理员关闭后读取。
- feedback 四种策略、长度和纯文本边界。
- choice/approval 配置组合与 semanticKey。
- 门槛边界、零票、`passed/rejected/no_quorum`。
- 并发最后一票、cron 和提前关闭的幂等性。

### 服务与接口

- 开放期间任何响应都不含票数、选择或 feedback。
- system poll 禁止管理员编辑、延长或提前关闭。
- role scope 与固定名单投票、重复投票和 deadline 检查。
- 记名明细端点只对 admin/dev 且只在关闭后开放。
- 两种 promotion 创建正确的 system poll、electorate 和门槛。
- poll outcome 正确映射到 promotion 状态，最终角色修改仍需管理员复核。
- 发布通知一次、无邮件、失败不重试。

### 页面

- 新 scope、类型、身份模式、feedback 和自动结算条件表单。
- 匿名/记名提示和确认文案。
- promotion 上下文、feedback 提交和结果展示。
- 管理员关闭后的记名明细，普通参与者不可见。
- system poll 管理动作禁用。

完成前运行相关测试、ESLint、TypeScript、Prisma validate/generate 和生产构建。

## 17. 风险与权衡

- **应用层匿名**：匿名 ballot 与 participation 分离，足以阻止应用查询关联，但不是加密投票。
- **同表支持两种身份模式**：记名 voterEmail 可空增加约束复杂度，但避免维护两套 ballot 和统计实现。
- **动态 role scope**：资格符合当前身份语义，但结算分母会随身份变化；promotion 使用固定 electorate 避免该问题。
- **自动结算并发**：集中幂等服务和条件更新增加实现成本，但避免重复业务回写。
- **直接移除旧 PromotionVote**：实现更干净；基于当前没有进行中投票的已确认前提，不提供兼容路径。
- **无邀请邮件**：降低触达冗余和邮件依赖，接受用户依赖 dashboard 与其它线下通知的运营选择。

## 18. 预期文件边界

- `prisma/schema.prisma` 与 poll migration：新枚举、字段、electorate、promotion 关联并移除 PromotionVote。
- `src/lib/polls/`：身份、资格、feedback、匿名/记名、聚合和结算。
- `src/lib/promotions/` 或聚焦服务：申请创建、poll 配置和结果映射。
- `src/app/api/polls/`、`src/app/api/cron/polls/`：薄路由。
- `src/app/api/promotions/`：改用 system poll，删除 token vote 路由。
- `src/app/[locale]/dashboard/polls/`：统一列表、详情和管理体验。
- 删除 `src/app/[locale]/promotions/vote/[token]/`。
- `src/lib/notify/` 与通知设置：按 role scope 或 electorate 分发。
- `src/messages/en.json`、`src/messages/zh.json`：完整双语文案。
- 对应领域、服务、API 和组件测试。

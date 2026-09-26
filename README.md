# FitPlan · 个性化健身计划

移动端优先的 Web App，**离线可用、可添加到手机桌面**。录入身体数据 + 健身房器械 → 生成本地规则引擎驱动的周训练计划 → 训练后提交反馈 → 自动调整下周计划。

- 无后端、无账号体系，全部数据存 `localStorage`
- 计划生成与渐进超负荷均为**纯函数**，不发起任何网络请求
- 技术栈：React 18 + TypeScript + Vite 5 + Tailwind CSS 3

---

## 一、页面结构

```
首次进入
  └─ 免责声明页（必须勾选同意）           src/components/DisclaimerGate.tsx
       └─ 建档向导（5 步）                src/components/Onboarding.tsx
            1 身体数据     身高/体重/年龄/性别
            2 经验与目标   新手/初级/中级 × 增肌/减脂/增力/塑形/保持健康
            3 可投入时间   每周 1–6 天 × 30/45/60/90 分钟 × 伤病禁忌
            4 训练节奏     连着练 / 练一休一 / 练二休一 / 自定义星期
                          + 每周有氧日（可多选）+ 器械偏好（自由重量 / 固定器械 / 不限）
                          + 训练容量（每次动作数 / 每个动作组数 / 每组次数，可固定也可自动）
                          + 部位侧重（每个部位：正常 / 少练 / 加强 / 不练）
            5 选择器械     分类勾选 + 搜索 + 自定义新增
            └─ 生成计划（4 周中周期）

主界面（底部 Tab）                        src/App.tsx + src/components/BottomNav.tsx
  ├─ 计划  src/pages/PlanPage.tsx
  │    周切换（第 1–4 周，第 4 周为减负周）
  │    训练日卡片：热身 → 主体动作 → 放松拉伸
  │    每个动作：组数 × 次数 / 建议重量 / 组间休息 / 动作要领
  │    每个动作可「改」（组数 / 每组次数 / 建议重量 / 组间休息）或「换一个」/ 删除
  │    训练模板库：套用现成计划（动作、组数、次数、重量百分比已排好，可自由改）
  │    「开始这次训练」→ 跳转训练页
  ├─ 训练  src/pages/TrainPage.tsx
  │    今日训练卡片 / 自由训练
  │    大字体大按钮逐组记录：实际重量、实际次数、勾选完成
  │    组间休息倒计时（勾选一组后自动弹出，可跳过）
  │    完成训练 → 反馈表单（约 30 秒）→ 立即输出本次小结 + 下次调整说明
  ├─ 记录  src/pages/RecordsPage.tsx
  │    累计训练次数 / 时长 / 平均时长
  │    本周完成率（环形）
  │    近 8 周训练次数柱状图
  │    体重趋势折线
  │    各动作历史重量曲线（可切换动作）+ 1RM 估算
  └─ 我的  src/pages/MePage.tsx
       身体档案编辑、器械编辑、体重记录
       训练偏好编辑（节奏 / 有氧日 / 容量 / 部位侧重 / 器械偏好）
       安装到手机桌面指引（独立 App 模式下自动识别）
       外观（浅色/深色）、中周期周数
       数据导出 / 导入 / 清空
       常驻免责声明
```

目录：

```
src/
├─ types/index.ts          数据模型（全部实体）
├─ data/equipment.ts       预置器械库（49 项）= 基础 23 + 扩充 26
├─ data/equipment-extra.ts 扩充器械（史密斯机 / 哈克深蹲 / 楼梯机 / TRX 等）
├─ data/exercises.ts       预置动作库（144 个）+ 热身/放松池
├─ data/exercises-extra.ts 扩充动作（与扩充器械一一对应）
├─ data/templates.ts       训练模板库（薄肌训练法三阶段）
├─ engine/                 纯函数规则引擎
│   ├─ load.ts             起始重量估算 / 取整 / 递进步长 / Epley 1RM
│   ├─ prescription.ts     组数·次数·组间休息（按目标 + 经验）
│   ├─ split.ts            分化方式 + 训练节奏 → 每周训练日
│   ├─ alternatives.ts     器械约束 / 伤病过滤 / 替代动作
│   ├─ generate.ts         计划生成（4 周中周期）
│   ├─ template.ts         训练模板 → 完整计划（百分比重量换算 / 器械补齐）
│   └─ progression.ts      渐进超负荷 + 反馈驱动调整
├─ store/                  reducer + Context + localStorage 持久化
├─ components/             UI 组件（含 SVG 图表、器械选择、反馈表单）
├─ pages/                  四个 Tab 页面
└─ lib/                    工具函数与中文文案
```

---

## 二、数据模型（`src/types/index.ts`）

| 实体 | 关键字段 |
| --- | --- |
| **User** | `id`、`createdAt`、`disclaimerAcceptedAt`、`onboarded` |
| **Profile** | `heightCm`、`weightKg`、`age`、`gender`、`experience`、`goal`、`daysPerWeek`(1–6)、`sessionMinutes`(30/45/60/90)、`injuries: BodyRegion[]`、`medicalFlags`、`weightLogs: WeightLog[]`、`trainingRhythm`、`customWeekdays`、`cardioWeekdays`、`equipmentPreference`、`muscleEmphasis`(正常/少练/加强/不练)、`volume`(每次动作数/组数/次数) |
| **WeightLog** | `id`、`date`、`kg` |
| **Equipment** | `id`、`name`、`category`(自由/固定/有氧/自重)、`weightRange?`、`custom` |
| **Exercise** | `id`、`name`、`equipmentId`（硬约束）、`muscleGroup`、`secondaryMuscles`、`pattern`、`level`、`compound`、`unilateral`、`riskRegions`、`loadType`、`loadFactor`、`cues`、`restSeconds`、`alternatives`、`isCustom` |
| **Plan** | `id`、`userId`、`splitName`、`mesocycleWeeks`、`startDate`、`weeks: PlanWeek[]` |
| **PlanWeek** | `id`、`planId`、`weekNumber`、`isDeload`、`sessions: PlanSession[]` |
| **PlanSession** | `id`、`weekId`、`index`、`weekday`、`title`、`focus`、`estimatedMinutes`、`warmup[]`、`exercises[]`、`cooldown[]`、`status` |
| **PlanExercise** | `id`、`exerciseId`、`kind`、`order`、`sets`、`reps`、`restSeconds`、`suggestedWeightKg`、`cues`、`reason` |
| **WorkoutSet** | `id`、`sessionId`、`exerciseId`、`setIndex`、`targetReps`、`reps`、`weightKg`、`done` |
| **WorkoutSession** | `id`、`userId`、`planId?`、`planSessionId?`、`date`、`startedAt`、`finishedAt?`、`title`、`durationMinutes?`、`sets[]`、`feedback?`、`status` |
| **Feedback** | `id`、`sessionId`、`rpe`(1–10)、`completion`(全部/部分/未完成)、`fatigueRegions`、`pain?{region,level}`、`actualMinutes`、`note?`、`adjustments[]`、`advice[]` |
| **Adjustment** | `exerciseId`、`fromWeightKg/toWeightKg`、`fromReps/toReps`、`action`(increase/maintain/decrease/rest)、`reason` |
| **ExerciseProgress** | `exerciseId`、`history: ExerciseRecord[]`、`currentWeightKg`、`currentReps`、`easyStreak`、`restUntil?` |

---

## 三、规则引擎要点

**分化方式（按每周可训练天数）**
1–2 天 → 全身分化；3 天 → 推/拉/腿；4 天 → 上肢/下肢；5–6 天 → 推/拉/腿 + 弱项专项。

**组数 / 次数 / 组间休息**

| 目标 | 复合动作 | 孤立动作 |
| --- | --- | --- |
| 增肌 | 3 组 × 10 次，休息 90 秒 | 3 组 × 12 次，休息 60 秒 |
| 减脂 | 3 × 15，60 秒 | 3 × 15，45 秒 |
| 增力 | 5 × 5，150 秒 | 3 × 8，75 秒 |
| 塑形 | 3 × 12，60 秒 | 3 × 15，45 秒 |
| 保持健康 | 2 × 12，75 秒 | 2 × 12，60 秒 |

**起始重量估算**
`总负重 = 体重 × loadFactor × 经验系数(0.68/1.0/1.22) × 性别系数 × 目标系数`
单只动作再 ÷ 2，最后按器械步长取整（杠铃 2.5kg / 哑铃 0.5–1kg / 器械 2.5kg / 壶铃 2kg）。

**硬约束**：动作只在 `equipmentId ∈ 已勾选器械` 的集合中挑选，并排除 `riskRegions ∩ 用户禁忌 ≠ ∅` 的动作。

**训练容量**：默认按目标 + 经验推导（见上表）；用户可在偏好里固定「每次动作数 / 每个动作组数 / 每组次数」，计时与有氧类动作除外（它们的"次数"是秒或分钟）。固定动作数时会放宽每个肌群的动作上限，优先满足用户的容量习惯。

**部位侧重**：每个肌群可设为 正常 / 少练 / 加强 / 不练。
- 不练：该肌群的动作完全不出现；若某天目标肌群被全部排除，自动改练其他未排除的部位，避免出现空训练
- 少练：每次训练该肌群最多 1 个动作
- 加强：每次训练该肌群最多 4 个动作（正常为 2～3 个），并在候选排序中提前

配额按动作的**主肌群**统计，因此某动作被别的肌群组挑走时同样受自己主肌群的配额约束。自动模式下前两轮按侧重上限挑选，之后为填满时长预算放宽到每肌群 3 个（「少练」始终保持 1 个）。

**渐进超负荷**
- RPE ≤ 7 且完成全部目标次数，连续两次（或单次 RPE ≤ 4）→ 重量 +2.5%~5%（新手 5%、初级 4%、中级 2.5%）；自重/计时/有氧类改为次数 +1~2 或时长 +2 分钟
- RPE ≥ 9 且未完成 → 重量 −10%；仅未完成 → −5%；RPE ≥ 9 但完成 → 维持
- 反馈出现关节疼痛且该动作涉及该部位 → 立即停用 7 天、重量 −10%，并在后续训练中自动替换为同肌群替代动作

**减负周**（第 4 周）：重量 −10%，仅 ≥4 组的方案减 1 组，保证单次训练时长基本不变。模板计划只下调重量 10%，组数/次数保持模板原值（冲击期模板可关掉减负周）。

**训练模板**（`src/data/templates.ts` + `src/engine/template.ts`）

模板是一份「写死的课表」：动作、组数、每组次数、重量百分比都由模板决定，不走分化与容量推导。计划页「用训练模板」进入模板库 → 查看每天安排 → 套用后即可逐动作改组数 / 次数 / 重量 / 休息。

- 内置：**薄肌训练法三阶段**（来源：抖音 @努力的橙子（自律中）第 148 集）
  - 第一阶段 肌肥大：每周 5 练，8–15 次 × 4 组，三大项按 70% 极限
  - 第二阶段 增肌增力：大项 3 × 3 双组数（83% + 72.5%），超程硬拉 65% 并每次 +5kg
  - 第三阶段 冲击期：90% + 78% 双组数，**不设减负周**
- 重量换算：系统按体重估算的起始重量视为 **70% 极限**，模板百分比按 `估算值 × weightPct / 70` 等比换算后再按器械步长取整；有训练记录时以记录里的当前重量为基准
- 器械：模板需要的器械未勾选时自动补进器械库，保证动作可执行
- 伤病：命中禁忌的动作自动替换为同肌群安全动作（先找显式替代，再在全库兜底），实在没有安全动作则跳过该条目
- 套用后生成的仍是普通 `Plan`，`sourceTemplateId / sourceTemplateName` 仅用于展示来源，之后所有编辑与自动计划完全一致

---

## 四、本地运行

```bash
cd fitplan
npm install     # 安装依赖（约 130 个包）
npm run dev     # 开发服务器，默认 http://localhost:5173
```

其他命令：

```bash
npm run build      # 类型检查 + 生产构建，输出到 dist/
npm run preview    # 预览生产构建
npm run selftest   # 运行规则引擎自检（50 项断言，覆盖验收标准 1、2 及节奏 / 有氧日 / 容量 / 部位侧重 / 器械偏好 / 训练模板）
```

**在线地址（PWA）**：https://fitplan-18681.app.workbuddy.host/

**添加到手机桌面**：用手机浏览器打开上面的地址，选择「添加到主屏幕」即可；Service Worker 会在生产构建下自动注册，之后断网也能打开。

- iPhone：Safari 打开 → 底部「分享」→「添加到主屏幕」
- 安卓：Chrome 打开 → 右上角菜单 →「安装应用 / 添加到主屏幕」

发布流程：`npm run build` 后把 `dist/` 内容复制到一个单独目录，再用「发布为应用」部署该目录即可（构建产物使用相对路径 `base: './'`，根路径或子目录都能跑）。

---

## 五、已实现 / 未实现

### 已实现

- [x] 身体档案（身高体重年龄性别、经验、目标、每周天数、单次时长、伤病禁忌、健康状况）
- [x] 体重多次记录 + 趋势折线
- [x] 器械库 49 项预置（自由重量 / 固定器械 / 有氧 / 自重辅具），分类展示、搜索、自定义新增
- [x] 自定义器械自动派生同名动作，保证器械硬约束不被破坏
- [x] 计划生成：4 周中周期，热身 / 主体 / 放松三段结构
- [x] 按每周天数自动选择分化方式（全身 / 推拉腿 / 上下肢 / 推拉腿+弱项）
- [x] 训练节奏：连着练 / 练一休一 / 练二休一 / 自定义星期（含超出容量时的相邻排期提示）
- [x] 每周有氧日：指定某天为纯有氧训练（可覆盖力量日，也可作为额外训练日）
- [x] 器械偏好：偏好自由重量 / 偏好固定器械 / 不限，影响同肌群候选动作的排序
- [x] 训练容量自定义：固定「每次 N 个动作 × 每组 M 组 × 每组 K 次」（如 6 × 4 × 12），也可保持自动
- [x] 部位侧重：每个肌群可设为 正常 / 少练 / 加强 / 不练（如「不练腿」「女生不爱练胸」）
- [x] 每个动作输出组数、次数、建议起始重量、组间休息、动作要领
- [x] 器械硬约束 + 伤病过滤（自检已覆盖）
- [x] 同肌群同难度替代动作（自动计算 + 手动「换一个」）
- [x] 训练模板库：套用现成课表（薄肌训练法三阶段），可逐动作改组数 / 次数 / 重量 / 组间休息、删除动作
- [x] 渐进超负荷规则（上调 / 维持 / 下调 / 停用替换）
- [x] 训练执行：逐组记录实际重量与次数、勾选完成、组间休息倒计时
- [x] 训练反馈表单（RPE、完成度、疲劳部位、疼痛部位与程度、实际时长、备注）
- [x] 提交后立即输出本次小结 + 下次调整说明（如「哑铃上斜卧推 10.5kg → 11kg」）
- [x] 数据看板：累计次数/时长、本周完成率、近 8 周柱状图、体重趋势、动作重量曲线 + 1RM 估算
- [x] 底部四 Tab、移动端优先、按钮点击区 ≥ 44px、空状态引导
- [x] 深色 / 浅色模式切换并持久化
- [x] 首次进入免责声明；计划页与设置页常驻「本应用建议不构成医疗建议」
- [x] 伤病 / 慢性病 / 孕期提示先咨询医生；反馈出现关节疼痛立即提示停止并休息
- [x] localStorage 持久化，刷新不丢数据；导出 / 导入 JSON 备份
- [x] PWA：manifest + Service Worker，可添加到桌面、离线打开
- [x] 全中文界面

### 未实现

- [ ] 导出计划为 PDF / 图片（当前仅有 JSON 数据导出）
- [ ] 按部位的训练容量统计（每周每肌群组数热力图）
- [ ] 完整的 1RM 百分比训练法（目前仅在记录页用 Epley 公式做 1RM 估算展示）
- [ ] 接入大模型做自然语言问答式调整（会牺牲离线能力，与本项目定位冲突）
- [ ] 动作图片 / 视频演示（按需求明确排除）
- [ ] 多设备同步（无后端定位，仅支持手动导出导入）

### 明确不做

社交、排行榜、付费、后端服务、第三方登录、推送通知。

---

## 六、免责声明

本应用给出的计划与建议基于通用训练原则自动生成，**不构成医疗建议**。如有伤病、慢性病或孕期情况，请先咨询医生；训练中出现关节刺痛或锐痛，请立即停止并寻求专业医疗帮助。

// ============================================================
// Mock Data — Lens RSS/JSON Aggregator
// ============================================================

import type { Article, CustomView, NewsFlash, TimelineEvent } from "@/lib/types"

// ─── Daily Articles ────────────────────────────────────────
export const DAILY_OVERVIEW = {
  date: '2026年3月19日 · 星期三',
  summary:
    '今天的信息流围绕两条主线展开：AI 基础设施竞赛进入白热化，多家大厂密集发布新模型与定价调整；与此同时，全球科技监管机构加速跟进，欧盟 AI 法案细则落地在即。整体基调：激进创新与审慎监管并行。',
}

export const SPOTLIGHT_ARTICLES: Article[] = [
  {
    id: 'spotlight-1',
    title: 'Anthropic Claude Opus 4.6 发布：推理能力大幅跃升，API 定价重构',
    source: 'The Verge',
    sourceUrl: 'https://theverge.com',
    publishedAt: '09:30',
    summary:
      'Anthropic 今日发布 Claude Opus 4.6，在数学推理与代码生成基准上超越 GPT-5，同时将 API 定价从按 Token 改为按"思考深度"的分级收费。分析师认为此举将改变 AI 应用层的成本结构。',
    bullets: [
      '数学推理 AIME 2025 得分提升至 87.3%，超越 GPT-5 的 84.1%',
      '新定价模式：轻量 / 标准 / 深度推理三档，起步价降低 30%',
      '支持 200K 上下文窗口，原生多模态图像输入',
    ],
    content: `Anthropic 今日正式发布 Claude Opus 4.6，这是其旗舰系列的最新迭代。在多项公认基准测试中，新模型展示出显著的推理能力提升。

在数学竞赛基准 AIME 2025 上，Opus 4.6 获得了 87.3 分的成绩，超过了 OpenAI GPT-5 的 84.1 分。在代码生成方面，SWE-bench 验证集得分达到 72.8%。

**定价结构重构**

最引人注目的是 Anthropic 对定价模式的彻底重构。传统的 per-token 计费被替换为三档"思考深度"模式：轻量模式适合简单问答与格式化任务；标准模式对应当前 Opus 4.5 的能力水平；深度推理模式则激活模型的完整推理链，单次调用可持续数分钟。

分析师普遍认为，这一变化将显著降低 AI 应用层的入门成本，但对重度推理场景的定价策略仍需观察。

**生态影响**

此次发布距上次版本仅三个月，加速迭代的节奏令市场侧目。竞争对手 Google 的 Gemini 3 Ultra 预计将在本季度末发布，AI 基础模型的军备竞赛仍在加速。`,
    imageUrl: '/images/article-1.jpg',
    aiScore: 9.8,
  },
  {
    id: 'spotlight-2',
    title: '欧盟 AI 法案执行细则正式公布，高风险 AI 系统须在 6 月前完成合规审计',
    source: 'Reuters',
    sourceUrl: 'https://reuters.com',
    publishedAt: '10:15',
    summary:
      '欧盟委员会今日公布 AI 法案配套执行细则，要求所有在欧运营的高风险 AI 系统于 2026 年 6 月 1 日前提交合规审计报告。涵盖医疗、金融、执法三大领域，违规罚款最高为全球营收的 3%。',
    bullets: [
      '六大高风险类别明确：医疗诊断、信用评分、招聘筛选、执法辅助等',
      '合规审计须由欧盟认证的第三方机构完成，费用约 5-50 万欧元',
      '违规处罚设上限：最高为全球年营收 3% 或 1500 万欧元取较高值',
    ],
    content: `欧盟委员会今日公布《人工智能法案》（EU AI Act）的配套执行细则，这标志着全球首个全面性 AI 监管框架正式进入落地阶段。

**高风险 AI 系统定义**

执行细则将高风险 AI 系统分为六大类别，涵盖医疗诊断辅助、信用评分与贷款决策、招聘简历筛选、执法犯罪预测、关键基础设施管理以及教育评估系统。

任何在欧盟市场运营的企业，只要其 AI 产品涉及上述类别，均须在 2026 年 6 月 1 日前提交合规审计报告。

**审计要求与成本**

合规审计须由欧盟认证的第三方机构完成，包含技术文档审查、偏见测试、人工监督机制验证等环节。据业内估算，小型系统审计费用约 5 万欧元，复杂系统可高达 50 万欧元。

**市场反应**

法规发布后，主要科技股出现分化：欧洲本土 AI 公司小幅上涨，美国大型科技公司因合规成本预期而小幅承压。`,
    aiScore: 9.2,
  },
]

export const RECOMMENDED_ARTICLES: Article[] = [
  {
    id: 'rec-1',
    title: 'Vercel 发布 Next.js 16：Turbopack 正式稳定，React Compiler 内置支持',
    source: 'Vercel Blog',
    sourceUrl: 'https://vercel.com/blog',
    publishedAt: '08:00',
    summary: 'Next.js 16 带来 Turbopack 稳定版和全新缓存 API，构建速度提升显著。',
    bullets: [
      'Turbopack 成为默认 bundler，冷启动速度提升约 55%',
      '"use cache" 指令：组件级精细缓存控制',
      'React Compiler 稳定版内置，自动优化渲染性能',
    ],
    content: 'Next.js 16 正式发布...',
    aiScore: 8.7,
  },
  {
    id: 'rec-2',
    title: 'OpenAI 推出 GPT-5 mini：面向移动端的轻量级模型，离线推理能力首次开放',
    source: 'TechCrunch',
    sourceUrl: 'https://techcrunch.com',
    publishedAt: '11:20',
    summary: 'GPT-5 mini 体积仅 1.2GB，支持在 iPhone 15 Pro 上本地运行，标志着端侧 AI 新阶段。',
    bullets: [
      '模型体积 1.2GB，支持 iPhone 15 Pro / Snapdragon 8 Gen 3 本地推理',
      '响应延迟低于 200ms，离线可用',
      '隐私保护：对话数据不上传服务器',
    ],
    content: 'GPT-5 mini 正式发布...',
    aiScore: 8.5,
  },
  {
    id: 'rec-3',
    title: '英伟达 Blackwell Ultra 架构详解：显存带宽突破 16TB/s，专为 AI 推理设计',
    source: 'Ars Technica',
    sourceUrl: 'https://arstechnica.com',
    publishedAt: '13:45',
    summary: '英伟达发布下一代 GPU 架构，AI 推理吞吐量对比上代提升 4 倍，成本降低 60%。',
    bullets: [
      'HBM4 显存带宽达 16TB/s，是 H100 的 3.2 倍',
      '推理专用硬件单元 TFU 首次引入，专门加速 Transformer 注意力机制',
      '能效比提升 2.8 倍，数据中心 TCO 预计降低 40%',
    ],
    content: '英伟达发布 Blackwell Ultra...',
    aiScore: 8.3,
  },
  {
    id: 'rec-4',
    title: 'Stripe 进军 AI 支付基础设施：推出 Agent Payments API，支持 AI 自主发起交易',
    source: 'The Information',
    sourceUrl: 'https://theinformation.com',
    publishedAt: '14:30',
    summary: 'Stripe 新 API 允许 AI Agent 在特定授权框架内自主完成支付，开辟代理经济新赛道。',
    bullets: [
      'Agent 钱包：为 AI 代理分配独立支付额度和权限范围',
      '人工审批阈值：超过设定金额自动触发人工确认',
      '首批集成伙伴包括 Anthropic、OpenAI 的 Operator 产品',
    ],
    content: 'Stripe 发布 Agent Payments API...',
    aiScore: 8.1,
  },
]

export const NEWS_FLASHES: NewsFlash[] = [
  { id: 'nf-1', time: '07:30', text: 'Google DeepMind 宣布 AlphaFold 3 向学术机构免费开放 API' },
  { id: 'nf-2', time: '08:45', text: 'Meta 将在 Q2 发布 Llama 4，参数规模首次突破 1 万亿' },
  { id: 'nf-3', time: '09:00', text: 'Opus 4.6 API 调用价格标准档上涨 15%，深度推理档持平' },
  { id: 'nf-4', time: '10:30', text: 'Microsoft 将 Copilot 嵌入 Windows 11 系统级快捷键，不可禁用引发争议' },
  { id: 'nf-5', time: '11:00', text: '美联储 3 月会议纪要：暂缓降息，科技股期货小幅承压' },
  { id: 'nf-6', time: '12:15', text: 'Arc 浏览器开发商 The Browser Company 宣布裁员 50%，All-in AI 产品线' },
  { id: 'nf-7', time: '14:00', text: 'Scale AI 完成 14 亿美元 E 轮融资，估值达 135 亿美元' },
  { id: 'nf-8', time: '15:20', text: 'Cloudflare 推出 AI Gateway 全球加速节点，覆盖亚太七城' },
  { id: 'nf-9', time: '16:45', text: 'GitHub Copilot 月活用户突破 500 万，企业版渗透率创新高' },
]

// ─── Weekly Data ────────────────────────────────────────────
export const WEEKLY_HERO = {
  weekNumber: 'Week 11',
  headline: '硅谷加速季',
  subheadline: '2026 年 3 月第三周 · 2026.03.13 — 2026.03.19',
  editorial: `本周，AI 产业的演进速度再次令所有预测落后于现实。三家顶级模型公司在同一周发布了重大更新，一个此前只存在于论文中的概念——"AI 代理支付"——突然变得触手可及。

与此同时，监管的幽灵也愈发清晰：欧盟执行细则的落地，预示着 AI 的蛮荒西部时代正在收尾。下一个周期，合规能力将成为产品竞争力的一部分，而不仅仅是法务部门的事情。

我们正站在一个有趣的分叉路口：技术的加速度与治理的滞后性之间的张力，将在接下来数月持续放大。这不是终点，而是新一轮游戏规则确立的开始。`,
}

export const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'tl-1',
    date: '03/13',
    dayLabel: '周四',
    title: 'Meta 泄露 Llama 4 技术规格，参数量首次突破万亿级别',
    summary: '内部文件外泄显示 Llama 4 采用 MoE 架构，总参数 1.2T，激活参数约 70B，预期 Q2 发布。',
  },
  {
    id: 'tl-2',
    date: '03/14',
    dayLabel: '周五',
    title: 'OpenAI 宣布 GPT-5 mini 端侧推理开放测试',
    summary: '开发者计划邀请码开放申请，首批支持 iOS 平台，Android 版本将于 Q3 推出。',
  },
  {
    id: 'tl-3',
    date: '03/17',
    dayLabel: '周一',
    title: 'Anthropic 发布 Claude Opus 4.6，推理基准超越 GPT-5',
    summary: '同步宣布新定价结构，深度推理模式按"思考时长"计费，引发行业广泛讨论。',
  },
  {
    id: 'tl-4',
    date: '03/18',
    dayLabel: '周二',
    title: 'Stripe Agent Payments API 发布，AI 自主支付成为现实',
    summary: 'Anthropic 与 OpenAI 同日宣布成为首批集成伙伴，代理经济赛道加速启动。',
  },
  {
    id: 'tl-5',
    date: '03/19',
    dayLabel: '周三',
    title: '欧盟 AI 法案执行细则公布，合规大限 6 月到来',
    summary: '业界普遍认为这是 AI 行业的"GDPR 时刻"，合规成本预期将重塑企业 AI 策略。',
  },
]

export const DEEP_DIVES: Article[] = [
  {
    id: 'deep-1',
    title: 'AI 代理经济的基础设施时刻：从工具调用到自主交易，边界在哪里',
    source: 'Ben Thompson · Stratechery',
    sourceUrl: 'https://stratechery.com',
    publishedAt: '周六 · 03/15',
    summary:
      'Stripe Agent Payments API 的发布，让"AI 自主经济"从概念变为现实。但在兴奋之余，我们需要认真讨论一个问题：当 AI 代理可以自主发起金融交易，人类的监督和控制边界究竟在哪里？Ben Thompson 的深度分析从基础设施层切入，探讨这一转变的深层含义。',
    bullets: [
      'AI 代理的"工具调用权"与"资产操控权"是本质不同的权力等级',
      '支付授权框架的设计决策，将成为代理经济的宪法性文件',
      '"人在回路"（Human-in-the-loop）的位置正在从流程中心移向边缘审计',
    ],
    content: '这是一个里程碑时刻...',
    imageUrl: '/images/deep-1.jpg',
    aiScore: 9.5,
  },
  {
    id: 'deep-2',
    title: '后 ChatGPT 时代的职场变革：哪些工作真的消失了，哪些只是变了形态',
    source: 'Harvard Business Review',
    sourceUrl: 'https://hbr.org',
    publishedAt: '周日 · 03/16',
    summary:
      '基于对 2000 家企业的跟踪调查，HBR 发布了 AI 普及三年后职场格局的深度报告。结论令人意外：消失的不是岗位，而是工作中的"低信息密度任务"；真正的变化是认知劳动的重新分配——人类越来越多地承担意义判断，而非信息处理。',
    bullets: [
      '75% 的受访企业表示 AI 工具减少了初级员工数量，但中高级岗位反而增加',
      '"提示工程"作为独立职能正在消解，被融入所有知识工作者的日常技能',
      '组织中"AI 使用率"与"人均产出"的相关性在第 18 个月后趋于平稳',
    ],
    content: '职场的 AI 变革已经三年...',
    aiScore: 9.1,
  },
]

// ─── Custom Views ───────────────────────────────────────────
export const CUSTOM_VIEWS: CustomView[] = [
  {
    id: 'view-morning',
    name: '晨间必读',
    icon: 'coffee',
    description: '每天 7 点前的精选快报，10 分钟掌握核心信息',
    articles: [
      {
        id: 'cv-1',
        title: 'Cloudflare 2025 年网络安全报告：AI 驱动攻击同比增长 340%',
        source: 'Cloudflare Blog',
        sourceUrl: 'https://cloudflare.com/blog',
        publishedAt: '06:00',
        summary: 'AI 生成的钓鱼邮件和自动化漏洞扫描成为最主要威胁向量。',
        bullets: [
          'AI 生成钓鱼邮件的识别率比人工降低 67%',
          'Bot 流量占比达到全球互联网流量的 51%，首次过半',
          'Zero-day 漏洞从公开到被利用的平均时间缩短至 1.4 天',
        ],
        content: 'Cloudflare 发布年度报告...',
        aiScore: 8.9,
      },
      {
        id: 'cv-2',
        title: 'Y Combinator W26 Demo Day 亮点：43% 的团队正在构建 AI Agent 产品',
        source: 'TechCrunch',
        sourceUrl: 'https://techcrunch.com',
        publishedAt: '06:30',
        summary: '本届 YC 最热赛道为 AI Agent 基础设施和垂直领域自动化，医疗和法律方向尤为密集。',
        bullets: [
          '共 214 家公司参展，AI 相关占比 78%，创历史新高',
          '最高估值团队来自医疗 AI 诊断领域，Pre-money 达 8000 万美元',
          'B2B SaaS 传统模式减少，"结果即服务"计费模式占主导',
        ],
        content: 'YC W26 Demo Day 结束...',
        aiScore: 8.4,
      },
    ],
  },
  {
    id: 'view-fish',
    name: '摸鱼快看',
    icon: 'zap',
    description: '轻松有趣的科技资讯，午休摸鱼专用',
    articles: [
      {
        id: 'cv-3',
        title: '程序员用 AI 生成了 10 万行代码，结果没人能维护了',
        source: 'Hacker News',
        sourceUrl: 'https://news.ycombinator.com',
        publishedAt: '11:00',
        summary: '一个独立开发者用 Cursor 三天内完成了预计三个月的工作量，但六个月后无法向新加入的团队成员解释代码逻辑。',
        bullets: [
          '代码质量测试通过率 95%，但可读性评分接近零',
          '团队最终决定用三个月时间"翻译"这批代码',
          'AI 辅助开发正在创造新的技术债务类型：可运行但不可理解',
        ],
        content: 'HN 热门帖子讨论...',
        aiScore: 7.8,
      },
      {
        id: 'cv-4',
        title: '这款 AI 每天给你发一封"过去自己写的信"，已有 40 万用户',
        source: 'Product Hunt',
        sourceUrl: 'https://producthunt.com',
        publishedAt: '13:00',
        summary: 'TimeLetters 通过分析用户日记和聊天记录，用"过去自己的语气"写信给现在的自己，探讨个人成长。',
        bullets: [
          '用户平均每天花 8 分钟阅读"过去的信"，留存率极高',
          '隐私模式：全部本地处理，不上传服务器',
          'App Store 年度最佳应用候选',
        ],
        content: 'Product Hunt 今日产品...',
        aiScore: 7.5,
      },
    ],
  },
]

// ─── Saved Articles ─────────────────────────────────────────
export const INITIAL_SAVED_IDS: string[] = ['spotlight-1', 'deep-1']

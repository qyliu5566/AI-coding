# 小红书内容工厂（xhs-factory）

> 一个**自用**的小红书内容生产桌面应用：用 AI 快速完成「选题 → 创作 → 成稿」，并逐步用历史数据迭代选题与内容质量。
>
> **当前版本：v0.1**（MVP，覆盖闭环前半段：选题 / 创作 / 草稿）

## 用途

如果你在运营小红书账号，日常最耗时的就是**想选题**和**写文案**。这个工具把这两步自动化：

- 配置好账号「人设」（赛道、语气、目标人群）后，一键产出有爆款潜质的**选题**；
- 选定选题后，AI 流式生成符合小红书调性的**完整笔记**（标题 / 正文 / 标签 / 封面文案 / 配图建议）；
- 可手动微调后存入草稿库，**一键复制或导出**，再去 App 发布。

所有数据都存在**你本地**，仅自己可见；API Key 经系统级加密存储，不上传、不进入界面进程。

## 基本功能（v0.1）

| 模块 | 说明 |
| --- | --- |
| **选题工作台** | 选人设 → AI 生成候选选题（可勾选爆款样本作参考）；管理候选 / 已选状态 |
| **创作工作台** | 从选题生成多个标题 + **流式正文** + 标签 + 封面文案 + 配图建议，可编辑后存草稿 |
| **草稿库** | 按状态筛选、编辑、一键复制（标题+正文+标签）、导出 Markdown |
| **爆款库** | 收录对标爆文，AI 拆解其「钩子 / 开头 / 结构 / CTA」，反哺选题与创作 |
| **设置** | 配置 AI 提供方与密钥、管理账号人设 |

**支持的 AI 提供方：**

- **Claude**（推荐，`claude-opus-4-8`）——自动识别两种凭证：
  - 标准 API Key（`sk-ant-api...`，console.anthropic.com 创建）
  - Claude Code / cc-switch 的 OAuth 令牌（`sk-ant-oat...`，自动走 Bearer + oauth 头）
- **DeepSeek**（OpenAI 兼容，`deepseek-chat` / `deepseek-reasoner`）

## 安装与使用

> 环境要求：Node.js ≥ 20、macOS / Windows / Linux。

```bash
# 1. 克隆
git clone https://github.com/<your-account>/xhs-factory.git
cd xhs-factory

# 2. 安装依赖（postinstall 会自动为 Electron 重建 better-sqlite3 原生模块）
npm install

# 3. 启动开发
npm run dev
```

首次启动后：

1. 进入 **设置** → 选择提供方、填入对应 API Key（DeepSeek 需在 platform.deepseek.com 充值后使用）→ 新建一个 **人设**；
2. 回到 **选题**，生成候选选题；
3. 点选题的「去创作」，生成内容、编辑、保存草稿；
4. 在 **草稿库** 复制或导出，去小红书发布。

### 打包

```bash
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux
```

### 常用脚本

```bash
npm run dev           # 开发
npm run typecheck     # 类型检查
npm run lint          # 代码检查
```

## 技术栈

- **桌面**：Electron + electron-vite
- **前端**：React 19 + TypeScript + Tailwind CSS v4 + shadcn 风格组件（Radix）
- **数据**：本地 SQLite（better-sqlite3）+ Drizzle ORM（应用内版本化迁移）
- **AI**：多 Provider 抽象（`src/main/ai`），Claude + OpenAI 兼容（DeepSeek）
- **安全**：API Key 经 Electron `safeStorage` 加密存于本地用户目录；渲染进程经白名单 IPC 访问主进程

## 架构

```
src/
├─ shared/types.ts        # 主/渲染共享类型 + IPC 契约（单一事实来源）
├─ main/                  # 主进程：DB / IPC / AI / 服务 / 密钥
│  ├─ db/                 #   schema + 版本化迁移
│  ├─ ai/                 #   provider 接口 + claude / openai 兼容实现 + prompts + 解析
│  ├─ services/           #   业务逻辑（IPC handler 仅做转发）
│  └─ ipc/                #   统一 { ok, data | error } 返回
├─ preload/               # 白名单 window.api（类型见 index.d.ts）
└─ renderer/src/          # React UI（pages / components/ui / store）
```

数据库与密钥位于系统用户数据目录（不随仓库分发）：`<userData>/xhs-factory.db`、`<userData>/secrets.json`。

## 路线图

- **v0.1（当前）**：选题 / 创作 / 草稿 / 爆款库 / 多 Provider
- **下一步**：
  - 数据采集：Playwright 爬虫 / 第三方数据平台
  - 自动爆款分析：批量拆解对标账号爆文 → 爆款公式库
  - 发布后数据回收 + 归因；选题打分迭代（用历史表现优化选题）
  - 内容日历 / 排期、合规敏感词检测、多账号

## 说明

本项目为个人自用工具。使用第三方模型/订阅凭证时，请遵守对应服务的使用条款。

## License

MIT

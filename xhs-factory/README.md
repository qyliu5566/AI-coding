# 小红书内容工厂（xhs-factory）

> 一个自用的小红书内容生产桌面应用：围绕「选题 → 创作 → 草稿 → 发布 → 数据回收 → 复盘」形成闭环。
>
> **当前版本：v0.5**（发布闭环 + 创作队列 + 视觉模型 + 草稿图片资产 + 资料包导出）

## 用途

如果你在运营小红书账号，日常最耗时的通常是想选题、写文案、做封面配图和复盘数据。这个工具把这些环节串成一个本地工作台：

- 按账号人设批量生成候选选题；
- 将选题加入创作队列，生成完整笔记内容；
- 对当前稿件做诊断、勾选修改建议、局部改写和版本回退；
- 生成封面图与正文配图方案，并调用视觉模型生成图片；
- 保存到草稿库，继续创作、复制、合规检查或导出完整资料包；
- 记录发布计划和发布后数据，反哺选题评分、标签表现和爆款公式。

所有业务数据默认存放在本地 SQLite；API Key 使用 Electron `safeStorage` 加密保存在本机。

## 当前功能（v0.5）

| 模块 | 说明 |
| --- | --- |
| **选题工作台** | 按人设批量生成候选选题，可参考爆款样本，支持选用或直接进入创作 |
| **创作队列** | 集中管理已选用、生成中、草稿未保存的话题，避免切页丢失创作状态 |
| **创作工作台** | 生成标题、正文、标签、封面文案、配图建议；支持整篇改写、局部改写、版本管理 |
| **视觉创作** | 生成封面与正文配图方案，支持调用 OpenAI Images 或火山引擎 Ark 生成图片 |
| **草稿库** | 管理草稿/成稿，查看图片资产，继续创作原草稿，合规检查，沉淀公式 |
| **资料包导出** | 导出 Markdown、视觉方案 JSON、图片目录和缺失图片清单，Markdown 使用相对图片路径 |
| **发布/日历** | 将成稿加入发布计划，手动录入发布时间、链接、笔记 ID 和表现数据 |
| **复盘看板** | 汇总人设、标签、选题表现， reviewed 后回写 topic score |
| **爆款库/公式库** | 收录爆文并拆解结构，从爆款样本或高表现草稿沉淀公式 |
| **合规检查** | 本地规则检查敏感词、绝对化承诺、营销风险和平台禁忌表达 |
| **设置** | 管理文本模型、视觉模型、API Key 和账号人设 |

## 支持的模型

文本模型：

- **Claude**：支持标准 API Key，也兼容 Claude Code / cc-switch OAuth 令牌
- **OpenAI 兼容接口**：可用于 DeepSeek 等兼容服务
- **DeepSeek**：`deepseek-chat` / `deepseek-reasoner`

视觉模型：

- **OpenAI Images**：默认 `gpt-image-1`
- **火山引擎 Ark**：默认 `doubao-seedream-5-0-260128`，图片尺寸固定使用 `2K`

## 安装与使用

环境要求：Node.js >= 20，macOS / Windows / Linux。

```bash
git clone https://github.com/qyliu5566/xhs-factory.git
cd xhs-factory
npm install
npm run dev
```

首次启动后：

1. 进入 **设置**，配置文本模型和视觉模型 API Key；
2. 创建一个账号人设；
3. 在 **选题** 批量生成候选话题；
4. 点击 **选用** 加入创作队列，或点击 **去创作** 直接开始；
5. 在 **创作** 中生成内容、视觉方案和图片；
6. 保存到 **草稿库**，继续创作、导出资料包或加入发布计划。

## 导出资料包

草稿库中的「导出资料包」会生成如下目录：

```text
标题_draft-123_YYYYMMDD-HHmmss/
  稿件.md
  visual-plan.json
  images/
    cover.png
    content-01.png
    content-02.png
  missing-assets.txt
```

说明：

- `稿件.md` 使用相对路径引用图片，移动整个目录后仍可正常显示；
- `visual-plan.json` 保存封面和正文配图方案；
- 图片缺失时不阻塞导出，会写入 `missing-assets.txt`。

## 常用脚本

```bash
npm run dev           # 启动开发
npm run typecheck     # 类型检查
npm run lint          # ESLint 检查
npm run build         # 构建
npm run build:mac     # macOS 打包
npm run build:win     # Windows 打包
npm run build:linux   # Linux 打包
```

## 技术栈

- **桌面**：Electron + electron-vite
- **前端**：React 19 + TypeScript + Tailwind CSS v4 + Radix UI
- **状态**：Zustand
- **数据**：SQLite（better-sqlite3）+ Drizzle ORM + 应用内版本化迁移
- **AI**：多 Provider 抽象，Claude / OpenAI 兼容 / DeepSeek / OpenAI Images / 火山引擎 Ark
- **安全**：API Key 本地加密保存；渲染进程通过白名单 IPC 访问主进程

## 架构

```text
src/
├─ shared/types.ts        # 主/渲染共享类型 + IPC 契约
├─ main/                  # 主进程：DB / IPC / AI / 服务 / 密钥
│  ├─ db/                 # schema + 版本化迁移
│  ├─ ai/                 # provider 接口、实现、prompts、解析
│  ├─ services/           # 业务服务
│  └─ ipc/                # IPC 注册与统一返回
├─ preload/               # 白名单 window.api
└─ renderer/src/          # React UI、页面、组件、store
```

本地数据位于系统用户数据目录：

- 数据库：`<userData>/xhs-factory.db`
- 密钥：`<userData>/secrets.json`
- 生成图片：`<userData>/assets/images/`

## 路线图

- **v0.1**：选题 / 创作 / 草稿 / 爆款库 / 多 Provider
- **v0.2**：发布记录 / 内容日历 / 手动数据回收 / 复盘看板 / 选题评分 / 公式库 / 合规检查
- **v0.3**：创作诊断、修改建议、版本管理、局部改写
- **v0.4**：视觉方案、图片生成、草稿图片资产、合规与质量增强
- **v0.5（当前）**：创作队列、草稿继续创作、火山引擎视觉模型、资料包导出、本地图片安全读取

## License

MIT

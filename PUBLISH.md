# 发布0.2.0-alpha.2

这是原生/ws客户端预览版，不发布旧0.1.0采集网关原型。

本版工具契约改为五个工具：移除 `ark_wait` 与模型可见的 `advance`；`ready` 通过插件内部计算、上报和推进，返回下一决策或终局，且不会将剩余批次带入下一轮。站点强制计时、暂停与首领共享血池规则保留。旧对话中的工具清单需要重启客户端并新开对话刷新。

## GitHub Actions

- ci.yml：push、PR或手动运行，在Node22/24执行锁文件安装、构建、JS语法/插件元数据/入口核对和独立打包；Actions产物保留14天。不调用模型、游戏站或测试套件。
- release.yml：发布GitHub Release后，用Node24重建并校验tag必须等于v+package.json.version，然后自动上传zip、SHA256和清单。目标提交必须含本工作流；安装包不依赖DSH相邻仓库。
- Actions使用固定提交的官方checkout/setup-node/upload-artifact；常规CI只读权限，Release上传单独授予contents:write。

本地复现：

```sh
npm ci --ignore-scripts
npm run build
npm run check:package
npm run package -- results/releases
```

新版本同步package.json、package-lock.json、plugin.json、.codex-plugin/plugin.json并重建dist后提交。用当前提交创建对应v版本Tag和Release；已有资产不会被覆盖，失败重跑前检查同名资产。DSH独立打包与npm发布见其仓库说明。

## Codex 插件与市场文件

- 根 `plugin.json`：portable 插件 manifest，包含发布者、版本与 `extensions.com.openai.interface` 展示信息。
- `.codex-plugin/plugin.json`：兼容 manifest，指向根 `mcp.json`，保持展示信息一致；根 OpenAI extension 存在时不会合并此兼容文件。
- 根 `mcp.json`：内置 stdio 服务入口 `${PLUGIN_ROOT}/dist/mcp.mjs`。
- `.agents/plugins/marketplace.json`：仓库市场索引，市场 `ark-stronghold`、插件 `ark-play`，本地来源 `./` 指向市场仓库根目录。必须保留隐藏目录；zip 同样包含它。

用户可运行 `codex plugin marketplace add HarcoChen/ArkStrongholdCodex --ref codex/wss-play`，然后 `codex plugin add ark-play@ark-stronghold`。解压 zip 后也可将解压目录作为本地市场添加。仓库默认分支当前是 `codex/wss-play`；改分支或发布稳定 tag 时相应更新安装命令的 `--ref`。

CI 审查两种 manifest 的身份、版本、展示信息、MCP 路径，以及市场条目的名称、来源与安装策略。本地另以 Codex CLI 0.163.0 读取市场，确认列出 `ark-play@ark-stronghold`。这些检查不等于桌面 UI 安装或官方目录审核。

当前交付的是自建仓库市场。若提交到 OpenAI 公共插件目录，本地 stdio MCP 目前仅面向已获准的合作伙伴，需按[官方 desktop-only 流程](https://developers.openai.com/plugins/deploy/desktop-only)确认资格并审核；公开 GitHub 仓库或生成 Release 不会自动上架。不预填虚构的隐私网址、审核录像或准入状态。

## 可直接使用的Release说明

Ark Play首个原生游戏站对局预览版：Codex插件与DSH原生插件共用原生/ws适配，提供紧凑局面、明确动作批量、卡牌查询与后台原生战斗计算。采集、保存、导出、账号鉴权均交由游戏站，插件不下载轨迹。

验证：本地0.3.1服务器、证书校验的WSS，两个真实工具入口各完成一局；服务器全量复算共10场普通战斗且无不一致/结果拒绝/接管。未驱动实际LLM或宣称棋力提升。仅vanilla solo；首领/隐藏关共享血池及玩法插件房间尚未完整验收，站点计时不会跳过。需要Node22+及可信站点/ws与公开内容模块；详见README。

安装与发布是独立步骤；上传源码不会修改用户全局配置或部署游戏站。GitHub预览Release需附对应zip。

## 独立 Core 依赖

共享对局代码已迁往 https://github.com/ArkStrongholdRL/ark-play-core。
本仓库只维护 Codex MCP 入口、插件清单和构建包装。
依赖名为 `@arkstrongholdrl/ark-play-core`，使用明确提交的 HTTPS 归档并由 lockfile 固定完整性。
发布 Core 改动后，更新 package.json 的提交与 package-lock.json，按 CI 的 `npm ci --ignore-scripts` 重建验证。
构建与打包无需相邻 checkout、本地 tgz 或手动覆盖 node_modules。
ZIP 包含核心与 Codex 宿主的对应源码；已构建包不需要运行时安装 Core。

Codex 同步 DSH 的默认站点、房间号保存与覆盖规则、下一盘读取配置、玩家来源声明和引导。命令行配置支持 --update，并在发布 ZIP 顶层提供独立 configure.mjs；不开图形配置页。插件清单使用薄荷绿品牌色，两份 manifest 保持一致。

## 2026-10-30：0.3.3 兼容候选

Codex 0.2.0-alpha.6 固定共享 Core 6eae6865467e5df4b363ac6ee84f2314ecda4a17，支持默认玩法版本的 0.3.3 站点；历史版本明确拒绝。
本次只准备本地 ZIP，不创建 tag、Release 或修改已安装缓存。Huawei 的 0.3.3 独立候选已完成握手、公开表校验和 Worker 加载；未运行新版完整公开对局。
仍是五个工具；录像、统计和多角色方案一并收在 docs/COMBAT-AND-MULTIROLE-DESIGN.md，尚未实现。
旧客户端会拒绝 0.3.3，应在服务器切换前协调更新。

## Huawei 已启用 0.3.3，客户端发布准备（2026-10-30）

Huawei 已于 15:39 手动切换到运行修订 47cdf5f447241aae581e6d56c78827b177a942cd。此轮只准备插件发布，不创建 tag／GitHub Release，不覆盖已安装缓存。
本仓库更新候选是 0.2.0-alpha.6，Core 固定 6eae6865467e5df4b363ac6ee84f2314ecda4a17。候选保留现有 bundled skill／打包工作，并纳入可独立安装的 ZIP 和对应源码。
公开 HTTPS health 与首页已核对为 0.3.3，保留备案。插件仍只有五个工具；统计／录像、多角色只是设计稿。
先等更新分支的 Node 22/24 CI 通过，再从经过校验的提交创建 v0.2.0-alpha.6 预览 Release。发布工作流上传重建 ZIP／摘要；不覆盖现有同名资产。

## 2026-10-30: settled-round combat metrics candidate

Current candidate: 0.2.0-alpha.7, pinned Core 7450e17f37138e9d3a8636b1f345e094a98b1693 (0.2.0-alpha.5).
Six shared tools now include `ark_combat({scope:'last'|'match'})`: damage, damage
taken, effective healing, shares and player DPS/HPS from completed native
simulations. Summons are credited to their operator. Missing, taken-over,
reconstructed and interrupted fields are explicit; coverage is local fields,
not a server-wide ranking. No active-round counters, frame logs or replay.
Both host skills require one read after each settled round before the next
action, and before finishing terminal review. No polling for missing metrics.

Validated: 15 Core tests; local 0.3.3 Worker counters and full compact battle
result match direct native simulation (damage 12100, taken 135, healing 135);
Worker takeover/interruption, unavailable remote fields and new-match reset.
Host build/package audits and Node 22/24 CI accompany this candidate.
No tag, Release, npm publication or installed-profile replacement in this step.

## Release v0.2.1 (2026-10-30)

Publish the prepared combat statistics implementation as v0.2.1, pinned to
Core 7450e17f37138e9d3a8636b1f345e094a98b1693. Includes default-version game
0.3.3 compatibility, `ark_combat` damage/taken/healing/shares and round-end
review in the bundled skill. Existing source and package validation is retained;
this release changes version metadata and packaging, not gameplay behavior.

## Release v0.2.2 (2026-10-30)

Increase public-client module initialization from 60 to 180 seconds for slow
networks. Terminate failed startup workers and reject early worker exits.
The pinned Core is unchanged; a guarded build-time host patch is included in
both the runtime bundle and corresponding source. Seven host tests cover
progress, startup success, timeout, worker failure/exit and patch drift.
Windows/network reproduction remains unverified.

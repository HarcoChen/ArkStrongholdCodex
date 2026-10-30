# Ark Play — Codex 插件

`0.2.1`：通过游戏站现有原生 `/ws` 对局。插件负责连接、紧凑局面、明确动作和原生客户端战斗；**采集、保存、导出入口、账号与鉴权规则由游戏站决定**。无独立网关、采集器、轨迹写盘或下载工具。

DSH 使用 Cordis 原生工具；Codex 插件包通过常驻 MCP 提供同样的工具，两端共用 [Ark Play Core](https://github.com/ArkStrongholdRL/ark-play-core) 的对局实现，本仓库仅保留 Codex MCP 入口与插件清单。MCP 是 Codex 工具接口，网站侧始终使用原生 WebSocket。旧0.1.0独立模拟器安装包已退役。

## 使用与安装

需要 Node 22+。仓库与发布zip均包含运行依赖和Worker文件，可直接安装，无需npm install；首次对局会从所配置站点读取公开规则数据和客户端模块，在内存中使用，无需本地引擎 checkout 或游戏美术。

源码执行 `node tools/configure.mjs`，发布包执行 `node configure.mjs`：

```sh
node configure.mjs
# 保存默认房间号（留空仍为单人）：
node configure.mjs --update --room-code AB12
# 自定义玩家名（最多 12 个字符）：
node configure.mjs --update --name "小刻"
# 自定义游戏站，可填根地址：
node configure.mjs --update --url https://your-game-site
```

默认站点为 [ark.minyako.top](https://ark.minyako.top)，无需先配置即可请求开局。脚本创建 `~/.config/ark-play/client.json`，权限 0600；已有文件需显式传 `--update` 才更新，并保留未指定的字段与凭据。可用 `--out` 或 `ARK_AGENT_CONFIG_FILE` 指定配置文件。保存后的设置在下一盘开局时读取，当前对局保持原设置。站点需要额外凭据时，按站点规则选配 `--headers-file private-headers.json`（JSON握手头）、`--token-file bearer-token`（Bearer）或 `--session-file native-session-token`（已有原生hello会话令牌）。后两种令牌含义不同；没有站点要求就无需配置。脚本不会连接、安装插件或显示凭据。

仓库附有市场索引 `.agents/plugins/marketplace.json`，条目为 `ark-play@ark-stronghold`，指向仓库根目录的完整插件。添加此仓库市场并安装：

```sh
codex plugin marketplace add HarcoChen/ArkStrongholdCodex --ref codex/wss-play
codex plugin add ark-play@ark-stronghold
```

桌面端也可在插件市场的添加来源入口填写仓库地址。发布 zip 含相同索引，解压后可用 `codex plugin marketplace add /absolute/ark-play-codex` 添加本地来源。需要时重启桌面端、在本地新对话使用。

更新仓库不会自动替换已安装插件的缓存。通过 Git 来源安装的用户，更新时运行：

```sh
codex plugin marketplace upgrade ark-stronghold
codex plugin add ark-play@ark-stronghold
```

本地目录来源在完成构建后，直接重新运行第二条安装命令。随后重启桌面端并新建聊天。发布者更新时须同步提升 `package.json`、lockfile、`plugin.json` 和 `.codex-plugin/plugin.json` 的版本，并提交重新构建的产物；不要求创建 GitHub Release，但不能把代码推送当作已安装插件更新完成。

根 `plugin.json` 是 portable manifest，`mcp.json` 配置 stdio MCP；`.codex-plugin/plugin.json` 提供 Codex 兼容 manifest。发布者与展示元数据已填写；根 `extensions.com.openai` 存在时优先于兼容文件，CI 检查两份信息一致。格式参考[官方插件打包文档](https://developers.openai.com/plugins/build/plugins)。仓库市场分发与官方公共目录收录是独立流程；本地 stdio MCP 的公共目录提交目前需要获准的合作伙伴资格，见[官方桌面插件提交要求](https://developers.openai.com/plugins/deploy/desktop-only)。

也可单独注册同一 MCP 入口：

```sh
codex mcp add ark -- node /absolute/ark-play-codex/dist/mcp.mjs
```

MCP SDK stdio入口已实测；Codex CLI 已实际读取仓库市场索引并列出正确插件及版本，桌面UI完整安装流程尚未单独验收。配置文件还支持 roomCode、name、headersFile、tokenFile、sessionFile；环境变量为 ARK_AGENT_URL / ARK_AGENT_ROOM_CODE / ARK_AGENT_NAME / ARK_AGENT_CONFIG_FILE / ARK_AGENT_HEADERS_FILE / ARK_AGENT_TOKEN_FILE / ARK_AGENT_SESSION_FILE。玩家名会去除两端空白，最多 12 个字符；默认玩家名为「笨蛋大肥龙」，`--name ""` 恢复默认名，修改后下一盘生效，LLM 标记保留。凭据只由客户端携带，服务器决定权限与有效期。原生会话令牌仅在进程内保存，不输出给模型；客户端重启不承诺恢复。

使用你信任的游戏站：客户端会执行该站点公开发布的规则模块。Worker隔离内容状态，不是操作系统权限沙箱。远程仅允许有效证书WSS；回环可用ws。原生站点无需新增Agent API或下载接口。

## 内置构筑 skill

插件随附 `ark-covenant-playbook`，用于七条盟约路线、核心三选一、金棋检索时机、装备站位与转型，也可显式使用 `$ark-covenant-playbook`。参考基于 0.3.1 的机制对照和专家候选先验，实际局面与当前站点公开说明优先，不代表已验证的最优策略。单独注册 MCP 不会加载插件 skill。

`ark_combat({scope:"last"})` 返回上一已结算回合（含联防），`scope:"match"` 汇总保留的已结束回合。伤害为对敌有效 HP 损失，承伤含自损／友伤，治疗排除过量与 restore 模式；召唤物计入所属干员。玩家占比对已观察战场总量，干员占比对其玩家总量，`shares` 为 0–1，零分母为 0。统计只覆盖本客户端模拟的场地（含同场伙伴），不是全队总榜。接管、重连重建和缺失会标明不完整；每玩家最多返回 256 行且保留完整分母，历史最多 64 场。每次结算后、下轮操作前按 skill 查询一次，终局先复盘再 finish；战斗中不轮询。

## 对局工具

| 工具 | 作用 |
| --- | --- |
| ark_start | 原生hello、创建solo房间并开始；默认深渊；可传roomCode加入已有房间并准备 |
| ark_view | 恢复完整紧凑局面；若正在结算，处理到下一决策或终局再返回 |
| ark_act | 1–8个明确动作；ready 后内部完成战斗、上报和结算，返回下一决策或终局 |
| ark_lookup | 读取公开卡牌、召唤物、装备、盟约、策略等文字与数值 |
| ark_combat | 查询已结算回合／本局的玩家和干员伤害、承伤、有效治疗、DPS/HPS 与占比；每回合结算后先查一次 |
| ark_finish | 原生room.leave并断开客户端；保存与处理归站点 |

提示示例：`用 ark_start 开一局深渊，根据公开局面和说明主动管理资金、手牌、晋升与摆放，玩到自然结束。只进行对局，不下载或管理轨迹。`

指定房间号示例：`ark_start({roomCode:"AB12"})`。省略 `roomCode` 使用配置文件或 `ARK_AGENT_ROOM_CODE`；传 `roomCode:""` 临时创建单人局。加入房间时采用房间难度，并自动准备；本次调用持续等待房主开始及自己的决策时机，再返回局面，不需要反复调用 `ark_view`。房间不存在、已满或已开始时返回站点错误，不自动另开单人局。

当前提供上述六个工具，不再向模型提供 `ark_wait`，`ark_act` 也不再接收 `advance` 开关。`ready` 后立即停止本批的剩余动作；插件后台计算战斗、上报原生结果，并处理站点推进，模型下一次看到的是可决策局面或完整终局结果。等待队友、别人回合、战斗及暂停恢复时，本次工具调用保持挂起，由 WS 推送唤醒，不发送状态查询，也不返回周期性的模型结果。房间关闭、连接失败或取消会结束等待；断线或取消不会撤销已接受的动作，应以一次 `ark_view` 恢复并继续等待，不能重复发送 `ready`。服务端强制计时和首领共享血池仍遵循原生规则。

发布构建对站点客户端的模块初始化最多等待 180 秒（原为 60 秒），加载失败后会终止 worker。首次加载需要下载站点公开模块，慢网络下可能超过一分钟。这项修复由 `tools/core-patches.mjs` 在构建时应用，发布包附带相应修改后的核心源码；直接运行 `src/mcp.mjs` 仍使用原始依赖，验证此修复请运行 `npm run build` 后的 `node dist/mcp.mjs`。

Codex 宿主仍可能对单次工具调用设置绝对超时。插件在客户端请求 progressToken 时发送 MCP 进度通知；这是协议活动，不是模型轮询，也不能绕过绝对超时。需要较长真人等待时，可使用独立 MCP 配置并设置 `tool_timeout_sec = 1800`；同时关闭插件内的同名 MCP，避免重复注册：

```toml
[plugins."ark-play@ark-stronghold".mcp_servers.ark]
enabled = false

[mcp_servers.ark]
command = "node"
args = ["/absolute/ark-play-codex/dist/mcp.mjs"]
tool_timeout_sec = 1800
```

此为可选宿主配置，插件不会自动修改全局配置。便携 `mcp.json` 的标准 schema 不支持 `tool_timeout_sec`，不能直接把该字段塞入插件声明。宿主超时后不要反复轮询或重复开局。

动作使用返回的本地快照revision；这是插件侧前置检查，不是服务端原子锁。过期会返回新局面且不发送该批动作；网络结果不确定时先ark_view，不盲目重试。每批提交前还用站点自身的协议校验器验证输入格式，合法目标/资源仍由服务器决定。接收原生ok不等于状态帧已到，客户端会合并随后public/private推送后再决策。短意图用于工具交互，不增加上游不认识的协议字段，不要求输出私密思维链。

## 如何跟进上游

独立 Core 仓库的 `src/rpc.mjs` 集中处理原生 `{t,rid}`、hello/welcome、房间、m.public/private/result、g.*、ok/error。两个插件壳不接触这些消息细节。`native-view.mjs`只投影玩家可见帧；种子、RNG、BattleSpec、会话令牌不进入模型局面。

站点提供 `/cs/<hash16>/index.json`，客户端校验数据长度/摘要、加载的sim/shared模块摘要以及整体内容身份。战斗通过站点自己的spec/simdata/trait模块运行，并按原生b.progress/b.result报告；无需复制或打包上游引擎。地形摆放参考复用站点纯UI helper；这些UI helper不在上游cs清单内，只限制从同一站点加载，不宣称由cs覆盖。

显式检查原生协议v1、应用0.3.0至0.3.3、vanilla内容身份；0.3.3已完成真实站点握手、内容校验与Worker加载，完整历史对局实测仍为0.3.1。当前仅支持默认官方玩法版本，历史版本房间会明确拒绝。上游升级超出兼容范围时明确报错，更新共享适配层即可。玩法插件content sets不支持；当前工具可创建独立 solo，或指定四位房间号加入已有房间并准备。

普通战斗用真实确定性引擎在后台快速计算；站点的准备/展示/结算计时保留。首领共享血池报告按站点时钟推进，不保证整盘瞬时结束。首领/隐藏关共享血池路径尚未完成端到端验收；本版是预览版。脚本对局不证明LLM棋力或端到端提速。

## 验证

真实0.3.1服务器、有效校验的本地TLS、完整原生协议，Codex SDK stdio入口与DSH注册工具各完成一局；服务器SP_VERIFY=all共复算10场普通战斗，0不一致、0结果拒绝、0接管。另一次直接共享客户端对局核对断线恢复不改变准备局面。旧快照拒绝、批量遇错误/阶段变化停止、DSH卸载清理均已核对。均为本地脚本接入验证，未驱动实际LLM模型、用户全局profile或云端部署。未新增测试、夹具或测试基础设施。

自动结算 patch 另在相同原生服务器上通过 Codex SDK stdio 与 DSH 注册工具各跑完一局：共 11 场普通战斗全量复算，0 不一致、0 结果拒绝、0 接管。所有返回均为决策阶段或完整终局，`ready` 后附带的刷新动作未跨轮执行。另核对取消及断线后的 `ark_view` 恢复，2 场复算一致，等待回调清理为 0。均为脚本接入核对，不代表模型棋力或首领路径验收。

## 源码构建与许可

```sh
npm ci --ignore-scripts
npm run build
```

本仓库与 [DSH 源码仓库](https://github.com/HarcoChen/dsh-ArkStronghold) 均固定依赖 [Ark Play Core](https://github.com/ArkStrongholdRL/ark-play-core) 的明确 Git 提交，并由 lockfile 校验归档完整性；发布bundle内置共享代码，无需另装核心。构建/打包CI覆盖Node22与24；每次提交/PR生成可下载的独立zip和摘要，发布GitHub Release后自动附加对应包。发布步骤见PUBLISH.md。源码仓库：[ArkStrongholdCodex](https://github.com/HarcoChen/ArkStrongholdCodex)。本版通过GitHub源码与Release包分发，未发布npm包。

GPL-3.0-or-later，见LICENSE。构建附第三方许可，发布包附对应源码；不含游戏引擎副本、美术、模型、凭据或对局记录。站点代码/数据来自[Stronghold-Protocol](https://github.com/sganggs/Stronghold-Protocol)，使用时遵守其许可和资源条款。Codex插件接口参照[官方MCP组件文档](https://developers.openai.com/plugins/build/mcp-server)。

插件连接时自动声明 LLM 玩家来源（Codex 或 DSH），支持该字段的站点会在房间、对局及结算中显示 LLM 标记，并随记录保留。该标记为客户端声明，不代表模型身份认证，也不启用游戏内 AI 托管。旧站点忽略可选声明，正常对局不受影响。

## 0.3.3 兼容更新

当前版本为 0.2.1，Core 固定 7450e17f37138e9d3a8636b1f345e094a98b1693。
现有六个对局工具，已实现战斗汇总统计；录像和多角色的后续设计见 [接口方案](docs/COMBAT-AND-MULTIROLE-DESIGN.md)。
Huawei 已于 2026-10-30 启用 0.3.3；使用旧客户端会报不支持版本。更新插件并重启／开启新会话后可加载新增工具。

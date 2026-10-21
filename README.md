# Ark Play — Codex 插件与共享对局核心

`0.2.0-alpha.1`：通过游戏站现有原生 `/ws` 对局。插件负责连接、紧凑局面、明确动作和原生客户端战斗；**采集、保存、导出入口、账号与鉴权规则由游戏站决定**。无独立网关、采集器、轨迹写盘或下载工具。

DSH 使用 Cordis 原生工具；Codex 插件包通过常驻 MCP 提供同样的工具，两端共用本仓库实现。MCP 是 Codex 工具接口，网站侧始终使用原生 WebSocket。旧0.1.0独立模拟器安装包已退役。

## 使用与安装

需要 Node 22+。发布 zip 包已包含运行依赖与 Worker 文件，解压后无需 npm install；首次对局会从所配置站点读取公开规则数据和客户端模块，在内存中使用，无需本地引擎 checkout 或游戏美术。

源码执行 `node tools/configure.mjs`，发布包执行 `node configure.mjs`：

```sh
node configure.mjs --url wss://your-game-site/ws
```

创建 `~/.config/ark-play/client.json`，权限0600、拒绝覆盖。站点需要额外凭据时，按站点规则选配 `--headers-file private-headers.json`（JSON握手头）、`--token-file bearer-token`（Bearer）或 `--session-file native-session-token`（已有原生hello会话令牌）。后两种令牌含义不同；没有站点要求就无需配置。脚本不会连接、安装插件或显示凭据。

Codex 可选择完整插件目录安装（plugin.json / mcp.json），也可直接注册同一入口：

```sh
codex mcp add ark -- node /absolute/ark-play-codex/dist/mcp.mjs
```

MCP SDK stdio入口已实测；Codex插件管理UI完整安装流程尚未单独验收。配置文件还支持 name、headersFile、tokenFile、sessionFile；环境变量为 ARK_AGENT_URL / ARK_AGENT_CONFIG_FILE / ARK_AGENT_HEADERS_FILE / ARK_AGENT_TOKEN_FILE / ARK_AGENT_SESSION_FILE。凭据只由客户端携带，服务器决定权限与有效期。原生会话令牌仅在进程内保存，不输出给模型；客户端重启不承诺恢复。

使用你信任的游戏站：客户端会执行该站点公开发布的规则模块。Worker隔离内容状态，不是操作系统权限沙箱。远程仅允许有效证书WSS；回环可用ws。原生站点无需新增Agent API或下载接口。

## 对局工具

| 工具 | 作用 |
| --- | --- |
| ark_start | 原生hello、创建solo房间并开始；默认深渊 |
| ark_view | 完整紧凑局面，断线后按站点会话恢复 |
| ark_act | 1–8个明确动作，附简短意图；遇拒绝/阶段或回合变化停止 |
| ark_wait | 等待原生事件到下一决策或终局，单次最多约25秒 |
| ark_lookup | 读取公开卡牌、召唤物、装备、盟约、策略等文字与数值 |
| ark_finish | 原生room.leave并断开客户端；保存与处理归站点 |

提示示例：`用 ark_start 开一局深渊，根据公开局面和说明主动管理资金、手牌、晋升与摆放，玩到自然结束。只进行对局，不下载或管理轨迹。`

动作使用返回的本地快照revision；这是插件侧前置检查，不是服务端原子锁。过期会返回新局面且不发送该批动作；网络结果不确定时先ark_view，不盲目重试。每批提交前还用站点自身的协议校验器验证输入格式，合法目标/资源仍由服务器决定。接收原生ok不等于状态帧已到，客户端会合并随后public/private推送后再决策。短意图用于工具交互，不增加上游不认识的协议字段，不要求输出私密思维链。

## 如何跟进上游

`src/rpc.mjs`集中处理原生 `{t,rid}`、hello/welcome、房间、m.public/private/result、g.*、ok/error。两个插件壳不接触这些消息细节。`native-view.mjs`只投影玩家可见帧；种子、RNG、BattleSpec、会话令牌不进入模型局面。

站点提供 `/cs/<hash16>/index.json`，客户端校验数据长度/摘要、加载的sim/shared模块摘要以及整体内容身份。战斗通过站点自己的spec/simdata/trait模块运行，并按原生b.progress/b.result报告；无需复制或打包上游引擎。地形摆放参考复用站点纯UI helper；这些UI helper不在上游cs清单内，只限制从同一站点加载，不宣称由cs覆盖。

显式检查原生协议v1、应用0.3.0/0.3.1、vanilla内容身份；完整实测为0.3.1。上游升级超出兼容范围时明确报错，更新共享适配层即可。玩法插件content sets不支持；当前工具只创建独立solo。

普通战斗用真实确定性引擎在后台快速计算；站点的准备/展示/结算计时保留。首领共享血池报告按站点时钟推进，不保证整盘瞬时结束。首领/隐藏关共享血池路径尚未完成端到端验收；本版是预览版。脚本对局不证明LLM棋力或端到端提速。

## 验证

真实0.3.1服务器、有效校验的本地TLS、完整原生协议，Codex SDK stdio入口与DSH注册工具各完成一局；服务器SP_VERIFY=all共复算10场普通战斗，0不一致、0结果拒绝、0接管。另一次直接共享客户端对局核对断线恢复不改变准备局面。旧快照拒绝、批量遇错误/阶段变化停止、DSH卸载清理均已核对。均为本地脚本接入验证，未驱动实际LLM模型、用户全局profile或云端部署。未新增测试、夹具或测试基础设施。

## 源码构建与许可

```sh
npm ci --ignore-scripts
npm run build
```

[DSH源码仓库](https://github.com/HarcoChen/dsh-ArkStronghold)固定依赖本仓库的明确Git提交；发布bundle内置共享代码，无需另装核心。发布步骤见PUBLISH.md。源码仓库：[ArkStrongholdCodex](https://github.com/HarcoChen/ArkStrongholdCodex)。本版通过GitHub源码与Release包分发，未发布npm包。

GPL-3.0-or-later，见LICENSE。构建附第三方许可，发布包附对应源码；不含游戏引擎副本、美术、模型、凭据或对局记录。站点代码/数据来自[Stronghold-Protocol](https://github.com/sganggs/Stronghold-Protocol)，使用时遵守其许可和资源条款。Codex插件接口参照[官方MCP组件文档](https://developers.openai.com/plugins/build/mcp-server)。

# 发布0.2.0-alpha.1

这是原生/ws客户端预览版，不发布旧0.1.0采集网关原型。

1. 源码仓库分别为HarcoChen/ArkStrongholdCodex与HarcoChen/dsh-ArkStronghold。DSH固定核心Git提交，协议修正只维护核心一处。
2. 两仓库相邻，分别npm ci --ignore-scripts；先在核心npm run build，再在DSH npm run build。
3. 核心运行node tools/package.mjs /absolute/release-output。打包需要系统zip命令，客户端运行不需要。脚本拒绝覆盖已有归档，输出两个独立zip及SHA256清单。
4. 在各仓库创建0.2.0-alpha.1预览Release并附对应zip。对应源码已附在zip，且仓库源码保留GPL许可；不提交游戏数据、凭据、轨迹、node_modules；dist运行文件与许可需随仓库提交，保证插件仓库安装可用。
5. 安装指向解压目录。源码构建可分别克隆两仓库；DSH的npm ci会安装固定提交的核心，不依赖相邻目录。发布打包脚本则约定作者将两源码仓库相邻放置。

## 可直接使用的Release说明

Ark Play首个原生游戏站对局预览版：Codex插件与DSH原生插件共用原生/ws适配，提供紧凑局面、明确动作批量、卡牌查询与后台原生战斗计算。采集、保存、导出、账号鉴权均交由游戏站，插件不下载轨迹。

验证：本地0.3.1服务器、证书校验的WSS，两个真实工具入口各完成一局；服务器全量复算共10场普通战斗且无不一致/结果拒绝/接管。未驱动实际LLM或宣称棋力提升。仅vanilla solo；首领/隐藏关共享血池及玩法插件房间尚未完整验收，站点计时不会跳过。需要Node22+及可信站点/ws与公开内容模块；详见README。

安装与发布是独立步骤；上传源码不会修改用户全局配置或部署游戏站。GitHub预览Release需附对应zip。

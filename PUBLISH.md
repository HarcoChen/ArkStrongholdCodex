# 发布0.2.0-alpha.1

这是原生/ws客户端预览版，不发布旧0.1.0采集网关原型。

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

## 可直接使用的Release说明

Ark Play首个原生游戏站对局预览版：Codex插件与DSH原生插件共用原生/ws适配，提供紧凑局面、明确动作批量、卡牌查询与后台原生战斗计算。采集、保存、导出、账号鉴权均交由游戏站，插件不下载轨迹。

验证：本地0.3.1服务器、证书校验的WSS，两个真实工具入口各完成一局；服务器全量复算共10场普通战斗且无不一致/结果拒绝/接管。未驱动实际LLM或宣称棋力提升。仅vanilla solo；首领/隐藏关共享血池及玩法插件房间尚未完整验收，站点计时不会跳过。需要Node22+及可信站点/ws与公开内容模块；详见README。

安装与发布是独立步骤；上传源码不会修改用户全局配置或部署游戏站。GitHub预览Release需附对应zip。

# 在线学习站

发布地址：[通往 Linux 之路](https://zhuguang-zfg.github.io/linux/)。内容源仍是仓库中的 Markdown、动画和媒体元数据，不维护第二份手写正文。

## 本地预览

需要 Node.js 22.12+ 和 pnpm 11.5.0：

```bash
pnpm install --frozen-lockfile
node scripts/check-media.mjs
node scripts/sync-media.mjs --check
pnpm run build
pnpm run preview
```
打开 `http://127.0.0.1:4173/linux/`。需要换端口时设置 `COURSE_PORT=4174 pnpm run preview`，Playwright 也会使用同一个端口。生成文件在 `_site/`，不提交到 Git；不要直接用 file:// 打开首页，因为课程目录、搜索索引和按源路径拆分的章节正文需要通过 HTTP 加载。

## 阅读与媒体

- 首页先加载轻量课程目录；章节正文按需从 `_site/data/docs/` 读取并按 Markdown 源路径缓存，旧的 `#read=docs%2F...` 深链接保持有效。
- 搜索章节全文时才加载独立的 `data/search.json`；视频和动画目录随课程目录一起可用。
- 搜索章节、视频和动画，支持 `/` 聚焦搜索。
- 章节正文由 Marked 构建，经过 sanitize-html 清理；Mermaid 在阅读时按需加载。
- 学习标记只保存在当前浏览器 localStorage，不上传到服务器。
- 视频点击加载后才创建官方 iframe，保留原站入口，禁止自动播放。
- B站使用已核对的 bvid / cid / p；YouTube 使用官方嵌入地址并发送正常来源信息。
- 视频元数据核验与完整实播分开记录，平台限制、地区和登录状态可能影响播放。
- 动画默认暂停，支持播放、单步、重播、速度和时间拖动；文字步骤保持可读。

## 更新内容

1. 修改正文 Markdown，或修改 `scripts/animation_scenes.py` 后运行 `python3 -B scripts/build-animations.py`。
2. 维护视频选段时修改 `scripts/verify-videos.py`，显式运行它获取新的平台元数据；此命令需要联网，CI 不执行。
3. 修改 `scripts/sync-media.mjs` 中的章节推荐和适用说明，运行 `node scripts/sync-media.mjs` 同步映射、视频库与章节视频段落。
4. 执行内容、媒体、构建和浏览器测试。

## 浏览器测试

```bash
pnpm exec playwright install chromium
pnpm run build
pnpm run test:site
```

默认使用 Playwright Chromium，避免依赖本机安装的 Chrome。端口被占用时，设置 `COURSE_PORT` 后重试；预览服务会报告冲突端口而不是等待超时。测试覆盖阅读、搜索、手机目录、进度保存、Mermaid、复制代码、官方嵌入参数以及动画控制。测试中的第三方播放器响应为固定测试页面，不把它算成真实视频播放通过。

## 发布

现有 CI 先运行教程回归，再构建并测试站点。只有 main 的 push 且所有检查通过时，才上传并部署 GitHub Pages 产物。部署权限限定为该任务所需的 Pages 和 OIDC 权限。

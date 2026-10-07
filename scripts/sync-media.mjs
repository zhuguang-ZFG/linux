import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(path.join(root, name), 'utf8');
const checking = process.argv.includes('--check');
const drift = [];
const write = (name, value) => {
  if (checking) {
    if (read(name).replaceAll('\r\n', '\n') !== value.replaceAll('\r\n', '\n')) drift.push(name);
  } else writeFileSync(path.join(root, name), value);
};
const videos = JSON.parse(read('resources/videos.json'));
const byId = new Map(videos.videos.map(video => [video.id, video]));
const animations = JSON.parse(read('assets/animations/catalog.json'));
const chapters = [...read('README.md').matchAll(/\]\((docs\/[^)]+\.md)\)/g)].map(match => match[1]);
const picks = {
  '00-onboarding/01': ['y-linux100', 'b-applications'], '00-onboarding/02': ['y-linux100', 'b-distros', 'b-unix'],
  '00-onboarding/03': ['b-distros'], '00-onboarding/04': ['y-linux-crash', 'b-install-ubuntu'], '00-onboarding/05': ['y-commands', 'b-shell-basics'],
  '01-basics/01': ['y-commands', 'b-dir-cmds', 'b-dir-structure'], '01-basics/02': ['b-vim', 'b-vim-keys'], '01-basics/03': ['b-permissions', 'b-user-mgmt', 'b-chmod'],
  '01-basics/04': ['b-archive', 'b-archive2'], '01-basics/05': ['b-apt', 'b-apt-src'], '01-basics/06': ['b-process', 'b-process-tree', 'b-kill-proc'],
  '01-basics/07': ['b-env', 'b-set-env'], '01-basics/08': ['b-man'], '01-basics/09': ['y-linux-things'],
  '02-advanced/01': ['b-redirection'], '02-advanced/02': ['b-grep', 'b-find'], '02-advanced/03': ['y-sed'],
  '02-advanced/04': ['y-awk'], '02-advanced/05': ['b-bash', 'b-shell-loop'], '02-advanced/06': ['b-systemd', 'b-logs', 'b-logs-service', 'y-systemd'],
  '02-advanced/07': ['b-disk', 'b-partition', 'b-disk-add'], '02-advanced/08': ['b-ssh', 'b-scp', 'b-nat'], '02-advanced/09': ['y-git'],
  '03-pro/01': ['b-process', 'b-io-monitor', 'y-gregg60s'], '03-pro/02': ['b-distros', 'b-kernel-read', 'y-linux-things'], '03-pro/03': ['b-ssh', 'b-hidden-perm'],
  '03-pro/04': ['y-docker'], '03-pro/05': ['b-cron', 'b-cron-apply', 'y-ansible'], '03-pro/06': ['b-bash', 'b-shell-func', 'b-shell-practice'],
  '03-pro/07': ['y-local-ai'], '04-projects/项目1': ['y-systemd', 'b-mysql'], '04-projects/项目2': ['b-process', 'b-bash', 'b-count-stats', 'b-cron-backup'],
  '04-projects/项目3': ['y-docker', 'b-tunnel-basics', 'b-nps'], '04-projects/项目4': ['y-local-ai'], '04-projects/项目5': ['y-systemd', 'y-linux-full', 'b-boot-flow'],
  '05-raspberry-pi/01': ['y-pi-intro'], '05-raspberry-pi/02': ['y-pi-overview'], '05-raspberry-pi/03': ['b-ssh'],
  '05-raspberry-pi/04': ['y-gpio'], '05-raspberry-pi/05': ['y-docker'], '05-raspberry-pi/06': ['b-pi-llm', 'b-pi-llava'],
  '05-raspberry-pi/07': ['y-gpio'],
};
const notes = {
  '00-onboarding/02': '先建立内核与发行版的背景，不代替本章历史阅读。',
  '00-onboarding/04': '基础操作预习；安装步骤与版本以本章为准。',
  '00-onboarding/05': 'Shell 基础补充；终端练习仍按本章实验。',
  '01-basics/01': '目录结构背景与指令演示；具体操作按本章实验记录。',
  '01-basics/02': 'vim 快捷键补充；模式切换按本章动画与实验练习。',
  '01-basics/03': '用户管理与权限修改补充；命令以本教程当前环境说明为准。',
  '01-basics/04': '压缩与解压进阶；参数组合与覆盖风险以本章为准。',
  '01-basics/05': '软件源与更新实例；不要直接套用其他发行版的源结构。',
  '01-basics/06': '进程观察、父子关系与终止信号的补充；信号操作只对测试进程执行。',
  '01-basics/07': '环境变量设置的补充；PATH 定位顺序仍按本章实验验证。',
  '01-basics/09': '知识全景补充，实物识别与机器记录仍需按正文完成。',
  '02-advanced/02': '查找工具补充；grep 正则与选项按本章实验验证。',
  '02-advanced/05': 'Shell 循环补充；脚本语法、退出码与失败处理按本章验证。',
  '02-advanced/06': '服务管理与日志原理补充；journalctl 查询按本章实验。',
  '02-advanced/07': '磁盘扩容实例；操作前确认设备名并完成备份。',
  '02-advanced/08': '远程传输与 NAT 原理补充；网络配置与加固以本章为准。',
  '03-pro/01': '进程观察与 USE 方法的背景；性能结论按正文实验核对。',
  '03-pro/02': '内核源码阅读方法；本章的系统调用实验仍是验收依据。',
  '03-pro/03': 'SSH 与隐藏权限补充；加固策略与最终配置验证以正文为准。',
  '03-pro/05': '定时任务实例；cron 环境与路径差异按本章实验验证。',
  '03-pro/06': 'Shell 基础、函数与实战补充；并发、trap 和失败处理仍需按本章验证。',
  '03-pro/07': '展示本地模型工具背景，不代替人工审阅与证据核对。',
  '04-projects/项目1': '服务管理与数据库安装预备；LNMP 完整部署与验收见正文。',
  '04-projects/项目2': '巡检相关统计与定时备份演示；脚本与验收标准以本章为准。',
  '04-projects/项目3': '内网穿透原理与工具演示；方案选择与暴露面控制见正文。',
  '04-projects/项目5': '排障的工具背景与启动流程；案例根因需要自己的现场证据。',
  '05-raspberry-pi/01': '仅为课程介绍与硬件背景，不是完整树莓派课程。',
  '05-raspberry-pi/02': '仅为工作坊概览；当前 Imager 烧录流程以正文和官方说明为准。',
  '05-raspberry-pi/05': '容器基础补充，Samba 与家庭存储配置见正文。',
  '05-raspberry-pi/06': '第三方厂商教程演示 Pi 5 部署流程；模型选择、内存与温度按本章实验记录。',
  '05-raspberry-pi/07': 'GPIO 基础复习，CSV 记录程序和采样限制以本章为准。',
};
const output = {};
for (const chapter of chapters) {
  const key = Object.keys(picks).find(prefix => chapter.startsWith(`docs/${prefix}-`));
  if (!key) throw new Error(`Missing deliberate media mapping: ${chapter}`);
  const references = picks[key].map(id => {
    if (!byId.has(id)) throw new Error(`Missing video ${id}`);
    return { id, note: notes[key] || '观看对应主题后，回到本章用实际输入和输出验证。' };
  });
  const related = animations.filter(item => item.chapter === chapter);
  let text = read(chapter).replaceAll('\r\n', '\n');
  // Canonical inline block: exactly one blank line after the heading and one before
  // the following section, so repeated runs stay idempotent across every chapter.
  const inlineBlock = animation => `\n\n![${animation.title}原理动画](../../assets/animations/${animation.file})\n\n[在学习站暂停、单步或重播](https://zhuguang-zfg.github.io/linux/#animation=${animation.file})。动画中的输入输出为教学示意，需用本章实验验证。\n\n`;
  const inlineBlockPattern = animation => {
    const file = animation.file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\n*!\\[[^\\]]*原理动画\\]\\(\\.\\.\\/\\.\\.\\/assets\\/animations\\/${file}\\)\\n+\\[在学习站暂停、单步或重播\\]\\(https:\\/\\/zhuguang-zfg\\.github\\.io\\/linux\\/#animation=${file}\\)。动画中的输入输出为教学示意，需用本章实验验证。\\n*`);
  };
  for (const animation of related.filter(item => item.height === 640)) {
    const existing = inlineBlockPattern(animation);
    if (existing.test(text)) text = text.replace(existing, '\n\n');
    if (!text.includes(`assets/animations/${animation.file}`)) {
      text = text.replace(/(^## .*核心概念|^## .*方案设计)[ \t]*\n+/m, (match, heading) => `${heading}${inlineBlock(animation)}`);
    }
  }
  const inlineAnimations = [...text.matchAll(/assets\/animations\/([\w-]+\.svg)/g)].map(match => match[1]);
  output[chapter] = { videos: references, animations: [...new Set([...related.map(item => item.file), ...inlineAnimations])].filter(file => animations.some(item => item.file === file)) };
  const marker = text.search(/^## .*推荐视频\s*$/m);
  if (marker < 0) throw new Error(`Missing video section: ${chapter}`);
  const start = text.indexOf('\n', marker) + 1;
  const next = text.slice(start).search(/^## /m);
  const end = next < 0 ? text.length : start + next;
  const lines = references.map(({ id, note }) => {
    const video = byId.get(id);
    const time = video.duration ? `${Math.floor(video.duration / 60)}分${video.duration % 60}秒` : '时长以原站为准';
    return `- [${video.platform === 'bilibili' ? 'B站' : 'YouTube'} · ${video.title}](${video.url}) — ${video.author}${video.page ? `，P${video.page}` : ''}，${time}。${note}`;
  });
  const firstVideo = references.length ? byId.get(references[0].id) : null;
  const cover = firstVideo ? `\n\n[![${firstVideo.title} 视频封面](${firstVideo.thumbnail})](${firstVideo.url})` : '';
  const content = lines.length ? lines.join('\n') + cover : '本章暂不收录不匹配的泛用视频。先完成图像采集与 OCR 实验，后续加入明确对应硬件和软件版本的演示。';
  write(chapter, `${text.slice(0, start)}\n${content}\n\n[在学习站查看配套媒体](https://zhuguang-zfg.github.io/linux/#read=${encodeURIComponent(chapter)}) · [视频资料与核验说明](../../resources/videos.md)。标题、作者和分P已核对，未逐条完成实播，播放限制以原站为准。\n\n${text.slice(end)}`);
}
write('resources/chapter-media.json', `${JSON.stringify(output, null, 2)}\n`);
const duration = seconds => seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '待补充';
let library = '# 视频课堂与核验记录\n\n';
library += `共 **${videos.videos.length} 条视频或课程选段**，B站分P分别计为选段，不把同一套课程包装成多套课程。核验日期：${videos.checkedAt.slice(0, 10)}。\n\n`;
library += '[打开可嵌入播放的学习站](https://zhuguang-zfg.github.io/linux/#videos) · [按章节查看配套关系](chapter-media.json)\n\n';
library += '本页核对原站标题、作者、分P/CID及可获取的时长。**元数据可读不等于已完整观看或在所有地区可播放**；每条实播状态保存在 [videos.json](videos.json)。GitHub Markdown 使用跳转链接，学习站使用官方外链播放器并保留原站入口。\n\n';
for (const [platform, name] of [['bilibili', 'B站 · 中文选段'], ['youtube', 'YouTube · 专题与概览']]) {
  library += `## ${name}\n\n| 主题 | 作者 | 分P / 类型 | 时长 | 原站 |\n|---|---|---|---|---|\n`;
  for (const video of videos.videos.filter(item => item.platform === platform)) {
    library += `| ${video.title} | ${video.author.replaceAll('|', '\\|')} | ${video.page ? `P${video.page}` : video.kind} | ${duration(video.duration)} | [观看](${video.url}) |\n`;
  }
  library += '\n';
}
library += '## 怎么看才有效\n\n1. 先确认本章使用的发行版、硬件和工具版本。旧课里的 CentOS、GPIO 库或安装步骤不能直接套用。\n2. 优先看指定分P。没有可靠时间戳的长视频不编造跳转时间，按原站目录定位。\n3. 视频结束后完成本章实验，保存自己的输出；模型建议、视频画面与实测结果分开记录。\n4. 两条树莓派 overview/introduction 已明确标为概览，不再称作完整课程。\n5. 若嵌入被作者、平台、登录或网络条件限制，使用原站链接。本站不下载、搬运或去除视频水印。\n\n';
library += '播放器依据：[B站官方站外播放器](https://player.bilibili.com/) · [YouTube 官方嵌入参数](https://developers.google.com/youtube/player_parameters)。视频版权归各创作者所有。\n';
write('resources/videos.md', library);
if (drift.length) { console.error(`Media content needs regeneration: ${drift.join(', ')}`); process.exitCode = 1; }
else console.log(`${checking ? 'Verified' : 'Mapped'} ${chapters.length} chapter media mappings and video sections`);

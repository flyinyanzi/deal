# DEAL? / 一掷千金 V2.2 MOBILE SAFE

这版是针对手机 Safari 的双故障点修复：

1. 去掉所有 backdrop-filter / blur，避免 Deal 成交层退出时黑屏。
2. Deal 后的模拟阶段完全不再使用：
   - caseReveal overlay
   - bankerOverlay
   - 假 Banker 报价动画
3. 模拟阶段改为游戏页面内普通信息条：
   - 开箱金额
   - 假想 Banker 报价
   - 最终 YOUR CASE 揭晓
4. 正常游戏（Deal 前）的 Banker 来电、报价、Deal / No Deal 逻辑保持不变。
5. 静态资源使用新文件名：
   - style-v2.2.css
   - script-v2.2.js
6. 页面版本号：V2.2 MOBILE SAFE

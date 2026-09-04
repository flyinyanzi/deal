# DEAL? / 一掷千金 V2.3

关键修复：
- 移除模拟状态下 `.case-btn.sim-mode { filter: saturate(.55) }`
- 不再给 26 个箱子添加 `sim-mode` class
- 这能解释：
  - V2.1：继续模拟时立即 renderCases -> 所有箱子加 filter -> 手机黑屏
  - V2.2：进入模拟不 renderCases；第一次点箱子才 renderCases -> 此时才崩
- 模拟状态视觉提示改为只改变顶部状态卡的边框/背景，不对箱子使用 filter
- 文件名恢复固定：
  - index.html
  - style.css
  - script.js
  - README.md
- 用 `?v=2.3` 做缓存更新，不再改实体文件名

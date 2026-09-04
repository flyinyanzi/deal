# DEAL? / 一掷千金 V2.1 CACHEFIX

这版基于 V2.0 CLEAN，但把静态资源改成全新的文件名：

- `style-v2.1.css`
- `script-v2.1.js`

目的：彻底避免 GitHub Pages / 手机浏览器继续复用旧版 `style.css` 或 `script.js`，
导致“新版 HTML + 旧版 JS”这种混版运行时错误。

以后每次发布新版本，都建议同步修改 CSS/JS 文件名或资源版本号。

页面会明确显示 `V2.1 CACHEFIX`。

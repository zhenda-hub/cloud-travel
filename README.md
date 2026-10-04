# 云旅游 · Cloud Travel

在云端，遇见远方 —— 一个纯静态的旅游主题网站。

精选国内目的地与主题路线，深色天空渐变 + 云层动效 + 滚动渐入。

## 特点

- **零依赖**：原生 HTML / CSS / JS，无框架、无 CDN、无构建步骤
- **离线可用**：所有图形都是内联 SVG / CSS 渐变，不加载任何外部资源
- **响应式**：桌面 / 平板 / 手机自适应
- **可直接部署**：GitHub Pages / 任意静态托管，开箱即用

## 目录结构

```
cloud-travel/
├─ index.html      页面结构：Hero · 目的地 · 主题路线 · 为什么 · 页脚
├─ css/style.css   主题变量、云层动效、卡片、响应式
├─ js/main.js      导航状态、滚动渐入、云层视差
└─ README.md
```

## 本地预览

```bash
# 任选一个静态服务器，例如：
python -m http.server 8765
# 然后打开 http://127.0.0.1:8765/
```

也可以直接双击 `index.html`（本页无跨域资源，`file://` 也能正常显示）。

## 部署到 GitHub Pages

1. 打开仓库 **Settings → Pages**
2. Source 选 `Deploy from a branch`
3. Branch 选 `main`，目录选 `/ (root)`
4. 保存后访问 `https://<用户名>.github.io/cloud-travel/`

## 自定义

- **配色 / 圆角 / 阴影**：改 `css/style.css` 顶部的 `:root` 变量
- **目的地卡片**：复制 `index.html` 里的 `<article class="card">`，改
  `style="--a:#..;--b:#.."`（卡片缩略图的两个渐变色）、`<span class="tag">`、`<h3>`、`<p>`
- **主题路线**：复制 `.route` 块，改序号、标题、描述和天数

## 说明

内容为示例，实际出行请以当地情况为准。

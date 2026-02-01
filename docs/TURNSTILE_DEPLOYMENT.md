# Turnstile 验证码部署指南

本文档说明如何在不同的 Cloudflare 部署环境中配置 Turnstile 验证码。

## 工作原理

项目使用 **按需加载模态框** 方案：
1. 用户点击登录/注册按钮时，系统检查是否配置了 Turnstile site key
2. 如果配置了 site key，弹出验证模态框
3. TurnstileModal 组件动态加载 Turnstile 脚本
4. 验证成功后自动提交表单

## 配置要求

### 1. 获取 Turnstile Site Key

1. 访问 [Cloudflare Turnstile Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
2. 创建新的 Turnstile 站点
3. 添加允许的域名：
   - 本地开发：`localhost`
   - 生产环境：你的实际域名（例如：`hrt-tracker.pages.dev`）
4. 获取 **Site Key**（公开密钥，用于前端）
5. 获取 **Secret Key**（私密密钥，用于后端验证）

### 2. 配置环境变量

项目支持多种环境变量来源，优先级如下：
```
window.__ENV__ (运行时) > globalThis (运行时) > import.meta.env (构建时)
```

## 部署场景

### 场景 1: Cloudflare Pages（无 Worker）

**特点**：静态站点托管，无法在运行时注入环境变量

**配置步骤**：

1. 在 Cloudflare Dashboard 配置环境变量
   ```
   项目 → Settings → Environment Variables

   变量名: VITE_TURNSTILE_SITE_KEY
   值: 0x4AAAAAACNK04dmEz0g0aG7 (你的 site key)

   变量名: VITE_API_BASE_URL
   值: https://hrt-service.transmtf.com/api
   ```

2. 触发重新构建
   - 环境变量会在构建时被 Vite 嵌入到代码中
   - 必须重新部署才能生效

3. 验证部署
   - 打开浏览器控制台
   - 访问登录页面，点击登录按钮
   - 查看控制台日志：`[TurnstileModal] Site key: Found`

### 场景 2: Cloudflare Workers（使用 wrangler.toml）

**特点**：通过 Worker 在运行时注入环境变量

**配置步骤**：

1. 编辑 `wrangler.toml`
   ```toml
   [vars]
   VITE_TURNSTILE_SITE_KEY = "0x4AAAAAACNK04dmEz0g0aG7"
   VITE_API_BASE_URL = "https://hrt-service.transmtf.com/api"
   ```

2. 部署 Worker
   ```bash
   wrangler deploy
   ```

3. Worker 工作流程
   - Worker 拦截 HTML 请求
   - 使用 HTMLRewriter 注入 `<script>window.__ENV__=...</script>`
   - 前端代码从 `window.__ENV__` 读取配置

4. 验证部署
   - 查看页面源代码（右键 → 查看页面源代码）
   - 应该能看到 `<script>window.__ENV__={"VITE_TURNSTILE_SITE_KEY":"0x4AAAAAACNK04dmEz0g0aG7",...}</script>`

### 场景 3: Cloudflare Workers（使用 Dashboard）

**特点**：通过 Dashboard 配置环境变量

**配置步骤**：

1. 在 Cloudflare Dashboard 配置
   ```
   Workers & Pages → 选择你的 Worker → Settings → Variables

   添加环境变量：
   - VITE_TURNSTILE_SITE_KEY: 0x4AAAAAACNK04dmEz0g0aG7
   - VITE_API_BASE_URL: https://hrt-service.transmtf.com/api
   ```

2. 重新部署 Worker
   - Dashboard 配置的变量优先级高于 `wrangler.toml`
   - 修改后需要重新部署

## 本地开发

1. 创建 `.env` 文件
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env`
   ```
   VITE_API_BASE_URL=https://hrt-service.transmtf.com/api
   VITE_TURNSTILE_SITE_KEY=0x4AAAAAACNK04dmEz0g0aG7
   ```

3. 启动开发服务器
   ```bash
   npm run dev
   ```

4. 注意：本地开发使用 Vite dev server，不经过 Worker

## 故障排查

### 问题：部署后看不到验证码

**检查步骤**：

1. **确认 site key 是否可用**
   ```javascript
   // 在浏览器控制台运行
   console.log(window.__ENV__?.VITE_TURNSTILE_SITE_KEY)
   console.log(import.meta.env.VITE_TURNSTILE_SITE_KEY)
   ```

2. **检查控制台日志**
   - 打开浏览器开发者工具
   - 点击登录按钮
   - 查看以 `[TurnstileModal]` 开头的日志
   - 如果看到 "No site key available"，说明环境变量未配置

3. **检查网络请求**
   - Network 标签页
   - 应该能看到 `https://challenges.cloudflare.com/turnstile/v0/api.js`
   - 如果 404 或被拦截，检查 CSP 策略或广告拦截器

4. **检查页面源代码**（仅适用于 Worker 部署）
   - 右键 → 查看页面源代码
   - 搜索 `window.__ENV__`
   - 应该能找到注入的脚本

### 问题：CSP (Content Security Policy) 阻止

如果你的站点有自定义 CSP 策略，需要添加：

```
Content-Security-Policy:
  script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://cdn.tailwindcss.com;
  frame-src https://challenges.cloudflare.com;
  connect-src 'self' https://challenges.cloudflare.com;
```

### 问题：site key 域名不匹配

Turnstile site key 绑定到特定域名：
- 确保在 Turnstile Dashboard 中添加了生产域名
- 本地开发需要添加 `localhost`
- 域名必须完全匹配（包括协议和端口）

## 后端配置（重要）

前端只负责获取 Turnstile token，**后端必须验证 token**：

1. 获取 Turnstile **Secret Key**（不是 Site Key）

2. 在登录/注册接口验证 token
   ```
   POST https://challenges.cloudflare.com/turnstile/v0/siteverify
   {
     "secret": "your_secret_key",
     "response": "token_from_frontend",
     "remoteip": "user_ip" // 可选
   }
   ```

3. 如果后端不验证 token，用户可以绕过前端验证

参考文档：[Turnstile 服务端验证](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

## 技术细节

### 动态加载流程

1. 用户点击提交按钮
2. 系统检查是否有 site key（多源检查）
3. 如果有 site key 但无 token，显示模态框
4. TurnstileModal 动态加载 Turnstile 脚本（如果未加载）
5. 渲染 Turnstile widget
6. 用户完成验证
7. 获取 token 后自动提交表单

### Site Key 读取优先级

```typescript
// src/components/TurnstileModal.tsx
const siteKey =
  runtimeEnv.__ENV__?.VITE_TURNSTILE_SITE_KEY ||  // Worker 注入
  runtimeEnv.VITE_TURNSTILE_SITE_KEY ||           // 全局变量
  import.meta.env.VITE_TURNSTILE_SITE_KEY ||     // Vite 构建时
  '';
```

### 文件变更说明

- ✅ `src/components/TurnstileModal.tsx` - 新增模态框组件
- ✅ `src/pages/Login.tsx` - 使用模态框
- ✅ `src/pages/Register.tsx` - 使用模态框
- ✅ `worker.ts` - 注入 `window.__ENV__`
- ✅ `index.html` - 移除静态 Turnstile 脚本（改为动态加载）

## 安全建议

1. **不要在前端硬编码 Secret Key**
   - Site Key 是公开的，可以在前端使用
   - Secret Key 必须保密，只能在后端使用

2. **后端必须验证 token**
   - 前端验证只是用户体验
   - 真正的安全依赖后端验证

3. **限制域名**
   - 在 Turnstile Dashboard 中只添加你的合法域名
   - 避免使用通配符

4. **日志脱敏**
   - 生产环境考虑减少控制台日志
   - 不要记录用户敏感信息

## 总结

- **Pages 部署**：必须在构建时设置环境变量
- **Workers 部署**：可以在运行时注入环境变量
- **本地开发**：使用 `.env` 文件
- **后端验证**：必须使用 Secret Key 验证 token

如有问题，检查：
1. Site key 是否正确配置
2. 域名是否在 Turnstile 白名单中
3. 浏览器控制台是否有错误日志
4. 网络请求是否成功

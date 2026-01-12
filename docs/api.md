# API 文档

## 认证

### 1.4 注销当前登录

注销当前设备的登录状态（使当前 refresh token 失效）。

**接口：** `POST /auth/logout`

**需要认证：** 是

**请求体：** 无

**成功响应 (200)：**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": {
    "revoked_count": 1
  }
}
```

**错误响应：**
- `401` - 未授权（令牌无效）
- `500` - 服务器内部错误

**说明：**
- 该接口会删除当前会话对应的 refresh token，使其无法再用于刷新 access token。

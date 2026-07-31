# AI 退款投诉助手部署

## 本地运行

```bash
cd "/Volumes/外置硬盘/claude code/giffgaff"
npm start
```

- 客户页面：`http://127.0.0.1:8765/refund-agent.html`
- 管理后台：`http://127.0.0.1:8765/refund-agent-admin.html`
- 首次启动生成的后台密码：`.data/admin-password.txt`

## 生产环境变量

```text
PORT=8765
HOST=0.0.0.0
AGENT_ADMIN_PASSWORD=设置一个足够长的后台密码
AGENT_CONFIG_SECRET=设置一个至少32字节的随机加密密钥
AGENT_DATA_DIR=/data/services/giffgaff-refund-agent/shared/data
```

`AGENT_CONFIG_SECRET` 用于加密后台保存的 API Key。更换该值后，已经保存的
API Key 需要在管理后台重新填写。

## 接口设置

进入管理后台的“AI接口设置”，填写：

```text
API Base URL: https://api.openai.com/v1
API Key:      OpenAI项目API Key
模型名称:     当前项目可使用的模型名称
```

先点击“测试接口”，成功后开启“允许客户提交”并保存。

## 数据目录

运行数据保存在 `.data/`，已加入 `.gitignore`：

- `config.json`：接口设置，API Key 为 AES-256-GCM 加密文本；
- `jobs.json`：队列与最近任务；
- `experience.json`：跨案例匿名拒绝模式和策略经验；
- `agent-secret`：本地生成的加密密钥；
- `admin-password.txt`：本地生成的后台密码。

生产环境需要为 `.data/` 挂载持久化磁盘。多实例部署时需要把本地队列替换为
共享数据库与 Redis 队列；当前版本应只运行一个服务器实例，以保证全站严格
并发为 1。

## 健康检查

```text
GET /api/refund-agent/health
```

返回接口配置状态、暂停状态、正在处理数量和排队人数。

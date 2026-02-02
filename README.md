# StreamSight - 用户行为录制与回放系统

StreamSight 是一个基于 TypeScript 的用户行为录制与回放系统，采用 Monorepo 架构，支持高效的事件采集、压缩存储和安全回放。

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
# 方式一：使用安装脚本（推荐）
./scripts/setup.sh

# 方式二：手动安装
pnpm install
pnpm build
```

### 本地开发

1. **启动后端服务**
```bash
pnpm backend
# 或者
pnpm --filter @streamsight/backend-api dev
```

2. **启动演示应用**
```bash
pnpm demo
# 或者
pnpm --filter @streamsight/demo-app dev
```

3. **启动回放平台**
```bash
pnpm replay
# 或者
pnpm --filter @streamsight/replay-platform dev
```

4. **一键启动所有服务**
```bash
pnpm e2e
```

### E2E 验证流程

#### 方式一：使用完整演示应用
1. 打开演示应用：http://localhost:5174
2. 在页面上进行各种操作（点击、输入、滚动等）
3. 点击"停止录制"按钮
4. 打开回放平台：http://localhost:3000
5. 查看录制的会话并播放

#### 方式二：使用简单测试页面（推荐用于快速验证）
1. 在浏览器中打开 `test-simple.html`
2. 点击"开始录制"
3. 进行各种操作（输入、点击等）
4. 查看浏览器控制台的日志输出
5. 后端会接收并存储录制数据

### 当前状态说明

✅ **已完成功能**：
- Monorepo 项目结构搭建
- 核心 SDK 基础框架
- 事件批次处理逻辑
- Web Worker 压缩桥接
- 后端 API 服务（支持本地文件和 MySQL 存储）
- 简单测试页面验证

⚠️ **已知问题**：
- rrweb 类型定义冲突，暂时禁用了 DOM 增强插件
- 部分 TypeScript 类型需要进一步优化
- 回放平台需要完善 rrweb-player 集成

🔧 **快速修复建议**：
1. 使用 `test-simple.html` 验证基础录制功能
2. 后续可以逐步完善 rrweb 集成
3. 优化 TypeScript 类型定义

## 📦 项目结构

```
streamsight/
├── apps/
│   ├── replay-platform/     # Next.js 回放查看器
│   └── demo-app/            # 演示应用
├── packages/
│   ├── streamsight/     # 核心 SDK (streamsight)
│   ├── core-utils/          # 共享工具 (streamsight-core-utils)
│   └── backend-api/         # 后端 API (@streamsight/backend-api)
```

## 🔧 SDK 使用方法

### 基础用法

```typescript
import { init, start, stop } from 'streamsight'

// 初始化
const recorder = init({
  appId: 'my-app',
  apiEndpoint: 'http://localhost:3001',
  userId: 'user-123',
})

// 开始录制
await start()

// 停止录制
stop()
```

### 高级配置

```typescript
import { init } from 'streamsight'

const recorder = init({
  appId: 'my-app',
  apiEndpoint: 'http://localhost:3001',
  userId: 'user-123',
  
  // 批次配置
  batchSize: 80,           // 每批事件数量
  batchTimeout: 30000,     // 批次超时时间（毫秒）
  
  // 脱敏配置
  privacy: {
    maskSelectors: ['.oo-mask', '.sensitive'],
    blockSelectors: ['.oo-block', '.private'],
    maskAllInputs: false,
    maskPasswords: true,
  },
  
  // 压缩配置
  compression: {
    type: 'gzip',          // 'gzip' | 'zstd'
    level: 6,
  },
  
  // 网络配置
  network: {
    retryCount: 3,
    retryDelay: 1000,
  },
})
```

### 脱敏规则

SDK 支持多种脱敏策略：

1. **CSS 类名脱敏**
   ```html
   <!-- 文本遮盖 -->
   <span class="oo-mask">敏感信息</span>
   
   <!-- 元素阻止 -->
   <div class="oo-block">私密内容</div>
   ```

2. **自动模式识别**
   - 信用卡号：`4111-1111-1111-1111`
   - 邮箱地址：`user@example.com`
   - 手机号码：`13812345678`
   - 身份证号：`110101199001011234`

3. **表单输入脱敏**
   ```html
   <!-- 密码输入默认遮盖 -->
   <input type="password" />
   
   <!-- 自定义遮盖 -->
   <input class="oo-mask" type="text" />
   ```

### API 参考

```typescript
// 初始化 SDK
init(config: StreamsightConfig): StreamsightRecorder

// 开始录制
start(): Promise<void>

// 停止录制
stop(): void

// 刷新当前批次
flush(): Promise<void>

// 设置用户信息
setUser(userId: string, meta?: Record<string, any>): void

// 添加遮盖选择器
addMaskSelector(selector: string): void

// 添加阻止选择器
addIgnoreSelector(selector: string): void
```

## 💾 数据存储配置

### 本地文件存储（默认）

默认使用本地文件存储，数据保存在 `packages/backend-api/data/` 目录：

```bash
# 使用默认配置
pnpm backend
```

### MySQL 数据库存储

1. **准备 MySQL 数据库**
```sql
CREATE DATABASE streamsight CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'streamsight'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON streamsight.* TO 'streamsight'@'localhost';
FLUSH PRIVILEGES;
```

2. **配置环境变量**
```bash
# 编辑 packages/backend-api/.env
USE_MYSQL=true
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=streamsight
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=streamsight
```

3. **启动服务**
```bash
pnpm backend
```

数据库表会自动创建，包括：
- `replay_metadata`: 回放元数据
- `replay_data`: 回放二进制数据

## 🔄 压缩方案替换

### 当前方案（MVP）

默认使用 `fflate` 库进行 gzip 压缩：

```typescript
// packages/core-utils/src/compression.ts
import { gzip, gunzip } from 'fflate'
```

### 升级到 ZSTD（推荐）

1. **安装 zstd-wasm**
```bash
pnpm add zstd-wasm
```

2. **更新压缩适配器**
```typescript
// packages/core-utils/src/compression.ts
import { compress as zstdCompress, decompress as zstdDecompress } from 'zstd-wasm'

// 在 CompressionAdapter 类中添加
private static async compressZstd(data: Uint8Array, level: number): Promise<ArrayBuffer> {
  const compressed = await zstdCompress(data, level)
  return compressed.buffer
}

private static async decompressZstd(data: Uint8Array): Promise<string> {
  const decompressed = await zstdDecompress(data)
  const decoder = new TextDecoder()
  return decoder.decode(decompressed)
}
```

3. **更新支持检测**
```typescript
static isZstdSupported(): boolean {
  try {
    require('zstd-wasm')
    return true
  } catch {
    return false
  }
}
```

### 性能对比

| 压缩方案 | 压缩率 | 压缩速度 | 解压速度 | 浏览器支持 |
|---------|--------|----------|----------|------------|
| gzip    | 中等   | 快       | 快       | 优秀       |
| zstd    | 优秀   | 很快     | 很快     | 需要 WASM  |

## 🔒 隐私与安全

### 数据脱敏

- 默认遮盖密码输入
- 支持自定义遮盖规则
- 自动识别敏感信息模式
- 支持元素级别的阻止采集

### 脚本安全

- 移除所有 `<script>` 标签的可执行内容
- 阻止回放时的真实页面跳转
- 使用 iframe sandbox 隔离回放环境

### 权限控制

- 支持用户级别的访问控制
- 会话级别的数据隔离
- API 密钥认证（生产环境）

### 合规建议

1. **用户同意**：在开始录制前获得用户明确同意
2. **数据保留**：设置合理的数据保留期限
3. **访问审计**：记录所有回放访问日志
4. **数据加密**：生产环境使用 HTTPS 和数据库加密
5. **隐私政策**：更新隐私政策说明数据收集用途

## 🛠️ 开发指南

### 构建项目

```bash
# 构建所有包
pnpm build

# 构建特定包
pnpm --filter streamsight build
```

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定包测试
pnpm --filter streamsight test
```

### 代码检查

```bash
# 运行 ESLint
pnpm lint

# 类型检查
pnpm type-check
```

### 发布包

```bash
# 发布到 npm
pnpm publish-packages
```

## 📋 技术规范

### 核心特性

- ✅ 基于 rrweb 的 DOM 快照与增量事件
- ✅ MutationObserver 监听 DOM 变化
- ✅ 事件批次处理（默认 80 条/批）
- ✅ Web Worker 压缩处理
- ✅ 脱敏规则支持（`.oo-mask` / `.oo-block`）
- ✅ 相对 URL 转绝对 URL
- ✅ 脚本内容清理
- ✅ 表单输入值处理
- ✅ 网络重试与离线队列
- ✅ iframe sandbox 安全回放

### 待实现特性

- ⏳ ZSTD 压缩支持
- ⏳ Canvas 录制支持
- ⏳ 移动端适配
- ⏳ 实时流式传输
- ⏳ 高级权限控制
- ⏳ 数据库存储后端
- ⏳ 回放性能优化

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🆘 支持

- 📖 [文档](./docs/)
- 🐛 [问题反馈](https://github.com/your-org/streamsight/issues)
- 💬 [讨论区](https://github.com/your-org/streamsight/discussions)

---

**注意**：这是一个 MVP 版本，主要用于概念验证和快速原型开发。生产环境使用前请进行充分的安全评估和性能测试。
# StreamSight 使用指南

## 🚀 快速开始

### 1. 环境准备
```bash
# 确保已安装 Node.js 18+ 和 pnpm
node --version  # 应该 >= 18.0.0
pnpm --version  # 应该 >= 8.0.0
```

### 2. 项目初始化
```bash
# 克隆项目后，运行初始化脚本
./scripts/test-complete.sh
```

### 3. 启动服务

#### 方式一：分别启动（推荐用于开发）
```bash
# 终端 1：启动后端
pnpm --filter @streamsight/backend-api dev

# 终端 2：启动演示应用
pnpm --filter @streamsight/demo-app dev
```

#### 方式二：一键启动
```bash
# 使用快速启动脚本
./scripts/quick-start.sh
```

## 🧪 测试验证

### 方式一：使用简单测试页面（最简单）
1. 确保后端服务已启动（http://localhost:3001）
2. 在浏览器中打开 `test-simple.html`
3. 点击"开始录制"按钮
4. 进行各种操作：
   - 在输入框中输入文字
   - 点击按钮
   - 滚动页面
5. 查看浏览器控制台，应该能看到：
   ```
   开始录制...
   记录事件: {type: "click", target: "BUTTON", timestamp: 1234567890}
   记录事件: {type: "input", target: "INPUT", value: "test", timestamp: 1234567891}
   上传批次: 5 个事件
   上传成功: {success: true, replayId: "..."}
   ```

### 方式二：使用完整演示应用
1. 访问 http://localhost:5173
2. 点击"开始录制"按钮
3. 在页面上进行各种操作
4. 点击"停止录制"按钮
5. 查看浏览器控制台的日志

## 📊 功能验证清单

### ✅ 基础录制功能
- [ ] 点击事件录制
- [ ] 输入事件录制
- [ ] 滚动事件录制
- [ ] 页面加载事件录制

### ✅ 脱敏功能
- [ ] 密码输入自动脱敏（显示为 `***`）
- [ ] CSS 类脱敏（`.ss-mask` 类的元素）
- [ ] 敏感信息模式匹配（邮箱、手机号等）

### ✅ 数据处理
- [ ] 事件批次处理（默认 5 条/批次）
- [ ] 数据压缩（使用浏览器原生 API）
- [ ] 网络上传（POST /v1/replays）
- [ ] 错误重试机制

### ✅ 存储功能
- [ ] 本地文件存储（默认）
- [ ] MySQL 数据库存储（可选）
- [ ] 数据查询和检索

## 🔧 配置选项

### SDK 配置
```typescript
import { init } from 'streamsight'

const recorder = init({
  appId: 'my-app',                    // 应用标识
  apiEndpoint: 'http://localhost:3001', // API 端点
  userId: 'user-123',                 // 用户标识（可选）
  
  // 批次配置
  batchSize: 20,                      // 每批事件数量
  batchTimeout: 10000,                // 批次超时时间（毫秒）
  
  // 脱敏配置
  privacy: {
    maskSelectors: ['.ss-mask', '.sensitive'],
    blockSelectors: ['.ss-block', '.private'],
    maskAllInputs: false,
    maskPasswords: true,
  },
  
  // 压缩配置
  compression: {
    type: 'gzip',                     // 压缩类型
    level: 6,                         // 压缩级别
  },
  
  // 网络配置
  network: {
    retryCount: 3,                    // 重试次数
    retryDelay: 1000,                 // 重试延迟
  },
})
```

### 后端配置
```bash
# 环境变量配置（packages/backend-api/.env）
PORT=3001                           # 服务端口
USE_MYSQL=false                     # 是否使用 MySQL
DATA_DIR=./data                     # 本地存储目录

# MySQL 配置（当 USE_MYSQL=true 时）
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=streamsight
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=streamsight
```

## 🐛 常见问题

### Q: 点击"开始录制"没有反应？
A: 检查以下几点：
1. 后端服务是否正常启动（http://localhost:3001/health）
2. 浏览器控制台是否有错误信息
3. 网络请求是否被 CORS 阻止

### Q: 看不到录制事件？
A: 检查以下几点：
1. 打开浏览器开发者工具的 Console 标签
2. 确保已点击"开始录制"按钮
3. 进行一些操作（点击、输入等）触发事件

### Q: 上传失败？
A: 检查以下几点：
1. 后端服务是否正常运行
2. API 端点配置是否正确
3. 网络连接是否正常

### Q: MySQL 连接失败？
A: 检查以下几点：
1. MySQL 服务是否启动
2. 数据库连接配置是否正确
3. 用户权限是否足够

## 📈 性能优化建议

### 1. 批次大小调优
- 开发环境：使用较小批次（5-20 条）便于调试
- 生产环境：使用较大批次（50-100 条）提升性能

### 2. 压缩配置
- 网络带宽充足：可以降低压缩级别提升速度
- 网络带宽有限：提高压缩级别减少传输量

### 3. 脱敏规则
- 只对必要的元素应用脱敏规则
- 避免过于复杂的 CSS 选择器

## 🔒 安全注意事项

### 1. 数据脱敏
- 确保所有敏感信息都被正确脱敏
- 定期审查脱敏规则的有效性
- 测试各种输入场景

### 2. 网络安全
- 生产环境必须使用 HTTPS
- 实施适当的 API 认证机制
- 限制跨域访问

### 3. 数据存储
- 定期清理过期的录制数据
- 实施数据访问权限控制
- 考虑数据加密存储

## 📞 技术支持

如果遇到问题，请按以下顺序排查：

1. **查看控制台日志**：浏览器开发者工具 Console 标签
2. **检查网络请求**：开发者工具 Network 标签
3. **验证服务状态**：访问 http://localhost:3001/health
4. **查看后端日志**：后端服务的终端输出
5. **重启服务**：停止并重新启动所有服务

---

**注意**：这是一个 MVP 版本，主要用于概念验证和快速原型开发。生产环境使用前请进行充分的安全评估和性能测试。
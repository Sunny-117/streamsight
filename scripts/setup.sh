#!/bin/bash

echo "🚀 StreamSight 项目初始化脚本"

# 检查 Node.js 版本
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ 需要 Node.js 18 或更高版本，当前版本: $(node -v)"
    exit 1
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ 需要安装 pnpm"
    echo "请运行: npm install -g pnpm"
    exit 1
fi

echo "✅ 环境检查通过"

# 安装依赖
echo "📦 安装依赖..."
pnpm install

# 构建项目
echo "🔨 构建项目..."
pnpm build

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p packages/backend-api/data

# 复制环境变量文件
if [ ! -f packages/backend-api/.env ]; then
    echo "📝 创建环境变量文件..."
    cp packages/backend-api/.env.example packages/backend-api/.env
fi

echo "✅ 项目初始化完成！"
echo ""
echo "🎯 快速启动："
echo "  pnpm e2e    # 启动所有服务"
echo "  pnpm backend # 仅启动后端"
echo "  pnpm demo   # 仅启动演示应用"
echo "  pnpm replay # 仅启动回放平台"
echo ""
echo "🌐 访问地址："
echo "  演示应用: http://localhost:5173"
echo "  回放平台: http://localhost:3000"
echo "  后端 API: http://localhost:3001"
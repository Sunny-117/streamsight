#!/bin/bash

echo "🚀 StreamSight 快速启动脚本"

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    pnpm install
fi

# 构建核心包
echo "🔨 构建核心包..."
pnpm --filter streamsight-core-utils build
pnpm --filter streamsight build

# 创建数据目录
mkdir -p packages/backend-api/data

# 启动后端服务
echo "🌐 启动后端服务..."
pnpm --filter @streamsight/backend-api dev &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动演示应用
echo "📱 启动演示应用..."
pnpm --filter @streamsight/demo-app dev &
DEMO_PID=$!

echo ""
echo "✅ 服务启动完成！"
echo ""
echo "🌐 访问地址："
echo "  后端 API: http://localhost:3002"
echo "  演示应用: http://localhost:5174"
echo "  简单测试: 在浏览器中打开 test-simple.html"
echo ""
echo "📝 使用说明："
echo "1. 打开 test-simple.html 进行快速测试"
echo "2. 点击'开始录制'按钮"
echo "3. 进行各种操作（输入、点击等）"
echo "4. 查看浏览器控制台的录制日志"
echo ""
echo "⏹️  停止服务: Ctrl+C"

# 等待用户中断
trap "echo '正在停止服务...'; kill $BACKEND_PID $DEMO_PID 2>/dev/null; exit" INT
wait
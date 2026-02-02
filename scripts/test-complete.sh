#!/bin/bash

echo "🧪 StreamSight 完整测试脚本"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    pnpm install
fi

# 构建所有包
echo "🔨 构建所有包..."
pnpm --filter streamsight-core-utils build
pnpm --filter streamsight build

# 创建数据目录
mkdir -p packages/backend-api/data

echo ""
echo "✅ 构建完成！"
echo ""
echo "🚀 现在可以启动服务："
echo "  1. 启动后端: pnpm --filter @streamsight/backend-api dev"
echo "  2. 启动演示: pnpm --filter @streamsight/demo-app dev"
echo ""
echo "🌐 访问地址："
echo "  演示应用: http://localhost:5173"
echo "  后端 API: http://localhost:3001"
echo "  简单测试: 在浏览器中打开 test-simple.html"
echo ""
echo "📝 测试步骤："
echo "  1. 打开演示应用或 test-simple.html"
echo "  2. 点击'开始录制'按钮"
echo "  3. 进行各种操作（输入、点击等）"
echo "  4. 查看浏览器控制台的录制日志"
echo "  5. 后端会接收并存储录制数据"
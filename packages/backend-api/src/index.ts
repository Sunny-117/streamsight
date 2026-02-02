import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from 'dotenv'
import { replayRoutes } from './routes/replays'

// 加载环境变量
config()

const fastify = Fastify({
  logger: true,
  bodyLimit: 10485760, // 10MB
})

// 添加原始请求体解析器
fastify.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (req, body, done) => {
  done(null, body)
})

// 注册 CORS
fastify.register(cors, {
  origin: true,
  credentials: true,
})

// 注册路由
fastify.register(replayRoutes, { prefix: '/v1' })

// 健康检查
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001
    await fastify.listen({ port, host: '0.0.0.0' })
    console.log(`🚀 StreamSight API 服务已启动: http://localhost:${port}`)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

start()
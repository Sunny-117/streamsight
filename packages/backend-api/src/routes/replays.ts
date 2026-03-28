import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { FileStorage } from '../storage/file-storage'
import { MySQLStorage } from '../storage/mysql-storage'
import { CompressionAdapter } from 'streamsight-core-utils'

// 根据环境变量选择存储方式
const createStorage = () => {
  if (process.env.USE_MYSQL === 'true') {
    const mysqlConfig = {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'streamsight',
    }
    return new MySQLStorage(mysqlConfig)
  } else {
    return new FileStorage(process.env.DATA_DIR || './data')
  }
}

const storage = createStorage()

interface ReplayHeaders {
  'x-app-id': string
  'x-session-id': string
  'x-batch-index': string
  'x-ts': string
  'x-compression': 'gzip' | 'zstd'
  'x-user-id'?: string
}

export async function replayRoutes(fastify: FastifyInstance) {
  // 上传回放数据
  fastify.post('/replays', {
    bodyLimit: 10485760, // 10MB
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const headers = request.headers as Partial<ReplayHeaders>
      const {
        'x-app-id': appId,
        'x-session-id': sessionId,
        'x-batch-index': batchIndex,
        'x-ts': timestamp,
        'x-compression': compression,
        'x-user-id': userId,
      } = headers

      // 验证必需的头部
      if (!appId || !sessionId || !batchIndex || !timestamp) {
        return reply.status(400).send({
          error: 'Missing required headers',
          required: ['x-app-id', 'x-session-id', 'x-batch-index', 'x-ts'],
        })
      }

      // 获取二进制数据
      let buffer: Buffer
      
      if (Buffer.isBuffer(request.body)) {
        buffer = request.body
      } else if (request.body instanceof ArrayBuffer) {
        buffer = Buffer.from(request.body)
      } else if (typeof request.body === 'string') {
        buffer = Buffer.from(request.body, 'binary')
      } else {
        return reply.status(400).send({ error: 'Invalid request body format' })
      }
      
      if (!buffer || buffer.length === 0) {
        return reply.status(400).send({ error: 'Empty request body' })
      }

      // 生成回放 ID
      const replayId = uuidv4()

      // 存储元数据和数据
      const metadata = {
        replayId,
        appId,
        sessionId,
        batchIndex: parseInt(batchIndex),
        timestamp: parseInt(timestamp),
        userId,
        compression: compression || 'gzip',
        size: buffer.length,
        createdAt: new Date().toISOString(),
      }

      await storage.saveReplay(replayId, buffer, metadata)

      console.log('回放数据已保存', {
        replayId,
        sessionId,
        batchIndex,
        size: buffer.length,
      })

      return reply.send({
        success: true,
        replayId,
        message: 'Replay data saved successfully',
      })
    } catch (error) {
      console.error('保存回放数据失败', error)
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }})

  // 获取回放列表
  fastify.get('/replays', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as {
        sessionId?: string
        appId?: string
        userId?: string
        limit?: string
        offset?: string
      }

      const replays = await storage.listReplays({
        sessionId: query.sessionId,
        appId: query.appId,
        userId: query.userId,
        limit: query.limit ? parseInt(query.limit) : 50,
        offset: query.offset ? parseInt(query.offset) : 0,
      })

      return reply.send({
        success: true,
        data: replays,
        total: replays.length,
      })
    } catch (error) {
      console.error('获取回放列表失败', error)
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // 获取回放数据
  fastify.get('/replays/:id/blob', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const query = request.query as { decompress?: string }

      const result = await storage.getReplay(id)
      if (!result) {
        return reply.status(404).send({ error: 'Replay not found' })
      }

      const { data, metadata } = result

      // 如果请求解压
      if (query.decompress === 'true') {
        try {
          const arrayBuffer = data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength
          ) as ArrayBuffer
          const decompressed = await CompressionAdapter.decompress(
            arrayBuffer,
            metadata.compression as 'gzip' | 'zstd'
          )
          
          return reply
            .header('Content-Type', 'application/json')
            .send(JSON.parse(decompressed))
        } catch (error) {
          console.error('解压数据失败', error)
          return reply.status(500).send({ error: 'Failed to decompress data' })
        }
      }

      // 返回原始压缩数据
      return reply
        .header('Content-Type', 'application/octet-stream')
        .header('x-compression', metadata.compression)
        .header('x-original-size', metadata.size.toString())
        .send(data)
    } catch (error) {
      console.error('获取回放数据失败', error)
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // 获取回放元数据
  fastify.get('/replays/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }

      const result = await storage.getReplay(id)
      if (!result) {
        return reply.status(404).send({ error: 'Replay not found' })
      }

      return reply.send({
        success: true,
        data: result.metadata,
      })
    } catch (error) {
      console.error('获取回放元数据失败', error)
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // 删除回放
  fastify.delete('/replays/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }

      const success = await storage.deleteReplay(id)
      if (!success) {
        return reply.status(404).send({ error: 'Replay not found' })
      }

      return reply.send({
        success: true,
        message: 'Replay deleted successfully',
      })
    } catch (error) {
      console.error('删除回放失败', error)
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
}

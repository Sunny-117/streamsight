import { promises as fs } from 'fs'
import path from 'path'

export interface ReplayMetadata {
  replayId: string
  appId: string
  sessionId: string
  batchIndex: number
  timestamp: number
  userId?: string
  compression: string
  size: number
  createdAt: string
}

export interface ListReplaysOptions {
  sessionId?: string
  appId?: string
  userId?: string
  limit?: number
  offset?: number
}

export class FileStorage {
  private dataDir: string

  constructor(dataDir = './data') {
    this.dataDir = path.resolve(dataDir)
    this.ensureDataDir()
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.access(this.dataDir)
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true })
    }
  }

  async saveReplay(
    replayId: string,
    data: Buffer,
    metadata: ReplayMetadata
  ): Promise<void> {
    await this.ensureDataDir()

    const dataPath = path.join(this.dataDir, `${replayId}.bin`)
    const metaPath = path.join(this.dataDir, `${replayId}.meta.json`)

    // 保存二进制数据
    await fs.writeFile(dataPath, data)

    // 保存元数据
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2))
  }

  async getReplay(replayId: string): Promise<{
    data: Buffer
    metadata: ReplayMetadata
  } | null> {
    try {
      const dataPath = path.join(this.dataDir, `${replayId}.bin`)
      const metaPath = path.join(this.dataDir, `${replayId}.meta.json`)

      const [data, metaContent] = await Promise.all([
        fs.readFile(dataPath),
        fs.readFile(metaPath, 'utf-8'),
      ])

      const metadata = JSON.parse(metaContent) as ReplayMetadata

      return { data, metadata }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  async listReplays(options: ListReplaysOptions = {}): Promise<ReplayMetadata[]> {
    try {
      await this.ensureDataDir()
      const files = await fs.readdir(this.dataDir)
      const metaFiles = files.filter(file => file.endsWith('.meta.json'))

      console.log(`找到 ${metaFiles.length} 个元数据文件`)

      const replays: ReplayMetadata[] = []

      for (const file of metaFiles) {
        try {
          const content = await fs.readFile(path.join(this.dataDir, file), 'utf-8')
          const metadata = JSON.parse(content) as ReplayMetadata

          // 应用过滤条件
          if (options.sessionId && metadata.sessionId !== options.sessionId) continue
          if (options.appId && metadata.appId !== options.appId) continue
          if (options.userId && metadata.userId !== options.userId) continue

          replays.push(metadata)
        } catch (error) {
          console.warn(`跳过无效的元数据文件: ${file}`, error)
        }
      }

      // 按时间戳排序（最新的在前）
      replays.sort((a, b) => b.timestamp - a.timestamp)

      console.log(`返回 ${replays.length} 个回放记录`)

      // 应用分页
      const offset = options.offset || 0
      const limit = options.limit || 50
      return replays.slice(offset, offset + limit)
    } catch (error) {
      console.error('列出回放失败', error)
      return []
    }
  }

  async deleteReplay(replayId: string): Promise<boolean> {
    try {
      const dataPath = path.join(this.dataDir, `${replayId}.bin`)
      const metaPath = path.join(this.dataDir, `${replayId}.meta.json`)

      await Promise.all([
        fs.unlink(dataPath).catch(() => {}), // 忽略文件不存在的错误
        fs.unlink(metaPath).catch(() => {}),
      ])

      return true
    } catch (error) {
      console.error('删除回放失败', error)
      return false
    }
  }

  async getStorageStats(): Promise<{
    totalReplays: number
    totalSize: number
    oldestReplay?: string
    newestReplay?: string
  }> {
    try {
      const replays = await this.listReplays({ limit: 1000 })
      const totalSize = replays.reduce((sum, replay) => sum + replay.size, 0)

      return {
        totalReplays: replays.length,
        totalSize,
        oldestReplay: replays[replays.length - 1]?.createdAt,
        newestReplay: replays[0]?.createdAt,
      }
    } catch (error) {
      console.error('获取存储统计失败', error)
      return {
        totalReplays: 0,
        totalSize: 0,
      }
    }
  }
}
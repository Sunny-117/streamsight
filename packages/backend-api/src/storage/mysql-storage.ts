import mysql from 'mysql2/promise'
import type { ReplayMetadata, ListReplaysOptions } from './file-storage'

export interface MySQLConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export class MySQLStorage {
  private pool: mysql.Pool

  constructor(config: MySQLConfig) {
    this.pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
    
    this.initTables()
  }

  private async initTables(): Promise<void> {
    try {
      const connection = await this.pool.getConnection()
      
      // 创建回放元数据表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS replay_metadata (
          replay_id VARCHAR(36) PRIMARY KEY,
          app_id VARCHAR(100) NOT NULL,
          session_id VARCHAR(100) NOT NULL,
          batch_index INT NOT NULL,
          timestamp BIGINT NOT NULL,
          user_id VARCHAR(100),
          compression VARCHAR(20) NOT NULL DEFAULT 'gzip',
          size INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_session_id (session_id),
          INDEX idx_app_id (app_id),
          INDEX idx_user_id (user_id),
          INDEX idx_timestamp (timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)

      // 创建回放数据表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS replay_data (
          replay_id VARCHAR(36) PRIMARY KEY,
          data LONGBLOB NOT NULL,
          FOREIGN KEY (replay_id) REFERENCES replay_metadata(replay_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)

      connection.release()
      console.log('MySQL 表初始化完成')
    } catch (error) {
      console.error('MySQL 表初始化失败:', error)
      throw error
    }
  }

  async saveReplay(
    replayId: string,
    data: Buffer,
    metadata: ReplayMetadata
  ): Promise<void> {
    const connection = await this.pool.getConnection()
    
    try {
      await connection.beginTransaction()

      // 保存元数据
      await connection.execute(
        `INSERT INTO replay_metadata 
         (replay_id, app_id, session_id, batch_index, timestamp, user_id, compression, size, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          replayId,
          metadata.appId,
          metadata.sessionId,
          metadata.batchIndex,
          metadata.timestamp,
          metadata.userId || null,
          metadata.compression,
          metadata.size,
          new Date(metadata.createdAt),
        ]
      )

      // 保存二进制数据
      await connection.execute(
        'INSERT INTO replay_data (replay_id, data) VALUES (?, ?)',
        [replayId, data]
      )

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async getReplay(replayId: string): Promise<{
    data: Buffer
    metadata: ReplayMetadata
  } | null> {
    const connection = await this.pool.getConnection()
    
    try {
      // 获取元数据
      const [metaRows] = await connection.execute(
        'SELECT * FROM replay_metadata WHERE replay_id = ?',
        [replayId]
      ) as [any[], any]

      if (metaRows.length === 0) {
        return null
      }

      const metaRow = metaRows[0]

      // 获取二进制数据
      const [dataRows] = await connection.execute(
        'SELECT data FROM replay_data WHERE replay_id = ?',
        [replayId]
      ) as [any[], any]

      if (dataRows.length === 0) {
        return null
      }

      const metadata: ReplayMetadata = {
        replayId: metaRow.replay_id,
        appId: metaRow.app_id,
        sessionId: metaRow.session_id,
        batchIndex: metaRow.batch_index,
        timestamp: metaRow.timestamp,
        userId: metaRow.user_id,
        compression: metaRow.compression,
        size: metaRow.size,
        createdAt: metaRow.created_at.toISOString(),
      }

      return {
        data: dataRows[0].data,
        metadata,
      }
    } finally {
      connection.release()
    }
  }

  async listReplays(options: ListReplaysOptions = {}): Promise<ReplayMetadata[]> {
    const connection = await this.pool.getConnection()
    
    try {
      let query = 'SELECT * FROM replay_metadata WHERE 1=1'
      const params: any[] = []

      // 应用过滤条件
      if (options.sessionId) {
        query += ' AND session_id = ?'
        params.push(options.sessionId)
      }

      if (options.appId) {
        query += ' AND app_id = ?'
        params.push(options.appId)
      }

      if (options.userId) {
        query += ' AND user_id = ?'
        params.push(options.userId)
      }

      // 排序
      query += ' ORDER BY timestamp DESC'

      // 分页
      if (options.limit) {
        query += ' LIMIT ?'
        params.push(options.limit)
        
        if (options.offset) {
          query += ' OFFSET ?'
          params.push(options.offset)
        }
      }

      const [rows] = await connection.execute(query, params) as [any[], any]

      return rows.map((row: any) => ({
        replayId: row.replay_id,
        appId: row.app_id,
        sessionId: row.session_id,
        batchIndex: row.batch_index,
        timestamp: row.timestamp,
        userId: row.user_id,
        compression: row.compression,
        size: row.size,
        createdAt: row.created_at.toISOString(),
      }))
    } finally {
      connection.release()
    }
  }

  async deleteReplay(replayId: string): Promise<boolean> {
    const connection = await this.pool.getConnection()
    
    try {
      const [result] = await connection.execute(
        'DELETE FROM replay_metadata WHERE replay_id = ?',
        [replayId]
      ) as [mysql.ResultSetHeader, any]

      return result.affectedRows > 0
    } finally {
      connection.release()
    }
  }

  async getStorageStats(): Promise<{
    totalReplays: number
    totalSize: number
    oldestReplay?: string
    newestReplay?: string
  }> {
    const connection = await this.pool.getConnection()
    
    try {
      // 获取统计信息
      const [statsRows] = await connection.execute(`
        SELECT 
          COUNT(*) as total_replays,
          SUM(size) as total_size,
          MIN(created_at) as oldest_replay,
          MAX(created_at) as newest_replay
        FROM replay_metadata
      `) as [any[], any]

      const stats = statsRows[0]

      return {
        totalReplays: stats.total_replays || 0,
        totalSize: stats.total_size || 0,
        oldestReplay: stats.oldest_replay?.toISOString(),
        newestReplay: stats.newest_replay?.toISOString(),
      }
    } finally {
      connection.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
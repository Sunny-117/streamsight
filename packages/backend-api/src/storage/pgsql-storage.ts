import { Pool } from 'pg'
import type { ReplayMetadata, ListReplaysOptions } from './file-storage'

export interface PgSQLConfig {
  connectionString?: string
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  ssl?: boolean
}

function toISOStringSafe(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
  }
  return new Date().toISOString()
}

export class PgSQLStorage {
  private pool: Pool
  private initPromise: Promise<void>

  constructor(config: PgSQLConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      max: 10,
    })

    this.initPromise = this.initTables()
  }

  private async ensureReady(): Promise<void> {
    await this.initPromise
  }

  private async initTables(): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS replay_metadata (
          replay_id TEXT PRIMARY KEY,
          app_id VARCHAR(100) NOT NULL,
          session_id VARCHAR(100) NOT NULL,
          batch_index INTEGER NOT NULL,
          timestamp_ms BIGINT NOT NULL,
          user_id VARCHAR(100),
          compression VARCHAR(20) NOT NULL DEFAULT 'zstd',
          size INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS replay_data (
          replay_id TEXT PRIMARY KEY REFERENCES replay_metadata(replay_id) ON DELETE CASCADE,
          data BYTEA NOT NULL
        )
      `)

      await client.query('CREATE INDEX IF NOT EXISTS idx_replay_metadata_session_id ON replay_metadata(session_id)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_replay_metadata_app_id ON replay_metadata(app_id)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_replay_metadata_user_id ON replay_metadata(user_id)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_replay_metadata_timestamp_ms ON replay_metadata(timestamp_ms)')

      console.log('PostgreSQL 表初始化完成')
    } catch (error) {
      console.error('PostgreSQL 表初始化失败:', error)
      throw error
    } finally {
      client.release()
    }
  }

  async saveReplay(
    replayId: string,
    data: Buffer,
    metadata: ReplayMetadata
  ): Promise<void> {
    await this.ensureReady()
    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO replay_metadata
          (replay_id, app_id, session_id, batch_index, timestamp_ms, user_id, compression, size, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          replayId,
          metadata.appId,
          metadata.sessionId,
          metadata.batchIndex,
          metadata.timestamp,
          metadata.userId || null,
          metadata.compression,
          metadata.size,
          metadata.createdAt,
        ]
      )

      await client.query(
        'INSERT INTO replay_data (replay_id, data) VALUES ($1, $2)',
        [replayId, data]
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async getReplay(replayId: string): Promise<{
    data: Buffer
    metadata: ReplayMetadata
  } | null> {
    await this.ensureReady()
    const client = await this.pool.connect()

    try {
      const metaResult = await client.query(
        'SELECT * FROM replay_metadata WHERE replay_id = $1',
        [replayId]
      )
      if (metaResult.rows.length === 0) {
        return null
      }

      const dataResult = await client.query(
        'SELECT data FROM replay_data WHERE replay_id = $1',
        [replayId]
      )
      if (dataResult.rows.length === 0) {
        return null
      }

      const metaRow = metaResult.rows[0]
      const metadata: ReplayMetadata = {
        replayId: metaRow.replay_id,
        appId: metaRow.app_id,
        sessionId: metaRow.session_id,
        batchIndex: metaRow.batch_index,
        timestamp: Number(metaRow.timestamp_ms),
        userId: metaRow.user_id || undefined,
        compression: metaRow.compression,
        size: Number(metaRow.size),
        createdAt: toISOStringSafe(metaRow.created_at),
      }

      return {
        data: dataResult.rows[0].data,
        metadata,
      }
    } finally {
      client.release()
    }
  }

  async listReplays(options: ListReplaysOptions = {}): Promise<ReplayMetadata[]> {
    await this.ensureReady()
    const client = await this.pool.connect()

    try {
      const conditions: string[] = []
      const params: Array<string | number> = []

      if (options.sessionId) {
        params.push(options.sessionId)
        conditions.push(`session_id = $${params.length}`)
      }
      if (options.appId) {
        params.push(options.appId)
        conditions.push(`app_id = $${params.length}`)
      }
      if (options.userId) {
        params.push(options.userId)
        conditions.push(`user_id = $${params.length}`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      let query = `SELECT * FROM replay_metadata ${whereClause} ORDER BY timestamp_ms DESC`

      const hasLimit = typeof options.limit === 'number'
      const hasOffset = typeof options.offset === 'number'
      if (hasLimit) {
        params.push(options.limit as number)
        query += ` LIMIT $${params.length}`
      }
      if (hasOffset) {
        params.push(options.offset as number)
        query += ` OFFSET $${params.length}`
      }

      const result = await client.query(query, params)
      return result.rows.map((row) => ({
        replayId: row.replay_id,
        appId: row.app_id,
        sessionId: row.session_id,
        batchIndex: row.batch_index,
        timestamp: Number(row.timestamp_ms),
        userId: row.user_id || undefined,
        compression: row.compression,
        size: Number(row.size),
        createdAt: toISOStringSafe(row.created_at),
      }))
    } finally {
      client.release()
    }
  }

  async deleteReplay(replayId: string): Promise<boolean> {
    await this.ensureReady()
    const result = await this.pool.query(
      'DELETE FROM replay_metadata WHERE replay_id = $1',
      [replayId]
    )
    return (result.rowCount ?? 0) > 0
  }

  async getStorageStats(): Promise<{
    totalReplays: number
    totalSize: number
    oldestReplay?: string
    newestReplay?: string
  }> {
    await this.ensureReady()
    const result = await this.pool.query(`
      SELECT
        COUNT(*)::int AS total_replays,
        COALESCE(SUM(size), 0)::bigint AS total_size,
        MIN(created_at) AS oldest_replay,
        MAX(created_at) AS newest_replay
      FROM replay_metadata
    `)

    const row = result.rows[0]
    return {
      totalReplays: Number(row.total_replays || 0),
      totalSize: Number(row.total_size || 0),
      oldestReplay: row.oldest_replay ? toISOStringSafe(row.oldest_replay) : undefined,
      newestReplay: row.newest_replay ? toISOStringSafe(row.newest_replay) : undefined,
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

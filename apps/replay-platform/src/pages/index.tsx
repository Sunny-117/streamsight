import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ReplayMetadata {
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

export default function HomePage() {
  const [replays, setReplays] = useState<ReplayMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReplays()
  }, [])

  const fetchReplays = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:3001/v1/replays')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      setReplays(result.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取回放列表失败')
      console.error('获取回放列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const groupedReplays = replays.reduce((groups, replay) => {
    const key = replay.sessionId
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(replay)
    return groups
  }, {} as Record<string, ReplayMetadata[]>)

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>加载回放列表中...</p>
        </div>
        <style jsx>{`
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .loading {
            text-align: center;
            padding: 60px 20px;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">
          <h2>❌ 加载失败</h2>
          <p>{error}</p>
          <button onClick={fetchReplays} className="retry-btn">
            重试
          </button>
        </div>
        <style jsx>{`
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .error {
            text-align: center;
            padding: 60px 20px;
            color: #e74c3c;
          }
          .retry-btn {
            padding: 10px 20px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
          }
          .retry-btn:hover {
            background: #2980b9;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="container">
      <header className="header">
        <h1>🎬 StreamSight 回放平台</h1>
        <p>用户行为录制回放查看器</p>
        <button onClick={fetchReplays} className="refresh-btn">
          🔄 刷新列表
        </button>
      </header>

      {Object.keys(groupedReplays).length === 0 ? (
        <div className="empty">
          <h3>📭 暂无回放数据</h3>
          <p>请先在演示应用中录制一些用户行为</p>
          <a href="http://localhost:5173" target="_blank" rel="noopener noreferrer" className="demo-link">
            打开演示应用
          </a>
        </div>
      ) : (
        <div className="sessions">
          <h2>📊 回放会话列表 ({Object.keys(groupedReplays).length} 个会话)</h2>
          
          {Object.entries(groupedReplays).map(([sessionId, sessionReplays]) => {
            const totalSize = sessionReplays.reduce((sum, r) => sum + r.size, 0)
            const latestReplay = sessionReplays.sort((a, b) => b.timestamp - a.timestamp)[0]
            
            return (
              <div key={sessionId} className="session-card">
                <div className="session-header">
                  <h3>🎯 会话: {sessionId}</h3>
                  <div className="session-meta">
                    <span className="meta-item">📱 应用: {latestReplay.appId}</span>
                    <span className="meta-item">👤 用户: {latestReplay.userId || '匿名'}</span>
                    <span className="meta-item">📦 批次: {sessionReplays.length}</span>
                    <span className="meta-item">💾 大小: {formatFileSize(totalSize)}</span>
                    <span className="meta-item">🕒 时间: {formatDate(latestReplay.createdAt)}</span>
                  </div>
                </div>
                
                <div className="batches">
                  {sessionReplays
                    .sort((a, b) => a.batchIndex - b.batchIndex)
                    .map((replay) => (
                      <div key={replay.replayId} className="batch-item">
                        <div className="batch-info">
                          <span className="batch-index">批次 #{replay.batchIndex}</span>
                          <span className="batch-size">{formatFileSize(replay.size)}</span>
                          <span className="batch-compression">{replay.compression.toUpperCase()}</span>
                        </div>
                        <Link href={`/replay/${replay.replayId}`} className="play-btn">
                          ▶️ 播放
                        </Link>
                      </div>
                    ))}
                </div>
                
                <div className="session-actions">
                  <Link href={`/replay/${sessionReplays[0].replayId}?session=${sessionId}`} className="play-session-btn">
                    🎬 播放完整会话
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding: 30px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
        }
        
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 2.5em;
        }
        
        .header p {
          margin: 0 0 20px 0;
          opacity: 0.9;
        }
        
        .refresh-btn {
          padding: 10px 20px;
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s ease;
        }
        
        .refresh-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        
        .empty {
          text-align: center;
          padding: 60px 20px;
          background: #f8f9fa;
          border-radius: 12px;
          color: #6c757d;
        }
        
        .demo-link {
          display: inline-block;
          padding: 12px 24px;
          background: #007bff;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin-top: 20px;
          transition: background 0.3s ease;
        }
        
        .demo-link:hover {
          background: #0056b3;
        }
        
        .sessions h2 {
          color: #333;
          margin-bottom: 30px;
        }
        
        .session-card {
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          margin-bottom: 30px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .session-header {
          padding: 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }
        
        .session-header h3 {
          margin: 0 0 15px 0;
          color: #495057;
        }
        
        .session-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
        }
        
        .meta-item {
          font-size: 14px;
          color: #6c757d;
          background: white;
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .batches {
          padding: 20px;
        }
        
        .batch-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f1f3f4;
        }
        
        .batch-item:last-child {
          border-bottom: none;
        }
        
        .batch-info {
          display: flex;
          gap: 15px;
          align-items: center;
        }
        
        .batch-index {
          font-weight: 600;
          color: #495057;
        }
        
        .batch-size {
          font-size: 14px;
          color: #6c757d;
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
        }
        
        .batch-compression {
          font-size: 12px;
          color: #28a745;
          background: #d4edda;
          padding: 2px 6px;
          border-radius: 3px;
        }
        
        .play-btn {
          padding: 8px 16px;
          background: #28a745;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-size: 14px;
          transition: background 0.3s ease;
        }
        
        .play-btn:hover {
          background: #218838;
        }
        
        .session-actions {
          padding: 20px;
          background: #f8f9fa;
          border-top: 1px solid #e9ecef;
          text-align: center;
        }
        
        .play-session-btn {
          padding: 12px 24px;
          background: #007bff;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          transition: background 0.3s ease;
        }
        
        .play-session-btn:hover {
          background: #0056b3;
        }
        
        @media (max-width: 768px) {
          .session-meta {
            flex-direction: column;
            gap: 8px;
          }
          
          .batch-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .batch-info {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  )
}
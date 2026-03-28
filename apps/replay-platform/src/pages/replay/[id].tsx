import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import type { eventWithTime } from 'rrweb'
import 'rrweb-player/dist/style.css'

type RRWebPlayerConstructor = (typeof import('rrweb-player'))['default']
type RRWebPlayerInstance = InstanceType<RRWebPlayerConstructor>
type DestroyablePlayer = RRWebPlayerInstance & { $destroy?: () => void }

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

interface StreamsightBatch {
  batchIndex: number
  timestamp: number
  events: eventWithTime[]
  sessionId: string
  appId: string
  userId?: string
}

export default function ReplayPage() {
  const router = useRouter()
  const { id, session } = router.query
  const playerRef = useRef<HTMLDivElement>(null)
  const playerInstanceRef = useRef<RRWebPlayerInstance | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<ReplayMetadata | null>(null)
  const [events, setEvents] = useState<eventWithTime[]>([])

  useEffect(() => {
    if (id) {
      loadReplay(id as string)
    }
    
    return () => {
      destroyPlayer()
    }
  }, [id, session])

  const loadReplay = async (replayId: string) => {
    try {
      setLoading(true)
      setError(null)

      if (session) {
        await loadSessionReplays(session as string)
      } else {
        await loadSingleReplay(replayId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载回放失败')
      console.error('加载回放失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadSingleReplay = async (replayId: string) => {
    const metaResponse = await fetch(`http://localhost:3001/v1/replays/${replayId}`)
    if (!metaResponse.ok) {
      throw new Error(`获取元数据失败: ${metaResponse.status}`)
    }
    const metaResult = await metaResponse.json()
    setMetadata(metaResult.data)

    const dataResponse = await fetch(`http://localhost:3001/v1/replays/${replayId}/blob?decompress=true`)
    if (!dataResponse.ok) {
      throw new Error(`获取回放数据失败: ${dataResponse.status}`)
    }
    
    const batchData: StreamsightBatch = await dataResponse.json()
    setEvents(batchData.events)

    if (playerRef.current && batchData.events.length > 0) {
      await initPlayer(batchData.events)
    }
  }

  const loadSessionReplays = async (sessionId: string) => {
    const listResponse = await fetch(`http://localhost:3001/v1/replays?sessionId=${sessionId}&limit=100`)
    if (!listResponse.ok) {
      throw new Error(`获取会话列表失败: ${listResponse.status}`)
    }
    
    const listResult = await listResponse.json()
    const batches: ReplayMetadata[] = listResult.data
    
    if (batches.length === 0) {
      throw new Error('会话中没有找到批次数据')
    }

    batches.sort((a, b) => a.batchIndex - b.batchIndex)
    setMetadata(batches[0])

    const allEvents: eventWithTime[] = []
    
    for (const batch of batches) {
      const dataResponse = await fetch(`http://localhost:3001/v1/replays/${batch.replayId}/blob?decompress=true`)
      if (dataResponse.ok) {
        const batchData: StreamsightBatch = await dataResponse.json()
        allEvents.push(...batchData.events)
      }
    }

    allEvents.sort((a, b) => a.timestamp - b.timestamp)
    setEvents(allEvents)

    if (playerRef.current && allEvents.length > 0) {
      await initPlayer(allEvents)
    }
  }

  const initPlayer = async (replayEvents: eventWithTime[]) => {
    if (!playerRef.current) return

    try {
      const { default: RRWebPlayer } = await import('rrweb-player')
      destroyPlayer()
      
      playerRef.current.innerHTML = ''

      playerInstanceRef.current = new RRWebPlayer({
        target: playerRef.current,
        props: {
          events: replayEvents,
          autoPlay: false,
          speedOption: [0.5, 1, 1.5, 2, 4, 8],
          showController: true,
          showWarning: false,
          skipInactive: false,
          mouseTail: {
            duration: 500,
            lineCap: 'round',
            lineWidth: 2,
            strokeStyle: 'red',
          },
        },
      })

      console.log('rrweb-player 初始化成功，事件数:', replayEvents.length)
    } catch (error) {
      console.error('初始化播放器失败:', error)
      setError('播放器初始化失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  const destroyPlayer = () => {
    if (!playerInstanceRef.current) {
      return
    }

    try {
      const instance = playerInstanceRef.current as DestroyablePlayer
      if (typeof instance.$destroy === 'function') {
        instance.$destroy()
      }
    } catch (e) {
      console.warn('清理播放器失败:', e)
    } finally {
      playerInstanceRef.current = null
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>加载回放数据中...</p>
        </div>
        <style jsx>{`
          .container {
            max-width: 1400px;
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
          <button onClick={() => router.back()} className="back-btn">
            返回列表
          </button>
        </div>
        <style jsx>{`
          .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .error {
            text-align: center;
            padding: 60px 20px;
            color: #e74c3c;
          }
          .back-btn {
            padding: 10px 20px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
          }
          .back-btn:hover {
            background: #2980b9;
          }
        `}</style>
      </div>
    )
  }

  const duration = events.length > 0 ? events[events.length - 1].timestamp - events[0].timestamp : 0

  return (
    <div className="container">
      <header className="header">
        <button onClick={() => router.back()} className="back-btn">
          ← 返回列表
        </button>
        <h1>🎬 回放查看器</h1>
        {metadata && (
          <div className="metadata">
            <span className="meta-item">📱 {metadata.appId}</span>
            <span className="meta-item">🎯 {metadata.sessionId.substring(0, 20)}...</span>
            <span className="meta-item">📦 批次 #{metadata.batchIndex}</span>
            <span className="meta-item">👤 {metadata.userId || '匿名'}</span>
            <span className="meta-item">💾 {formatFileSize(metadata.size)}</span>
            <span className="meta-item">📊 {events.length} 事件</span>
          </div>
        )}
      </header>

      <div className="player-container">
        <div ref={playerRef} className="player" />
      </div>

      <div className="event-info">
        <h3>📋 事件信息</h3>
        <div className="event-stats">
          <div className="stat-item">
            <span className="stat-label">总事件数:</span>
            <span className="stat-value">{events.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">录制时长:</span>
            <span className="stat-value">{formatTime(duration)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">压缩格式:</span>
            <span className="stat-value">{metadata?.compression.toUpperCase()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">创建时间:</span>
            <span className="stat-value">
              {metadata ? new Date(metadata.createdAt).toLocaleString('zh-CN') : '-'}
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
        }
        
        .header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          flex-wrap: wrap;
        }
        
        .back-btn {
          padding: 8px 16px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.3s ease;
        }
        
        .back-btn:hover {
          background: #5a6268;
        }
        
        .header h1 {
          margin: 0;
          color: #333;
          flex: 1;
        }
        
        .metadata {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
        }
        
        .meta-item {
          font-size: 14px;
          color: #6c757d;
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .player-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow: hidden;
          margin-bottom: 30px;
        }
        
        .player {
          width: 100%;
          min-height: 600px;
        }
        
        .event-info {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          padding: 20px;
        }
        
        .event-info h3 {
          margin: 0 0 20px 0;
          color: #333;
        }
        
        .event-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }
        
        .stat-item {
          display: flex;
          justify-content: space-between;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        
        .stat-label {
          color: #6c757d;
          font-size: 14px;
        }
        
        .stat-value {
          color: #495057;
          font-weight: 600;
          font-size: 14px;
        }
        
        @media (max-width: 768px) {
          .header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .metadata {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}

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
      setError(err instanceof Error ? err.message : 'Failed to load replay')
      console.error('Failed to load replay:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadSingleReplay = async (replayId: string) => {
    const metaResponse = await fetch(`http://localhost:3001/v1/replays/${replayId}`)
    if (!metaResponse.ok) throw new Error(`Metadata fetch failed: ${metaResponse.status}`)
    const metaResult = await metaResponse.json()
    setMetadata(metaResult.data)

    const dataResponse = await fetch(`http://localhost:3001/v1/replays/${replayId}/blob?decompress=true`)
    if (!dataResponse.ok) throw new Error(`Replay data fetch failed: ${dataResponse.status}`)
    const batchData: StreamsightBatch = await dataResponse.json()
    setEvents(batchData.events)

    if (playerRef.current && batchData.events.length > 0) {
      await initPlayer(batchData.events)
    }
  }

  const loadSessionReplays = async (sessionId: string) => {
    const listResponse = await fetch(`http://localhost:3001/v1/replays?sessionId=${sessionId}&limit=100`)
    if (!listResponse.ok) throw new Error(`Session list fetch failed: ${listResponse.status}`)
    const listResult = await listResponse.json()
    const batches: ReplayMetadata[] = listResult.data

    if (batches.length === 0) throw new Error('No batch data found in session')

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
            strokeStyle: '#0071e3',
          },
        },
      })
      console.log('rrweb-player initialized, events:', replayEvents.length)
    } catch (err) {
      console.error('Player initialization failed:', err)
      setError('Player failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const destroyPlayer = () => {
    if (!playerInstanceRef.current) return
    try {
      const instance = playerInstanceRef.current as DestroyablePlayer
      if (typeof instance.$destroy === 'function') instance.$destroy()
    } catch (e) {
      console.warn('Player cleanup failed:', e)
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

  const duration = events.length > 0 ? events[events.length - 1].timestamp - events[0].timestamp : 0

  // ===== Loading =====
  if (loading) {
    return (
      <div className="page">
        <div className="center-state">
          <div className="spinner" />
          <p className="center-text">Loading replay...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  // ===== Error =====
  if (error) {
    return (
      <div className="page">
        <div className="center-state">
          <div className="error-icon">!</div>
          <p className="center-title">Unable to Load</p>
          <p className="center-text">{error}</p>
          <button onClick={() => router.back()} className="btn btn-filled">
            Go Back
          </button>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-inner">
          <button onClick={() => router.back()} className="nav-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            Sessions
          </button>
          <div className="nav-center">
            <span className="nav-title">Replay Viewer</span>
          </div>
          <div className="nav-right">
            {session && <span className="nav-badge">Full Session</span>}
          </div>
        </div>
      </nav>

      <main className="main">
        {/* Player */}
        <div className="player-card">
          <div ref={playerRef} className="player" />
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{events.length.toLocaleString()}</span>
            <span className="stat-label">Events</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{formatTime(duration)}</span>
            <span className="stat-label">Duration</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{metadata?.compression.toUpperCase() || '-'}</span>
            <span className="stat-label">Compression</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{metadata ? formatFileSize(metadata.size) : '-'}</span>
            <span className="stat-label">Size</span>
          </div>
        </div>

        {/* Metadata */}
        {metadata && (
          <div className="detail-card">
            <h3 className="detail-heading">Session Details</h3>
            <div className="detail-list">
              <div className="detail-row">
                <span className="detail-label">App</span>
                <span className="detail-value">{metadata.appId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">User</span>
                <span className="detail-value">{metadata.userId || 'Anonymous'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Batch</span>
                <span className="detail-value">#{metadata.batchIndex}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Session ID</span>
                <code className="detail-code">{metadata.sessionId.substring(0, 28)}...</code>
              </div>
              <div className="detail-row">
                <span className="detail-label">Recorded</span>
                <span className="detail-value">
                  {new Date(metadata.createdAt).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>StreamSight Replay Platform</p>
      </footer>

      <style jsx>{styles}</style>
    </div>
  )
}

const styles = `
  /* ===== Base ===== */
  .page {
    min-height: 100vh;
    background: #f5f5f7;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
    color: #1d1d1f;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    letter-spacing: -0.022em;
    line-height: 1.47;
  }

  /* ===== Nav ===== */
  .nav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(245, 245, 247, 0.72);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border-bottom: 0.5px solid rgba(60, 60, 67, 0.06);
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .nav-inner {
    width: 100%;
    max-width: 1200px;
    padding: 0 22px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }
  .nav-back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    font-family: inherit;
    font-size: 15px;
    font-weight: 400;
    color: #0071e3;
    cursor: pointer;
    padding: 6px 10px 6px 6px;
    border-radius: 8px;
    transition: background 0.15s ease;
    letter-spacing: -0.01em;
    justify-self: start;
  }
  .nav-back:hover {
    background: rgba(0, 113, 227, 0.06);
  }
  .nav-center {
    text-align: center;
  }
  .nav-title {
    font-size: 15px;
    font-weight: 600;
    color: #1d1d1f;
    letter-spacing: -0.01em;
  }
  .nav-right {
    justify-self: end;
  }
  .nav-badge {
    font-size: 11px;
    font-weight: 600;
    color: #5856d6;
    background: rgba(88, 86, 214, 0.1);
    padding: 3px 10px;
    border-radius: 980px;
    letter-spacing: 0.01em;
  }

  /* ===== Main ===== */
  .main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px 22px 80px;
  }

  /* ===== Player ===== */
  .player-card {
    background: #fff;
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }
  .player {
    width: 100%;
    min-height: 520px;
  }

  /* ===== Stats Grid ===== */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: rgba(60, 60, 67, 0.06);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 16px;
  }
  .stat-card {
    background: #fff;
    padding: 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat-value {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: #1d1d1f;
    font-variant-numeric: tabular-nums;
  }
  .stat-label {
    font-size: 12px;
    font-weight: 500;
    color: #86868b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ===== Detail Card ===== */
  .detail-card {
    background: #fff;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 16px;
  }
  .detail-heading {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 16px;
    letter-spacing: -0.01em;
  }
  .detail-list {
    display: flex;
    flex-direction: column;
  }
  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 11px 0;
  }
  .detail-row + .detail-row {
    border-top: 0.5px solid rgba(60, 60, 67, 0.06);
  }
  .detail-label {
    font-size: 15px;
    color: #1d1d1f;
  }
  .detail-value {
    font-size: 15px;
    color: #86868b;
    text-align: right;
  }
  .detail-code {
    font-family: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, monospace;
    font-size: 13px;
    color: #86868b;
    background: #f5f5f7;
    padding: 3px 8px;
    border-radius: 6px;
  }

  /* ===== Center States ===== */
  .center-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    text-align: center;
    padding: 40px 20px;
  }
  .spinner {
    width: 28px;
    height: 28px;
    border: 2.5px solid #d2d2d7;
    border-top-color: #1d1d1f;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin-bottom: 16px;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .center-title {
    font-size: 19px;
    font-weight: 600;
    margin: 0 0 4px;
  }
  .center-text {
    font-size: 15px;
    color: #86868b;
    margin: 0 0 20px;
  }
  .error-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 59, 48, 0.1);
    color: #ff3b30;
    font-size: 20px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }

  /* ===== Buttons ===== */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: -0.01em;
    border-radius: 980px;
    padding: 11px 22px;
    text-decoration: none;
    transition: opacity 0.15s ease, transform 0.1s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .btn:active {
    transform: scale(0.97);
  }
  .btn-filled {
    background: #0071e3;
    color: #fff;
  }
  .btn-filled:hover {
    opacity: 0.88;
  }

  /* ===== Footer ===== */
  .footer {
    text-align: center;
    padding: 24px 22px 40px;
    font-size: 13px;
    color: #86868b;
  }
  .footer p { margin: 0; }

  /* ===== Responsive ===== */
  @media (max-width: 734px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .player {
      min-height: 360px;
    }
    .nav-inner {
      grid-template-columns: auto 1fr auto;
    }
    .nav-center {
      display: none;
    }
  }
` as unknown as TemplateStringsArray

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
      setError(err instanceof Error ? err.message : 'Failed to load replays')
      console.error('Failed to load replays:', err)
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
    const d = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)

    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    if (diffDay < 7) return `${diffDay}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const groupedReplays = replays.reduce((groups, replay) => {
    const key = replay.sessionId
    if (!groups[key]) groups[key] = []
    groups[key].push(replay)
    return groups
  }, {} as Record<string, ReplayMetadata[]>)

  const sessionCount = Object.keys(groupedReplays).length

  // ===== Loading =====
  if (loading) {
    return (
      <div className="page">
        <div className="center-state">
          <div className="spinner" />
          <p className="center-text">Loading sessions...</p>
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
          <button onClick={fetchReplays} className="btn btn-filled">
            Try Again
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
          <div className="nav-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
            StreamSight
          </div>
          <button onClick={fetchReplays} className="nav-action">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
        </div>
      </nav>

      <main className="main">
        {/* Hero */}
        <div className="hero">
          <h1 className="hero-title">Sessions</h1>
          <p className="hero-desc">
            {sessionCount === 0
              ? 'No sessions recorded yet.'
              : `${sessionCount} session${sessionCount > 1 ? 's' : ''} recorded`
            }
          </p>
        </div>

        {/* Empty State */}
        {sessionCount === 0 ? (
          <div className="empty-card">
            <div className="empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#aeaeb2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <p className="empty-title">No Replay Data</p>
            <p className="empty-desc">Start recording user behavior in the demo app to see sessions here.</p>
            <a href="http://localhost:5173" target="_blank" rel="noopener noreferrer" className="btn btn-filled">
              Open Demo App
            </a>
          </div>
        ) : (
          <div className="session-list">
            {Object.entries(groupedReplays).map(([sessionId, sessionReplays]) => {
              const sorted = [...sessionReplays].sort((a, b) => a.batchIndex - b.batchIndex)
              const totalSize = sorted.reduce((sum, r) => sum + r.size, 0)
              const latest = [...sessionReplays].sort((a, b) => b.timestamp - a.timestamp)[0]

              return (
                <div key={sessionId} className="session-card">
                  {/* Session Header */}
                  <div className="session-header">
                    <div className="session-header-left">
                      <div className="session-avatar">
                        {(latest.userId || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div className="session-header-info">
                        <div className="session-title">{latest.userId || 'Anonymous'}</div>
                        <div className="session-sub">
                          {latest.appId} &middot; {formatDate(latest.createdAt)}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/replay/${sorted[0].replayId}?session=${sessionId}`}
                      className="btn btn-filled btn-sm"
                    >
                      Play Session
                    </Link>
                  </div>

                  {/* Session Meta Row */}
                  <div className="session-meta-row">
                    <div className="meta-pill">
                      <span className="meta-pill-label">Batches</span>
                      <span className="meta-pill-value">{sorted.length}</span>
                    </div>
                    <div className="meta-pill">
                      <span className="meta-pill-label">Size</span>
                      <span className="meta-pill-value">{formatFileSize(totalSize)}</span>
                    </div>
                    <div className="meta-pill">
                      <span className="meta-pill-label">Compression</span>
                      <span className="meta-pill-value">{latest.compression.toUpperCase()}</span>
                    </div>
                    <div className="meta-pill">
                      <span className="meta-pill-label">Recorded</span>
                      <span className="meta-pill-value">{formatFullDate(latest.createdAt)}</span>
                    </div>
                  </div>

                  {/* Batch List */}
                  <div className="batch-list">
                    {sorted.map((replay) => (
                      <Link
                        key={replay.replayId}
                        href={`/replay/${replay.replayId}`}
                        className="batch-row"
                      >
                        <div className="batch-row-left">
                          <span className="batch-badge">#{replay.batchIndex}</span>
                          <span className="batch-detail">{formatFileSize(replay.size)}</span>
                          <span className="batch-tag">{replay.compression.toUpperCase()}</span>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aeaeb2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </Link>
                    ))}
                  </div>

                  {/* Session ID Footer */}
                  <div className="session-footer">
                    <span className="session-id-label">Session</span>
                    <code className="session-id-value">{sessionId.substring(0, 24)}...</code>
                  </div>
                </div>
              )
            })}
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
    background: #fbfbfd;
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
    background: rgba(251, 251, 253, 0.72);
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
    max-width: 980px;
    padding: 0 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .nav-brand {
    font-size: 15px;
    font-weight: 600;
    color: #1d1d1f;
    display: flex;
    align-items: center;
    gap: 6px;
    letter-spacing: -0.01em;
  }
  .nav-action {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: #0071e3;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 980px;
    transition: background 0.15s ease;
    letter-spacing: -0.01em;
  }
  .nav-action:hover {
    background: rgba(0, 113, 227, 0.06);
  }
  .nav-action:active {
    background: rgba(0, 113, 227, 0.1);
  }

  /* ===== Main ===== */
  .main {
    max-width: 980px;
    margin: 0 auto;
    padding: 0 22px 80px;
  }

  /* ===== Hero ===== */
  .hero {
    padding: 48px 0 36px;
  }
  .hero-title {
    font-size: 34px;
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.1;
    margin: 0 0 6px;
  }
  .hero-desc {
    font-size: 17px;
    color: #6e6e73;
    margin: 0;
  }

  /* ===== Center States ===== */
  .center-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
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

  /* ===== Empty State ===== */
  .empty-card {
    text-align: center;
    padding: 60px 20px;
    background: #fff;
    border-radius: 16px;
  }
  .empty-icon {
    margin-bottom: 16px;
  }
  .empty-title {
    font-size: 19px;
    font-weight: 600;
    margin: 0 0 6px;
  }
  .empty-desc {
    font-size: 15px;
    color: #86868b;
    margin: 0 0 24px;
    max-width: 320px;
    margin-left: auto;
    margin-right: auto;
  }

  /* ===== Session List ===== */
  .session-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ===== Session Card ===== */
  .session-card {
    background: #fff;
    border-radius: 16px;
    overflow: hidden;
    transition: box-shadow 0.3s ease;
  }
  .session-card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  }

  .session-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    gap: 16px;
  }
  .session-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .session-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #5856d6, #af52de);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .session-header-info {
    min-width: 0;
  }
  .session-title {
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .session-sub {
    font-size: 13px;
    color: #86868b;
  }

  /* ===== Meta Row ===== */
  .session-meta-row {
    display: flex;
    gap: 0;
    padding: 0 24px;
    border-top: 0.5px solid rgba(60, 60, 67, 0.06);
    border-bottom: 0.5px solid rgba(60, 60, 67, 0.06);
    overflow-x: auto;
  }
  .meta-pill {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 8px;
    min-width: 0;
  }
  .meta-pill + .meta-pill {
    border-left: 0.5px solid rgba(60, 60, 67, 0.06);
  }
  .meta-pill-label {
    font-size: 11px;
    font-weight: 500;
    color: #86868b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 2px;
  }
  .meta-pill-value {
    font-size: 14px;
    font-weight: 600;
    color: #1d1d1f;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* ===== Batch List ===== */
  .batch-list {
    padding: 4px 12px;
  }
  .batch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 12px;
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition: background 0.15s ease;
    cursor: pointer;
  }
  .batch-row:hover {
    background: #f5f5f7;
  }
  .batch-row:active {
    background: #ececee;
  }
  .batch-row-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .batch-badge {
    font-size: 14px;
    font-weight: 600;
    color: #1d1d1f;
    min-width: 32px;
    font-variant-numeric: tabular-nums;
  }
  .batch-detail {
    font-size: 13px;
    color: #86868b;
    font-variant-numeric: tabular-nums;
  }
  .batch-tag {
    font-size: 11px;
    font-weight: 600;
    color: #34c759;
    background: rgba(52, 199, 89, 0.1);
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.02em;
  }

  /* ===== Session Footer ===== */
  .session-footer {
    padding: 10px 24px;
    border-top: 0.5px solid rgba(60, 60, 67, 0.06);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .session-id-label {
    font-size: 11px;
    font-weight: 500;
    color: #aeaeb2;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .session-id-value {
    font-family: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, monospace;
    font-size: 12px;
    color: #86868b;
    background: none;
  }

  /* ===== Buttons ===== */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
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
    user-select: none;
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
  .btn-sm {
    font-size: 13px;
    padding: 7px 16px;
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
    .hero-title { font-size: 28px; }
    .session-header {
      flex-direction: column;
      align-items: flex-start;
    }
    .session-meta-row {
      flex-wrap: wrap;
    }
    .meta-pill {
      min-width: 45%;
    }
  }
` as unknown as TemplateStringsArray

import 'rrweb-player/dist/style.css'

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

interface SessionGroup {
  sessionId: string
  batches: ReplayMetadata[]
  firstTimestamp: number
  lastTimestamp: number
  totalSize: number
}

type ViewState = 'list' | 'loading' | 'playing'

let container: HTMLElement
let state: ViewState = 'list'
let currentPlayer: any = null
let apiBase = ''

export function initReplayViewer(el: HTMLElement, apiEndpoint: string) {
  container = el
  apiBase = apiEndpoint
  renderList()
}

// ===== Rendering =====

async function renderList() {
  state = 'list'
  destroyPlayer()
  container.innerHTML = `
    <div class="replay-toolbar">
      <button id="replayRefreshBtn" class="btn btn-tinted btn-sm">Refresh</button>
      <button id="replayClearBtn" class="btn btn-gray btn-sm">Clear All</button>
    </div>
    <div id="replayListContent" class="replay-list">
      <div class="replay-loading">Loading sessions...</div>
    </div>
  `

  container.querySelector('#replayRefreshBtn')!.addEventListener('click', () => renderList())
  container.querySelector('#replayClearBtn')!.addEventListener('click', async () => {
    if (!confirm('Delete all recorded sessions?')) return
    await fetch(getApiBase() + '/v1/replays', { method: 'DELETE' })
    renderList()
  })

  try {
    const res = await fetch(getApiBase() + '/v1/replays?limit=500')
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`)
    }
    const text = await res.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error('Invalid response (not JSON) — Service Worker may not be active yet. Try refreshing.')
    }

    if (!json.success || !json.data || json.data.length === 0) {
      container.querySelector('#replayListContent')!.innerHTML = `
        <div class="replay-empty">
          <div class="replay-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
          </div>
          <p class="replay-empty-title">No recordings yet</p>
          <p class="replay-empty-desc">Start recording, interact with the page, then stop to see sessions here.</p>
        </div>
      `
      return
    }

    const groups = groupBySession(json.data)
    const listEl = container.querySelector('#replayListContent')!
    listEl.innerHTML = ''

    for (const group of groups) {
      const card = document.createElement('div')
      card.className = 'replay-session-card'
      const date = new Date(group.firstTimestamp)
      const duration = group.lastTimestamp - group.firstTimestamp
      card.innerHTML = `
        <div class="replay-session-info">
          <div class="replay-session-title">
            <span class="replay-session-id">${group.sessionId.slice(0, 8)}...</span>
            <span class="replay-session-batches">${group.batches.length} batch${group.batches.length > 1 ? 'es' : ''}</span>
          </div>
          <div class="replay-session-meta">
            ${formatDate(date)} &middot; ${formatDuration(duration)} &middot; ${formatSize(group.totalSize)}
          </div>
        </div>
        <button class="btn btn-filled btn-sm replay-play-btn">Play</button>
      `
      card.querySelector('.replay-play-btn')!.addEventListener('click', () => {
        playSession(group)
      })
      listEl.appendChild(card)
    }
  } catch (err) {
    container.querySelector('#replayListContent')!.innerHTML = `
      <div class="replay-empty">
        <p class="replay-empty-title">Failed to load</p>
        <p class="replay-empty-desc">${(err as Error).message}</p>
      </div>
    `
  }
}

async function playSession(group: SessionGroup) {
  state = 'loading'
  container.innerHTML = `
    <div class="replay-toolbar">
      <button id="replayBackBtn" class="btn btn-tinted btn-sm">&larr; Back</button>
      <span class="replay-now-playing">Session ${group.sessionId.slice(0, 8)}...</span>
    </div>
    <div id="replayPlayerWrap" class="replay-player-wrap">
      <div class="replay-loading">Loading batches...</div>
    </div>
  `
  container.querySelector('#replayBackBtn')!.addEventListener('click', () => renderList())

  try {
    // Sort batches by batchIndex
    const sorted = [...group.batches].sort((a, b) => a.batchIndex - b.batchIndex)

    // Fetch and decompress all blobs
    const allEvents: any[] = []
    for (const batch of sorted) {
      const res = await fetch(getApiBase() + `/v1/replays/${batch.replayId}/blob?decompress=true`)
      if (!res.ok) continue
      const data = await res.json()
      if (data.events && Array.isArray(data.events)) {
        allEvents.push(...data.events)
      }
    }

    if (allEvents.length === 0) {
      container.querySelector('#replayPlayerWrap')!.innerHTML = `
        <div class="replay-empty">
          <p class="replay-empty-title">No events found</p>
          <p class="replay-empty-desc">The recorded batches contain no replay events.</p>
        </div>
      `
      return
    }

    // Sort events by timestamp
    allEvents.sort((a, b) => a.timestamp - b.timestamp)

    state = 'playing'
    const playerWrap = container.querySelector('#replayPlayerWrap')!
    playerWrap.innerHTML = '<div id="replayPlayerMount"></div>'

    // Dynamic import rrweb-player
    const { default: RRWebPlayer } = await import('rrweb-player')
    const mountEl = document.getElementById('replayPlayerMount')!

    currentPlayer = new RRWebPlayer({
      target: mountEl,
      props: {
        events: allEvents,
        autoPlay: false,
        showController: true,
        speedOption: [0.5, 1, 1.5, 2, 4],
        skipInactive: true,
        mouseTail: {
          strokeStyle: 'rgba(0, 113, 227, 0.6)',
          lineWidth: 2,
        },
      },
    })
  } catch (err) {
    container.querySelector('#replayPlayerWrap')!.innerHTML = `
      <div class="replay-empty">
        <p class="replay-empty-title">Playback failed</p>
        <p class="replay-empty-desc">${(err as Error).message}</p>
      </div>
    `
  }
}

// ===== Helpers =====

function getApiBase(): string {
  return apiBase
}

function destroyPlayer() {
  if (currentPlayer) {
    if (typeof currentPlayer.$destroy === 'function') {
      currentPlayer.$destroy()
    }
    currentPlayer = null
  }
}

function groupBySession(items: ReplayMetadata[]): SessionGroup[] {
  const map = new Map<string, ReplayMetadata[]>()
  for (const item of items) {
    const arr = map.get(item.sessionId) || []
    arr.push(item)
    map.set(item.sessionId, arr)
  }

  const groups: SessionGroup[] = []
  for (const [sessionId, batches] of map) {
    const timestamps = batches.map(b => b.timestamp)
    groups.push({
      sessionId,
      batches,
      firstTimestamp: Math.min(...timestamps),
      lastTimestamp: Math.max(...timestamps),
      totalSize: batches.reduce((sum, b) => sum + b.size, 0),
    })
  }

  groups.sort((a, b) => b.firstTimestamp - a.firstTimestamp)
  return groups
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

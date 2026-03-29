/// <reference lib="webworker" />

const DB_NAME = 'streamsight-local'
const DB_VERSION = 1
const STORE_META = 'metadata'
const STORE_BLOBS = 'blobs'

// ===== IndexedDB Helpers =====

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_META)) {
        const meta = db.createObjectStore(STORE_META, { keyPath: 'replayId' })
        meta.createIndex('sessionId', 'sessionId', { unique: false })
        meta.createIndex('appId', 'appId', { unique: false })
        meta.createIndex('timestamp', 'timestamp', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'replayId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db, stores, mode) {
  const t = db.transaction(stores, mode)
  return stores.length === 1 ? t.objectStore(stores[0]) : stores.map(s => t.objectStore(s))
}

function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ===== Route Matching =====

function matchRoute(url) {
  const u = new URL(url)
  const path = u.pathname.replace(/\/$/, '')

  // GET /v1/replays/:id/blob
  let m = path.match(/^(?:\/streamsight)?\/v1\/replays\/([^/]+)\/blob$/)
  if (m) return { handler: 'getBlob', id: m[1], params: u.searchParams }

  // GET /v1/replays/:id (not "blob" suffix)
  m = path.match(/^(?:\/streamsight)?\/v1\/replays\/([^/]+)$/)
  if (m) return { handler: 'getOne', id: m[1], params: u.searchParams }

  // GET|POST /v1/replays
  m = path.match(/^(?:\/streamsight)?\/v1\/replays$/)
  if (m) return { handler: 'replays', params: u.searchParams }

  return null
}

// ===== Handlers =====

async function handlePost(request) {
  const db = await openDB()
  const headers = request.headers
  const appId = headers.get('x-app-id')
  const sessionId = headers.get('x-session-id')
  const batchIndex = headers.get('x-batch-index')
  const timestamp = headers.get('x-ts')
  const compression = headers.get('x-compression')
  const userId = headers.get('x-user-id')

  if (!appId || !sessionId || !batchIndex || !timestamp || !compression) {
    return jsonResponse(400, {
      error: 'Missing required headers',
      required: ['x-app-id', 'x-session-id', 'x-batch-index', 'x-ts', 'x-compression'],
    })
  }

  const body = await request.arrayBuffer()
  if (!body || body.byteLength === 0) {
    return jsonResponse(400, { error: 'Empty request body' })
  }

  const replayId = crypto.randomUUID()
  const meta = {
    replayId,
    appId,
    sessionId,
    batchIndex: parseInt(batchIndex, 10),
    timestamp: parseInt(timestamp, 10),
    compression,
    size: body.byteLength,
    createdAt: new Date().toISOString(),
  }
  if (userId) meta.userId = userId

  const t = db.transaction([STORE_META, STORE_BLOBS], 'readwrite')
  t.objectStore(STORE_META).put(meta)
  t.objectStore(STORE_BLOBS).put({ replayId, data: body })

  await new Promise((resolve, reject) => {
    t.oncomplete = resolve
    t.onerror = () => reject(t.error)
  })

  return jsonResponse(200, { success: true, replayId, message: 'Replay data saved successfully' })
}

async function handleGetList(params) {
  const db = await openDB()
  const store = tx(db, [STORE_META], 'readonly')
  const all = await idbReq(store.getAll())

  let filtered = all
  const sessionId = params.get('sessionId')
  const appId = params.get('appId')
  const userId = params.get('userId')
  if (sessionId) filtered = filtered.filter(r => r.sessionId === sessionId)
  if (appId) filtered = filtered.filter(r => r.appId === appId)
  if (userId) filtered = filtered.filter(r => r.userId === userId)

  filtered.sort((a, b) => b.timestamp - a.timestamp)

  const limit = parseInt(params.get('limit') || '50', 10)
  const offset = parseInt(params.get('offset') || '0', 10)
  const page = filtered.slice(offset, offset + limit)

  return jsonResponse(200, { success: true, data: page, total: filtered.length })
}

async function handleGetOne(id) {
  const db = await openDB()
  const store = tx(db, [STORE_META], 'readonly')
  const meta = await idbReq(store.get(id))

  if (!meta) {
    return jsonResponse(404, { error: 'Replay not found' })
  }
  return jsonResponse(200, { success: true, data: meta })
}

async function handleGetBlob(id, params) {
  const db = await openDB()
  const [metaStore, blobStore] = (() => {
    const t = db.transaction([STORE_META, STORE_BLOBS], 'readonly')
    return [t.objectStore(STORE_META), t.objectStore(STORE_BLOBS)]
  })()

  const meta = await idbReq(metaStore.get(id))
  const blob = await idbReq(blobStore.get(id))

  if (!meta || !blob) {
    return jsonResponse(404, { error: 'Replay blob not found' })
  }

  const decompress = params.get('decompress') === 'true'

  if (decompress && meta.compression === 'gzip') {
    try {
      const ds = new DecompressionStream('gzip')
      const readable = new Response(blob.data).body.pipeThrough(ds)
      const decompressed = await new Response(readable).text()
      return new Response(decompressed, {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (e) {
      return jsonResponse(500, { error: 'Decompression failed', message: e.message })
    }
  }

  // Return raw blob
  return new Response(blob.data, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-compression': meta.compression,
      'x-original-size': String(meta.size),
    },
  })
}

async function handleDelete(id) {
  const db = await openDB()
  const t = db.transaction([STORE_META, STORE_BLOBS], 'readwrite')
  t.objectStore(STORE_META).delete(id)
  t.objectStore(STORE_BLOBS).delete(id)
  await new Promise((resolve, reject) => {
    t.oncomplete = resolve
    t.onerror = () => reject(t.error)
  })
  return jsonResponse(200, { success: true })
}

async function handleDeleteAll() {
  const db = await openDB()
  const t = db.transaction([STORE_META, STORE_BLOBS], 'readwrite')
  t.objectStore(STORE_META).clear()
  t.objectStore(STORE_BLOBS).clear()
  await new Promise((resolve, reject) => {
    t.oncomplete = resolve
    t.onerror = () => reject(t.error)
  })
  return jsonResponse(200, { success: true })
}

// ===== Utilities =====

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ===== Service Worker Events =====

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const route = matchRoute(event.request.url)
  if (!route) return // Let the request pass through

  event.respondWith(
    (async () => {
      try {
        const method = event.request.method

        if (route.handler === 'replays') {
          if (method === 'POST') return await handlePost(event.request)
          if (method === 'GET') return await handleGetList(route.params)
          if (method === 'DELETE') return await handleDeleteAll()
        }

        if (route.handler === 'getOne') {
          if (method === 'GET') return await handleGetOne(route.id)
          if (method === 'DELETE') return await handleDelete(route.id)
        }

        if (route.handler === 'getBlob') {
          if (method === 'GET') return await handleGetBlob(route.id, route.params)
        }

        return jsonResponse(405, { error: 'Method not allowed' })
      } catch (err) {
        return jsonResponse(500, { error: 'Internal server error', message: err.message })
      }
    })()
  )
})

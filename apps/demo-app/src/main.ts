import { init, start, stop, flush, setUser } from 'streamsight'
import { initReplayViewer } from './replay-viewer'

// ===== Environment Detection =====
// GH Pages build sets base to '/streamsight/', so even when previewed on localhost
// we should use SW mode. Only true localhost dev (base='/') uses the real backend.
const isGHPagesBuild = import.meta.env.BASE_URL !== '/'
const isLocal = !isGHPagesBuild && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
const apiEndpoint = isLocal ? 'http://localhost:3001' : ''

// ===== Service Worker Registration (for GH Pages local mode) =====
async function setupServiceWorker() {
  if (isLocal || !('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
    await navigator.serviceWorker.ready
    // On first load, the SW is active but hasn't claimed this page yet.
    // Wait for clients.claim() to finish so fetches are actually intercepted.
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
      })
    }
    console.log('[StreamSight] Service Worker active — local IndexedDB mode')
  } catch (err) {
    console.warn('[StreamSight] SW registration failed:', err)
  }
}

// ===== Initialize SDK =====
async function bootstrap() {
  await setupServiceWorker()

  init({
    appId: 'demo-app',
    apiEndpoint,
    userId: 'demo-user-' + Math.random().toString(36).substr(2, 9),
    batchSize: 20,
    batchTimeout: 10000,
    privacy: {
      maskSelectors: ['.ss-mask', '.sensitive'],
      blockSelectors: ['.ss-block', '.private'],
      maskAllInputs: false,
      maskPasswords: true,
    },
    compression: {
      type: isLocal ? 'zstd' : 'gzip',
      level: 3,
    },
  })

  // Init replay viewer
  const replayContainer = document.getElementById('replayContainer')
  if (replayContainer) {
    initReplayViewer(replayContainer, apiEndpoint)
  }

  console.log('[StreamSight] Demo app loaded' + (isLocal ? ' (local dev)' : ' (GH Pages mode)'))
  showToast('Welcome to StreamSight', '\u25B6')
}

bootstrap()

// ===== DOM References =====
const startBtn = document.getElementById('startBtn') as HTMLButtonElement
const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement
const flushBtn = document.getElementById('flushBtn') as HTMLButtonElement
const viewReplaysBtn = document.getElementById('viewReplaysBtn') as HTMLButtonElement
const navStatus = document.getElementById('navStatus') as HTMLDivElement
const navStatusText = document.getElementById('navStatusText') as HTMLSpanElement

let isRecording = false

// ===== Toast System =====
function showToast(message: string, icon: string = '') {
  const container = document.getElementById('toastContainer')!
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.innerHTML = `${icon ? `<span class="toast-icon">${icon}</span>` : ''}<span>${message}</span>`
  container.appendChild(toast)

  setTimeout(() => {
    toast.classList.add('leaving')
    toast.addEventListener('animationend', () => toast.remove())
  }, 3000)
}

// ===== Recording Controls =====
startBtn.addEventListener('click', async () => {
  try {
    startBtn.textContent = 'Starting...'
    startBtn.disabled = true
    await start()
    isRecording = true
    updateUI()
    showToast('Recording started', '\u25CF')
  } catch (error) {
    console.error('Failed to start recording:', error)
    showToast('Failed to start: ' + (error as Error).message, '\u26A0')
    startBtn.textContent = 'Start Recording'
    startBtn.disabled = false
  }
})

stopBtn.addEventListener('click', () => {
  try {
    stop()
    isRecording = false
    updateUI()
    showToast('Recording stopped. Data saved.', '\u2713')
  } catch (error) {
    console.error('Failed to stop recording:', error)
  }
})

flushBtn.addEventListener('click', async () => {
  try {
    await flush()
    showToast('Batch flushed', '\u2191')
  } catch (error) {
    console.error('Failed to flush batch:', error)
  }
})

viewReplaysBtn.addEventListener('click', () => {
  const section = document.getElementById('replaySection')
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' })
  }
})

function updateUI() {
  if (isRecording) {
    startBtn.disabled = true
    startBtn.textContent = 'Recording'
    stopBtn.disabled = false
    stopBtn.className = 'btn btn-filled-red'
    navStatus.className = 'nav-status recording'
    navStatusText.textContent = 'Recording'
  } else {
    startBtn.disabled = false
    startBtn.textContent = 'Start Recording'
    stopBtn.disabled = true
    stopBtn.className = 'btn btn-gray'
    navStatus.className = 'nav-status'
    navStatusText.textContent = 'Ready'
  }
}

// ===== Click Interaction Counters =====
const clickCounts = { click1: 0, click2: 0, hover: 0 }

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  if (!target || typeof target.closest !== 'function') return

  const card = target.closest('[data-action]') as HTMLElement | null
  if (!card) return

  const action = card.getAttribute('data-action')

  switch (action) {
    case 'click1':
      clickCounts.click1++
      animateCounter('click1Count', clickCounts.click1)
      break
    case 'modal':
      openModal()
      break
  }
})

document.addEventListener('dblclick', (event) => {
  const target = event.target as HTMLElement
  if (!target || typeof target.closest !== 'function') return

  const card = target.closest('[data-action="click2"]')
  if (card) {
    clickCounts.click2++
    animateCounter('click2Count', clickCounts.click2)
  }
})

document.addEventListener('mouseenter', (event) => {
  const target = event.target as HTMLElement
  if (!target || typeof target.closest !== 'function') return

  const card = target.closest('[data-action="hover"]')
  if (card) {
    clickCounts.hover++
    animateCounter('hoverCount', clickCounts.hover)
  }
}, true)

function animateCounter(id: string, value: number) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = value.toString()
  el.style.transform = 'scale(1.1)'
  el.style.transition = 'transform 0.15s ease'
  setTimeout(() => {
    el.style.transform = 'scale(1)'
  }, 150)
}

// ===== Modal =====
const modal = document.getElementById('modal')!

function openModal() {
  modal.classList.add('visible')
}

function closeModal() {
  modal.classList.remove('visible')
}

document.getElementById('closeModalBtn')?.addEventListener('click', closeModal)
document.getElementById('closeModalBtn2')?.addEventListener('click', closeModal)

modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal.classList.contains('visible')) {
    closeModal()
  }
})

// ===== Dynamic Content =====
let dynamicContentCount = 0
const dynamicContainer = document.getElementById('dynamicContent')!
const dynamicEmpty = document.getElementById('dynamicEmpty')!

function updateDynamicEmpty() {
  dynamicEmpty.style.display = dynamicContainer.children.length === 0 ? 'block' : 'none'
}

document.getElementById('addContentBtn')?.addEventListener('click', () => {
  dynamicContentCount++
  const item = document.createElement('div')
  item.className = 'dynamic-item'
  item.innerHTML = `
    <div class="dynamic-item-left">
      <div class="dynamic-item-number">${dynamicContentCount}</div>
      <input type="text" placeholder="Dynamic input #${dynamicContentCount}">
    </div>
    <button class="btn-remove" aria-label="Remove">&times;</button>
  `
  item.querySelector('.btn-remove')?.addEventListener('click', () => {
    item.style.opacity = '0'
    item.style.transform = 'translateX(20px)'
    item.style.transition = 'opacity 0.2s ease, transform 0.2s ease'
    setTimeout(() => {
      item.remove()
      updateDynamicEmpty()
    }, 200)
  })
  dynamicContainer.appendChild(item)
  updateDynamicEmpty()
})

document.getElementById('removeContentBtn')?.addEventListener('click', () => {
  const last = dynamicContainer.lastElementChild as HTMLElement | null
  if (last) {
    last.style.opacity = '0'
    last.style.transform = 'translateX(20px)'
    last.style.transition = 'opacity 0.2s ease, transform 0.2s ease'
    setTimeout(() => {
      last.remove()
      updateDynamicEmpty()
    }, 200)
  }
})

// ===== Form Input Logging =====
document.querySelectorAll('input, textarea, select').forEach(element => {
  element.addEventListener('focus', (event) => {
    const target = event.target as HTMLInputElement
    console.log('Focus:', target.id)
  })

  element.addEventListener('blur', (event) => {
    const target = event.target as HTMLInputElement
    console.log('Blur:', target.id)
  })
})

// ===== Scroll & Resize Logging =====
let scrollTimeout: number
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout)
  scrollTimeout = window.setTimeout(() => {
    console.log('Scroll Y:', window.scrollY)
  }, 100)
})

window.addEventListener('resize', () => {
  console.log('Viewport:', window.innerWidth, 'x', window.innerHeight)
})

document.addEventListener('visibilitychange', () => {
  console.log('Visibility:', document.hidden ? 'hidden' : 'visible')
})

// ===== Set User =====
setUser('demo-user', {
  name: 'Demo User',
  role: 'tester',
  timestamp: Date.now(),
})

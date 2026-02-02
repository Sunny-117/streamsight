import { init, start, stop, flush, setUser } from 'streamsight'

// 初始化 SDK
const recorder = init({
  appId: 'demo-app',
  apiEndpoint: 'http://localhost:3001',
  userId: 'demo-user-' + Math.random().toString(36).substr(2, 9),
  batchSize: 20, // 演示用较小批次
  batchTimeout: 10000, // 10 秒超时
  privacy: {
    maskSelectors: ['.oo-mask', '.sensitive'],
    blockSelectors: ['.oo-block', '.private'],
    maskAllInputs: false,
    maskPasswords: true,
  },
  compression: {
    type: 'gzip',
    level: 6,
  },
})

// DOM 元素
const startBtn = document.getElementById('startBtn') as HTMLButtonElement
const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement
const flushBtn = document.getElementById('flushBtn') as HTMLButtonElement
const viewReplaysBtn = document.getElementById('viewReplaysBtn') as HTMLButtonElement
const status = document.getElementById('status') as HTMLDivElement

// 录制状态
let isRecording = false

// 开始录制
startBtn.addEventListener('click', async () => {
  try {
    // 显示加载状态
    startBtn.textContent = '正在启动...'
    startBtn.disabled = true
    
    await start()
    isRecording = true
    updateUI()
    console.log('录制已开始')
    
    // 显示成功提示
    showNotification('✅ 录制已开始', 'success')
  } catch (error) {
    console.error('启动录制失败:', error)
    alert('启动录制失败: ' + (error as Error).message)
    startBtn.textContent = '开始录制'
    startBtn.disabled = false
  }
})

// 停止录制
stopBtn.addEventListener('click', () => {
  try {
    stop()
    isRecording = false
    updateUI()
    console.log('录制已停止')
    
    // 显示成功提示
    showNotification('⏹️ 录制已停止，数据已保存', 'success')
    
    // 提示用户可以查看数据
    setTimeout(() => {
      showNotification('💡 提示：点击"本地数据查看器"可查看录制的数据', 'info')
    }, 2000)
  } catch (error) {
    console.error('停止录制失败:', error)
  }
})

// 刷新批次
flushBtn.addEventListener('click', async () => {
  try {
    await flush()
    console.log('批次已刷新')
  } catch (error) {
    console.error('刷新批次失败:', error)
  }
})

// 查看回放
viewReplaysBtn.addEventListener('click', () => {
  window.open('http://localhost:3000', '_blank')
})

// 更新 UI 状态
function updateUI() {
  if (isRecording) {
    startBtn.disabled = true
    stopBtn.disabled = false
    status.textContent = '🔴 录制中...'
    status.className = 'status recording'
  } else {
    startBtn.disabled = false
    stopBtn.disabled = true
    status.textContent = '⏹️ 录制已停止'
    status.className = 'status stopped'
  }
}

// 交互事件处理
let clickCounts = {
  click1: 0,
  click2: 0,
  hover: 0,
}

// 点击事件
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  if (!target || typeof target.getAttribute !== 'function') return
  
  const action = target.getAttribute('data-action') || target.closest('[data-action]')?.getAttribute('data-action')
  
  if (action) {
    switch (action) {
      case 'click1':
        clickCounts.click1++
        const click1Element = document.getElementById('click1Count')
        if (click1Element) {
          click1Element.textContent = clickCounts.click1.toString()
        }
        break
      case 'modal':
        const modalElement = document.getElementById('modal')
        if (modalElement) {
          modalElement.style.display = 'block'
        }
        break
    }
  }
})

// 双击事件
document.addEventListener('dblclick', (event) => {
  const target = event.target as HTMLElement
  if (!target || typeof target.getAttribute !== 'function') return
  
  const action = target.getAttribute('data-action') || target.closest('[data-action]')?.getAttribute('data-action')
  
  if (action === 'click2') {
    clickCounts.click2++
    const click2Element = document.getElementById('click2Count')
    if (click2Element) {
      click2Element.textContent = clickCounts.click2.toString()
    }
  }
})

// 悬停事件
document.addEventListener('mouseenter', (event) => {
  const target = event.target as HTMLElement
  if (!target || typeof target.getAttribute !== 'function') return
  
  const action = target.getAttribute('data-action')
  
  if (action === 'hover') {
    clickCounts.hover++
    const hoverElement = document.getElementById('hoverCount')
    if (hoverElement) {
      hoverElement.textContent = clickCounts.hover.toString()
    }
  }
}, true)

// 关闭模态框
document.getElementById('closeModalBtn')?.addEventListener('click', () => {
  document.getElementById('modal')!.style.display = 'none'
})

// 点击模态框背景关闭
document.getElementById('modal')?.addEventListener('click', (event) => {
  if (event.target === event.currentTarget) {
    document.getElementById('modal')!.style.display = 'none'
  }
})

// 动态内容
let dynamicContentCount = 0

document.getElementById('addContentBtn')?.addEventListener('click', () => {
  const container = document.getElementById('dynamicContent')!
  const div = document.createElement('div')
  div.style.cssText = 'padding: 10px; margin: 5px 0; background: #e3f2fd; border-radius: 4px;'
  div.innerHTML = `
    <p>动态内容 #${++dynamicContentCount}</p>
    <input type="text" placeholder="动态输入框 ${dynamicContentCount}">
    <button onclick="this.parentElement.remove()">删除此项</button>
  `
  container.appendChild(div)
})

document.getElementById('removeContentBtn')?.addEventListener('click', () => {
  const container = document.getElementById('dynamicContent')!
  const lastChild = container.lastElementChild
  if (lastChild) {
    lastChild.remove()
  }
})

// 表单输入事件
document.querySelectorAll('input, textarea, select').forEach(element => {
  element.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement
    console.log('输入事件:', target.id, target.value.length > 0 ? '有内容' : '空')
  })
  
  element.addEventListener('focus', (event) => {
    const target = event.target as HTMLInputElement
    console.log('焦点事件:', target.id)
  })
  
  element.addEventListener('blur', (event) => {
    const target = event.target as HTMLInputElement
    console.log('失焦事件:', target.id)
  })
})

// 滚动事件
let scrollTimeout: number
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout)
  scrollTimeout = window.setTimeout(() => {
    console.log('滚动位置:', window.scrollY)
  }, 100)
})

// 窗口大小变化
window.addEventListener('resize', () => {
  console.log('窗口大小:', window.innerWidth, 'x', window.innerHeight)
})

// 页面可见性变化
document.addEventListener('visibilitychange', () => {
  console.log('页面可见性:', document.hidden ? '隐藏' : '可见')
})

// 设置用户信息
setUser('demo-user', {
  name: '演示用户',
  role: 'tester',
  timestamp: Date.now(),
})

// 通知函数
function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const notification = document.createElement('div')
  notification.textContent = message
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `
  
  if (type === 'success') {
    notification.style.background = '#4CAF50'
  } else if (type === 'error') {
    notification.style.background = '#f44336'
  } else {
    notification.style.background = '#2196F3'
  }
  
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in'
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

// 添加动画样式
const style = document.createElement('style')
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`
document.head.appendChild(style)

console.log('StreamSight 演示应用已加载')
console.log('请点击"开始录制"按钮开始录制用户行为')

// 显示欢迎提示
showNotification('👋 欢迎使用 StreamSight！点击"开始录制"开始', 'info')
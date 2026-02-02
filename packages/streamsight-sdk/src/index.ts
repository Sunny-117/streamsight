import { record } from 'rrweb'

// 定义必要的类型
export interface eventWithTime {
  type: number
  data: any
  timestamp: number
}

interface recordOptions {
  emit: (event: eventWithTime) => void
  checkoutEveryNms?: number
  maskTextSelector?: string
  blockSelector?: string
  maskAllInputs?: boolean
  maskInputOptions?: {
    password?: boolean
  }
  recordCanvas?: boolean
  collectFonts?: boolean
  inlineStylesheet?: boolean
  slimDOMOptions?: {
    script?: boolean
    comment?: boolean
    headFavicon?: boolean
    headWhitespace?: boolean
    headMetaDescKeywords?: boolean
    headMetaSocial?: boolean
    headMetaRobots?: boolean
    headMetaHttpEquiv?: boolean
    headMetaAuthorship?: boolean
    headMetaVerification?: boolean
  }
}
import { EventBatcher } from './batcher'
import { PrivacyManager } from './privacy'
import { Uploader } from './uploader'
import { WorkerBridge } from 'streamsight-core-utils'

export interface StreamsightConfig {
  /** 应用标识 */
  appId: string
  /** API 端点 */
  apiEndpoint: string
  /** 用户标识（可选） */
  userId?: string
  /** 会话标识（可选，默认自动生成） */
  sessionId?: string
  /** 批次大小，默认 80 条事件 */
  batchSize?: number
  /** 批次时间窗口（毫秒），默认 30 秒 */
  batchTimeout?: number
  /** 脱敏配置 */
  privacy?: {
    /** 自定义遮盖选择器，默认 ['.oo-mask'] */
    maskSelectors?: string[]
    /** 自定义阻止选择器，默认 ['.oo-block'] */
    blockSelectors?: string[]
    /** 是否遮盖所有输入，默认 false */
    maskAllInputs?: boolean
    /** 是否遮盖密码输入，默认 true */
    maskPasswords?: boolean
  }
  /** 压缩配置 */
  compression?: {
    /** 压缩类型，默认 'gzip'，可选 'zstd' */
    type?: 'gzip' | 'zstd'
    /** 压缩级别 */
    level?: number
  }
  /** 网络配置 */
  network?: {
    /** 重试次数，默认 3 */
    retryCount?: number
    /** 重试延迟（毫秒），默认 1000 */
    retryDelay?: number
  }
}

export interface StreamsightBatch {
  batchIndex: number
  timestamp: number
  events: eventWithTime[]
  sessionId: string
  appId: string
  userId?: string
}

export class StreamsightRecorder {
  private config: StreamsightConfig & {
    sessionId: string
    batchSize: number
    batchTimeout: number
    privacy: {
      maskSelectors: string[]
      blockSelectors: string[]
      maskAllInputs: boolean
      maskPasswords: boolean
    }
    compression: {
      type: 'gzip' | 'zstd'
      level: number
    }
    network: {
      retryCount: number
      retryDelay: number
    }
  }
  private isRecording = false
  private stopRecording?: () => void
  private batcher: EventBatcher
  private privacyManager: PrivacyManager
  private uploader: Uploader
  private workerBridge: WorkerBridge
  private sessionId: string

  constructor(config: StreamsightConfig) {
    // 设置默认配置
    this.config = {
      ...config,
      sessionId: config.sessionId || this.generateSessionId(),
      batchSize: config.batchSize || 80,
      batchTimeout: config.batchTimeout || 30000,
      privacy: {
        maskSelectors: ['.oo-mask'],
        blockSelectors: ['.oo-block'],
        maskAllInputs: false,
        maskPasswords: true,
        ...config.privacy,
      },
      compression: {
        type: 'gzip',
        level: 6,
        ...config.compression,
      },
      network: {
        retryCount: 3,
        retryDelay: 1000,
        ...config.network,
      },
    }

    this.sessionId = this.config.sessionId
    this.privacyManager = new PrivacyManager(this.config.privacy)
    this.batcher = new EventBatcher({
      batchSize: this.config.batchSize,
      timeout: this.config.batchTimeout,
      onBatch: this.handleBatch.bind(this),
    })
    this.uploader = new Uploader(this.config)
    this.workerBridge = new WorkerBridge()
  }

  /**
   * 开始录制
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      console.warn('StreamSight: 录制已在进行中')
      return
    }

    try {
      // 异步初始化 Worker，不阻塞录制启动
      this.workerBridge.init().catch(err => {
        console.error('StreamSight: Worker 初始化失败', err)
      })

      // 配置 rrweb 录制选项
      const recordOptions: recordOptions = {
        emit: this.handleEvent.bind(this),
        checkoutEveryNms: 10 * 60 * 1000, // 每 10 分钟生成一次全量快照
        
        // 脱敏配置
        maskTextSelector: this.privacyManager.getMaskSelectors().join(','),
        blockSelector: this.privacyManager.getBlockSelectors().join(','),
        
        // 输入脱敏
        maskAllInputs: this.config.privacy.maskAllInputs,
        maskInputOptions: {
          password: this.config.privacy.maskPasswords,
        },

        // DOM 增强处理
        // 注意：由于 rrweb 类型定义复杂，暂时不使用插件系统

        // 采集配置
        recordCanvas: false, // MVP 暂不支持 Canvas
        collectFonts: true,
        inlineStylesheet: true,
        
        // 脚本安全处理
        slimDOMOptions: {
          script: true, // 移除脚本内容
          comment: true,
          headFavicon: true,
          headWhitespace: true,
          headMetaDescKeywords: true,
          headMetaSocial: true,
          headMetaRobots: true,
          headMetaHttpEquiv: true,
          headMetaAuthorship: true,
          headMetaVerification: true,
        },
      }

      // 使用 requestIdleCallback 或 setTimeout 延迟初始化，避免阻塞主线程
      const startRecording = () => {
        this.stopRecording = record(recordOptions)
        this.isRecording = true

        console.log('StreamSight: 录制已开始', {
          sessionId: this.sessionId,
          appId: this.config.appId,
        })
      }

      // 优先使用 requestIdleCallback，如果不支持则使用 setTimeout
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(startRecording, { timeout: 100 })
      } else {
        setTimeout(startRecording, 0)
      }
    } catch (error) {
      console.error('StreamSight: 启动录制失败', error)
      throw error
    }
  }

  /**
   * 停止录制
   */
  stop(): void {
    if (!this.isRecording) {
      console.warn('StreamSight: 录制未在进行中')
      return
    }

    this.stopRecording?.()
    this.isRecording = false
    
    // 刷新剩余事件
    this.flush()
    
    console.log('StreamSight: 录制已停止')
  }

  /**
   * 刷新当前批次
   */
  async flush(): Promise<void> {
    await this.batcher.flush()
  }

  /**
   * 设置用户信息
   */
  setUser(userId: string, meta?: Record<string, any>): void {
    this.config.userId = userId
    // 可以在这里添加用户元数据事件
    console.log('StreamSight: 用户信息已更新', { userId, meta })
  }

  /**
   * 添加忽略选择器
   */
  addIgnoreSelector(selector: string): void {
    this.privacyManager.addBlockSelector(selector)
  }

  /**
   * 添加遮盖选择器
   */
  addMaskSelector(selector: string): void {
    this.privacyManager.addMaskSelector(selector)
  }

  /**
   * 处理录制事件
   */
  private handleEvent(event: eventWithTime): void {
    // 添加到批次处理器
    this.batcher.addEvent(event)
  }

  /**
   * 处理批次数据
   */
  private async handleBatch(events: eventWithTime[], batchIndex: number): Promise<void> {
    const batch: StreamsightBatch = {
      batchIndex,
      timestamp: Date.now(),
      events,
      sessionId: this.sessionId,
      appId: this.config.appId,
      userId: this.config.userId,
    }

    try {
      // 在 Worker 中压缩数据
      const compressedData = await this.workerBridge.compress(
        JSON.stringify(batch),
        this.config.compression.type,
        this.config.compression.level
      )

      // 上传压缩数据
      await this.uploader.upload(compressedData, batch)
      
      console.log(`StreamSight: 批次 ${batchIndex} 上传成功`, {
        eventCount: events.length,
        compressedSize: compressedData.byteLength,
        sessionId: this.sessionId,
      })
    } catch (error) {
      console.error(`StreamSight: 批次 ${batchIndex} 上传失败`, error)
      // 失败时保存到本地存储
      this.saveToLocalStorage(batch)
    }
  }

  /**
   * 保存到本地存储（作为备份）
   */
  private saveToLocalStorage(batch: StreamsightBatch): void {
    try {
      const key = `streamsight_backup_${this.sessionId}_${batch.batchIndex}`
      localStorage.setItem(key, JSON.stringify(batch))
      console.log(`StreamSight: 批次 ${batch.batchIndex} 已保存到本地存储`)
    } catch (error) {
      console.error('StreamSight: 保存到本地存储失败', error)
    }
  }



  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    return `ss_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }


}

// 全局实例
let globalRecorder: StreamsightRecorder | null = null

/**
 * 初始化 StreamSight SDK
 */
export function init(config: StreamsightConfig): StreamsightRecorder {
  if (globalRecorder) {
    console.warn('StreamSight: SDK 已初始化，返回现有实例')
    return globalRecorder
  }

  globalRecorder = new StreamsightRecorder(config)
  return globalRecorder
}

/**
 * 开始录制（使用全局实例）
 */
export async function start(): Promise<void> {
  if (!globalRecorder) {
    throw new Error('StreamSight: 请先调用 init() 初始化 SDK')
  }
  await globalRecorder.start()
}

/**
 * 停止录制（使用全局实例）
 */
export function stop(): void {
  if (!globalRecorder) {
    throw new Error('StreamSight: 请先调用 init() 初始化 SDK')
  }
  globalRecorder.stop()
}

/**
 * 刷新当前批次（使用全局实例）
 */
export async function flush(): Promise<void> {
  if (!globalRecorder) {
    throw new Error('StreamSight: 请先调用 init() 初始化 SDK')
  }
  await globalRecorder.flush()
}

/**
 * 设置用户信息（使用全局实例）
 */
export function setUser(userId: string, meta?: Record<string, any>): void {
  if (!globalRecorder) {
    throw new Error('StreamSight: 请先调用 init() 初始化 SDK')
  }
  globalRecorder.setUser(userId, meta)
}

/**
 * 添加忽略选择器（使用全局实例）
 */
export function addIgnoreSelector(selector: string): void {
  if (!globalRecorder) {
    throw new Error('StreamSight: 请先调用 init() 初始化 SDK')
  }
  globalRecorder.addIgnoreSelector(selector)
}

/**
 * 添加遮盖选择器（使用全局实例）
 */
export function addMaskSelector(selector: string): void {
  if (!globalRecorder) {
    throw new Error('StreamSight: 请先调用 init() 初始化 SDK')
  }
  globalRecorder.addMaskSelector(selector)
}

// 类型已在上面导出，这里不需要重复导出
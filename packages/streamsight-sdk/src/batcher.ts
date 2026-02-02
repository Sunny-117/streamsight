import type { eventWithTime } from './index'

export interface BatcherConfig {
  batchSize: number
  timeout: number
  onBatch: (events: eventWithTime[], batchIndex: number) => Promise<void>
}

export class EventBatcher {
  private events: eventWithTime[] = []
  private batchIndex = 0
  private timer: NodeJS.Timeout | null = null
  private config: BatcherConfig

  constructor(config: BatcherConfig) {
    this.config = config
  }

  addEvent(event: eventWithTime): void {
    this.events.push(event)

    // 检查是否达到批次大小
    if (this.events.length >= this.config.batchSize) {
      this.flushBatch()
    } else if (this.timer === null) {
      // 启动超时定时器
      this.timer = setTimeout(() => {
        this.flushBatch()
      }, this.config.timeout)
    }
  }

  async flush(): Promise<void> {
    if (this.events.length > 0) {
      await this.flushBatch()
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.events.length === 0) return

    const eventsToFlush = [...this.events]
    const currentBatchIndex = this.batchIndex++

    // 清空当前批次
    this.events = []
    this.clearTimer()

    try {
      await this.config.onBatch(eventsToFlush, currentBatchIndex)
    } catch (error) {
      console.error('StreamSight: 批次处理失败', error)
      // 可以在这里实现重试逻辑
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
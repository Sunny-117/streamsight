import type { StreamsightConfig, StreamsightBatch } from './index'

export class Uploader {
  private config: StreamsightConfig & {
    network: {
      retryCount: number
      retryDelay: number
    }
    compression: {
      type: 'gzip' | 'zstd'
    }
  }
  private uploadQueue: Array<{ data: ArrayBuffer; batch: StreamsightBatch }> = []
  private isUploading = false

  constructor(config: StreamsightConfig & {
    network: {
      retryCount: number
      retryDelay: number
    }
    compression: {
      type: 'gzip' | 'zstd'
    }
  }) {
    this.config = config
  }

  async upload(compressedData: ArrayBuffer, batch: StreamsightBatch): Promise<void> {
    // 添加到队列
    this.uploadQueue.push({ data: compressedData, batch })

    // 如果没有正在上传，开始处理队列
    if (!this.isUploading) {
      await this.processQueue()
    }
  }

  private async processQueue(): Promise<void> {
    this.isUploading = true

    while (this.uploadQueue.length > 0) {
      const item = this.uploadQueue.shift()!
      await this.uploadWithRetry(item.data, item.batch)
    }

    this.isUploading = false
  }

  private async uploadWithRetry(
    data: ArrayBuffer,
    batch: StreamsightBatch,
    attempt = 1
  ): Promise<void> {
    try {
      await this.performUpload(data, batch)
    } catch (error) {
      console.error(`StreamSight: 上传失败 (尝试 ${attempt}/${this.config.network.retryCount})`, error)

      if (attempt < this.config.network.retryCount) {
        // 指数退避延迟
        const delay = this.config.network.retryDelay * Math.pow(2, attempt - 1)
        await this.sleep(delay)
        await this.uploadWithRetry(data, batch, attempt + 1)
      } else {
        // 最终失败，可以考虑本地存储
        console.error('StreamSight: 上传最终失败，考虑本地存储', {
          batchIndex: batch.batchIndex,
          sessionId: batch.sessionId,
        })
        this.handleUploadFailure(data, batch)
      }
    }
  }

  private async performUpload(data: ArrayBuffer, batch: StreamsightBatch): Promise<void> {
    const response = await fetch(`${this.config.apiEndpoint}/v1/replays`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-app-id': batch.appId,
        'x-session-id': batch.sessionId,
        'x-batch-index': batch.batchIndex.toString(),
        'x-ts': batch.timestamp.toString(),
        'x-compression': this.config.compression.type,
        ...(batch.userId && { 'x-user-id': batch.userId }),
      },
      body: data,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('StreamSight: 上传成功', result)
  }

  private handleUploadFailure(data: ArrayBuffer, batch: StreamsightBatch): void {
    // MVP: 简单的本地存储失败处理
    try {
      const failedUploads = JSON.parse(
        localStorage.getItem('streamsight_failed_uploads') || '[]'
      )
      
      failedUploads.push({
        batchIndex: batch.batchIndex,
        sessionId: batch.sessionId,
        timestamp: batch.timestamp,
        size: data.byteLength,
        // 注意：不存储实际数据到 localStorage，只存储元信息
      })

      // 限制失败记录数量
      if (failedUploads.length > 100) {
        failedUploads.splice(0, failedUploads.length - 100)
      }

      localStorage.setItem('streamsight_failed_uploads', JSON.stringify(failedUploads))
    } catch (error) {
      console.error('StreamSight: 无法保存失败上传记录', error)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取失败的上传记录
   */
  getFailedUploads(): Array<{
    batchIndex: number
    sessionId: string
    timestamp: number
    size: number
  }> {
    try {
      return JSON.parse(localStorage.getItem('streamsight_failed_uploads') || '[]')
    } catch {
      return []
    }
  }

  /**
   * 清除失败的上传记录
   */
  clearFailedUploads(): void {
    localStorage.removeItem('streamsight_failed_uploads')
  }
}
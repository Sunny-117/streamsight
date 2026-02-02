import type { WorkerMessage, WorkerResponse, CompressionType } from './types'

export class WorkerBridge {
  private worker: Worker | null = null
  private pendingRequests = new Map<string, {
    resolve: (value: ArrayBuffer | string) => void
    reject: (error: Error) => void
  }>()

  async init(): Promise<void> {
    if (this.worker) {
      return
    }

    try {
      // 创建内联 Worker
      const workerCode = this.getWorkerCode()
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const workerUrl = URL.createObjectURL(blob)
      
      this.worker = new Worker(workerUrl)
      this.worker.onmessage = this.handleWorkerMessage.bind(this)
      this.worker.onerror = this.handleWorkerError.bind(this)

      // 延迟清理 URL，确保 Worker 已加载
      setTimeout(() => URL.revokeObjectURL(workerUrl), 100)
      
      console.log('StreamSight: Worker 初始化成功')
    } catch (error) {
      console.error('StreamSight: Worker 初始化失败', error)
      throw error
    }
  }

  async compress(
    data: string,
    type: CompressionType = 'gzip',
    level: number = 6
  ): Promise<ArrayBuffer> {
    if (!this.worker) {
      throw new Error('Worker 未初始化')
    }

    const id = this.generateId()
    const message: WorkerMessage = {
      id,
      type: 'compress',
      data,
      options: { type, level },
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve: resolve as any, reject })
      this.worker!.postMessage(message)
    })
  }

  async decompress(
    data: ArrayBuffer,
    type: CompressionType = 'gzip'
  ): Promise<string> {
    if (!this.worker) {
      throw new Error('Worker 未初始化')
    }

    const id = this.generateId()
    const message: WorkerMessage = {
      id,
      type: 'decompress',
      data,
      options: { type },
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve: resolve as any, reject })
      this.worker!.postMessage(message, [data])
    })
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.pendingRequests.clear()
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const { id, success, data, error } = event.data
    const request = this.pendingRequests.get(id)

    if (!request) {
      console.warn('StreamSight: 收到未知请求的响应', id)
      return
    }

    this.pendingRequests.delete(id)

    if (success && data !== undefined) {
      request.resolve(data)
    } else {
      request.reject(new Error(error || '未知错误'))
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('StreamSight: Worker 错误', error)
    
    // 拒绝所有待处理的请求
    for (const [, request] of this.pendingRequests) {
      request.reject(new Error('Worker 错误'))
    }
    this.pendingRequests.clear()
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  private getWorkerCode(): string {
    return `
// Worker 代码 - 内联 fflate 压缩功能
self.onmessage = async function(event) {
  const { id, type, data, options } = event.data;
  
  try {
    let result;
    
    if (type === 'compress') {
      result = await compressData(data, options);
    } else if (type === 'decompress') {
      result = await decompressData(data, options);
    } else {
      throw new Error('未知操作类型: ' + type);
    }
    
    self.postMessage({
      id,
      success: true,
      data: result
    });
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message
    });
  }
};

// 简化的 gzip 压缩实现
async function compressData(data, options) {
  const encoder = new TextEncoder();
  const uint8Data = encoder.encode(data);
  
  // 使用浏览器原生的 CompressionStream API（如果可用）
  if (typeof CompressionStream !== 'undefined') {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(uint8Data);
    writer.close();
    
    const chunks = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result.buffer;
  } else {
    // 回退到简单的压缩（实际上不压缩，只是返回原数据）
    console.warn('CompressionStream 不可用，跳过压缩');
    return uint8Data.buffer;
  }
}

async function decompressData(data, options) {
  const uint8Data = new Uint8Array(data);
  
  // 使用浏览器原生的 DecompressionStream API（如果可用）
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(uint8Data);
    writer.close();
    
    const chunks = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    const decoder = new TextDecoder();
    return decoder.decode(result);
  } else {
    // 回退到简单的解压（假设数据未压缩）
    console.warn('DecompressionStream 不可用，跳过解压');
    const decoder = new TextDecoder();
    return decoder.decode(uint8Data);
  }
}
    `
  }
}
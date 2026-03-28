import type { CompressionType } from './types'

type FflateModule = typeof import('fflate')

// 动态导入 fflate 以避免构建时错误
let fflate: FflateModule | null = null

async function loadFflate(): Promise<FflateModule | null> {
  if (!fflate) {
    try {
      fflate = await import('fflate')
    } catch {
      console.warn('fflate 加载失败，使用浏览器原生压缩')
    }
  }
  return fflate
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = data
  return buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer
}

type GzipLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

function normalizeLevel(level: number): GzipLevel {
  const safeLevel = Math.min(9, Math.max(0, Math.round(level)))
  return safeLevel as GzipLevel
}

export class CompressionAdapter {
  /**
   * 压缩数据
   */
  static async compress(
    data: string,
    type: CompressionType = 'gzip',
    level: number = 6
  ): Promise<ArrayBuffer> {
    const encoder = new TextEncoder()
    const uint8Data = encoder.encode(data)

    switch (type) {
      case 'gzip':
        return this.compressGzip(uint8Data, level)
      case 'zstd':
        // TODO: 实现 zstd 压缩，当前回退到 gzip
        console.warn('ZSTD 压缩暂未实现，使用 gzip 替代')
        return this.compressGzip(uint8Data, level)
      default:
        throw new Error(`不支持的压缩类型: ${type}`)
    }
  }

  /**
   * 解压数据
   */
  static async decompress(
    data: ArrayBuffer,
    type: CompressionType = 'gzip'
  ): Promise<string> {
    const uint8Data = new Uint8Array(data)

    switch (type) {
      case 'gzip':
        return this.decompressGzip(uint8Data)
      case 'zstd':
        // TODO: 实现 zstd 解压，当前回退到 gzip
        console.warn('ZSTD 解压暂未实现，使用 gzip 替代')
        return this.decompressGzip(uint8Data)
      default:
        throw new Error(`不支持的压缩类型: ${type}`)
    }
  }

  private static async compressGzip(data: Uint8Array, level: number): Promise<ArrayBuffer> {
    const fflateLib = await loadFflate()
    
    if (fflateLib && fflateLib.gzip) {
      return new Promise((resolve, reject) => {
        fflateLib.gzip(data, { level: normalizeLevel(level) }, (err, compressed) => {
          if (err) {
            reject(err)
          } else {
            resolve(toArrayBuffer(compressed))
          }
        })
      })
    } else {
      // 回退到浏览器原生压缩
      if (typeof CompressionStream !== 'undefined') {
        const stream = new CompressionStream('gzip')
        const writer = stream.writable.getWriter()
        const reader = stream.readable.getReader()
        const inputBuffer = toArrayBuffer(data)
        
        writer.write(inputBuffer)
        writer.close()
        
        const chunks: Uint8Array[] = []
        let done = false
        
        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone
          if (value) {
            chunks.push(value)
          }
        }
        
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const result = new Uint8Array(totalLength)
        let offset = 0
        
        for (const chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.length
        }
        
        return toArrayBuffer(result)
      } else {
        // 最后回退：不压缩
        console.warn('压缩不可用，返回原始数据')
        return toArrayBuffer(data)
      }
    }
  }

  private static async decompressGzip(data: Uint8Array): Promise<string> {
    const fflateLib = await loadFflate()
    
    if (fflateLib && fflateLib.gunzip) {
      return new Promise((resolve, reject) => {
        fflateLib.gunzip(data, (err, decompressed) => {
          if (err) {
            reject(err)
          } else {
            const decoder = new TextDecoder()
            resolve(decoder.decode(decompressed))
          }
        })
      })
    } else {
      // 回退到浏览器原生解压
      if (typeof DecompressionStream !== 'undefined') {
        const stream = new DecompressionStream('gzip')
        const writer = stream.writable.getWriter()
        const reader = stream.readable.getReader()
        const inputBuffer = toArrayBuffer(data)
        
        writer.write(inputBuffer)
        writer.close()
        
        const chunks: Uint8Array[] = []
        let done = false
        
        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone
          if (value) {
            chunks.push(value)
          }
        }
        
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const result = new Uint8Array(totalLength)
        let offset = 0
        
        for (const chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.length
        }
        
        const decoder = new TextDecoder()
        return decoder.decode(result)
      } else {
        // 最后回退：假设数据未压缩
        console.warn('解压不可用，假设数据未压缩')
        const decoder = new TextDecoder()
        return decoder.decode(new Uint8Array(toArrayBuffer(data)))
      }
    }
  }

  /**
   * 检查是否支持 ZSTD
   */
  static isZstdSupported(): boolean {
    // TODO: 检查 zstd-wasm 是否可用
    return false
  }

  /**
   * 获取推荐的压缩类型
   */
  static getRecommendedCompressionType(): CompressionType {
    return this.isZstdSupported() ? 'zstd' : 'gzip'
  }
}

export type CompressionType = 'gzip' | 'zstd'

export interface CompressionOptions {
  type: CompressionType
  level?: number
}

export interface WorkerMessage {
  id: string
  type: 'compress' | 'decompress'
  data: string | ArrayBuffer
  options?: CompressionOptions
}

export interface WorkerResponse {
  id: string
  success: boolean
  data?: ArrayBuffer | string
  error?: string
}

export interface PrivacyRule {
  selector: string
  type: 'mask' | 'block'
  pattern?: RegExp
}
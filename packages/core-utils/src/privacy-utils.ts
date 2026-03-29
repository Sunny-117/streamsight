export const DEFAULT_SENSITIVE_PATTERNS = [
  // 信用卡号
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  // 邮箱
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // 中国手机号
  /\b1[3-9]\d{9}\b/g,
  // 美国 SSN
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // 身份证号（简化版）
  /\b\d{17}[\dXx]\b/g,
]

export const DEFAULT_MASK_SELECTORS = [
  '.ss-mask',
  '[data-sensitive]',
  '.sensitive',
]

export const DEFAULT_BLOCK_SELECTORS = [
  '.ss-block',
  '[data-private]',
  '.private',
  'script',
  'style',
]

/**
 * 检查文本是否包含敏感信息
 */
export function containsSensitiveData(text: string, patterns = DEFAULT_SENSITIVE_PATTERNS): boolean {
  return patterns.some(pattern => pattern.test(text))
}

/**
 * 遮盖敏感文本
 */
export function maskSensitiveText(text: string, patterns = DEFAULT_SENSITIVE_PATTERNS): string {
  let maskedText = text
  
  patterns.forEach(pattern => {
    maskedText = maskedText.replace(pattern, (match) => '*'.repeat(match.length))
  })
  
  return maskedText
}

/**
 * 检查元素是否应该被遮盖
 */
export function shouldMaskElement(element: Element, selectors = DEFAULT_MASK_SELECTORS): boolean {
  return selectors.some(selector => {
    try {
      return element.matches(selector)
    } catch {
      return false
    }
  })
}

/**
 * 检查元素是否应该被阻止
 */
export function shouldBlockElement(element: Element, selectors = DEFAULT_BLOCK_SELECTORS): boolean {
  return selectors.some(selector => {
    try {
      return element.matches(selector)
    } catch {
      return false
    }
  })
}

/**
 * 清理 URL 中的敏感参数
 */
export function sanitizeUrl(url: string, sensitiveParams = ['token', 'key', 'password', 'secret']): string {
  try {
    const urlObj = new URL(url)
    
    sensitiveParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '***')
      }
    })
    
    return urlObj.toString()
  } catch {
    return url
  }
}

/**
 * 生成遮盖字符
 */
export function generateMask(length: number, char = '*'): string {
  return char.repeat(Math.max(1, Math.min(length, 20))) // 限制最大长度
}
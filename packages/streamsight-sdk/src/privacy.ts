export interface PrivacyConfig {
  maskSelectors: string[]
  blockSelectors: string[]
  maskAllInputs: boolean
  maskPasswords: boolean
}

export class PrivacyManager {
  private config: PrivacyConfig
  private sensitivePatterns = [
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // 信用卡号
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // 邮箱
    /\b1[3-9]\d{9}\b/, // 中国手机号
    /\b\d{3}-\d{2}-\d{4}\b/, // 美国 SSN
  ]

  constructor(config: PrivacyConfig) {
    this.config = { ...config }
  }

  getMaskSelectors(): string[] {
    return [...this.config.maskSelectors]
  }

  getBlockSelectors(): string[] {
    return [...this.config.blockSelectors]
  }

  addMaskSelector(selector: string): void {
    if (!this.config.maskSelectors.includes(selector)) {
      this.config.maskSelectors.push(selector)
    }
  }

  addBlockSelector(selector: string): void {
    if (!this.config.blockSelectors.includes(selector)) {
      this.config.blockSelectors.push(selector)
    }
  }

  shouldMaskInput(input: HTMLInputElement | HTMLTextAreaElement): boolean {
    // 检查密码输入
    if (this.config.maskPasswords && input.type === 'password') {
      return true
    }

    // 检查全局输入遮盖
    if (this.config.maskAllInputs) {
      return true
    }

    // 检查元素是否匹配遮盖选择器
    for (const selector of this.config.maskSelectors) {
      if (input.matches(selector)) {
        return true
      }
    }

    // 检查输入值是否包含敏感信息
    const value = input.value || ''
    for (const pattern of this.sensitivePatterns) {
      if (pattern.test(value)) {
        return true
      }
    }

    return false
  }

  shouldBlockElement(element: Element): boolean {
    for (const selector of this.config.blockSelectors) {
      if (element.matches(selector)) {
        return true
      }
    }
    return false
  }

  maskText(text: string): string {
    let maskedText = text

    // 应用敏感信息模式遮盖
    for (const pattern of this.sensitivePatterns) {
      maskedText = maskedText.replace(pattern, (match) => '*'.repeat(match.length))
    }

    return maskedText
  }
}
import { transform } from '@babel/standalone';
import type { CompileResult } from '../types/widget';

/**
 * Widget 编译服务
 * 负责将用户编写的 JSX/TSX 代码编译为可执行的 JavaScript
 */
export class WidgetCompiler {
  private babelConfig = {
    presets: [
      ['react', { runtime: 'automatic' }],
      ['typescript', { isTSX: true, allExtensions: true }],
    ],
    plugins: [
      ['transform-modules-commonjs', { loose: true }],
    ],
    filename: 'widget.tsx',
  };

  /**
   * 编译 Widget 代码
   */
  compile(sourceCode: string): CompileResult {
    try {
      this.securityCheck(sourceCode);

      const result = transform(sourceCode, this.babelConfig);

      return {
        success: true,
        code: result.code || '',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compilation failed',
      };
    }
  }

  /**
   * 安全检查：禁止使用危险 API
   */
  private securityCheck(code: string): void {
    const dangerousPatterns = [
      /\beval\s*\(/,
      /\bFunction\s*\(/,
      /\b__proto__\b/,
      /\bconstructor\s*\[/,
      /\bwindow\s*\[/,
      /\bdocument\.write\b/,
      /\bimportScripts\b/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error('Security violation: dangerous pattern detected');
      }
    }
  }
}

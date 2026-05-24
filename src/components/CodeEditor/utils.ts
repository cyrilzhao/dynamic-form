import { parser as javascriptParser } from '@lezer/javascript';
import { parser as pythonParser } from '@lezer/python';
import type { LRParser } from '@lezer/lr';
import type { SupportedLanguage } from './types';

/**
 * 根据语言类型获取语言显示名称
 */
export const getLanguageDisplayName = (language: SupportedLanguage): string => {
  const displayNames: Record<SupportedLanguage, string> = {
    javascript: 'JavaScript',
    json: 'JSON',
    python: 'Python',
    sql: 'SQL',
    yaml: 'YAML',
    markdown: 'Markdown',
    html: 'HTML',
    css: 'CSS',
  };
  return displayNames[language] || language.toUpperCase();
};

/**
 * 通用 Lezer parser 语法验证
 * 解析代码并检测语法树中的错误节点，返回首个错误的位置信息
 */
const validateWithLezerParser = (code: string, parser: LRParser): string | null => {
  if (!code || code.trim() === '') {
    return null;
  }

  const tree = parser.parse(code);
  let firstErrorPos: number | null = null;

  tree.iterate({
    enter(node) {
      if (firstErrorPos === null && node.type.isError) {
        firstErrorPos = node.from;
      }
    },
  });

  if (firstErrorPos !== null) {
    const lines = code.slice(0, firstErrorPos).split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    return `Syntax Error: Unexpected token at line ${line}, column ${col}`;
  }

  return null;
};

/**
 * JSON 验证器
 */
export const jsonValidator = (code: string): string | null => {
  if (!code || code.trim() === '') {
    return null;
  }

  try {
    JSON.parse(code);
    return null;
  } catch (error) {
    return `Invalid JSON: ${(error as Error).message}`;
  }
};

/**
 * JavaScript 语法验证器
 * 使用 Lezer JavaScript parser 进行纯语法树解析，无代码执行风险
 */
export const javascriptValidator = (code: string): string | null => {
  return validateWithLezerParser(code, javascriptParser);
};

/**
 * Python 语法验证器
 * 使用 Lezer Python parser 进行纯语法树解析
 */
export const pythonValidator = (code: string): string | null => {
  return validateWithLezerParser(code, pythonParser);
};

/**
 * 根据语言类型获取对应的内置验证器
 * 支持 JSON、JavaScript 和 Python 的语法校验
 */
export const getLanguageValidator = (
  language: SupportedLanguage
): ((code: string) => string | null) | undefined => {
  const validators: Partial<Record<SupportedLanguage, (code: string) => string | null>> = {
    json: jsonValidator,
    javascript: javascriptValidator,
    python: pythonValidator,
  };
  return validators[language];
};

/**
 * JSON 格式化器
 */
export const jsonFormatter = (code: string): string => {
  try {
    return JSON.stringify(JSON.parse(code), null, 2);
  } catch {
    return code;
  }
};

/**
 * 计算代码行数
 */
export const countLines = (code: string): number => {
  return code.split('\n').length;
};

/**
 * 截取代码的前 N 行
 */
export const truncateLines = (code: string, maxLines: number): string => {
  const lines = code.split('\n');
  if (lines.length <= maxLines) {
    return code;
  }
  return lines.slice(0, maxLines).join('\n') + '\n...';
};

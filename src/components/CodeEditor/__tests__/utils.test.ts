import {
  getLanguageDisplayName,
  jsonValidator,
  jsonFormatter,
  countLines,
  truncateLines,
} from '../utils';

describe('CodeEditor utils', () => {
  describe('getLanguageDisplayName', () => {
    it('应该返回 JavaScript 的显示名称', () => {
      expect(getLanguageDisplayName('javascript')).toBe('JavaScript');
    });

    it('应该返回 JSON 的显示名称', () => {
      expect(getLanguageDisplayName('json')).toBe('JSON');
    });

    it('应该返回 Python 的显示名称', () => {
      expect(getLanguageDisplayName('python')).toBe('Python');
    });

    it('应该返回 SQL 的显示名称', () => {
      expect(getLanguageDisplayName('sql')).toBe('SQL');
    });

    it('应该返回 YAML 的显示名称', () => {
      expect(getLanguageDisplayName('yaml')).toBe('YAML');
    });

    it('应该返回 Markdown 的显示名称', () => {
      expect(getLanguageDisplayName('markdown')).toBe('Markdown');
    });

    it('应该返回 HTML 的显示名称', () => {
      expect(getLanguageDisplayName('html')).toBe('HTML');
    });

    it('应该返回 CSS 的显示名称', () => {
      expect(getLanguageDisplayName('css')).toBe('CSS');
    });
  });

  describe('jsonValidator', () => {
    it('应该对有效的 JSON 返回 null', () => {
      expect(jsonValidator('{"name": "test"}')).toBeNull();
    });

    it('应该对有效的 JSON 数组返回 null', () => {
      expect(jsonValidator('[1, 2, 3]')).toBeNull();
    });

    it('应该对有效的嵌套 JSON 返回 null', () => {
      const validJson = JSON.stringify({
        user: { name: 'John', age: 30 },
        items: [1, 2, 3],
      });
      expect(jsonValidator(validJson)).toBeNull();
    });

    it('应该对空字符串返回 null', () => {
      expect(jsonValidator('')).toBeNull();
    });

    it('应该对只有空白的字符串返回 null', () => {
      expect(jsonValidator('   ')).toBeNull();
      expect(jsonValidator('\n\t')).toBeNull();
    });

    it('应该对无效的 JSON 返回错误信息', () => {
      const result = jsonValidator('{invalid}');
      expect(result).not.toBeNull();
      expect(result).toContain('Invalid JSON');
    });

    it('应该对缺少引号的 JSON 返回错误信息', () => {
      const result = jsonValidator('{name: "test"}');
      expect(result).not.toBeNull();
      expect(result).toContain('Invalid JSON');
    });

    it('应该对尾随逗号的 JSON 返回错误信息', () => {
      const result = jsonValidator('{"name": "test",}');
      expect(result).not.toBeNull();
      expect(result).toContain('Invalid JSON');
    });

    it('应该对不完整的 JSON 返回错误信息', () => {
      const result = jsonValidator('{"name":');
      expect(result).not.toBeNull();
      expect(result).toContain('Invalid JSON');
    });
  });

  describe('jsonFormatter', () => {
    it('应该格式化压缩的 JSON', () => {
      const input = '{"name":"test","age":30}';
      const expected = '{\n  "name": "test",\n  "age": 30\n}';
      expect(jsonFormatter(input)).toBe(expected);
    });

    it('应该格式化 JSON 数组', () => {
      const input = '[1,2,3]';
      const expected = '[\n  1,\n  2,\n  3\n]';
      expect(jsonFormatter(input)).toBe(expected);
    });

    it('应该格式化嵌套的 JSON', () => {
      const input = '{"user":{"name":"John"}}';
      const result = jsonFormatter(input);
      expect(result).toContain('"user"');
      expect(result).toContain('"name"');
      expect(result.split('\n').length).toBeGreaterThan(1);
    });

    it('应该对无效的 JSON 返回原始字符串', () => {
      const input = '{invalid json}';
      expect(jsonFormatter(input)).toBe(input);
    });

    it('应该对空字符串返回原始字符串', () => {
      expect(jsonFormatter('')).toBe('');
    });
  });

  describe('countLines', () => {
    it('应该正确计算单行代码的行数', () => {
      expect(countLines('single line')).toBe(1);
    });

    it('应该正确计算多行代码的行数', () => {
      expect(countLines('line1\nline2\nline3')).toBe(3);
    });

    it('应该正确计算空字符串的行数', () => {
      expect(countLines('')).toBe(1);
    });

    it('应该正确计算只有换行符的行数', () => {
      expect(countLines('\n')).toBe(2);
      expect(countLines('\n\n')).toBe(3);
    });

    it('应该正确计算带有空行的代码行数', () => {
      expect(countLines('line1\n\nline3')).toBe(3);
    });
  });

  describe('truncateLines', () => {
    it('应该截取前 N 行代码', () => {
      const code = 'line1\nline2\nline3\nline4\nline5';
      const result = truncateLines(code, 3);
      expect(result).toBe('line1\nline2\nline3\n...');
    });

    it('应该在行数不超过限制时返回原始代码', () => {
      const code = 'line1\nline2';
      expect(truncateLines(code, 3)).toBe(code);
    });

    it('应该在行数等于限制时返回原始代码', () => {
      const code = 'line1\nline2\nline3';
      expect(truncateLines(code, 3)).toBe(code);
    });

    it('应该正确处理单行代码', () => {
      const code = 'single line';
      expect(truncateLines(code, 3)).toBe(code);
    });

    it('应该正确处理空字符串', () => {
      expect(truncateLines('', 3)).toBe('');
    });

    it('应该在截取后添加省略号', () => {
      const code = 'line1\nline2\nline3\nline4';
      const result = truncateLines(code, 2);
      expect(result.endsWith('...')).toBe(true);
    });
  });
});

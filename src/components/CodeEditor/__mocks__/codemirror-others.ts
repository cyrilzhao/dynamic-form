/**
 * CodeMirror 语言和其他模块的 mock
 */

// @codemirror/commands
export const defaultKeymap: any[] = [];
export const history = jest.fn(() => []);
export const historyKeymap: any[] = [];

// @codemirror/lang-*
export const javascript = jest.fn(() => []);
export const json = jest.fn(() => []);
export const python = jest.fn(() => []);
export const sql = jest.fn(() => []);
export const yaml = jest.fn(() => []);
export const markdown = jest.fn(() => []);
export const html = jest.fn(() => []);
export const css = jest.fn(() => []);

// @codemirror/language
export const bracketMatching = jest.fn(() => []);
export const foldGutter = jest.fn(() => []);
export const indentOnInput = jest.fn(() => []);
export const syntaxHighlighting = jest.fn(() => []);
export const defaultHighlightStyle = {};

// @codemirror/search
export const searchKeymap: any[] = [];
export const highlightSelectionMatches = jest.fn(() => []);

// @codemirror/autocomplete
export const autocompletion = jest.fn(() => []);
export const completionKeymap: any[] = [];

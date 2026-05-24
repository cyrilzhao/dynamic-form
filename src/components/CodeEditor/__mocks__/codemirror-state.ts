/**
 * CodeMirror @codemirror/state 模块的 mock
 */

export let __mockDocValue = '';

export const EditorState = {
  create: jest.fn(({ doc }: { doc: string }) => {
    __mockDocValue = doc;
    return {
      doc: {
        toString: () => doc,
      },
    };
  }),
};

export function __resetMockDocValue() {
  __mockDocValue = '';
}

import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/testHelpers\\.'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // lucide-react/dynamic 子路径映射
    '^lucide-react/dynamic$':
      '<rootDir>/src/components/Workflow/nodes/__mocks__/lucide-react-dynamic.ts',
    // CodeMirror 模块映射到 mock 文件，确保在所有 Node 版本下都能正确 mock
    '^@codemirror/view$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-view.ts',
    '^@codemirror/state$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-state.ts',
    '^@codemirror/commands$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-others.ts',
    '^@codemirror/lang-javascript$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-others.ts',
    '^@codemirror/lang-json$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-others.ts',
    '^@codemirror/lang-python$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-others.ts',
    '^@codemirror/lang-sql$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-others.ts',
    '^@codemirror/lang-yaml$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-others.ts',
    '^@codemirror/lang-markdown$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-others.ts',
    '^@codemirror/lang-html$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-others.ts',
    '^@codemirror/lang-css$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-others.ts',
    '^@codemirror/language$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-others.ts',
    '^@codemirror/search$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-others.ts',
    '^@codemirror/autocomplete$':
      '<rootDir>/src/components/CodeEditor/__mocks__/codemirror-others.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/services/api.ts',
    '!src/routes/index.tsx',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          baseUrl: '.',
          paths: {
            '@/*': ['./src/*'],
          },
        },
      },
    ],
  },
};

export default config;

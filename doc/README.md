# 项目文档

## 项目概述

这是一个基于 Vite + React + TypeScript 的现代化前端项目框架。

## 技术栈

- **构建工具**: Vite
- **框架**: React 18
- **语言**: TypeScript
- **样式**: SASS
- **路由**: React Router v6
- **状态管理**: Zustand
- **数据请求**: TanStack Query (React Query)
- **HTTP 客户端**: Axios
- **代码格式化**: Prettier
- **代码检查**: ESLint

## 项目结构

```
workflow/
├── doc/                    # 文档目录
│   ├── README.md          # 项目文档
│   └── TECH.md            # 技术文档
├── src/                   # 源代码目录
│   ├── components/        # 可复用组件
│   ├── pages/            # 页面组件
│   ├── hooks/            # 自定义 Hooks
│   ├── stores/           # Zustand 状态管理
│   ├── services/         # API 服务
│   ├── utils/            # 工具函数
│   ├── styles/           # 样式文件
│   ├── types/            # TypeScript 类型定义
│   ├── routes/           # 路由配置
│   ├── App.tsx           # 根组件
│   └── main.tsx          # 入口文件
├── .prettierrc           # Prettier 配置
├── .prettierignore       # Prettier 忽略文件
├── eslint.config.js      # ESLint 配置
├── tsconfig.json         # TypeScript 配置
├── vite.config.ts        # Vite 配置
└── package.json          # 项目依赖
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

项目将在 http://localhost:3000 启动

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

### 代码检查

```bash
npm run lint
```

### 代码格式化

```bash
npm run format
```

## 开发指南

### 路径别名

项目配置了 `@` 作为 `src` 目录的别名，可以这样使用：

```typescript
import Component from '@/components/Component';
import { useUserStore } from '@/stores/userStore';
```

### 状态管理

使用 Zustand 进行状态管理，示例：

```typescript
import { useUserStore } from '@/stores/userStore';

const MyComponent = () => {
  const user = useUserStore(state => state.user);
  const setUser = useUserStore(state => state.setUser);

  // 使用 user 和 setUser
};
```

### API 请求

使用 Axios 和 TanStack Query 进行数据请求：

```typescript
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

const MyComponent = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  // 处理数据
};
```

### 样式编写

使用 SASS 编写样式，支持嵌套和变量：

```scss
.my-component {
  padding: 1rem;

  h1 {
    color: #333;
  }

  &:hover {
    background: #f0f0f0;
  }
}
```

## 环境变量

在项目根目录创建 `.env` 文件：

```
VITE_API_BASE_URL=http://localhost:8080/api
```

在代码中使用：

```typescript
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```

## 注意事项

- 所有环境变量必须以 `VITE_` 开头才能在客户端代码中访问
- 修改环境变量后需要重启开发服务器
- 生产构建前请确保所有 ESLint 错误已修复

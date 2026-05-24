# 技术文档

## 架构设计

### 整体架构

本项目采用现代化的前端架构，主要包括以下几个层次：

1. **视图层 (View Layer)**: React 组件
2. **状态层 (State Layer)**: Zustand 状态管理
3. **数据层 (Data Layer)**: TanStack Query + Axios
4. **路由层 (Router Layer)**: React Router

### 目录结构说明

#### `/src/components`

存放可复用的 UI 组件，这些组件应该是：

- 无状态或只包含 UI 状态
- 可在多个页面中复用
- 职责单一，易于测试

#### `/src/pages`

存放页面级组件，每个页面对应一个路由：

- 可以包含业务逻辑
- 可以调用 API
- 可以使用全局状态

#### `/src/hooks`

存放自定义 React Hooks：

- 封装可复用的逻辑
- 遵循 Hooks 命名规范（use 开头）

#### `/src/stores`

存放 Zustand 状态管理：

- 全局状态定义
- 状态操作方法
- 支持持久化

#### `/src/services`

存放 API 服务：

- Axios 实例配置
- API 请求封装
- 请求/响应拦截器

#### `/src/utils`

存放工具函数：

- 纯函数
- 不依赖组件或状态
- 可独立测试

#### `/src/types`

存放 TypeScript 类型定义：

- 接口定义
- 类型别名
- 枚举类型

## 技术选型说明

### Vite

**选择理由**:

- 极快的冷启动速度
- 即时的模块热更新 (HMR)
- 真正的按需编译
- 开箱即用的 TypeScript 支持

### React 18

**选择理由**:

- 成熟的生态系统
- 并发特性提升性能
- 自动批处理优化
- Suspense 支持

### TypeScript

**选择理由**:

- 静态类型检查
- 更好的 IDE 支持
- 减少运行时错误
- 提升代码可维护性

### SASS

**选择理由**:

- 支持嵌套规则
- 变量和混合宏
- 模块化导入
- 强大的函数库

### React Router v6

**选择理由**:

- 声明式路由配置
- 嵌套路由支持
- 代码分割友好
- TypeScript 支持良好

### Zustand

**选择理由**:

- 轻量级（约 1KB）
- API 简洁直观
- 无需 Provider 包裹
- 支持中间件（如持久化）
- TypeScript 支持优秀

**对比 Redux**:

- 更少的样板代码
- 更简单的学习曲线
- 更好的性能

### TanStack Query

**选择理由**:

- 自动缓存管理
- 后台数据同步
- 请求去重
- 分页和无限滚动支持
- 乐观更新

**核心概念**:

- Query: 获取数据
- Mutation: 修改数据
- Query Invalidation: 缓存失效

### Axios

**选择理由**:

- 浏览器和 Node.js 通用
- 支持请求/响应拦截
- 自动转换 JSON
- 请求取消支持
- 超时处理

### React Flow

**选择理由**:

- 强大的节点流程图库
- 高度可定制
- 内置交互功能（拖拽、缩放、连线）
- 活跃的社区支持

### Prettier + ESLint

**选择理由**:

- 统一代码风格
- 自动格式化
- 减少代码审查负担
- 提前发现潜在问题

## 最佳实践

### 组件设计

1. **单一职责原则**: 每个组件只做一件事
2. **Props 类型定义**: 使用 TypeScript 定义 Props 接口
3. **避免过度嵌套**: 组件层级不超过 5 层
4. **使用组合而非继承**: 通过组合小组件构建复杂 UI

### 状态管理

1. **局部状态优先**: 能用 useState 就不用全局状态
2. **合理拆分 Store**: 按功能模块拆分，避免单一巨大 Store
3. **避免冗余状态**: 能计算得出的就不要存储

### API 请求

1. **统一错误处理**: 在拦截器中处理通用错误
2. **使用 TanStack Query**: 利用其缓存和重试机制
3. **请求取消**: 组件卸载时取消未完成的请求
4. **乐观更新**: 提升用户体验

### 样式管理

1. **模块化**: 每个组件对应一个样式文件
2. **使用变量**: 定义全局颜色、字体等变量
3. **避免深层嵌套**: SASS 嵌套不超过 3 层
4. **命名规范**: 使用 BEM 或其他一致的命名方式

### 性能优化

1. **代码分割**: 使用 React.lazy 和 Suspense
2. **memo 优化**: 对昂贵的组件使用 React.memo
3. **虚拟列表**: 长列表使用虚拟滚动
4. **图片优化**: 使用适当的格式和尺寸

## 开发流程

### 添加新页面

1. 在 `/src/pages` 创建页面组件
2. 在 `/src/routes/index.tsx` 添加路由配置
3. 创建对应的样式文件
4. 如需 API，在 `/src/services` 添加接口

### 添加全局状态

1. 在 `/src/stores` 创建新的 Store
2. 定义状态接口和操作方法
3. 在组件中使用 Store

### 添加 API 接口

1. 在 `/src/services` 创建 API 模块
2. 使用统一的 api 实例
3. 配合 TanStack Query 使用

## 部署

### 构建优化

```bash
npm run build
```

构建产物在 `dist` 目录，可以部署到任何静态服务器。

### 环境配置

- 开发环境: `.env.development`
- 生产环境: `.env.production`

### 推荐部署平台

- Vercel
- Netlify
- GitHub Pages
- 阿里云 OSS
- 腾讯云 COS

## 常见问题

### 路径别名不生效

确保 `tsconfig.app.json` 和 `vite.config.ts` 都配置了路径别名。

### SASS 编译错误

检查 SASS 语法，确保安装了 `sass` 依赖。

### API 请求跨域

开发环境可在 `vite.config.ts` 配置代理：

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://backend-server.com',
      changeOrigin: true,
    },
  },
}
```

## 参考资料

- [Vite 官方文档](https://vitejs.dev/)
- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [React Router 文档](https://reactrouter.com/)
- [Zustand 文档](https://github.com/pmndrs/zustand)
- [TanStack Query 文档](https://tanstack.com/query/latest)
- [Axios 文档](https://axios-http.com/)

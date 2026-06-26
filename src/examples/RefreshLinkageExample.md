# RefreshLinkage Example

## 功能说明

本示例演示如何在异步数据加载完成后，使用 `refreshLinkage()` 方法重新触发表单联动。

## 使用场景

当联动函数依赖于异步加载的数据时（如员工列表、部门列表等），需要在数据加载完成后重新触发联动初始化。

## 示例覆盖的场景

### 1. 普通字段联动
- **字段**: Department → Employee
- **逻辑**: 选择部门后，员工列表会根据部门筛选
- **实现**: `getDepartmentOptions` 和 `getEmployeeOptions` 联动函数

### 2. 嵌套表单联动
- **字段**: Authentication Type → Authentication Configuration
- **逻辑**: 选择认证类型后，配置列表会根据类型筛选
- **实现**: `getAuthConfigOptions` 联动函数

### 3. 数组元素联动
- **字段**: Contact Role → Permissions
- **逻辑**: 在联系人列表中，选择角色后，权限列表会根据角色筛选
- **实现**: `getPermissionOptions` 联动函数，使用 JSON Pointer 路径 `#/role`

## 关键代码

### 数据加载和联动刷新

```tsx
useEffect(() => {
  async function loadData() {
    // 并行加载所有异步数据
    const [deptData, empData, authData, permData] = await Promise.all([
      fetchDepartments(),
      fetchEmployees(),
      fetchAuthConfigs(),
      fetchPermissions(),
    ]);

    setDepartments(deptData);
    setEmployees(empData);
    setAuthConfigs(authData);
    setPermissions(permData);

    // 数据加载完成后，重新触发联动
    await formRef.current?.refreshLinkage();
  }

  loadData();
}, []);
```

### 联动函数定义

```tsx
const linkageFunctions: Record<string, LinkageFunction> = {
  // 根据部门筛选员工
  getEmployeeOptions: formData => {
    const selectedDepartment = formData.department;
    if (!selectedDepartment || employees.length === 0) {
      return [];
    }
    return employees
      .filter(emp => emp.departmentId === selectedDepartment)
      .map(emp => ({
        label: `${emp.name} (${emp.email})`,
        value: emp.id,
      }));
  },

  // 根据角色筛选权限（数组元素联动）
  getPermissionOptions: (formData, context) => {
    const fieldPath = context?.fieldPath;
    if (!fieldPath) return [];

    // 解析数组索引
    const match = fieldPath.match(/contacts\.(\d+)\.permissions/);
    if (!match) return [];

    const index = parseInt(match[1], 10);
    const role = formData.contacts?.[index]?.role;

    if (!role || permissions.length === 0) return [];

    return permissions
      .filter(perm => perm.role === role)
      .map(perm => ({
        label: perm.name,
        value: perm.id,
      }));
  },
};
```

## 运行示例

1. 启动开发服务器：
```bash
npm run dev
```

2. 访问示例页面（根据路由配置）

3. 观察以下行为：
   - 页面加载时显示 "正在加载数据..."
   - 数据加载完成后，联动自动刷新
   - 选择部门后，员工列表动态更新
   - 选择认证类型后，配置列表动态更新
   - 在联系人列表中选择角色后，权限列表动态更新

4. 点击 "Refresh Data" 按钮可以手动重新加载数据并刷新联动

## 技术要点

### 1. 使用 `useRef` 获取表单实例

```tsx
const formRef = useRef<DynamicFormRef>(null);

<DynamicForm ref={formRef} ... />
```

### 2. 调用 `refreshLinkage` 方法

```tsx
await formRef.current?.refreshLinkage();
```

### 3. 联动配置放在 `ui.linkage` 中

```tsx
{
  type: 'string',
  title: 'Employee',
  ui: {
    widget: 'select',
    linkage: {
      type: 'options',
      dependencies: ['department'],
      fulfill: {
        function: 'getEmployeeOptions',
      },
    },
  },
}
```

### 4. 数组元素联动使用 JSON Pointer

```tsx
{
  linkage: {
    type: 'options',
    dependencies: ['#/role'],  // # 表示当前数组元素
    fulfill: {
      function: 'getPermissionOptions',
    },
  },
}
```

## 相关文档

- [refreshLinkage 使用指南](../../REFRESH_LINKAGE_USAGE.md)
- [联动机制设计文档](../../docs/UI_LINKAGE_DESIGN.md)
- [DynamicForm API 文档](../../src/components/DynamicForm/README.md)

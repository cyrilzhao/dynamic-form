import React, { useRef, useState, useEffect } from 'react';
import { DynamicForm } from '../../components/DynamicForm';
import type { DynamicFormRef } from '../../components/DynamicForm';
import type { ExtendedJSONSchema } from '../../components/DynamicForm/types/schema';
import type { LinkageFunction } from '../../components/DynamicForm/types/linkage';
import { Button, Card, Spinner, Callout } from '@blueprintjs/core';

/**
 * RefreshLinkage 示例
 *
 * 演示如何在异步数据加载完成后，使用 refreshLinkage 重新触发表单联动
 *
 * 场景覆盖：
 * 1. 普通字段联动 - 根据部门选择动态加载员工列表
 * 2. 嵌套表单联动 - 根据认证类型动态加载配置选项
 * 3. 数组元素联动 - 联系人列表中根据角色动态加载权限选项
 */

// ========== 模拟 API 数据类型 ==========

interface Department {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
  departmentId: string;
  email: string;
}

interface AuthConfig {
  id: string;
  name: string;
  authType: string;
}

interface Permission {
  id: string;
  name: string;
  role: string;
}

// ========== 模拟 API 函数 ==========

/**
 * 模拟异步加载部门列表
 */
const fetchDepartments = (): Promise<Department[]> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        { id: 'dept-1', name: 'Engineering' },
        { id: 'dept-2', name: 'Sales' },
        { id: 'dept-3', name: 'HR' },
        { id: 'dept-4', name: 'Marketing' },
      ]);
    }, 800);
  });
};

/**
 * 模拟异步加载员工列表
 */
const fetchEmployees = (): Promise<Employee[]> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        { id: 'emp-1', name: 'Alice Johnson', departmentId: 'dept-1', email: 'alice@example.com' },
        { id: 'emp-2', name: 'Bob Smith', departmentId: 'dept-1', email: 'bob@example.com' },
        { id: 'emp-3', name: 'Carol White', departmentId: 'dept-2', email: 'carol@example.com' },
        { id: 'emp-4', name: 'David Brown', departmentId: 'dept-2', email: 'david@example.com' },
        { id: 'emp-5', name: 'Eve Davis', departmentId: 'dept-3', email: 'eve@example.com' },
        { id: 'emp-6', name: 'Frank Miller', departmentId: 'dept-3', email: 'frank@example.com' },
        { id: 'emp-7', name: 'Grace Wilson', departmentId: 'dept-4', email: 'grace@example.com' },
        { id: 'emp-8', name: 'Henry Moore', departmentId: 'dept-4', email: 'henry@example.com' },
      ]);
    }, 1000);
  });
};

/**
 * 模拟异步加载认证配置列表
 */
const fetchAuthConfigs = (): Promise<AuthConfig[]> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        { id: 'oauth-google', name: 'Google OAuth', authType: 'oauth' },
        { id: 'oauth-github', name: 'GitHub OAuth', authType: 'oauth' },
        { id: 'saml-okta', name: 'Okta SAML', authType: 'saml' },
        { id: 'saml-azure', name: 'Azure AD SAML', authType: 'saml' },
        { id: 'api-key-1', name: 'Standard API Key', authType: 'api_key' },
        { id: 'api-key-2', name: 'Admin API Key', authType: 'api_key' },
      ]);
    }, 1200);
  });
};

/**
 * 模拟异步加载权限列表
 */
const fetchPermissions = (): Promise<Permission[]> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        { id: 'perm-1', name: 'Read Documents', role: 'viewer' },
        { id: 'perm-2', name: 'View Reports', role: 'viewer' },
        { id: 'perm-3', name: 'Edit Documents', role: 'editor' },
        { id: 'perm-4', name: 'Create Documents', role: 'editor' },
        { id: 'perm-5', name: 'Delete Documents', role: 'editor' },
        { id: 'perm-6', name: 'Manage Users', role: 'admin' },
        { id: 'perm-7', name: 'Manage Settings', role: 'admin' },
        { id: 'perm-8', name: 'View Audit Logs', role: 'admin' },
      ]);
    }, 900);
  });
};

// ========== 主组件 ==========

export const RefreshLinkageExample: React.FC = () => {
  const formRef = useRef<DynamicFormRef>(null);

  // 数据加载状态
  const [loading, setLoading] = useState(true);
  const [dataLoadedAt, setDataLoadedAt] = useState<Date | null>(null);
  const [shouldRefreshLinkage, setShouldRefreshLinkage] = useState(false);

  // 异步数据
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [authConfigs, setAuthConfigs] = useState<AuthConfig[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  // 表单数据
  const [formData, setFormData] = useState<Record<string, any>>({});

  // 加载所有异步数据
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 并行加载所有数据
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
        setDataLoadedAt(new Date());

        // 设置标志，触发联动刷新
        setShouldRefreshLinkage(true);
      } catch (error) {
        console.error('[RefreshLinkageExample] 数据加载失败:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // 在数据状态更新完成后触发联动刷新
  useEffect(() => {
    console.log('[RefreshLinkageExample] useEffect 触发:', {
      shouldRefreshLinkage,
      departmentsLength: departments.length,
      employeesLength: employees.length,
      authConfigsLength: authConfigs.length,
      permissionsLength: permissions.length,
    });

    if (
      shouldRefreshLinkage &&
      departments.length > 0 &&
      employees.length > 0 &&
      authConfigs.length > 0 &&
      permissions.length > 0
    ) {
      console.log('[RefreshLinkageExample] 准备调用 refreshLinkage');
      formRef.current?.refreshLinkage();
      setShouldRefreshLinkage(false);
      console.log('[RefreshLinkageExample] 数据加载完成，联动已刷新');
    }
  }, [shouldRefreshLinkage, departments, employees, authConfigs, permissions]);

  // 手动刷新数据
  const handleRefreshData = async () => {
    setLoading(true);
    try {
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
      setDataLoadedAt(new Date());

      // 设置标志，触发联动刷新
      setShouldRefreshLinkage(true);
    } catch (error) {
      console.error('[RefreshLinkageExample] 数据刷新失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // Schema 定义
  const schema: ExtendedJSONSchema = {
    type: 'object',
    title: 'Employee Management Form',
    properties: {
      // ========== 场景 1: 普通字段联动 ==========
      department: {
        type: 'string',
        title: 'Department',
        ui: {
          widget: 'select',
          placeholder: 'Select a department',
          linkages: [{
            type: 'options' as const,
            dependencies: [],
            fulfill: {
              function: 'getDepartmentOptions',
            },
          }],
        },
      },
      employee: {
        type: 'string',
        title: 'Employee',
        ui: {
          widget: 'select',
          placeholder: 'Select an employee',
          help: 'Employee list is filtered by selected department',
          linkages: [{
            type: 'options' as const,
            dependencies: ['department'],
            fulfill: {
              function: 'getEmployeeOptions',
            },
          }],
        },
      },

      // ========== 场景 2: 嵌套表单联动 ==========
      authentication: {
        type: 'object',
        title: 'Authentication Settings',
        ui: {
          widget: 'nested-form',
        },
        properties: {
          authType: {
            type: 'string',
            title: 'Authentication Type',
            enum: ['oauth', 'saml', 'api_key'],
            enumNames: ['OAuth 2.0', 'SAML', 'API Key'],
            ui: {
              widget: 'select',
            },
          },
          authConfig: {
            type: 'string',
            title: 'Authentication Configuration',
            ui: {
              widget: 'select',
              placeholder: 'Select a configuration',
              help: 'Configuration list is filtered by authentication type',
              linkages: [{
                type: 'options' as const,
                dependencies: ['authentication.authType'],
                fulfill: {
                  function: 'getAuthConfigOptions',
                },
              }],
            },
          },
        },
      },

      // ========== 场景 3: 数组元素联动 ==========
      contacts: {
        type: 'array',
        title: 'Contact List',
        ui: {
          widget: 'array',
        },
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              title: 'Name',
              ui: {
                placeholder: 'Enter contact name',
              },
            },
            role: {
              type: 'string',
              title: 'Role',
              enum: ['viewer', 'editor', 'admin'],
              enumNames: ['Viewer', 'Editor', 'Administrator'],
              ui: {
                widget: 'select',
              },
            },
            permissions: {
              type: 'array',
              title: 'Permissions',
              ui: {
                widget: 'select',
                help: 'Permission list is filtered by role',
                linkages: [{
                  type: 'options' as const,
                  dependencies: ['#/role'],
                  fulfill: {
                    function: 'getPermissionOptions',
                  },
                }],
              },
              items: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  };

  // 联动函数定义
  const linkageFunctions: Record<string, LinkageFunction> = {
    /**
     * 场景 1: 获取部门选项
     */
    getDepartmentOptions: () => {
      console.log('[getDepartmentOptions] 被调用, departments.length:', departments.length);
      if (departments.length === 0) {
        console.log('[getDepartmentOptions] 返回空数组');
        return [];
      }
      const options = departments.map(dept => ({
        label: dept.name,
        value: dept.id,
      }));
      console.log('[getDepartmentOptions] 返回选项:', options);
      return options;
    },

    /**
     * 场景 1: 根据部门获取员工选项
     */
    getEmployeeOptions: formData => {
      const selectedDepartment = formData.department;
      console.log('[getEmployeeOptions] 被调用:', {
        selectedDepartment,
        employeesLength: employees.length,
      });

      if (!selectedDepartment || employees.length === 0) {
        console.log('[getEmployeeOptions] 返回空数组');
        return [];
      }

      // 根据部门筛选员工
      const options = employees
        .filter(emp => emp.departmentId === selectedDepartment)
        .map(emp => ({
          label: `${emp.name} (${emp.email})`,
          value: emp.id,
        }));
      console.log('[getEmployeeOptions] 返回选项:', options);
      return options;
    },

    /**
     * 场景 2: 根据认证类型获取配置选项
     */
    getAuthConfigOptions: formData => {
      const authType = formData.authentication?.authType;
      console.log('[getAuthConfigOptions] 被调用:', {
        authType,
        authConfigsLength: authConfigs.length,
      });

      if (!authType || authConfigs.length === 0) {
        console.log('[getAuthConfigOptions] 返回空数组');
        return [];
      }

      // 根据认证类型筛选配置
      const options = authConfigs
        .filter(config => config.authType === authType)
        .map(config => ({
          label: config.name,
          value: config.id,
        }));
      console.log('[getAuthConfigOptions] 返回选项:', options);
      return options;
    },

    /**
     * 场景 3: 根据角色获取权限选项
     */
    getPermissionOptions: (formData, context) => {
      // 从 context 中获取当前数组元素的路径
      const fieldPath = context?.fieldPath;
      console.log('[getPermissionOptions] 被调用:', {
        fieldPath,
        permissionsLength: permissions.length,
      });

      if (!fieldPath) {
        console.log('[getPermissionOptions] fieldPath 为空，返回空数组');
        return [];
      }

      // 解析出当前数组元素的索引
      // 例如: 'contacts.0.permissions' -> 获取 contacts[0].role
      const match = fieldPath.match(/contacts\.(\d+)\.permissions/);
      if (!match) {
        console.log('[getPermissionOptions] 无法匹配路径，返回空数组');
        return [];
      }

      const index = parseInt(match[1], 10);
      const role = formData.contacts?.[index]?.role;
      console.log('[getPermissionOptions] 解析结果:', { index, role });

      if (!role || permissions.length === 0) {
        console.log('[getPermissionOptions] role 为空或 permissions 为空，返回空数组');
        return [];
      }

      // 根据角色筛选权限
      const options = permissions
        .filter(perm => perm.role === role)
        .map(perm => ({
          label: perm.name,
          value: perm.id,
        }));
      console.log('[getPermissionOptions] 返回选项:', options);
      return options;
    },
  };

  // 表单提交处理
  const handleSubmit = (data: Record<string, any>) => {
    console.log('[RefreshLinkageExample] Form submitted:', data);
    alert('Form submitted! Check console for details.');
  };

  // 表单变化处理
  const handleChange = (data: Record<string, any>) => {
    setFormData(data);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>RefreshLinkage Example</h1>

      <Callout intent="primary" style={{ marginBottom: '20px' }}>
        <h4>功能说明</h4>
        <p>
          本示例演示如何在异步数据加载完成后，使用 <code>refreshLinkage()</code> 重新触发表单联动。
        </p>
        <ul style={{ marginBottom: 0 }}>
          <li>
            <strong>场景 1 - 普通字段联动：</strong>选择部门后，员工列表会根据部门筛选
          </li>
          <li>
            <strong>场景 2 - 嵌套表单联动：</strong>选择认证类型后，配置列表会根据类型筛选
          </li>
          <li>
            <strong>场景 3 - 数组元素联动：</strong>
            在联系人列表中，选择角色后，权限列表会根据角色筛选
          </li>
        </ul>
      </Callout>

      {/* 数据加载状态 */}
      <Card style={{ marginBottom: '20px' }}>
        <h3>数据加载状态</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          {loading ? (
            <>
              <Spinner size={20} />
              <span>正在加载数据...</span>
            </>
          ) : (
            <>
              <span style={{ color: 'green' }}>✓</span>
              <span>数据已加载 {dataLoadedAt && `(${dataLoadedAt.toLocaleTimeString()})`}</span>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div>
            <strong>Departments:</strong> {departments.length} loaded
          </div>
          <div>
            <strong>Employees:</strong> {employees.length} loaded
          </div>
          <div>
            <strong>Auth Configs:</strong> {authConfigs.length} loaded
          </div>
          <div>
            <strong>Permissions:</strong> {permissions.length} loaded
          </div>
        </div>

        <Button
          icon="refresh"
          text="Refresh Data"
          onClick={handleRefreshData}
          disabled={loading}
          style={{ marginTop: '10px' }}
        />
      </Card>

      {/* 表单 */}
      <Card>
        <DynamicForm
          ref={formRef}
          schema={schema}
          linkageFunctions={linkageFunctions}
          onSubmit={handleSubmit}
          onChange={handleChange}
          defaultValues={{
            contacts: [{ name: '', role: 'viewer', permissions: [] }],
          }}
        />
      </Card>

      {/* 当前表单数据 */}
      <Card style={{ marginTop: '20px' }}>
        <h3>Current Form Data</h3>
        <pre
          style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', overflow: 'auto' }}
        >
          {JSON.stringify(formData, null, 2)}
        </pre>
      </Card>
    </div>
  );
};

export default RefreshLinkageExample;

import React from "react";
import { render, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DynamicForm } from "../DynamicForm";
import { FieldRegistry, blueprintPreset } from "..";
import type { ExtendedJSONSchema } from "../types/schema";
import type { DynamicFormRef } from "../types";

beforeAll(() => {
  FieldRegistry.setDefaultPreset(blueprintPreset);
});

describe("跨数组联动测试", () => {
  it("权限数组中有管理员权限时，功能数组中的启用字段应该为true", async () => {
    const formRef = React.createRef<DynamicFormRef>();

    // 场景：当权限列表中存在管理员权限时，功能列表中的所有功能都自动启用
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        permissions: {
          type: "array",
          title: "Permissions",
          items: {
            type: "object",
            properties: {
              name: { type: "string", title: "Name" },
              isAdmin: { type: "boolean", title: "Is Admin", default: false },
            },
          },
        },
        features: {
          type: "array",
          title: "Features",
          items: {
            type: "object",
            properties: {
              name: { type: "string", title: "Name" },
              enabled: {
                type: "boolean",
                title: "Enabled",
                ui: {
                  linkages: [
                    {
                      type: "value",
                      dependencies: ["#/properties/permissions"],
                      fulfill: { function: "checkAdminPermission" },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };

    const linkageFunctions = {
      checkAdminPermission: (formData: any) => {
        const permissions = formData.permissions || [];
        return permissions.some((p: any) => p.isAdmin === true);
      },
    };

    render(
      <DynamicForm
        ref={formRef}
        schema={schema}
        linkageFunctions={linkageFunctions}
        onSubmit={jest.fn()}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    // 初始化：普通权限 + 功能
    await act(async () => {
      formRef.current?.setValue("permissions", [
        { name: "View", isAdmin: false },
      ]);
      formRef.current?.setValue("features", [
        { name: "Export", enabled: false },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    // 验证：功能未启用
    await waitFor(() => {
      const values = formRef.current?.getValues();
      expect(values?.features?.[0]?.enabled).toBe(false);
    });

    // 添加管理员权限
    await act(async () => {
      formRef.current?.setValue("permissions", [
        { name: "View", isAdmin: false },
        { name: "Admin", isAdmin: true },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    // 验证：功能自动启用
    await waitFor(() => {
      const values = formRef.current?.getValues();
      expect(values?.features?.[0]?.enabled).toBe(true);
    });
  });

  it("移除管理员权限后，功能应该恢复为未启用", async () => {
    const formRef = React.createRef<DynamicFormRef>();

    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        permissions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              isAdmin: { type: "boolean", default: false },
            },
          },
        },
        features: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              enabled: {
                type: "boolean",
                ui: {
                  linkages: [
                    {
                      type: "value",
                      dependencies: ["#/properties/permissions"],
                      fulfill: { function: "checkAdminPermission" },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };

    const linkageFunctions = {
      checkAdminPermission: (formData: any) => {
        const permissions = formData.permissions || [];
        return permissions.some((p: any) => p.isAdmin === true);
      },
    };

    render(
      <DynamicForm
        ref={formRef}
        schema={schema}
        linkageFunctions={linkageFunctions}
        onSubmit={jest.fn()}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    // 初始化：有管理员权限
    await act(async () => {
      formRef.current?.setValue("permissions", [
        { name: "Admin", isAdmin: true },
      ]);
      formRef.current?.setValue("features", [{ name: "Export" }]);
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    // 验证：功能启用
    await waitFor(() => {
      const values = formRef.current?.getValues();
      expect(values?.features?.[0]?.enabled).toBe(true);
    });

    // 移除管理员权限
    await act(async () => {
      formRef.current?.setValue("permissions", [
        { name: "View", isAdmin: false },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    // 验证：功能恢复为未启用
    await waitFor(() => {
      const values = formRef.current?.getValues();
      expect(values?.features?.[0]?.enabled).toBe(false);
    });
  });
});

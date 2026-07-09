import React, { forwardRef, useEffect, useRef } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DynamicForm } from "../DynamicForm";
import { FieldRegistry, blueprintPreset } from "..";
import type { DynamicFormRef, FieldWidgetProps } from "../types";
import type { ExtendedJSONSchema } from "../types/schema";

beforeAll(() => {
  FieldRegistry.setDefaultPreset(blueprintPreset);
});

describe("独立嵌套 DynamicForm 联动", () => {
  it("非 asNestedForm 的内层 DynamicForm 应该隔离父级表单，只由自己的 form 触发联动", async () => {
    const outerRef = React.createRef<DynamicFormRef>();

    const innerSchema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        position: {
          type: "string",
          title: "Position",
        },
        salaryRange: {
          type: "string",
          title: "Salary Range",
          ui: {
            linkages: [
              {
                type: "visibility",
                dependencies: ["position"],
                when: {
                  field: "position",
                  operator: "==",
                  value: "Manager",
                },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
            ],
          },
        },
      },
    };

    const InnerWidget = forwardRef<HTMLDivElement, FieldWidgetProps>(
      ({ value, onChange }, ref) => {
        const innerRef = useRef<DynamicFormRef>(null);

        useEffect(() => {
          void innerRef.current?.refreshLinkage();
        }, []);

        return (
          <div ref={ref}>
            <button
              type="button"
              onClick={() => innerRef.current?.setValue("position", "Manager")}
            >
              Set Manager
            </button>
            <DynamicForm
              ref={innerRef}
              schema={innerSchema}
              defaultValues={value || {}}
              onChange={onChange}
              renderAsForm={false}
              showSubmitButton={false}
            />
          </div>
        );
      },
    );
    InnerWidget.displayName = "InnerWidget";

    const outerSchema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        position: {
          type: "string",
          title: "Outer Position",
        },
        employeeInfo: {
          type: "object",
          title: "Employee Info",
          ui: { widget: "inner" },
        },
      },
    };

    render(
      <DynamicForm
        ref={outerRef}
        schema={outerSchema}
        widgets={{ inner: InnerWidget }}
        renderAsForm={false}
        showSubmitButton={false}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText("Salary Range")).not.toBeInTheDocument();
    });

    // 为什么先改外层同名字段：
    // 这个用例复现了本次 bug 的反面约束。内层独立 DynamicForm 虽然渲染在外层
    // LinkageStateProvider 之下，但它没有设置 asNestedForm，所以它的联动不能监听父表单。
    // 如果这里显示了 Salary Range，说明内层仍然错误继承了父级 linkage form。
    await act(async () => {
      outerRef.current?.setValue("position", "Manager");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByText("Salary Range")).not.toBeInTheDocument();

    // 为什么再改内层字段：
    // 独立不是禁用联动，而是使用内层自己的 useForm 实例。只有内层 position
    // 变化时，salaryRange 才应该根据内层 schema 的 visibility 规则显示。
    await act(async () => {
      screen.getByText("Set Manager").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(screen.getByText("Salary Range")).toBeInTheDocument();
    });
  });

  it("asNestedForm 的内层 DynamicForm 应该继续继承父级 form 和联动状态", async () => {
    const formRef = React.createRef<DynamicFormRef>();

    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        employeeInfo: {
          type: "object",
          title: "Employee Info",
          properties: {
            position: {
              type: "string",
              title: "Nested Position",
            },
            salaryRange: {
              type: "string",
              title: "Nested Salary Range",
              ui: {
                linkages: [
                  {
                    type: "visibility",
                    dependencies: [
                      "#/properties/employeeInfo/properties/position",
                    ],
                    when: {
                      field: "#/properties/employeeInfo/properties/position",
                      operator: "==",
                      value: "Manager",
                    },
                    fulfill: { state: { visible: true } },
                    otherwise: { state: { visible: false } },
                  },
                ],
              },
            },
          },
        },
      },
    };

    render(
      <DynamicForm
        ref={formRef}
        schema={schema}
        renderAsForm={false}
        showSubmitButton={false}
      />,
    );

    await act(async () => {
      await formRef.current?.refreshLinkage();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(screen.queryByText("Nested Salary Range")).not.toBeInTheDocument();
    });

    // 为什么保留这个测试：
    // 本次业务修复只应该影响默认独立 DynamicForm；NestedFormWidget 内部会显式设置
    // asNestedForm=true，它必须继续复用父级 form，否则嵌套对象字段不会注册到同一个数据树，
    // 也会破坏已有嵌套表单联动能力。
    await act(async () => {
      formRef.current?.setValue("employeeInfo.position", "Manager");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(screen.getByText("Nested Salary Range")).toBeInTheDocument();
    });
  });
});

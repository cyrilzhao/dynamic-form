import "@testing-library/jest-dom";
import React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { LinkageFunction } from "../types/linkage";
import type { ExtendedJSONSchema } from "../types/schema";
import {
  getInputByName,
  refreshLinkage,
  renderDynamicForm,
  setFieldValue,
  setupDynamicFormTest,
  waitForFormReady,
} from "../__testUtils__/linkageTestHelpers";

beforeAll(setupDynamicFormTest);

describe("DynamicForm", () => {
  it("应该初始化 object default 中的嵌套对象和数组，并补齐缺失子字段默认值", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        review: {
          type: "object",
          title: "Review",
          default: {
            metadata: { documentType: "invoice" },
            sections: [{ title: "Summary", tags: ["AI"] }],
          },
          properties: {
            metadata: {
              type: "object",
              properties: {
                documentType: { type: "string" },
                source: { type: "string", default: "AI" },
              },
            },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                  },
                  confidence: { type: "number", default: 0 },
                },
              },
            },
          },
        },
      },
    };

    const { formRef } = renderDynamicForm({ props: { schema } });
    await waitForFormReady({ formRef });

    expect(formRef.current!.getValues()).toEqual({
      review: {
        metadata: { documentType: "invoice", source: "AI" },
        sections: [{ title: "Summary", tags: ["AI"], confidence: undefined }],
      },
    });
  });

  it("应该通过数组字段的 widgetProps 控制新增、删除和排序操作", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          title: "Tags",
          items: { type: "string" },
          ui: {
            widgetProps: {
              canAdd: false,
              canRemove: false,
              canReorder: false,
            },
          },
        },
      },
    };

    const { formRef } = renderDynamicForm({
      props: { schema, defaultValues: { tags: ["alpha", "beta"] } },
    });
    await waitForFormReady({ formRef });

    expect(screen.queryByRole("button", { name: /add/i })).toBeNull();
    expect(screen.queryByTitle("Delete")).toBeNull();
    expect(screen.queryByTitle("Move up")).toBeNull();
    expect(screen.queryByTitle("Move down")).toBeNull();
  });

  it("应该支持 callbackProps 使用内联 script 定义 widget 函数 prop", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        formatter: {
          type: "string",
          title: "Formatter",
          ui: {
            widget: "script-callback-widget",
            callbackProps: {
              onFormat: {
                type: "script",
                code: `function({ args }) {
                  const [value, meta] = args;
                  return value + "-" + meta.source;
                }`,
              },
            },
          },
        },
      },
    };

    const ScriptCallbackWidget = React.forwardRef<
      HTMLDivElement,
      {
        onFormat?: (value: string, meta: { source: string }) => string;
      }
    >(({ onFormat }, ref) => {
      const [result, setResult] = React.useState("");

      return (
        <div ref={ref}>
          <button
            type="button"
            onClick={() =>
              setResult(onFormat?.("alice", { source: "schema" }) ?? "")
            }
          >
            Run formatter
          </button>
          <span data-testid="format-result">{result}</span>
        </div>
      );
    });

    renderDynamicForm({
      props: {
        schema,
        widgets: {
          "script-callback-widget": ScriptCallbackWidget,
        },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Run formatter" }));

    expect(screen.getByTestId("format-result")).toHaveTextContent(
      "alice-schema",
    );
  });

  it("应该合并 schema default 和 defaultValues，并在 getValues 时解包基本类型数组赋值", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        username: {
          type: "string",
          title: "Username",
          default: "schema-user",
        },
        tags: {
          type: "array",
          title: "Tags",
          default: ["alpha", "beta"],
          items: {
            type: "string",
            enum: ["alpha", "beta", "gamma"],
          },
          ui: {
            arrayMode: "static",
          },
        },
      },
    };

    const { formRef } = renderDynamicForm({
      props: {
        schema,
        defaultValues: {
          username: "custom-user",
        },
      },
    });

    await waitForFormReady({ formRef });

    expect(formRef.current!.getValue("username")).toBe("custom-user");

    await act(async () => {
      formRef.current!.setValues({
        tags: ["gamma"],
      });
    });

    expect(formRef.current!.getValues()).toEqual({
      username: "custom-user",
      tags: ["gamma"],
    });
  });

  it("setValues 应该递归更新嵌套对象字段的 Controller", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        address: {
          type: "object",
          title: "Address",
          properties: {
            street: {
              type: "string",
              title: "Street",
            },
            city: {
              type: "string",
              title: "City",
            },
          },
        },
      },
    };

    const { formRef, container } = renderDynamicForm({ props: { schema } });
    await waitForFormReady({ formRef });

    await act(async () => {
      formRef.current!.setValues({
        address: {
          street: "Main Street",
          city: "Paris",
        },
      });
    });

    expect(getInputByName({ container, name: "address.street" })).toHaveValue(
      "Main Street",
    );
    expect(getInputByName({ container, name: "address.city" })).toHaveValue(
      "Paris",
    );
  });

  it("setValues 应该保留对象数组内多选 Select 的基本类型数组值", async () => {
    interface PermissionOptionsFormData {
      users: Array<{ value: string }>;
      actions: Array<{ code: string; label: string }>;
    }

    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        users: {
          type: "array",
          title: "Users",
          items: { type: "string" },
        },
        actions: {
          type: "array",
          title: "Actions",
          items: {
            type: "object",
            properties: {
              code: { type: "string", title: "Code" },
              label: { type: "string", title: "Label" },
            },
          },
        },
        permissions: {
          type: "array",
          title: "Permissions",
          items: {
            type: "object",
            properties: {
              users: {
                type: "array",
                title: "Users",
                items: { type: "string" },
                ui: {
                  widget: "select",
                  widgetProps: { multiple: true },
                  linkages: [
                    {
                      type: "options",
                      dependencies: [],
                      fulfill: { function: "getUserOptions" },
                    },
                  ],
                },
              },
              actions: {
                type: "array",
                title: "Actions",
                items: { type: "string" },
                ui: {
                  widget: "select",
                  widgetProps: { multiple: true },
                  linkages: [
                    {
                      type: "options",
                      dependencies: [],
                      fulfill: { function: "getActionOptions" },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };
    const getUserOptions: LinkageFunction = ({ formData }) =>
      (formData as PermissionOptionsFormData).users.map((user) => ({
        label: user.value,
        value: user.value,
      }));
    const getActionOptions: LinkageFunction = ({ formData }) =>
      (formData as PermissionOptionsFormData).actions.map((action) => ({
        label: action.label,
        value: action.code,
      }));
    const linkageFunctions = {
      getUserOptions,
      getActionOptions,
    };
    const { formRef } = renderDynamicForm({
      props: { schema, linkageFunctions },
    });
    await waitForFormReady({ formRef });

    await act(async () => {
      formRef.current!.setValues({
        users: ["Alan Zhao", "Leo Huang", "Carmen Zhu"],
        actions: [
          { code: "approve", label: "Approve" },
          { code: "reject", label: "Reject" },
        ],
        permissions: [
          {
            users: ["Alan Zhao", "Leo Huang"],
            actions: ["approve", "reject"],
          },
          {
            users: ["Carmen Zhu"],
            actions: ["approve"],
          },
        ],
      });
    });
    await refreshLinkage({ formRef });

    await waitFor(() => {
      expect(formRef.current!.getValues().permissions).toEqual([
        {
          users: ["Alan Zhao", "Leo Huang"],
          actions: ["approve", "reject"],
        },
        {
          users: ["Carmen Zhu"],
          actions: ["approve"],
        },
      ]);
    });
  });

  it("reset 空值时应该按 schema 类型清空字段", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        title: {
          type: "string",
          title: "Title",
        },
        enabled: {
          type: "boolean",
          title: "Enabled",
        },
        address: {
          type: "object",
          title: "Address",
          properties: {
            street: {
              type: "string",
              title: "Street",
            },
          },
        },
      },
    };

    const { formRef, container } = renderDynamicForm({ props: { schema } });
    await waitForFormReady({ formRef });

    await act(async () => {
      formRef.current!.setValues({
        title: "Draft",
        enabled: true,
        address: { street: "Main Street" },
      });
      formRef.current!.reset();
    });

    expect(getInputByName({ container, name: "title" })).toHaveValue("");
    expect(getInputByName({ container, name: "enabled" })).not.toBeChecked();
    expect(getInputByName({ container, name: "address.street" })).toHaveValue(
      "",
    );
  });

  it("ref API 应该对 setValue/getValue/getValues 应用字段 transform", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        rate: {
          type: "number",
          title: "Rate",
          ui: {
            transform: {
              callback: "toStorageRate",
              reverseCallback: "toDisplayRate",
            },
          },
        },
      },
    };

    const callbacks = {
      toStorageRate: ({ value }: { value: number }) => value / 100,
      toDisplayRate: ({ value }: { value: number }) => value * 100,
    };

    const { formRef, container } = renderDynamicForm({
      props: { schema, callbacks },
    });
    await waitForFormReady({ formRef });

    await setFieldValue({ formRef, name: "rate", value: 0.45 });

    await waitFor(() => {
      expect(getInputByName({ container, name: "rate" })).toHaveValue("45");
    });
    expect(container).toHaveTextContent("Converted value: 0.45");
    expect(formRef.current!.getValue("rate")).toBe(0.45);
    expect(formRef.current!.getValues()).toEqual({ rate: 0.45 });
  });

  it("transform 配置 hideConvertedValue 为 true 时应该隐藏转换预览但保留转换逻辑", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        rate: {
          type: "number",
          title: "Rate",
          ui: {
            transform: {
              callback: "toStorageRate",
              reverseCallback: "toDisplayRate",
              hideConvertedValue: true,
            },
          },
        },
      },
    };

    const callbacks = {
      toStorageRate: ({ value }: { value: number }) => value / 100,
      toDisplayRate: ({ value }: { value: number }) => value * 100,
    };

    const { formRef, container } = renderDynamicForm({
      props: { schema, callbacks },
    });
    await waitForFormReady({ formRef });

    await setFieldValue({ formRef, name: "rate", value: 0.45 });

    await waitFor(() => {
      expect(getInputByName({ container, name: "rate" })).toHaveValue("45");
    });
    expect(container).not.toHaveTextContent("Converted value:");
    expect(formRef.current!.getValue("rate")).toBe(0.45);
    expect(formRef.current!.getValues()).toEqual({ rate: 0.45 });
  });

  it("object 字段配置整体 transform 时不应该继续递归转换子字段", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        address: {
          type: "object",
          title: "Address",
          properties: {
            street: {
              type: "string",
              title: "Street",
            },
            ratio: {
              type: "number",
              title: "Ratio",
              ui: {
                transform: {
                  callback: "childToStorage",
                  reverseCallback: "childToDisplay",
                },
              },
            },
          },
          ui: {
            transform: {
              callback: "addressToStorage",
              reverseCallback: "addressToDisplay",
            },
          },
        },
      },
    };

    const callbacks = {
      addressToStorage: ({
        value,
      }: {
        value: { street: string; ratio: number };
      }) => ({
        street: value.street,
        ratio: value.ratio / 10,
      }),
      addressToDisplay: ({
        value,
      }: {
        value: { street: string; ratio: number };
      }) => ({
        street: value.street,
        ratio: value.ratio * 10,
      }),
      childToStorage: ({ value }: { value: number }) => value / 100,
      childToDisplay: ({ value }: { value: number }) => value * 100,
    };

    const { formRef, container } = renderDynamicForm({
      props: { schema, callbacks },
    });
    await waitForFormReady({ formRef });

    await act(async () => {
      formRef.current!.setValues({
        address: {
          street: "Main Street",
          ratio: 2,
        },
      });
    });

    expect(getInputByName({ container, name: "address.ratio" })).toHaveValue(
      "20",
    );
    expect(formRef.current!.getValues()).toEqual({
      address: {
        street: "Main Street",
        ratio: 2,
      },
    });
  });

  it("array 字段配置整体 transform 时不应该继续递归转换元素字段", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        lines: {
          type: "array",
          title: "Lines",
          items: {
            type: "object",
            title: "Line",
            properties: {
              amount: {
                type: "number",
                title: "Amount",
                ui: {
                  transform: {
                    callback: "childToStorage",
                    reverseCallback: "childToDisplay",
                  },
                },
              },
            },
          },
          ui: {
            transform: {
              callback: "linesToStorage",
              reverseCallback: "linesToDisplay",
            },
          },
        },
      },
    };

    const callbacks = {
      linesToStorage: ({ value }: { value: Array<{ amount: number }> }) =>
        value.map((item) => ({ amount: item.amount / 10 })),
      linesToDisplay: ({ value }: { value: Array<{ amount: number }> }) =>
        value.map((item) => ({ amount: item.amount * 10 })),
      childToStorage: ({ value }: { value: number }) => value / 100,
      childToDisplay: ({ value }: { value: number }) => value * 100,
    };

    const { formRef, container } = renderDynamicForm({
      props: { schema, callbacks },
    });
    await waitForFormReady({ formRef });

    await act(async () => {
      formRef.current!.setValues({
        lines: [{ amount: 3 }],
      });
    });

    expect(getInputByName({ container, name: "lines.0.amount" })).toHaveValue(
      "30",
    );
    expect(formRef.current!.getValues()).toEqual({
      lines: [{ amount: 3 }],
    });
  });

  it("onChange 和 onSubmit 应该返回转换并按 schema 过滤后的数据", async () => {
    const handleChange = jest.fn();
    const handleSubmit = jest.fn();
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        percent: {
          type: "number",
          title: "Percent",
          ui: {
            transform: {
              callback: "toRatio",
              reverseCallback: "toPercent",
            },
          },
        },
        note: {
          type: "string",
          title: "Note",
        },
      },
    };

    const callbacks = {
      toRatio: ({ value }: { value: number }) => value / 100,
      toPercent: ({ value }: { value: number }) => value * 100,
    };

    const { formRef, container } = renderDynamicForm({
      props: {
        schema,
        callbacks,
        onChange: handleChange,
        onSubmit: handleSubmit,
      },
    });
    await waitForFormReady({ formRef });

    await act(async () => {
      formRef.current!.setValues({
        percent: 0.2,
        note: "Ready",
        extra: "should be filtered",
      });
    });

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          percent: 0.2,
          note: "Ready",
        }),
      );
    });

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        percent: 0.2,
        note: "Ready",
      });
    });
  });

  it("应该支持 validate、getErrors、setError 和 clearErrors", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      required: ["email"],
      properties: {
        email: {
          type: "string",
          title: "Email",
          format: "email",
        },
      },
    };

    const { formRef } = renderDynamicForm({
      props: { schema, validateMode: "onSubmit" },
    });
    await waitForFormReady({ formRef });

    await act(async () => {
      await formRef.current!.validate();
    });
    expect(formRef.current!.getErrors().email).toBeTruthy();

    act(() => {
      formRef.current!.clearErrors("email");
    });
    expect(formRef.current!.getErrors().email).toBeUndefined();

    act(() => {
      formRef.current!.setError("email", {
        type: "manual",
        message: "Manual error",
      });
    });
    expect(formRef.current!.getErrors().email).toBeTruthy();
  });

  it("应该根据 renderAsForm 和 showSubmitButton 控制外层标签和提交按钮", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        name: {
          type: "string",
          title: "Name",
        },
      },
    };

    const { formRef, container } = renderDynamicForm({
      props: {
        schema,
        renderAsForm: false,
        showSubmitButton: false,
        className: "custom-form",
        style: { padding: 12 },
      },
    });
    await waitForFormReady({ formRef });

    expect(container.querySelector("form")).not.toBeInTheDocument();
    expect(
      container.querySelector(".dynamic-form.custom-form"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit" }),
    ).not.toBeInTheDocument();
  });

  it("loading 状态下应该禁用提交按钮并显示提交中状态", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        name: {
          type: "string",
          title: "Name",
        },
      },
    };

    const { formRef } = renderDynamicForm({
      props: {
        schema,
        loading: true,
      },
    });
    await waitForFormReady({ formRef });

    const button = screen.getByRole("button", { name: "Submitting..." });
    expect(button).toBeDisabled();
  });

  it("showErrorList 开启后应该渲染表单级错误列表", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      required: ["name"],
      properties: {
        name: {
          type: "string",
          title: "Name",
        },
      },
    };

    const { formRef, container } = renderDynamicForm({
      props: {
        schema,
        showErrorList: true,
      },
    });
    await waitForFormReady({ formRef });

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Name is required").length).toBeGreaterThan(0);
    });
  });
});

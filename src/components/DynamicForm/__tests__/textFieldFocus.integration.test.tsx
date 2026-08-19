import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DynamicForm } from "../DynamicForm";
import { FieldRegistry, blueprintPreset } from "..";
import type { DynamicFormRef, FieldWidgetProps } from "../types";
import type { ExtendedJSONSchema } from "../types/schema";

const TestTextWidget = React.forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, value, onChange, onBlur, onFocus }, ref) => (
    <input
      ref={ref}
      name={name}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={() => onBlur?.()}
      onFocus={onFocus}
    />
  ),
);
TestTextWidget.displayName = "TestTextWidget";

const TestSelectWidget = React.forwardRef<HTMLButtonElement>((_props, ref) => (
  <button ref={ref} type="button">
    Select
  </button>
));
TestSelectWidget.displayName = "TestSelectWidget";

const widgets = {
  text: TestTextWidget,
  select: TestSelectWidget,
};

describe("DynamicForm 文本字段 focus 通知", () => {
  beforeAll(() => {
    FieldRegistry.setDefaultPreset(blueprintPreset);
  });

  it("focus 文本字段时应该通知完整字段路径和值", () => {
    const onTextFieldFocus = jest.fn();
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        customer: {
          type: "object",
          properties: {
            name: { type: "string", title: "Customer name" },
          },
        },
      },
    };

    render(
      <DynamicForm
        schema={schema}
        defaultValues={{ customer: { name: "Alice" } }}
        onTextFieldFocus={onTextFieldFocus}
        showSubmitButton={false}
        widgets={widgets}
      />,
    );

    fireEvent.focus(screen.getByRole("textbox"));

    expect(onTextFieldFocus).toHaveBeenCalledWith(
      expect.objectContaining({ name: "customer.name", value: "Alice" }),
    );
  });

  it("focus 非文本字段时不应该触发文本字段回调", () => {
    const onTextFieldFocus = jest.fn();
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        status: {
          type: "string",
          title: "Status",
          enum: ["ready", "done"],
          ui: { widget: "select" },
        },
      },
    };

    render(
      <DynamicForm
        schema={schema}
        onTextFieldFocus={onTextFieldFocus}
        showSubmitButton={false}
        widgets={widgets}
      />,
    );

    fireEvent.focus(screen.getByRole("button", { name: /select/i }));

    expect(onTextFieldFocus).not.toHaveBeenCalled();
  });

  it("应该保留字段 widgetProps.onFocus 并随后通知页面层", () => {
    const calls: string[] = [];
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        name: {
          type: "string",
          title: "Name",
          ui: {
            widgetProps: {
              onFocus: () => calls.push("widget"),
            },
          },
        },
      },
    };

    render(
      <DynamicForm
        schema={schema}
        onTextFieldFocus={() => calls.push("page")}
        showSubmitButton={false}
        widgets={widgets}
      />,
    );

    fireEvent.focus(screen.getByRole("textbox"));

    expect(calls).toEqual(["widget", "page"]);
  });

  it("页面更新回调后应该使用最新回调", () => {
    const firstHandler = jest.fn();
    const secondHandler = jest.fn();
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        name: { type: "string", title: "Name" },
      },
    };

    const { rerender } = render(
      <DynamicForm
        schema={schema}
        onTextFieldFocus={firstHandler}
        showSubmitButton={false}
        widgets={widgets}
      />,
    );

    rerender(
      <DynamicForm
        schema={schema}
        onTextFieldFocus={secondHandler}
        showSubmitButton={false}
        widgets={widgets}
      />,
    );

    fireEvent.focus(screen.getByRole("textbox"));

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });

  it("通过 ref 回填文本值时不应该触发 focus 通知", () => {
    const formRef = React.createRef<DynamicFormRef>();
    const onTextFieldFocus = jest.fn();
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        name: { type: "string", title: "Name" },
      },
    };

    render(
      <DynamicForm
        ref={formRef}
        schema={schema}
        onTextFieldFocus={onTextFieldFocus}
        showSubmitButton={false}
        widgets={widgets}
      />,
    );

    act(() => {
      formRef.current?.setValue("name", "Selected document text");
    });

    expect(onTextFieldFocus).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("Selected document text");
  });
});

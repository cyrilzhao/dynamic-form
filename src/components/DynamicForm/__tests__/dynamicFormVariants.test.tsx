import "@testing-library/jest-dom";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ExtendedJSONSchema } from "../types/schema";
import {
  renderDynamicForm,
  setFieldValue,
  setupDynamicFormTest,
  waitForFormReady,
} from "../__testUtils__/linkageTestHelpers";

beforeAll(setupDynamicFormTest);

describe("DynamicForm Variants", () => {
  it("手动切换后只校验 active variant，并清理旧模式错误", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        identifier: {
          type: "string",
          title: "Identifier",
          ui: {
            widget: "variant",
            defaultVariant: "email",
            variants: [
              {
                name: "email",
                type: "string",
                widget: "text",
                detect: {
                  callback: {
                    type: "script",
                    code: "({ value }) => typeof value === 'string' && value.includes('@')",
                  },
                },
                schema: {
                  type: "string",
                  pattern: "^[^@]+@[^@]+\\.[^@]+$",
                },
              },
              {
                name: "phone",
                type: "string",
                widget: "text",
                detect: {
                  callback: {
                    type: "script",
                    code: "({ value }) => typeof value === 'string' && /^1[3-9]\\d{10}$/.test(value)",
                  },
                },
                schema: { type: "string", minLength: 11, maxLength: 11 },
              },
              {
                name: "object",
                type: "object",
                widget: "object-editor",
                schema: { type: "object", properties: {} },
              },
            ],
          },
        },
      },
      required: ["identifier"],
    };
    const { formRef } = renderDynamicForm({ props: { schema } });
    await waitForFormReady({ formRef });

    await setFieldValue({ formRef, name: "identifier", value: "invalid" });
    await act(async () => {
      await formRef.current!.validate("identifier");
    });
    expect(formRef.current!.getErrors().identifier).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "选择 Variant" }));
    fireEvent.click(screen.getByText("phone"));
    expect(formRef.current!.getErrors().identifier).toBeFalsy();
    fireEvent.click(screen.getByRole("button", { name: "选择 Variant" }));
    fireEvent.click(screen.getByText("object"));
    await act(async () => {
      await formRef.current!.validate("identifier");
    });
    expect(formRef.current!.getErrors().identifier).toBeFalsy();
    expect(formRef.current!.getValues().identifier).toEqual({});
  });

  it("通过真实文本输入时应保存字符串值，而不是 ChangeEvent 对象", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        value: {
          type: "string",
          title: "Value",
          ui: {
            widget: "variant",
            defaultVariant: "email",
            variants: [
              { name: "email", type: "string", widget: "text" },
              { name: "phone", type: "string", widget: "text" },
            ],
          },
        },
      },
    };
    const { container, formRef } = renderDynamicForm({ props: { schema } });
    await waitForFormReady({ formRef });

    const input = container.querySelector('input[name="value"]')!;
    fireEvent.change(input, { target: { value: "13800138000" } });

    await waitFor(() => {
      expect(input).toHaveValue("13800138000");
      expect(formRef.current!.getValue("value")).toBe("13800138000");
      expect(formRef.current!.getValue("value")).not.toEqual(
        expect.objectContaining({ target: expect.anything() }),
      );
    });
  });
});

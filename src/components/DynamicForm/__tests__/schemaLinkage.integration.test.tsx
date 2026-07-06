import "@testing-library/jest-dom";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
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

describe("schema 联动集成测试", () => {
  it("应该通过 schema 联动同时更新校验规则、placeholder 和 help 文本", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      required: ["value"],
      properties: {
        mode: {
          type: "string",
          title: "Mode",
          enum: ["strict", "loose"],
          default: "strict",
        },
        value: {
          type: "string",
          title: "Value",
          ui: {
            linkages: [
              {
                type: "schema",
                dependencies: ["#/properties/mode"],
                fulfill: { function: "getValueSchema" },
              },
            ],
          },
        },
      },
    };

    const linkageFunctions = {
      getValueSchema: (formData: Record<string, unknown>) => {
        if (formData.mode === "loose") {
          return {
            minLength: 3,
            ui: {
              placeholder: "Enter at least 3 chars",
              help: "Loose mode accepts mixed case",
            },
          };
        }

        return {
          minLength: 10,
          pattern: "^[A-Z]+$",
          ui: {
            placeholder: "Enter 10 uppercase chars",
            help: "Strict mode accepts uppercase letters only",
          },
        };
      },
    };

    const { formRef, container } = renderDynamicForm({
      props: { schema, linkageFunctions },
    });
    await waitForFormReady({ formRef });
    await refreshLinkage({ formRef });

    await waitFor(() => {
      expect(getInputByName({ container, name: "value" })).toHaveAttribute(
        "placeholder",
        "Enter 10 uppercase chars",
      );
      expect(
        screen.getByText("Strict mode accepts uppercase letters only"),
      ).toBeInTheDocument();
    });

    const valueInput = getInputByName({ container, name: "value" })!;
    await act(async () => {
      fireEvent.change(valueInput, { target: { value: "abcdefghij" } });
      await formRef.current!.validate("value");
    });
    expect(formRef.current!.getErrors().value).toBeTruthy();

    await setFieldValue({ formRef, name: "mode", value: "loose" });

    await waitFor(() => {
      expect(getInputByName({ container, name: "value" })).toHaveAttribute(
        "placeholder",
        "Enter at least 3 chars",
      );
      expect(
        screen.getByText("Loose mode accepts mixed case"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Strict mode accepts uppercase letters only"),
      ).not.toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(getInputByName({ container, name: "value" })!, {
        target: { value: "abc" },
      });
      await formRef.current!.validate("value");
    });
    expect(formRef.current!.getErrors().value).toBeUndefined();
  });

  it("schema 联动切换后，空值仍应保留原始 required 校验", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      required: ["username", "password"],
      properties: {
        mode: {
          type: "string",
          title: "Mode",
          enum: ["strict", "loose"],
          default: "strict",
        },
        username: {
          type: "string",
          title: "Username",
          ui: {
            linkages: [
              {
                type: "schema",
                dependencies: ["#/properties/mode"],
                fulfill: { function: "getUsernameSchema" },
              },
            ],
          },
        },
        password: {
          type: "string",
          title: "Password",
        },
      },
    };

    const linkageFunctions = {
      getUsernameSchema: (formData: Record<string, unknown>) =>
        formData.mode === "strict" ? { minLength: 10 } : { minLength: 3 },
    };

    const { formRef } = renderDynamicForm({
      props: { schema, linkageFunctions },
    });
    await waitForFormReady({ formRef });
    await refreshLinkage({ formRef });

    await act(async () => {
      await formRef.current!.validate();
    });
    expect(formRef.current!.getErrors().username).toBeTruthy();
    expect(formRef.current!.getErrors().password).toBeTruthy();

    await setFieldValue({ formRef, name: "mode", value: "loose" });
    await act(async () => {
      await formRef.current!.validate();
    });

    expect(formRef.current!.getErrors().username).toBeTruthy();
  });

  it("schema 联动应该能更新字段的 disabled 和 readonly UI 状态", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        phase: { type: "string", title: "Phase", default: "closed" },
        notes: {
          type: "string",
          title: "Notes",
          ui: {
            linkages: [
              {
                type: "schema",
                dependencies: ["#/properties/phase"],
                fulfill: { function: "getNotesSchema" },
              },
            ],
          },
        },
      },
    };

    const linkageFunctions = {
      getNotesSchema: (formData: Record<string, unknown>) =>
        formData.phase === "closed"
          ? { ui: { disabled: true, readonly: true } }
          : { ui: { disabled: false, readonly: false } },
    };

    const { formRef, container } = renderDynamicForm({
      props: { schema, linkageFunctions },
    });
    await waitForFormReady({ formRef });
    await refreshLinkage({ formRef });

    await waitFor(() => {
      const notesInput = getInputByName({ container, name: "notes" });
      expect(notesInput).toBeDisabled();
      expect(notesInput).toHaveAttribute("readonly");
    });

    await setFieldValue({ formRef, name: "phase", value: "open" });

    await waitFor(() => {
      const notesInput = getInputByName({ container, name: "notes" });
      expect(notesInput).not.toBeDisabled();
      expect(notesInput).not.toHaveAttribute("readonly");
    });
  });
});

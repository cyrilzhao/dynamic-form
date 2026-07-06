import "@testing-library/jest-dom";
import { waitFor } from "@testing-library/react";
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

describe("readonly 联动集成测试", () => {
  it("应该根据条件设置和解除只读状态", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        approved: { type: "boolean", title: "Approved", default: true },
        comment: {
          type: "string",
          title: "Comment",
          ui: {
            linkages: [
              {
                type: "readonly",
                dependencies: ["#/properties/approved"],
                when: { field: "approved", operator: "==", value: true },
                fulfill: { state: { readonly: true } },
                otherwise: { state: { readonly: false } },
              },
            ],
          },
        },
      },
    };

    const { formRef, container } = renderDynamicForm({ props: { schema } });
    await waitForFormReady({ formRef });
    await refreshLinkage({ formRef });

    await waitFor(() => {
      expect(getInputByName({ container, name: "comment" })).toHaveAttribute(
        "readonly",
      );
    });

    await setFieldValue({ formRef, name: "approved", value: false });

    await waitFor(() => {
      expect(
        getInputByName({ container, name: "comment" }),
      ).not.toHaveAttribute("readonly");
    });
  });

  it("多个 readonly 联动应该使用 OR 逻辑合并", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        systemLocked: {
          type: "boolean",
          title: "System Locked",
          default: false,
        },
        ownerLocked: { type: "boolean", title: "Owner Locked", default: true },
        code: {
          type: "string",
          title: "Code",
          ui: {
            linkages: [
              {
                type: "readonly",
                dependencies: ["#/properties/systemLocked"],
                when: { field: "systemLocked", operator: "==", value: true },
                fulfill: { state: { readonly: true } },
                otherwise: { state: { readonly: false } },
              },
              {
                type: "readonly",
                dependencies: ["#/properties/ownerLocked"],
                when: { field: "ownerLocked", operator: "==", value: true },
                fulfill: { state: { readonly: true } },
                otherwise: { state: { readonly: false } },
              },
            ],
          },
        },
      },
    };

    const { formRef, container } = renderDynamicForm({ props: { schema } });
    await waitForFormReady({ formRef });
    await refreshLinkage({ formRef });

    expect(getInputByName({ container, name: "code" })).toHaveAttribute(
      "readonly",
    );

    await setFieldValue({ formRef, name: "ownerLocked", value: false });

    await waitFor(() => {
      expect(getInputByName({ container, name: "code" })).not.toHaveAttribute(
        "readonly",
      );
    });

    await setFieldValue({ formRef, name: "systemLocked", value: true });

    await waitFor(() => {
      expect(getInputByName({ container, name: "code" })).toHaveAttribute(
        "readonly",
      );
    });
  });
});

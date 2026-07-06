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

describe("disabled 联动集成测试", () => {
  it("应该根据条件禁用和恢复字段", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        locked: { type: "boolean", title: "Locked", default: true },
        assignee: {
          type: "string",
          title: "Assignee",
          ui: {
            linkages: [
              {
                type: "disabled",
                dependencies: ["#/properties/locked"],
                when: { field: "locked", operator: "==", value: true },
                fulfill: { state: { disabled: true } },
                otherwise: { state: { disabled: false } },
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
      expect(getInputByName({ container, name: "assignee" })).toBeDisabled();
    });

    await setFieldValue({ formRef, name: "locked", value: false });

    await waitFor(() => {
      expect(
        getInputByName({ container, name: "assignee" }),
      ).not.toBeDisabled();
    });
  });

  it("多个 disabled 联动应该使用 OR 逻辑合并", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        archived: { type: "boolean", title: "Archived", default: false },
        readonlyMode: {
          type: "boolean",
          title: "Readonly Mode",
          default: true,
        },
        title: {
          type: "string",
          title: "Title",
          ui: {
            linkages: [
              {
                type: "disabled",
                dependencies: ["#/properties/archived"],
                when: { field: "archived", operator: "==", value: true },
                fulfill: { state: { disabled: true } },
                otherwise: { state: { disabled: false } },
              },
              {
                type: "disabled",
                dependencies: ["#/properties/readonlyMode"],
                when: { field: "readonlyMode", operator: "==", value: true },
                fulfill: { state: { disabled: true } },
                otherwise: { state: { disabled: false } },
              },
            ],
          },
        },
      },
    };

    const { formRef, container } = renderDynamicForm({ props: { schema } });
    await waitForFormReady({ formRef });
    await refreshLinkage({ formRef });

    expect(getInputByName({ container, name: "title" })).toBeDisabled();

    await setFieldValue({ formRef, name: "readonlyMode", value: false });

    await waitFor(() => {
      expect(getInputByName({ container, name: "title" })).not.toBeDisabled();
    });

    await setFieldValue({ formRef, name: "archived", value: true });

    await waitFor(() => {
      expect(getInputByName({ container, name: "title" })).toBeDisabled();
    });
  });
});

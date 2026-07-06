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

describe("value 联动集成测试", () => {
  it("应该根据依赖字段自动设置目标字段值", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        firstName: { type: "string", title: "First Name", default: "Ada" },
        lastName: { type: "string", title: "Last Name", default: "Lovelace" },
        fullName: {
          type: "string",
          title: "Full Name",
          ui: {
            linkages: [
              {
                type: "value",
                dependencies: [
                  "#/properties/firstName",
                  "#/properties/lastName",
                ],
                fulfill: { function: "getFullName" },
              },
            ],
          },
        },
      },
    };

    const linkageFunctions = {
      getFullName: (formData: Record<string, unknown>) =>
        `${formData.firstName ?? ""} ${formData.lastName ?? ""}`.trim(),
    };

    const { formRef, container } = renderDynamicForm({
      props: { schema, linkageFunctions },
    });
    await waitForFormReady({ formRef });
    await refreshLinkage({ formRef });

    await waitFor(() => {
      expect(getInputByName({ container, name: "fullName" })).toHaveValue(
        "Ada Lovelace",
      );
    });

    await setFieldValue({ formRef, name: "firstName", value: "Grace" });

    await waitFor(() => {
      expect(formRef.current!.getValue("fullName")).toBe("Grace Lovelace");
      expect(getInputByName({ container, name: "fullName" })).toHaveValue(
        "Grace Lovelace",
      );
    });
  });

  it("value 联动更新的字段应该继续触发下游联动", async () => {
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        amount: { type: "number", title: "Amount", default: 100 },
        tax: {
          type: "number",
          title: "Tax",
          ui: {
            linkages: [
              {
                type: "value",
                dependencies: ["#/properties/amount"],
                fulfill: { function: "getTax" },
              },
            ],
          },
        },
        total: {
          type: "number",
          title: "Total",
          ui: {
            linkages: [
              {
                type: "value",
                dependencies: ["#/properties/amount", "#/properties/tax"],
                fulfill: { function: "getTotal" },
              },
            ],
          },
        },
      },
    };

    const linkageFunctions = {
      getTax: (formData: Record<string, unknown>) =>
        Number(formData.amount ?? 0) * 0.1,
      getTotal: (formData: Record<string, unknown>) =>
        Number(formData.amount ?? 0) + Number(formData.tax ?? 0),
    };

    const { formRef } = renderDynamicForm({
      props: { schema, linkageFunctions },
    });
    await waitForFormReady({ formRef });
    await refreshLinkage({ formRef });

    expect(formRef.current!.getValue("tax")).toBe(10);
    expect(formRef.current!.getValue("total")).toBe(110);

    await setFieldValue({ formRef, name: "amount", value: 200 });

    await waitFor(() => {
      expect(formRef.current!.getValue("tax")).toBe(20);
      expect(formRef.current!.getValue("total")).toBe(220);
    });
  });
});

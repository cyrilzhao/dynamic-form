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

describe("数组聚合联动测试", () => {
  it("总价应该根据商品列表自动计算", async () => {
    const formRef = React.createRef<DynamicFormRef>();

    // 场景：总价依赖商品列表的所有价格和数量
    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        items: {
          type: "array",
          title: "Items",
          items: {
            type: "object",
            properties: {
              name: { type: "string", title: "Name" },
              price: { type: "number", title: "Price", minimum: 0 },
              quantity: { type: "number", title: "Quantity", minimum: 1 },
            },
          },
        },
        totalPrice: {
          type: "number",
          title: "Total Price",
          ui: {
            linkages: [
              {
                type: "value",
                dependencies: ["#/properties/items"],
                fulfill: { function: "calculateTotal" },
              },
            ],
          },
        },
      },
    };

    const linkageFunctions = {
      calculateTotal: ({ formData }: { formData: any }) => {
        const items = formData.items || [];
        return items.reduce((sum: number, item: any) => {
          return sum + (item.price || 0) * (item.quantity || 0);
        }, 0);
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

    // 添加商品
    await act(async () => {
      formRef.current?.setValue("items", [
        { name: "Book", price: 50, quantity: 2 },
        { name: "Pen", price: 10, quantity: 5 },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    // 验证：总价 = 50*2 + 10*5 = 150
    await waitFor(() => {
      const values = formRef.current?.getValues();
      expect(values?.totalPrice).toBe(150);
    });
  });

  it("修改商品数量应该更新总价", async () => {
    const formRef = React.createRef<DynamicFormRef>();

    const schema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              price: { type: "number" },
              quantity: { type: "number" },
            },
          },
        },
        totalPrice: {
          type: "number",
          ui: {
            linkages: [
              {
                type: "value",
                dependencies: ["#/properties/items"],
                fulfill: { function: "calculateTotal" },
              },
            ],
          },
        },
      },
    };

    const linkageFunctions = {
      calculateTotal: ({ formData }: { formData: any }) => {
        const items = formData.items || [];
        return items.reduce((sum: number, item: any) => {
          return sum + (item.price || 0) * (item.quantity || 0);
        }, 0);
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

    // 初始化商品
    await act(async () => {
      formRef.current?.setValue("items", [{ price: 100, quantity: 1 }]);
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    // 验证初始总价
    await waitFor(() => {
      expect(formRef.current?.getValues()?.totalPrice).toBe(100);
    });

    // 修改数量
    await act(async () => {
      formRef.current?.setValue("items.0.quantity", 3);
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    // 验证总价更新为 100*3 = 300
    await waitFor(() => {
      expect(formRef.current?.getValues()?.totalPrice).toBe(300);
    });
  });
});

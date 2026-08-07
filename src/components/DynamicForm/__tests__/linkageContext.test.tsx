import React, { useMemo, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DynamicForm } from "../DynamicForm";
import type { DynamicFormRef } from "../types";
import type { ExtendedJSONSchema } from "../types/schema";
import type { LinkageFunction } from "../types/linkage";

function createOptionsSchema(): ExtendedJSONSchema {
  return {
    type: "object",
    properties: {
      field: {
        type: "string",
        title: "Field",
        ui: {
          linkages: [
            {
              type: "options",
              dependencies: [],
              fulfill: { function: "loadOptions" },
            },
          ],
        },
      },
    },
  };
}

describe("LinkageContext", () => {
  describe("基本功能", () => {
    it("应该将 linkageContext 传递给联动函数", async () => {
      const mockLinkageFn = jest.fn<ReturnType<LinkageFunction>, Parameters<LinkageFunction>>(
        () => [],
      );
      const formRef = React.createRef<DynamicFormRef>();
      const externalData = { apiKey: "test-key", userId: 123 };

      render(
        <DynamicForm
          ref={formRef}
          schema={createOptionsSchema()}
          linkageFunctions={{ loadOptions: mockLinkageFn }}
          linkageContext={externalData}
        />,
      );

      await waitFor(() => {
        expect(formRef.current).not.toBeNull();
      });

      await act(async () => {
        await formRef.current?.refreshLinkage();
      });

      expect(mockLinkageFn).toHaveBeenCalled();
      expect(mockLinkageFn.mock.calls[0][0].context.externalData).toEqual(
        externalData,
      );
    });
  });

  describe("自动刷新机制", () => {
    it("应该在 linkageContext 变化时自动触发联动刷新", async () => {
      const mockLinkageFn = jest.fn<ReturnType<LinkageFunction>, Parameters<LinkageFunction>>(
        () => [],
      );

      const TestComponent = () => {
        const [apiData, setApiData] = useState({ count: 0 });
        const linkageFunctions = useMemo(
          () => ({ loadOptions: mockLinkageFn }),
          [],
        );

        return (
          <div>
            <button onClick={() => setApiData({ count: apiData.count + 1 })}>
              Update Data
            </button>
            <DynamicForm
              schema={createOptionsSchema()}
              linkageFunctions={linkageFunctions}
              linkageContext={apiData}
            />
          </div>
        );
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(mockLinkageFn).toHaveBeenCalledTimes(1);
      });
      expect(mockLinkageFn.mock.calls[0][0].context.externalData).toEqual({
        count: 0,
      });

      fireEvent.click(screen.getByRole("button", { name: "Update Data" }));

      await waitFor(() => {
        expect(mockLinkageFn).toHaveBeenCalledTimes(2);
      });
      expect(mockLinkageFn.mock.calls[1][0].context.externalData).toEqual({
        count: 1,
      });
    });

    it("应该使用 shallow compare 避免不必要的刷新", async () => {
      const mockLinkageFn = jest.fn<ReturnType<LinkageFunction>, Parameters<LinkageFunction>>(
        () => [],
      );
      const apiData = { userId: 123 };

      const TestComponent = () => {
        const [, setCount] = useState(0);
        const linkageFunctions = useMemo(
          () => ({ loadOptions: mockLinkageFn }),
          [],
        );

        return (
          <div>
            <button onClick={() => setCount((count) => count + 1)}>
              Rerender
            </button>
            <DynamicForm
              schema={createOptionsSchema()}
              linkageFunctions={linkageFunctions}
              linkageContext={apiData}
            />
          </div>
        );
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(mockLinkageFn).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(screen.getByRole("button", { name: "Rerender" }));
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockLinkageFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("边界情况", () => {
    it("应该正确处理 linkageContext 为 undefined", async () => {
      const mockLinkageFn = jest.fn<ReturnType<LinkageFunction>, Parameters<LinkageFunction>>(
        () => [],
      );
      const formRef = React.createRef<DynamicFormRef>();

      render(
        <DynamicForm
          ref={formRef}
          schema={createOptionsSchema()}
          linkageFunctions={{ loadOptions: mockLinkageFn }}
        />,
      );

      await waitFor(() => {
        expect(formRef.current).not.toBeNull();
      });

      await act(async () => {
        await formRef.current?.refreshLinkage();
      });

      expect(mockLinkageFn.mock.calls[0][0].context).toHaveProperty(
        "fieldPath",
      );
      expect(mockLinkageFn.mock.calls[0][0].context.externalData).toEqual({});
    });

    it("应该正确处理空对象 linkageContext", async () => {
      const mockLinkageFn = jest.fn<ReturnType<LinkageFunction>, Parameters<LinkageFunction>>(
        () => [],
      );
      const formRef = React.createRef<DynamicFormRef>();

      render(
        <DynamicForm
          ref={formRef}
          schema={createOptionsSchema()}
          linkageFunctions={{ loadOptions: mockLinkageFn }}
          linkageContext={{}}
        />,
      );

      await waitFor(() => {
        expect(formRef.current).not.toBeNull();
      });

      await act(async () => {
        await formRef.current?.refreshLinkage();
      });

      expect(mockLinkageFn.mock.calls[0][0].context).toHaveProperty(
        "fieldPath",
      );
      expect(mockLinkageFn.mock.calls[0][0].context.externalData).toEqual({});
    });
  });
});

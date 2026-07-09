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
  it("非 asNestedForm 的内层 DynamicForm 应该使用自己的 form 触发联动", async () => {
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
        employeeInfo: {
          type: "object",
          title: "Employee Info",
          ui: { widget: "inner" },
        },
      },
    };

    render(
      <DynamicForm
        schema={outerSchema}
        widgets={{ inner: InnerWidget }}
        renderAsForm={false}
        showSubmitButton={false}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText("Salary Range")).not.toBeInTheDocument();
    });

    await act(async () => {
      screen.getByText("Set Manager").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(screen.getByText("Salary Range")).toBeInTheDocument();
    });
  });
});

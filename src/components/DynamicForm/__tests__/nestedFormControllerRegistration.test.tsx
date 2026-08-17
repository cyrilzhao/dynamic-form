import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { DynamicForm } from "../DynamicForm";
import { FieldRegistry, blueprintPreset } from "..";
import type { DynamicFormRef, FieldWidgetProps } from "../types";
import type { ExtendedJSONSchema } from "../types/schema";

const schemaWithModel: ExtendedJSONSchema = {
  type: "object",
  properties: {
    ocr: {
      type: "object",
      title: "OCR",
      properties: {
        model: { type: "string", title: "Model" },
      },
    },
  },
};

const schemaWithEngine: ExtendedJSONSchema = {
  type: "object",
  properties: {
    ocr: {
      type: "object",
      title: "OCR",
      properties: {
        engine: { type: "string", title: "Engine" },
      },
    },
  },
};

const TestTextWidget = React.forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, value, onChange, onBlur }, ref) => (
    <input
      ref={ref}
      name={name}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={() => onBlur?.()}
    />
  ),
);
TestTextWidget.displayName = "TestTextWidget";

const strictModeWidgets = { text: TestTextWidget };

interface ErrorBoundaryState {
  error: Error | null;
}

class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public render() {
    if (this.state.error) {
      return <div role="alert">{this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

interface StrictModeFormProps {
  schema: ExtendedJSONSchema;
  open: boolean;
  formRef: React.RefObject<DynamicFormRef>;
}

const StrictModeForm: React.FC<StrictModeFormProps> = ({
  schema,
  open,
  formRef,
}) => (
  <React.StrictMode>
    <TestErrorBoundary>
      {open && (
        <DynamicForm
          ref={formRef}
          schema={schema}
          onSubmit={jest.fn()}
          showSubmitButton={false}
          showErrorList={false}
          widgets={strictModeWidgets}
        />
      )}
    </TestErrorBoundary>
  </React.StrictMode>
);

interface DelayedUnmountFormProps extends StrictModeFormProps {
  completeExit: boolean;
}

const DelayedUnmountForm: React.FC<DelayedUnmountFormProps> = ({
  schema,
  open,
  formRef,
  completeExit,
}) => {
  const [contentMounted, setContentMounted] = React.useState(open);

  React.useEffect(() => {
    if (open) {
      setContentMounted(true);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open && completeExit) {
      setContentMounted(false);
    }
  }, [completeExit, open]);

  return (
    <React.StrictMode>
      <TestErrorBoundary>
        {contentMounted && (
          <DynamicForm
            ref={formRef}
            schema={schema}
            onSubmit={jest.fn()}
            showSubmitButton={false}
            showErrorList={false}
            widgets={strictModeWidgets}
          />
        )}
      </TestErrorBoundary>
    </React.StrictMode>
  );
};

describe("NestedForm Controller 注册模型", () => {
  beforeAll(() => {
    FieldRegistry.setDefaultPreset(blueprintPreset);
  });

  it("StrictMode 下切换同一父路径的子 Schema 后应该正常注册并交互", async () => {
    const formRef = React.createRef<DynamicFormRef>();
    const { container, rerender } = render(
      <StrictModeForm schema={schemaWithModel} open={true} formRef={formRef} />,
    );

    await waitFor(() => {
      expect(container.querySelector('[name="ocr.model"]')).toBeInTheDocument();
    });

    rerender(
      <StrictModeForm
        schema={schemaWithEngine}
        open={true}
        formRef={formRef}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelector('[name="ocr.model"]'),
      ).not.toBeInTheDocument();
      expect(
        container.querySelector('[name="ocr.engine"]'),
      ).toBeInTheDocument();
    });

    fireEvent.change(container.querySelector('[name="ocr.engine"]')!, {
      target: { value: "tesseract" },
    });
    expect(formRef.current?.getValue("ocr.engine")).toBe("tesseract");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("关闭期间切换 Schema 并重新打开不应该破坏嵌套字段", async () => {
    const formRef = React.createRef<DynamicFormRef>();
    const { container, rerender } = render(
      <StrictModeForm schema={schemaWithModel} open={true} formRef={formRef} />,
    );

    await waitFor(() => {
      expect(container.querySelector('[name="ocr.model"]')).toBeInTheDocument();
    });

    rerender(
      <StrictModeForm
        schema={schemaWithEngine}
        open={false}
        formRef={formRef}
      />,
    );
    rerender(
      <StrictModeForm
        schema={schemaWithEngine}
        open={true}
        formRef={formRef}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelector('[name="ocr.engine"]'),
      ).toBeInTheDocument();
    });

    fireEvent.change(container.querySelector('[name="ocr.engine"]')!, {
      target: { value: "paddleocr" },
    });
    expect(formRef.current?.getValues()).toEqual({
      ocr: { engine: "paddleocr" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("延迟卸载期间反复切换 Schema 不应该产生注册异常", async () => {
    const formRef = React.createRef<DynamicFormRef>();
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { container, rerender } = render(
      <DelayedUnmountForm
        schema={schemaWithModel}
        open={true}
        completeExit={false}
        formRef={formRef}
      />,
    );

    try {
      await waitFor(() => {
        expect(
          container.querySelector('[name="ocr.model"]'),
        ).toBeInTheDocument();
      });

      for (let index = 0; index < 3; index += 1) {
        const nextSchema = index % 2 === 0 ? schemaWithEngine : schemaWithModel;
        const nextFieldName = index % 2 === 0 ? "ocr.engine" : "ocr.model";

        rerender(
          <DelayedUnmountForm
            schema={nextSchema}
            open={false}
            completeExit={false}
            formRef={formRef}
          />,
        );

        await waitFor(() => {
          expect(
            container.querySelector(`[name="${nextFieldName}"]`),
          ).toBeInTheDocument();
        });

        rerender(
          <DelayedUnmountForm
            schema={nextSchema}
            open={false}
            completeExit={true}
            formRef={formRef}
          />,
        );
        await waitFor(() => {
          expect(
            container.querySelector(`[name="${nextFieldName}"]`),
          ).toBeNull();
        });

        rerender(
          <DelayedUnmountForm
            schema={nextSchema}
            open={true}
            completeExit={false}
            formRef={formRef}
          />,
        );
        await waitFor(() => {
          expect(
            container.querySelector(`[name="${nextFieldName}"]`),
          ).toBeInTheDocument();
        });
      }

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("父对象 required 错误应该由 resolver 显示并在赋值后清除", async () => {
    const formRef = React.createRef<DynamicFormRef>();
    const requiredObjectSchema: ExtendedJSONSchema = {
      type: "object",
      required: ["ocr"],
      properties: {
        ocr: {
          type: "object",
          title: "OCR Config",
          properties: {},
        },
      },
    };

    render(
      <DynamicForm
        ref={formRef}
        schema={requiredObjectSchema}
        onSubmit={jest.fn()}
        showSubmitButton={false}
        showErrorList={false}
      />,
    );

    await act(async () => {
      expect(await formRef.current!.validate()).toBe(false);
    });
    expect(
      await screen.findByText("OCR Config is required"),
    ).toBeInTheDocument();

    await act(async () => {
      formRef.current!.setValue("ocr", {});
      expect(await formRef.current!.validate()).toBe(true);
    });
    await waitFor(() => {
      expect(
        screen.queryByText("OCR Config is required"),
      ).not.toBeInTheDocument();
    });
  });

  it("父对象约束错误应该由 resolver 显示并在修正后清除", async () => {
    const formRef = React.createRef<DynamicFormRef>();
    const constrainedObjectSchema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        ocr: {
          type: "object",
          title: "OCR Config",
          minProperties: 1,
          properties: {},
        },
      },
    };

    render(
      <DynamicForm
        ref={formRef}
        schema={constrainedObjectSchema}
        defaultValues={{ ocr: {} }}
        onSubmit={jest.fn()}
        showSubmitButton={false}
        showErrorList={false}
      />,
    );

    await act(async () => {
      expect(await formRef.current!.validate()).toBe(false);
    });
    expect(
      await screen.findByText("OCR Config requires at least 1 properties"),
    ).toBeInTheDocument();

    await act(async () => {
      formRef.current!.setValue("ocr", { configured: true });
      expect(await formRef.current!.validate()).toBe(true);
    });
    await waitFor(() => {
      expect(
        screen.queryByText("OCR Config requires at least 1 properties"),
      ).not.toBeInTheDocument();
    });
  });

  it("移除并重新加入 nested-form 后叶子字段应该恢复交互", async () => {
    const formRef = React.createRef<DynamicFormRef>();
    const emptySchema: ExtendedJSONSchema = { type: "object", properties: {} };
    const { container, rerender } = render(
      <DynamicForm
        ref={formRef}
        schema={schemaWithModel}
        onSubmit={jest.fn()}
        showSubmitButton={false}
        widgets={strictModeWidgets}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[name="ocr.model"]')).toBeInTheDocument();
    });
    fireEvent.change(container.querySelector('[name="ocr.model"]')!, {
      target: { value: "saved-model" },
    });

    rerender(
      <DynamicForm
        ref={formRef}
        schema={emptySchema}
        onSubmit={jest.fn()}
        showSubmitButton={false}
        widgets={strictModeWidgets}
      />,
    );
    expect(
      container.querySelector('[name="ocr.model"]'),
    ).not.toBeInTheDocument();

    rerender(
      <DynamicForm
        ref={formRef}
        schema={schemaWithModel}
        onSubmit={jest.fn()}
        showSubmitButton={false}
        widgets={strictModeWidgets}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector('[name="ocr.model"]')).toHaveValue(
        "saved-model",
      );
    });
  });

  it("对象数组中的 nested-form 应该由叶子字段维护值", async () => {
    const formRef = React.createRef<DynamicFormRef>();
    const arraySchema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        items: {
          type: "array",
          title: "Items",
          items: {
            type: "object",
            properties: {
              ocr: schemaWithModel.properties!.ocr,
            },
          },
        },
      },
    };
    const { container } = render(
      <DynamicForm
        ref={formRef}
        schema={arraySchema}
        defaultValues={{ items: [{ ocr: { model: "initial" } }] }}
        onSubmit={jest.fn()}
        showSubmitButton={false}
        widgets={strictModeWidgets}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[name="items.0.ocr.model"]')).toHaveValue(
        "initial",
      );
    });

    fireEvent.change(container.querySelector('[name="items.0.ocr.model"]')!, {
      target: { value: "updated" },
    });
    expect(formRef.current?.getValues()).toEqual({
      items: [{ ocr: { model: "updated" } }],
    });
  });

  it("多层 nested-form 应该只通过最深层叶子字段维护值", async () => {
    const formRef = React.createRef<DynamicFormRef>();
    const multiLevelSchema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        config: {
          type: "object",
          title: "Config",
          properties: {
            ocr: schemaWithModel.properties!.ocr,
          },
        },
      },
    };
    const { container } = render(
      <DynamicForm
        ref={formRef}
        schema={multiLevelSchema}
        defaultValues={{ config: { ocr: { model: "nested" } } }}
        onSubmit={jest.fn()}
        showSubmitButton={false}
        widgets={strictModeWidgets}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[name="config.ocr.model"]')).toHaveValue(
        "nested",
      );
    });
    fireEvent.change(container.querySelector('[name="config.ocr.model"]')!, {
      target: { value: "deep-updated" },
    });
    expect(formRef.current?.getValues()).toEqual({
      config: { ocr: { model: "deep-updated" } },
    });
  });

  it("setValues 和 reset 应该继续更新 nested-form 叶子字段", async () => {
    const formRef = React.createRef<DynamicFormRef>();
    const { container } = render(
      <DynamicForm
        ref={formRef}
        schema={schemaWithModel}
        onSubmit={jest.fn()}
        showSubmitButton={false}
        widgets={strictModeWidgets}
      />,
    );

    await act(async () => {
      formRef.current!.setValues({ ocr: { model: "set-values" } });
    });
    expect(container.querySelector('[name="ocr.model"]')).toHaveValue(
      "set-values",
    );

    await act(async () => {
      formRef.current!.reset({ ocr: { model: "reset-value" } });
    });
    expect(container.querySelector('[name="ocr.model"]')).toHaveValue(
      "reset-value",
    );
  });
});

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CallbackPropsEditor } from "../CallbackPropsEditor";

interface MockSelectOption {
  label: string;
  value: string;
}

interface MockSelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "onChange"
> {
  value: string;
  onChange: (value: string) => void;
  options: MockSelectOption[];
}

jest.mock("../../../../../Select", () => ({
  Select: ({
    value,
    onChange,
    disabled,
    options,
    ...rest
  }: MockSelectProps) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      {...rest}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

jest.mock("../../../../../CodeEditor", () => ({
  CodeEditor: () => <textarea aria-label="code-editor" />,
}));

describe("CallbackPropsEditor", () => {
  it("Callback Mode 标题旁应该说明两种模式的差别和适用场景", async () => {
    render(<CallbackPropsEditor onChange={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Callback Prop" }));
    fireEvent.mouseEnter(screen.getByLabelText("Callback Mode help"));

    await waitFor(() => {
      expect(
        screen.getByText(/Function Name reuses callbacks defined in code/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/Use it for shared handlers/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Inline Script is more flexible for one-off behavior/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Use it when the logic is field-specific/i),
    ).toBeInTheDocument();
  });

  it("Function Name 字段标题旁应该说明具体配置方式和示例", async () => {
    render(<CallbackPropsEditor onChange={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Callback Prop" }));
    fireEvent.change(
      screen.getByLabelText("Callback Mode", { selector: "select" }),
      {
        target: { value: "function-name" },
      },
    );
    fireEvent.mouseEnter(screen.getByLabelText("Function Name help"));

    await waitFor(() => {
      expect(
        screen.getByText(
          /Enter the key from the DynamicForm callbacks object/i,
        ),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/callbackProps: \{ onUpload: "uploadFile" \}/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/callbacks=\{\{ uploadFile \}\}/i),
    ).toBeInTheDocument();
  });
});

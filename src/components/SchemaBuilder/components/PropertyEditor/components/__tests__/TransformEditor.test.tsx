import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TransformEditor } from "../TransformEditor";

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
  CodeEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="code-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe("TransformEditor", () => {
  it("transform inline script 应该使用带说明和示例的完整函数模板", () => {
    const onChange = jest.fn();

    render(<TransformEditor value={{ callback: "" }} onChange={onChange} />);

    fireEvent.change(screen.getAllByLabelText("Callback Mode")[0], {
      target: { value: "inline-script" },
    });

    expect(
      (screen.getAllByLabelText("code-editor")[0] as HTMLTextAreaElement).value,
    ).toContain("function(value)");
    expect(
      (screen.getAllByLabelText("code-editor")[0] as HTMLTextAreaElement).value,
    ).toContain("@param {any} value");
    expect(
      (screen.getAllByLabelText("code-editor")[0] as HTMLTextAreaElement).value,
    ).toContain("@returns {any}");
    expect(
      (screen.getAllByLabelText("code-editor")[0] as HTMLTextAreaElement).value,
    ).toContain("convert percentage input 96 to decimal 0.96");
  });

  it("reverse transform inline script 应该使用对应的反向转换示例模板", () => {
    const onChange = jest.fn();

    render(<TransformEditor value={{ callback: "" }} onChange={onChange} />);

    fireEvent.change(screen.getAllByLabelText("Callback Mode")[1], {
      target: { value: "inline-script" },
    });

    expect(
      (screen.getAllByLabelText("code-editor")[0] as HTMLTextAreaElement).value,
    ).toContain("Transform stored form value back into display value");
    expect(
      (screen.getAllByLabelText("code-editor")[0] as HTMLTextAreaElement).value,
    ).toContain("convert stored decimal 0.96 back to percentage input 96");
  });
});

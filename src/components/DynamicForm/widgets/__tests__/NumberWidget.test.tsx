import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NumberWidget } from "../NumberWidget";

describe("NumberWidget", () => {
  const defaultProps = {
    name: "number-field",
  };

  describe("基本渲染", () => {
    it("应该渲染数字输入框", () => {
      render(<NumberWidget {...defaultProps} />);
      expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    });

    it("应该设置正确的 name 属性", () => {
      render(<NumberWidget {...defaultProps} />);
      expect(screen.getByRole("spinbutton")).toHaveAttribute(
        "name",
        "number-field",
      );
    });

    it("应该显示 placeholder", () => {
      render(<NumberWidget {...defaultProps} placeholder="请输入数字" />);
      expect(screen.getByPlaceholderText("请输入数字")).toBeInTheDocument();
    });
  });

  describe("禁用和只读状态", () => {
    it("应该支持禁用状态", () => {
      render(<NumberWidget {...defaultProps} disabled={true} />);
      expect(screen.getByRole("spinbutton")).toBeDisabled();
    });

    it("应该支持只读状态", () => {
      render(<NumberWidget {...defaultProps} readonly={true} />);
      expect(screen.getByRole("spinbutton")).toHaveAttribute("readonly");
    });
  });

  describe("错误状态", () => {
    it("有错误时应该显示 danger intent", () => {
      const { container } = render(
        <NumberWidget {...defaultProps} error="错误" />,
      );
      expect(container.querySelector(".bp6-intent-danger")).toBeInTheDocument();
    });
  });

  describe("onChange 回调", () => {
    it("输入有效数字时应该调用 onChange 并传递数字值", () => {
      const handleChange = jest.fn();
      render(<NumberWidget {...defaultProps} onChange={handleChange} />);

      const input = screen.getByRole("spinbutton");
      fireEvent.change(input, { target: { value: "42" } });

      expect(handleChange).toHaveBeenCalledWith(42);
    });

    it("输入 NaN 时应该调用 onChange 并传递 undefined", () => {
      const handleChange = jest.fn();
      render(<NumberWidget {...defaultProps} onChange={handleChange} />);

      const input = screen.getByRole("spinbutton");
      // 输入非数字字符触发 NaN
      fireEvent.change(input, { target: { value: "abc" } });

      expect(handleChange).toHaveBeenCalledWith(undefined);
    });

    it("没有 onChange 时不应该报错", () => {
      render(<NumberWidget {...defaultProps} />);

      const input = screen.getByRole("spinbutton");
      expect(() => {
        fireEvent.change(input, { target: { value: "123" } });
      }).not.toThrow();
    });
  });

  describe("onBlur 回调", () => {
    it("输入有效数字后失焦应该调用 onBlur", () => {
      const handleBlur = jest.fn();
      render(<NumberWidget {...defaultProps} onBlur={handleBlur} />);

      const input = screen.getByRole("spinbutton");
      fireEvent.change(input, { target: { value: "42" } });
      fireEvent.blur(input);

      expect(handleBlur).toHaveBeenCalled();
    });

    it("输入非法字符后失焦应该调用 onChange(undefined) 清空值", () => {
      const handleChange = jest.fn();
      const handleBlur = jest.fn();
      render(
        <NumberWidget
          {...defaultProps}
          onChange={handleChange}
          onBlur={handleBlur}
        />,
      );

      const input = screen.getByRole("spinbutton");
      // 模拟输入非法字符
      fireEvent.blur(input, { target: { value: "abc" } });

      expect(handleChange).toHaveBeenCalledWith(undefined);
      expect(handleBlur).toHaveBeenCalled();
    });

    it("输入为空时失焦不应该调用 onChange", () => {
      const handleChange = jest.fn();
      const handleBlur = jest.fn();
      render(
        <NumberWidget
          {...defaultProps}
          onChange={handleChange}
          onBlur={handleBlur}
        />,
      );

      const input = screen.getByRole("spinbutton");
      fireEvent.blur(input, { target: { value: "" } });

      // 空值不触发 onChange（因为 inputValue 为空，不进入 if 分支）
      expect(handleChange).not.toHaveBeenCalled();
      expect(handleBlur).toHaveBeenCalled();
    });

    it("没有 onBlur 时不应该报错", () => {
      render(<NumberWidget {...defaultProps} />);

      const input = screen.getByRole("spinbutton");
      expect(() => {
        fireEvent.blur(input);
      }).not.toThrow();
    });

    it("没有 onChange 时输入非法字符失焦不应该报错", () => {
      const handleBlur = jest.fn();
      render(<NumberWidget {...defaultProps} onBlur={handleBlur} />);

      const input = screen.getByRole("spinbutton");
      expect(() => {
        fireEvent.blur(input, { target: { value: "invalid" } });
      }).not.toThrow();
      expect(handleBlur).toHaveBeenCalled();
    });
  });
});

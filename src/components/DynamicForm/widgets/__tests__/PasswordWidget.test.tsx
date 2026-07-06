import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PasswordWidget } from "../PasswordWidget";

describe("PasswordWidget", () => {
  const defaultProps = {
    name: "password-field",
  };

  describe("基本渲染", () => {
    it("应该渲染密码输入框", () => {
      render(<PasswordWidget {...defaultProps} />);
      const input = document.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });

    it("应该设置正确的 name 属性", () => {
      render(<PasswordWidget {...defaultProps} />);
      const input = document.querySelector('input[type="password"]');
      expect(input).toHaveAttribute("name", "password-field");
    });

    it("应该显示 placeholder", () => {
      render(<PasswordWidget {...defaultProps} placeholder="请输入密码" />);
      expect(screen.getByPlaceholderText("请输入密码")).toBeInTheDocument();
    });
  });

  describe("禁用和只读状态", () => {
    it("应该支持禁用状态", () => {
      render(<PasswordWidget {...defaultProps} disabled={true} />);
      const input = document.querySelector('input[type="password"]');
      expect(input).toBeDisabled();
    });

    it("应该支持只读状态", () => {
      render(<PasswordWidget {...defaultProps} readonly={true} />);
      const input = document.querySelector('input[type="password"]');
      expect(input).toHaveAttribute("readonly");
    });
  });

  describe("错误状态", () => {
    it("有错误时应该显示 danger intent", () => {
      const { container } = render(
        <PasswordWidget {...defaultProps} error="密码错误" />,
      );
      expect(container.querySelector(".bp6-intent-danger")).toBeInTheDocument();
    });
  });

  describe("ref 转发", () => {
    it("应该正确转发 ref", () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<PasswordWidget {...defaultProps} ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });
});

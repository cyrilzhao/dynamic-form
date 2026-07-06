import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TextWidget } from "../TextWidget";

describe("TextWidget", () => {
  const defaultProps = {
    name: "test-field",
  };

  describe("基本渲染", () => {
    it("应该正确渲染输入框", () => {
      render(<TextWidget {...defaultProps} />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("应该设置正确的 name 属性", () => {
      render(<TextWidget {...defaultProps} />);
      expect(screen.getByRole("textbox")).toHaveAttribute("name", "test-field");
    });

    it("应该显示 placeholder", () => {
      render(<TextWidget {...defaultProps} placeholder="请输入内容" />);
      expect(screen.getByPlaceholderText("请输入内容")).toBeInTheDocument();
    });
  });

  describe("禁用和只读状态", () => {
    it("应该支持禁用状态", () => {
      render(<TextWidget {...defaultProps} disabled={true} />);
      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("应该支持只读状态", () => {
      render(<TextWidget {...defaultProps} readonly={true} />);
      expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    });
  });

  describe("错误状态", () => {
    it("有错误时应该显示 danger intent", () => {
      const { container } = render(
        <TextWidget {...defaultProps} error="错误信息" />,
      );
      expect(container.querySelector(".bp6-intent-danger")).toBeInTheDocument();
    });

    it("无错误时不应该有 danger intent", () => {
      const { container } = render(<TextWidget {...defaultProps} />);
      expect(
        container.querySelector(".bp6-intent-danger"),
      ).not.toBeInTheDocument();
    });
  });

  describe("ref 转发", () => {
    it("应该正确转发 ref", () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<TextWidget {...defaultProps} ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });
});

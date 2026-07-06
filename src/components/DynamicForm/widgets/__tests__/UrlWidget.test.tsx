import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UrlWidget } from "../UrlWidget";

describe("UrlWidget", () => {
  const defaultProps = {
    name: "url-field",
  };

  describe("基本渲染", () => {
    it("应该渲染 URL 输入框", () => {
      render(<UrlWidget {...defaultProps} />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("应该设置正确的 type 属性", () => {
      render(<UrlWidget {...defaultProps} />);
      expect(screen.getByRole("textbox")).toHaveAttribute("type", "url");
    });

    it("应该设置正确的 name 属性", () => {
      render(<UrlWidget {...defaultProps} />);
      expect(screen.getByRole("textbox")).toHaveAttribute("name", "url-field");
    });

    it("应该显示默认 placeholder", () => {
      render(<UrlWidget {...defaultProps} />);
      expect(screen.getByPlaceholderText("Enter URL")).toBeInTheDocument();
    });

    it("应该支持自定义 placeholder", () => {
      render(<UrlWidget {...defaultProps} placeholder="请输入网址" />);
      expect(screen.getByPlaceholderText("请输入网址")).toBeInTheDocument();
    });
  });

  describe("禁用和只读状态", () => {
    it("应该支持禁用状态", () => {
      render(<UrlWidget {...defaultProps} disabled={true} />);
      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("应该支持只读状态", () => {
      render(<UrlWidget {...defaultProps} readonly={true} />);
      expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    });
  });

  describe("错误状态", () => {
    it("有错误时应该显示 danger intent", () => {
      const { container } = render(
        <UrlWidget {...defaultProps} error="错误" />,
      );
      expect(container.querySelector(".bp6-intent-danger")).toBeInTheDocument();
    });
  });
});

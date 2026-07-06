import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CheckboxWidget } from "../CheckboxWidget";

describe("CheckboxWidget", () => {
  const defaultProps = {
    name: "checkbox-field",
  };

  describe("基本渲染", () => {
    it("应该渲染复选框", () => {
      render(<CheckboxWidget {...defaultProps} />);
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("应该显示 label", () => {
      render(<CheckboxWidget {...defaultProps} label="同意条款" />);
      expect(screen.getByText("同意条款")).toBeInTheDocument();
    });
  });

  describe("选中状态", () => {
    it("value 为 true 时应该选中", () => {
      render(<CheckboxWidget {...defaultProps} value={true} />);
      expect(screen.getByRole("checkbox")).toBeChecked();
    });

    it("value 为 false 时不应该选中", () => {
      render(<CheckboxWidget {...defaultProps} value={false} />);
      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });
  });

  describe("onChange 回调", () => {
    it("点击时应该触发 onChange", () => {
      const onChange = jest.fn();
      render(<CheckboxWidget {...defaultProps} onChange={onChange} />);
      fireEvent.click(screen.getByRole("checkbox"));
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe("禁用状态", () => {
    it("disabled 时应该禁用", () => {
      render(<CheckboxWidget {...defaultProps} disabled={true} />);
      expect(screen.getByRole("checkbox")).toBeDisabled();
    });

    it("readonly 时应该禁用", () => {
      render(<CheckboxWidget {...defaultProps} readonly={true} />);
      expect(screen.getByRole("checkbox")).toBeDisabled();
    });
  });
});

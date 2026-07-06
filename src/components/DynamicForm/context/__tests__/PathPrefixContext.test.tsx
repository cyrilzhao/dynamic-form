import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  PathPrefixProvider,
  usePathPrefix,
  joinPath,
  removePrefix,
} from "../PathPrefixContext";

describe("PathPrefixContext", () => {
  describe("PathPrefixProvider 和 usePathPrefix", () => {
    const TestComponent: React.FC = () => {
      const prefix = usePathPrefix();
      return <div data-testid="prefix">{prefix || "empty"}</div>;
    };

    it("应该提供默认空字符串前缀", () => {
      render(<TestComponent />);
      expect(screen.getByTestId("prefix")).toHaveTextContent("empty");
    });

    it("应该提供指定的前缀", () => {
      render(
        <PathPrefixProvider prefix="company.details">
          <TestComponent />
        </PathPrefixProvider>,
      );
      expect(screen.getByTestId("prefix")).toHaveTextContent("company.details");
    });

    it("应该支持嵌套 Provider", () => {
      render(
        <PathPrefixProvider prefix="level1">
          <PathPrefixProvider prefix="level1.level2">
            <TestComponent />
          </PathPrefixProvider>
        </PathPrefixProvider>,
      );
      expect(screen.getByTestId("prefix")).toHaveTextContent("level1.level2");
    });
  });

  describe("joinPath", () => {
    it("当前缀为空时，返回字段名", () => {
      expect(joinPath("", "name")).toBe("name");
    });

    it("当字段名为空时，返回前缀", () => {
      expect(joinPath("company", "")).toBe("company");
    });

    it("当两者都有值时，用点号连接", () => {
      expect(joinPath("company", "name")).toBe("company.name");
    });

    it("应该正确处理多级路径", () => {
      expect(joinPath("company.details", "address")).toBe(
        "company.details.address",
      );
    });

    it("当两者都为空时，返回空字符串", () => {
      expect(joinPath("", "")).toBe("");
    });
  });

  describe("removePrefix", () => {
    it("当前缀为空时，返回完整路径", () => {
      expect(removePrefix("company.type", "")).toBe("company.type");
    });

    it("当完整路径为空时，返回空字符串", () => {
      expect(removePrefix("", "company")).toBe("");
    });

    it("当路径以前缀开头时，移除前缀", () => {
      expect(removePrefix("company.type", "company")).toBe("type");
    });

    it("应该正确处理多级前缀", () => {
      expect(removePrefix("company.details.name", "company.details")).toBe(
        "name",
      );
    });

    it("当完整路径等于前缀时，返回空字符串", () => {
      expect(removePrefix("company", "company")).toBe("");
    });

    it("当前缀不匹配时，返回原路径", () => {
      expect(removePrefix("type", "company")).toBe("type");
    });

    it("当前缀是路径的部分但不是完整段时，返回原路径", () => {
      expect(removePrefix("companyName", "company")).toBe("companyName");
    });
  });
});

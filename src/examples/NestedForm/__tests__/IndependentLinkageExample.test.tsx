import React from "react";
import { screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import { IndependentLinkageExample } from "../IndependentLinkageExample";

describe("IndependentLinkageExample", () => {
  it("外部和内部 DynamicForm 挂载后应该分别初始化 visibility 联动状态", async () => {
    render(<IndependentLinkageExample />);

    await waitFor(() => {
      expect(screen.queryByText("Office Location")).not.toBeInTheDocument();
      expect(screen.queryByText("Department Budget")).not.toBeInTheDocument();
      expect(screen.queryByText("Salary Range")).not.toBeInTheDocument();
      expect(screen.queryByText("Manages a Team")).not.toBeInTheDocument();
    });
  });
});

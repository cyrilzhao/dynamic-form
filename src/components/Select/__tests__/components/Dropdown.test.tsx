import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Dropdown } from "../../components/Dropdown";
import type { SelectOption } from "../../types";

describe("Dropdown", () => {
  const mockOptions: SelectOption[] = [
    { label: "Apple", value: "apple" },
    { label: "Banana", value: "banana" },
  ];

  const mockTriggerRef = {
    current: document.createElement("div"),
  };

  beforeEach(() => {
    Object.defineProperty(window, "scrollX", {
      configurable: true,
      value: 20,
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 300,
    });

    // 模拟 getBoundingClientRect
    mockTriggerRef.current.getBoundingClientRect = jest.fn(() => ({
      bottom: 100,
      left: 50,
      width: 200,
      top: 70,
      right: 250,
      height: 30,
      x: 50,
      y: 70,
      toJSON: () => {},
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("关闭时不应该渲染", () => {
    const { container } = render(
      <Dropdown
        isOpen={false}
        options={mockOptions}
        selectedValues={[]}
        onSelect={() => {}}
        triggerRef={mockTriggerRef}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("打开时应该渲染选项", () => {
    render(
      <Dropdown
        isOpen={true}
        options={mockOptions}
        selectedValues={[]}
        onSelect={() => {}}
        triggerRef={mockTriggerRef}
      />,
    );
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  it("应该通过 body portal 使用文档坐标定位下拉菜单", () => {
    render(
      <Dropdown
        isOpen={true}
        options={mockOptions}
        selectedValues={[]}
        onSelect={() => {}}
        triggerRef={mockTriggerRef}
      />,
    );

    const dropdown = document.querySelector(".select-dropdown");

    expect(dropdown?.parentElement).toBe(document.body);
    expect(dropdown).toHaveStyle({
      position: "absolute",
      top: "404px",
      left: "70px",
      width: "200px",
    });
  });

  it("滚动嵌套容器时应该重新对齐下拉菜单", () => {
    const requestAnimationFrameSpy = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });

    render(
      <Dropdown
        isOpen={true}
        options={mockOptions}
        selectedValues={[]}
        onSelect={() => {}}
        triggerRef={mockTriggerRef}
      />,
    );

    mockTriggerRef.current.getBoundingClientRect = jest.fn(() => ({
      bottom: 60,
      left: 35,
      width: 180,
      top: 30,
      right: 215,
      height: 30,
      x: 35,
      y: 30,
      toJSON: () => {},
    }));

    act(() => {
      document.dispatchEvent(new Event("scroll", { bubbles: false }));
    });

    expect(requestAnimationFrameSpy).toHaveBeenCalled();
    expect(document.querySelector(".select-dropdown")).toHaveStyle({
      top: "364px",
      left: "55px",
      width: "180px",
    });
  });

  it("点击选项时应该调用 onSelect", () => {
    const handleSelect = jest.fn();
    render(
      <Dropdown
        isOpen={true}
        options={mockOptions}
        selectedValues={[]}
        onSelect={handleSelect}
        triggerRef={mockTriggerRef}
      />,
    );
    fireEvent.click(screen.getByText("Apple"));
    expect(handleSelect).toHaveBeenCalledWith(mockOptions[0]);
  });

  it("应该高亮选中的选项", () => {
    render(
      <Dropdown
        isOpen={true}
        options={mockOptions}
        selectedValues={["apple"]}
        onSelect={() => {}}
        triggerRef={mockTriggerRef}
      />,
    );
    const selectedOption = document.querySelector(".select-option--selected");
    expect(selectedOption).toHaveTextContent("Apple");
  });
});

import { calculateDropdownPosition } from '../../utils/position';

describe('calculateDropdownPosition', () => {
  describe('向下展开场景', () => {
    it('当下方空间充足时应该向下展开', () => {
      const triggerRect: DOMRect = {
        left: 100,
        top: 100,
        bottom: 150,
        right: 300,
        width: 200,
        height: 50,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      };

      // 模拟窗口高度为 800px，下方空间 = 800 - 150 = 650px
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      });

      const result = calculateDropdownPosition({
        triggerRect,
        dropdownHeight: 200,
        maxHeight: 300,
      });

      expect(result.direction).toBe('down');
      expect(result.top).toBe(150 + 4); // bottom + 4px gap
      expect(result.left).toBe(100);
      expect(result.width).toBe(200);
    });

    it('当下方空间大于 maxHeight 时应该向下展开', () => {
      const triggerRect: DOMRect = {
        left: 50,
        top: 50,
        bottom: 80,
        right: 250,
        width: 200,
        height: 30,
        x: 50,
        y: 50,
        toJSON: () => ({}),
      };

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 500,
      });

      const result = calculateDropdownPosition({
        triggerRect,
        dropdownHeight: 150,
        maxHeight: 300,
      });

      expect(result.direction).toBe('down');
      expect(result.top).toBe(84); // 80 + 4
    });
  });

  describe('向上展开场景', () => {
    it('当下方空间不足且上方空间更大时应该向上展开', () => {
      const triggerRect: DOMRect = {
        left: 100,
        top: 600,
        bottom: 650,
        right: 300,
        width: 200,
        height: 50,
        x: 100,
        y: 600,
        toJSON: () => ({}),
      };

      // 窗口高度 700px
      // 下方空间 = 700 - 650 = 50px
      // 上方空间 = 600px
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 700,
      });

      const result = calculateDropdownPosition({
        triggerRect,
        dropdownHeight: 200,
        maxHeight: 300,
      });

      expect(result.direction).toBe('up');
      // top = triggerRect.top - Math.min(dropdownHeight, maxHeight) - 4
      // top = 600 - 200 - 4 = 396
      expect(result.top).toBe(396);
      expect(result.left).toBe(100);
      expect(result.width).toBe(200);
    });

    it('当下方空间小于 maxHeight 且上方空间更大时应该向上展开', () => {
      const triggerRect: DOMRect = {
        left: 100,
        top: 500,
        bottom: 550,
        right: 300,
        width: 200,
        height: 50,
        x: 100,
        y: 500,
        toJSON: () => ({}),
      };

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      });

      const result = calculateDropdownPosition({
        triggerRect,
        dropdownHeight: 400,
        maxHeight: 300,
      });

      expect(result.direction).toBe('up');
      // top = 500 - min(400, 300) - 4 = 500 - 300 - 4 = 196
      expect(result.top).toBe(196);
    });
  });

  describe('边界条件', () => {
    it('当下拉菜单高度超过 maxHeight 时应该使用 maxHeight', () => {
      const triggerRect: DOMRect = {
        left: 100,
        top: 500,
        bottom: 550,
        right: 300,
        width: 200,
        height: 50,
        x: 100,
        y: 500,
        toJSON: () => ({}),
      };

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      });

      const result = calculateDropdownPosition({
        triggerRect,
        dropdownHeight: 500, // 超过 maxHeight
        maxHeight: 300,
      });

      expect(result.direction).toBe('up');
      // 应该使用 maxHeight 而不是 dropdownHeight
      expect(result.top).toBe(500 - 300 - 4);
    });

    it('当下方空间等于上方空间时应该向下展开', () => {
      const triggerRect: DOMRect = {
        left: 100,
        top: 400,
        bottom: 450,
        right: 300,
        width: 200,
        height: 50,
        x: 100,
        y: 400,
        toJSON: () => ({}),
      };

      // 窗口高度 900px
      // 下方空间 = 900 - 450 = 450px
      // 上方空间 = 400px
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 900,
      });

      const result = calculateDropdownPosition({
        triggerRect,
        dropdownHeight: 200,
        maxHeight: 300,
      });

      // 下方空间 >= 上方空间，应该向下
      expect(result.direction).toBe('down');
    });

    it('应该保持触发器的宽度', () => {
      const triggerRect: DOMRect = {
        left: 50,
        top: 100,
        bottom: 130,
        right: 350,
        width: 300,
        height: 30,
        x: 50,
        y: 100,
        toJSON: () => ({}),
      };

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      });

      const result = calculateDropdownPosition({
        triggerRect,
        dropdownHeight: 200,
        maxHeight: 300,
      });

      expect(result.width).toBe(300);
    });

    it('应该保持触发器的左侧位置', () => {
      const triggerRect: DOMRect = {
        left: 250,
        top: 100,
        bottom: 130,
        right: 450,
        width: 200,
        height: 30,
        x: 250,
        y: 100,
        toJSON: () => ({}),
      };

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      });

      const result = calculateDropdownPosition({
        triggerRect,
        dropdownHeight: 200,
        maxHeight: 300,
      });

      expect(result.left).toBe(250);
    });
  });

  describe('默认参数', () => {
    it('当 maxHeight 未提供时应该使用默认值 300', () => {
      const triggerRect: DOMRect = {
        left: 100,
        top: 500,
        bottom: 550,
        right: 300,
        width: 200,
        height: 50,
        x: 100,
        y: 500,
        toJSON: () => ({}),
      };

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      });

      const result = calculateDropdownPosition({
        triggerRect,
        dropdownHeight: 400,
      });

      expect(result.direction).toBe('up');
      // 应该使用默认的 maxHeight = 300
      expect(result.top).toBe(500 - 300 - 4);
    });
  });

  describe('间隙计算', () => {
    it('向下展开时应该在底部添加 4px 间隙', () => {
      const triggerRect: DOMRect = {
        left: 100,
        top: 100,
        bottom: 150,
        right: 300,
        width: 200,
        height: 50,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      };

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      });

      const result = calculateDropdownPosition({
        triggerRect,
        dropdownHeight: 200,
        maxHeight: 300,
      });

      expect(result.top).toBe(154); // bottom(150) + 4
    });

    it('向上展开时应该在顶部减去 4px 间隙', () => {
      const triggerRect: DOMRect = {
        left: 100,
        top: 600,
        bottom: 650,
        right: 300,
        width: 200,
        height: 50,
        x: 100,
        y: 600,
        toJSON: () => ({}),
      };

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 700,
      });

      const result = calculateDropdownPosition({
        triggerRect,
        dropdownHeight: 200,
        maxHeight: 300,
      });

      // top = 600 - 200 - 4 = 396
      expect(result.top).toBe(396);
    });
  });
});

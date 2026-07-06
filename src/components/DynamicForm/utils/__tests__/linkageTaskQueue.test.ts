import { LinkageTaskQueue } from "../linkageTaskQueue";

describe("LinkageTaskQueue", () => {
  let queue: LinkageTaskQueue;

  beforeEach(() => {
    queue = new LinkageTaskQueue();
  });

  describe("enqueue", () => {
    it("应该将任务添加到队列", () => {
      queue.enqueue("field1", ["field2", "field3"]);
      expect(queue.isEmpty()).toBe(false);
    });

    it("应该合并相同字段的任务", () => {
      queue.enqueue("field1", ["field2"]);
      queue.enqueue("field1", ["field3", "field4"]);

      const status = queue.getStatus();
      expect(status.queueLength).toBe(1);
      expect(status.tasks[0].affectedFields).toEqual(["field3", "field4"]);
    });

    it("应该为不同字段添加独立任务", () => {
      queue.enqueue("field1", ["field2"]);
      queue.enqueue("field3", ["field4"]);

      const status = queue.getStatus();
      expect(status.queueLength).toBe(2);
    });
  });

  describe("dequeue", () => {
    it("应该按 FIFO 顺序取出任务", () => {
      queue.enqueue("field1", ["a"]);
      queue.enqueue("field2", ["b"]);

      const task1 = queue.dequeue();
      expect(task1?.fieldName).toBe("field1");

      const task2 = queue.dequeue();
      expect(task2?.fieldName).toBe("field2");
    });

    it("队列为空时应该返回 undefined", () => {
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  describe("isTaskValid", () => {
    it("应该验证最新任务的 timestamp", () => {
      queue.enqueue("field1", ["a"]);
      const status = queue.getStatus();
      const timestamp = status.tasks[0].timestamp;

      expect(queue.isTaskValid("field1", timestamp)).toBe(true);
    });

    it("旧的 timestamp 应该无效", () => {
      queue.enqueue("field1", ["a"]);
      const oldTimestamp = queue.getStatus().tasks[0].timestamp;

      // 使用 jest.spyOn 模拟不同的时间戳
      const mockNow = jest.spyOn(Date, "now").mockReturnValue(oldTimestamp + 1);
      queue.enqueue("field1", ["b"]);
      mockNow.mockRestore();

      expect(queue.isTaskValid("field1", oldTimestamp)).toBe(false);
    });

    it("不存在的字段应该返回 false", () => {
      expect(queue.isTaskValid("nonexistent", Date.now())).toBe(false);
    });
  });

  describe("isEmpty", () => {
    it("初始状态应该为空", () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it("添加任务后应该不为空", () => {
      queue.enqueue("field1", []);
      expect(queue.isEmpty()).toBe(false);
    });

    it("取出所有任务后应该为空", () => {
      queue.enqueue("field1", []);
      queue.dequeue();
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe("processing 状态", () => {
    it("初始状态应该为 false", () => {
      expect(queue.getProcessing()).toBe(false);
    });

    it("应该能设置和获取处理状态", () => {
      queue.setProcessing(true);
      expect(queue.getProcessing()).toBe(true);

      queue.setProcessing(false);
      expect(queue.getProcessing()).toBe(false);
    });
  });

  describe("updatingForm 状态", () => {
    it("初始状态应该为 false", () => {
      expect(queue.isUpdatingForm()).toBe(false);
    });

    it("应该能设置和获取表单更新状态", () => {
      queue.setUpdatingForm(true);
      expect(queue.isUpdatingForm()).toBe(true);

      queue.setUpdatingForm(false);
      expect(queue.isUpdatingForm()).toBe(false);
    });
  });

  describe("updatingFields 管理", () => {
    it("应该能标记字段正在更新", () => {
      queue.markFieldUpdating("field1");
      expect(queue.isFieldUpdating("field1")).toBe(true);
    });

    it("应该能取消标记字段更新", () => {
      queue.markFieldUpdating("field1");
      queue.unmarkFieldUpdating("field1");
      expect(queue.isFieldUpdating("field1")).toBe(false);
    });

    it("未标记的字段应该返回 false", () => {
      expect(queue.isFieldUpdating("field1")).toBe(false);
    });

    it("应该能清除所有更新标记", () => {
      queue.markFieldUpdating("field1");
      queue.markFieldUpdating("field2");
      queue.clearUpdatingFields();

      expect(queue.isFieldUpdating("field1")).toBe(false);
      expect(queue.isFieldUpdating("field2")).toBe(false);
    });
  });

  describe("clear", () => {
    it("应该清空队列", () => {
      queue.enqueue("field1", ["a"]);
      queue.enqueue("field2", ["b"]);
      queue.clear();

      expect(queue.isEmpty()).toBe(true);
    });

    it("清空后 isTaskValid 应该返回 false", () => {
      queue.enqueue("field1", ["a"]);
      const timestamp = queue.getStatus().tasks[0].timestamp;

      queue.clear();
      expect(queue.isTaskValid("field1", timestamp)).toBe(false);
    });
  });

  describe("getStatus", () => {
    it("应该返回完整的队列状态", () => {
      queue.enqueue("field1", ["a", "b"]);
      queue.setProcessing(true);
      queue.setUpdatingForm(true);

      const status = queue.getStatus();

      expect(status.queueLength).toBe(1);
      expect(status.isProcessing).toBe(true);
      expect(status.isUpdatingForm).toBe(true);
      expect(status.tasks).toHaveLength(1);
      expect(status.tasks[0].fieldName).toBe("field1");
      expect(status.tasks[0].affectedFields).toEqual(["a", "b"]);
    });

    it("返回的 tasks 应该是副本", () => {
      queue.enqueue("field1", ["a"]);
      const status = queue.getStatus();

      status.tasks.push({
        fieldName: "fake",
        timestamp: 0,
        affectedFields: [],
      });

      expect(queue.getStatus().queueLength).toBe(1);
    });
  });
});

/**
 * 循环依赖错误
 */
export class CircularDependencyError extends Error {
  constructor(
    public readonly cycle: string[],
    message?: string
  ) {
    super(message || `检测到循环依赖: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

/**
 * 依赖图检测结果
 */
export interface DependencyGraphValidation {
  /** 是否有效（无循环依赖） */
  isValid: boolean;
  /** 循环依赖路径（如果存在） */
  cycle: string[] | null;
  /** 错误信息 */
  error?: string;
}

/**
 * 依赖图（DAG）管理器
 * 用于优化联动字段的更新顺序和性能
 */
export class DependencyGraph {
  // 依赖关系图：key 是源字段，value 是依赖该字段的目标字段集合
  private graph: Map<string, Set<string>> = new Map();
  // 反向依赖图：key 是目标字段，value 是该字段依赖的源字段集合
  private reverseGraph: Map<string, Set<string>> = new Map();

  /**
   * 添加依赖关系
   * @param target - 目标字段（依赖其他字段的字段）
   * @param source - 源字段（被依赖的字段）
   *
   * @example
   * // total 依赖 price
   * graph.addDependency('total', 'price')
   */
  addDependency(target: string, source: string) {
    // 正向依赖图：source -> target
    if (!this.graph.has(source)) {
      this.graph.set(source, new Set());
    }
    this.graph.get(source)!.add(target);

    // 反向依赖图：target -> source（用于拓扑排序时计算入度）
    if (!this.reverseGraph.has(target)) {
      this.reverseGraph.set(target, new Set());
    }
    this.reverseGraph.get(target)!.add(source);
  }

  /**
   * 获取字段的所有依赖（该字段依赖哪些字段）
   */
  getDependencies(field: string): string[] {
    const deps = this.reverseGraph.get(field);
    return deps ? Array.from(deps) : [];
  }

  /**
   * 获取受影响的字段（拓扑排序）
   * 当某个字段变化时，返回所有需要更新的字段，按依赖顺序排列
   *
   * @param changedField - 变化的字段
   * @returns 受影响的字段列表（按拓扑顺序）
   *
   * @example
   * // price -> total -> discount
   * graph.getAffectedFields('price') // ['total', 'discount']
   */
  getAffectedFields(changedField: string): string[] {
    const affected: string[] = [];
    const visited = new Set<string>();

    const dfs = (field: string) => {
      if (visited.has(field)) return;
      visited.add(field);

      const dependents = this.graph.get(field);
      if (dependents) {
        dependents.forEach(dependent => {
          if (!visited.has(dependent)) {
            affected.push(dependent);
          }
          dfs(dependent);
        });
      }
    };

    dfs(changedField);

    // 跨数组依赖的前缀匹配：
    // 当依赖整个数组（如 'permissions'）时，dep graph 中注册的 source 是 'permissions'，
    // 但 react-hook-form 的 watch 触发的是具体字段路径（如 'permissions.0.isAdmin'），
    // 精确匹配永远找不到。加 source + '.' 前缀检查，确保数组内任何字段变化都能触发
    // 依赖该数组的联动。source + '.' 中的 '.' 防止误匹配 'permissions2' 等无关路径。
    for (const source of this.graph.keys()) {
      if (changedField.startsWith(source + '.')) {
        dfs(source);
      }
    }

    return affected;
  }

  /**
   * 检测循环依赖
   * @param throwOnCycle - 是否在检测到循环时抛出错误
   * @returns 如果存在循环依赖，返回循环路径；否则返回 null
   * @throws CircularDependencyError 如果 throwOnCycle 为 true 且存在循环依赖
   */
  detectCycle(throwOnCycle: boolean = false): string[] | null {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];
    let cycleStart: string | null = null;

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = this.graph.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) return true;
          } else if (recStack.has(neighbor)) {
            // 找到循环，记录循环起点
            cycleStart = neighbor;
            return true;
          }
        }
      }

      recStack.delete(node);
      path.pop();
      return false;
    };

    for (const node of this.graph.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) {
          // 提取完整的循环路径
          // cycleStart 一定在 path 中，因为它是从 recStack 中找到的
          const cycleStartIndex = path.indexOf(cycleStart!);
          const cyclePath = [...path.slice(cycleStartIndex), cycleStart!];

          if (throwOnCycle) {
            throw new CircularDependencyError(cyclePath);
          }
          return cyclePath;
        }
      }
    }

    return null;
  }

  /**
   * 验证依赖图的有效性
   * @returns 验证结果，包含是否有效、循环路径和错误信息
   */
  validate(): DependencyGraphValidation {
    const cycle = this.detectCycle(false);
    if (cycle) {
      return {
        isValid: false,
        cycle,
        error: `检测到循环依赖: ${cycle.join(' -> ')}`,
      };
    }
    return { isValid: true, cycle: null };
  }

  /**
   * 获取所有源字段（被依赖的字段）
   */
  getSources(): string[] {
    return Array.from(this.graph.keys());
  }

  /**
   * 获取字段的直接依赖者
   */
  getDirectDependents(field: string): string[] {
    const dependents = this.graph.get(field);
    return dependents ? Array.from(dependents) : [];
  }

  /**
   * 拓扑排序：返回按依赖顺序排列的字段列表
   * @param fields - 需要排序的字段列表
   * @param options - 排序选项
   * @param options.throwOnCycle - 是否在检测到循环时抛出错误（默认 false）
   * @param options.onCycleDetected - 检测到循环时的回调函数
   * @returns 按拓扑顺序排列的字段列表
   *
   * @example
   * // A -> B -> C
   * graph.topologicalSort(['A', 'B', 'C']) // ['A', 'B', 'C']
   */
  topologicalSort(
    fields: string[],
    options: {
      throwOnCycle?: boolean;
      onCycleDetected?: (cycle: string[]) => void;
    } = {}
  ): string[] {
    const { throwOnCycle = false, onCycleDetected } = options;
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, Set<string>>();

    // 初始化入度和邻接表（只考虑给定的字段）
    const fieldSet = new Set(fields);
    fields.forEach(field => {
      inDegree.set(field, 0);
      adjList.set(field, new Set());
    });

    // 构建邻接表和计算入度
    fields.forEach(field => {
      const dependents = this.graph.get(field);
      if (dependents) {
        dependents.forEach(dependent => {
          // 只考虑在给定字段列表中的依赖关系
          if (fieldSet.has(dependent)) {
            adjList.get(field)!.add(dependent);
            inDegree.set(dependent, (inDegree.get(dependent) || 0) + 1);
          }
        });
      }
    });

    // Kahn 算法进行拓扑排序
    const queue: string[] = [];
    const result: string[] = [];

    // 将所有入度为 0 的节点加入队列
    inDegree.forEach((degree, field) => {
      if (degree === 0) {
        queue.push(field);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      // 减少相邻节点的入度
      // adjList 在初始化时已为所有 fields 创建了 Set，所以这里一定存在
      // neighbors 中的节点都在 fieldSet 中（第 223 行检查），因此 inDegree 一定存在
      const neighbors = adjList.get(current)!;
      neighbors.forEach(neighbor => {
        const newDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      });
    }

    // 检测循环依赖：如果结果数量少于输入数量，说明存在循环
    if (result.length < fields.length) {
      // 找出循环中的节点
      const cycleNodes = fields.filter(f => !result.includes(f));
      const cyclePath = this.findCyclePath(cycleNodes, adjList);

      if (onCycleDetected) {
        onCycleDetected(cyclePath);
      }

      if (throwOnCycle) {
        throw new CircularDependencyError(cyclePath);
      }

      // 返回已排序的节点，循环节点按原顺序追加到末尾
      console.warn('拓扑排序检测到循环依赖:', cyclePath.join(' -> '));
      return [...result, ...cycleNodes];
    }

    return result;
  }

  /**
   * 在给定节点集合中查找循环路径
   */
  private findCyclePath(
    cycleNodes: string[],
    adjList: Map<string, Set<string>>
  ): string[] {
    if (cycleNodes.length === 0) return [];

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];
    let cycleStart: string | null = null;

    const dfs = (node: string): boolean => {
      // node 一定在 cycleNodes 中：
      // 1. 入口点是 for (const node of cycleNodes)
      // 2. 递归调用只在 cycleNodes.includes(neighbor) 时才执行
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = adjList.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (cycleNodes.includes(neighbor)) {
            if (!visited.has(neighbor)) {
              if (dfs(neighbor)) return true;
            } else if (recStack.has(neighbor)) {
              cycleStart = neighbor;
              return true;
            }
          }
        }
      }

      recStack.delete(node);
      path.pop();
      return false;
    };

    for (const node of cycleNodes) {
      if (!visited.has(node)) {
        if (dfs(node)) {
          // cycleStart 一定在 path 中，因为它是从 recStack 中找到的
          const startIdx = path.indexOf(cycleStart!);
          return [...path.slice(startIdx), cycleStart!];
        }
      }
    }

    return cycleNodes;
  }

  /**
   * 获取拓扑层级
   *
   * 返回按依赖层级分组的字段列表（二维数组）
   *
   * 核心保证：
   * 1. 同一层级的字段之间绝对没有依赖关系（可以安全并行）
   * 2. 第 N 层的字段只依赖第 0 到 N-1 层的字段
   * 3. 使用 Kahn 算法的入度计算确保正确性
   *
   * @param fields - 需要分层的字段列表
   * @returns 按层级分组的字段列表
   *
   * @example
   * // 依赖关系：A → B, A → C, B → D, C → D
   * graph.getTopologicalLayers(['A', 'B', 'C', 'D'])
   * // 返回：[['A'], ['B', 'C'], ['D']]
   * // 含义：B 和 C 可以并行，D 必须等待 B 和 C 都完成
   */
  getTopologicalLayers(fields: string[]): string[][] {
    const layers: string[][] = [];
    const inDegree = new Map<string, number>();
    const remaining = new Set(fields);

    // 计算入度（只考虑 fields 中的字段）：
    // 仅统计 fields 内部的依赖关系，忽略来自 fields 外部字段的依赖。
    // 原因：外部字段在此次联动批次中不参与计算，其变化不影响本批次内字段的执行顺序；
    // 若计入外部依赖，某些字段的入度永远不会降为 0，会被误判为循环依赖。
    fields.forEach(field => {
      const deps = this.reverseGraph.get(field) || new Set();
      // 只统计在 fields 中的依赖
      const relevantDeps = Array.from(deps).filter(dep => remaining.has(dep));
      inDegree.set(field, relevantDeps.length);
    });

    // 按层级提取字段（Kahn 算法的变体）
    while (remaining.size > 0) {
      const currentLayer: string[] = [];

      // 找出当前层级的字段（入度为 0 的字段）
      // 入度为 0 意味着：该字段不依赖任何剩余字段
      remaining.forEach(field => {
        if (inDegree.get(field) === 0) {
          currentLayer.push(field);
        }
      });

      if (currentLayer.length === 0) {
        // 存在循环依赖，将剩余字段放入最后一层
        console.warn('[getTopologicalLayers] 检测到循环依赖，剩余字段:', Array.from(remaining));
        layers.push(Array.from(remaining));
        break;
      }

      layers.push(currentLayer);

      // 移除当前层级的字段，并更新剩余字段的入度
      currentLayer.forEach(field => {
        remaining.delete(field);

        // 更新依赖该字段的其他字段的入度
        const dependents = this.graph.get(field);
        if (dependents) {
          dependents.forEach(dependent => {
            // dependent 在 remaining 中意味着它在 fields 中，因此 inDegree 一定存在
            if (remaining.has(dependent)) {
              const currentInDegree = inDegree.get(dependent)!;
              inDegree.set(dependent, currentInDegree - 1);
            }
          });
        }
      });
    }

    return layers;
  }

  /**
   * 清空依赖图
   */
  clear() {
    this.graph.clear();
    this.reverseGraph.clear();
  }
}

import type { ConditionExpression, ConditionOperator } from '../types/linkage';
import { PathResolver } from './pathResolver';

/**
 * 条件表达式求值器
 */
export class ConditionEvaluator {
  /**
   * 求值条件表达式
   */
  static evaluate(
    condition: ConditionExpression,
    formData: Record<string, any>
  ): boolean {
    // 处理逻辑组合 - and
    if ('and' in condition && condition.and) {
      return condition.and.every(c => this.evaluate(c, formData));
    }

    // 处理逻辑组合 - or
    if ('or' in condition && condition.or) {
      return condition.or.some(c => this.evaluate(c, formData));
    }

    // 单条件求值
    if ('field' in condition) {
      const fieldValue = this.getFieldValue(formData, condition.field);
      return this.evaluateOperator(
        fieldValue,
        condition.operator,
        condition.value
      );
    }

    return false;
  }

  /**
   * 获取字段值（支持嵌套路径和 JSON Pointer）
   */
  private static getFieldValue(
    formData: Record<string, any>,
    fieldPath: string
  ): any {
    // 使用 PathResolver 支持 JSON Pointer 格式
    return PathResolver.resolve(fieldPath, formData);
  }

  /**
   * 求值操作符
   */
  private static evaluateOperator(
    fieldValue: any,
    operator: ConditionOperator,
    compareValue: any
  ): boolean {
    switch (operator) {
      case '==':
        return fieldValue === compareValue;

      case '!=':
        return fieldValue !== compareValue;

      case '>':
        return fieldValue > compareValue;

      case '<':
        return fieldValue < compareValue;

      case '>=':
        return fieldValue >= compareValue;

      case '<=':
        return fieldValue <= compareValue;

      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);

      case 'notIn':
        return Array.isArray(compareValue) && !compareValue.includes(fieldValue);

      case 'includes':
        return Array.isArray(fieldValue) && fieldValue.includes(compareValue);

      case 'notIncludes':
        return Array.isArray(fieldValue) && !fieldValue.includes(compareValue);

      case 'isEmpty':
        return (
          fieldValue === null ||
          fieldValue === undefined ||
          fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        );

      case 'isNotEmpty':
        return (
          fieldValue !== null &&
          fieldValue !== undefined &&
          fieldValue !== '' &&
          (!Array.isArray(fieldValue) || fieldValue.length > 0)
        );

      default:
        return false;
    }
  }
}

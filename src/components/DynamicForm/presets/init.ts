import { FieldRegistry } from '../core/FieldRegistry';
import { blueprintPreset } from './blueprint';

/**
 * 初始化默认 Widget 预设
 * 在应用启动时自动调用，设置 Blueprint 为默认预设
 */
let initialized = false;

export function initDefaultPreset() {
  if (!initialized) {
    FieldRegistry.setDefaultPreset(blueprintPreset);
    initialized = true;
  }
}

// 自动初始化
initDefaultPreset();

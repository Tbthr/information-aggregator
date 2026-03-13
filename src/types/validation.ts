/**
 * 类型守卫和验证工具函数
 * 用于安全地检查和提取未知类型值
 */

/**
 * 检查值是否为普通对象（非 null，非数组）
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 检查值是否为数组
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * 检查值是否为字符串
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * 检查值是否为数字
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * 检查值是否为布尔值
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * 安全获取对象中的字符串字段
 */
export function getStringField(obj: Record<string, unknown>, field: string): string | undefined {
  const value = obj[field];
  return isString(value) ? value : undefined;
}

/**
 * 安全获取对象中的数字字段
 */
export function getNumberField(obj: Record<string, unknown>, field: string): number | undefined {
  const value = obj[field];
  return isNumber(value) ? value : undefined;
}

/**
 * 安全获取对象中的布尔字段
 */
export function getBooleanField(obj: Record<string, unknown>, field: string): boolean | undefined {
  const value = obj[field];
  return isBoolean(value) ? value : undefined;
}

/**
 * 安全获取对象中的嵌套对象字段
 */
export function getObjectField(obj: Record<string, unknown>, field: string): Record<string, unknown> | undefined {
  const value = obj[field];
  return isRecord(value) ? value : undefined;
}

/**
 * 安全获取对象中的数组字段
 */
export function getArrayField<T>(obj: Record<string, unknown>, field: string): T[] | undefined {
  const value = obj[field];
  return isArray(value) ? (value as T[]) : undefined;
}

/**
 * 安全获取对象中的字符串数组字段
 */
export function getStringArrayField(obj: Record<string, unknown>, field: string): string[] | undefined {
  const value = obj[field];
  if (!isArray(value)) return undefined;

  const strings = value.filter(isString);
  return strings.length > 0 ? strings : undefined;
}

/**
 * 检查对象是否具有指定的字符串字段
 */
export function hasStringField(obj: Record<string, unknown>, field: string): boolean {
  return isString(obj[field]);
}

/**
 * 检查对象是否具有指定的数字字段
 */
export function hasNumberField(obj: Record<string, unknown>, field: string): boolean {
  return isNumber(obj[field]);
}

/**
 * 要求对象具有指定的字符串字段，否则抛出错误
 */
export function requireStringField(obj: Record<string, unknown>, field: string, context?: string): string {
  const value = obj[field];
  if (!isString(value) || value === "") {
    throw new Error(`${context ? `${context}: ` : ""}Missing or invalid field: ${field}`);
  }
  return value;
}

/**
 * 要求对象具有指定类型的字段，否则抛出错误
 */
export function requireField<T>(
  obj: Record<string, unknown>,
  field: string,
  validator: (value: unknown) => value is T,
  context?: string,
): T {
  const value = obj[field];
  if (!validator(value)) {
    throw new Error(`${context ? `${context}: ` : ""}Missing or invalid field: ${field}`);
  }
  return value;
}

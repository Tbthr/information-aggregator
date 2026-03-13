// src/templates/render.ts

/**
 * 简单模板渲染器
 * 支持 {{variable}} 和 {{nested.property}} 语法
 */

type TemplateData = Record<string, unknown>;

/**
 * 获取嵌套属性的值
 * @example getNestedValue({ a: { b: 1 } }, 'a.b') => 1
 */
function getNestedValue(obj: TemplateData, path: string): unknown {
  const keys = path.split('.');
  let value: unknown = obj;

  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[key];
  }

  return value;
}

/**
 * 渲染模板字符串
 * 将 {{variable}} 替换为对应的值
 *
 * @param template - 模板字符串
 * @param data - 模板数据
 * @returns 渲染后的字符串
 *
 * @example
 * render('Hello {{name}}!', { name: 'World' }) // => 'Hello World!'
 * render('{{user.name}}', { user: { name: 'Alice' } }) // => 'Alice'
 */
export function render(template: string, data: TemplateData): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const key = path.trim();
    const value = getNestedValue(data, key);

    if (value === undefined || value === null) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.join('\n');
    }

    return String(value);
  });
}

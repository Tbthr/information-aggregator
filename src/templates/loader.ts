// src/templates/loader.ts

import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { render } from './render';

const CONFIG_DIR = 'config';
const PROMPTS_DIR = 'prompts';
const VIEWS_DIR = 'views';

/**
 * 模板类型
 */
export type TemplateKind = 'prompt' | 'view';

/**
 * 获取模板目录路径
 */
function getTemplateDir(kind: TemplateKind): string {
  const subdir = kind === 'prompt' ? PROMPTS_DIR : VIEWS_DIR;
  return join(CONFIG_DIR, subdir);
}

/**
 * 检查模板文件是否存在
 */
export async function templateExists(
  kind: TemplateKind,
  name: string
): Promise<boolean> {
  const filePath = join(getTemplateDir(kind), `${name}.md`);
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 加载模板内容
 *
 * @param kind - 模板类型 ('prompt' | 'view')
 * @param name - 模板名称（不含 .md 后缀）
 * @returns 模板内容
 * @throws 如果模板文件不存在
 */
export async function loadTemplate(
  kind: TemplateKind,
  name: string
): Promise<string> {
  const filePath = join(getTemplateDir(kind), `${name}.md`);
  return readFile(filePath, 'utf-8');
}

/**
 * 加载并渲染模板
 *
 * @param kind - 模板类型
 * @param name - 模板名称
 * @param data - 模板数据
 * @returns 渲染后的内容
 */
export async function loadAndRender(
  kind: TemplateKind,
  name: string,
  data: Record<string, unknown>
): Promise<string> {
  const template = await loadTemplate(kind, name);
  return render(template, data);
}

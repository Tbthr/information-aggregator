/**
 * 将 YAML 中的 ${ENV_VAR} 替换为环境变量值
 */
export function resolveEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => {
      return process.env[key] ?? ''
    })
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveEnvVars)
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVars(value)
    }
    return result
  }
  return obj
}

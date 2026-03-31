export function resolveEnvVars<T>(obj: T): T {
  const str = JSON.stringify(obj)
  const resolved = str.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] ?? '')
  return JSON.parse(resolved)
}

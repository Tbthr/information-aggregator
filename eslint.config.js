import js from "@eslint/js";

export default [
  {
    ignores: ["dist/**", "out/**", "*.test.ts", "coverage/**", "node_modules/**"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: js.Configs?.typescript ?? js.Configs.recommended,
      sourceType: "module",
    },
    rules: {
      // TypeScript 相关
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",

      // 代码质量
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }],
      "prefer-const": "warn",
      "no-var": "error",

      // 最佳实践
      "eqeqeq": "warn",
      "no-throw-literal": "error",
    },
  },
];

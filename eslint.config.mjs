import nextConfig from "eslint-config-next";
import nextTypeScriptConfig from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextConfig,
  ...nextTypeScriptConfig,
  {
    rules: {
      // Allow necessary suppressions only
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    },
  },
];

export default eslintConfig;

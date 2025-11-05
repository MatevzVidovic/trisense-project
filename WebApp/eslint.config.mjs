  // WebApp/eslint.config.mjs
  import js from "@eslint/js";

  export default [
    { ignores: ["node_modules/**"] },
    js.configs.recommended,
    {
      files: ["static/**/*.js"],
      languageOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        globals: {
          window: "readonly",
          document: "readonly",
          console: "readonly",
          fetch: "readonly",
          devicePixelRatio: "readonly"
        }
      },
      rules: {
        indent: ["error", 2],
        semi: ["error", "always"],
        quotes: ["error", "double"],
        "no-trailing-spaces": "error"
      }
    }
  ];
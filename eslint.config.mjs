import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma's generated client is build output, not source we write.
    "lib/generated/**",
  ]),

  /**
   * The type-aware layer. `eslint-config-next` brings 86 rules but none of them
   * can see types, which leaves the failure this project is most exposed to
   * completely uncaught: a dropped `await`. This codebase awaits
   * `posthog.flush()` before a route handler tears down and drives model
   * answers through async generators, so a forgotten await does not throw, it
   * silently loses an event or truncates a stream. Only a type-aware rule can
   * see that.
   */
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // A warning never fails anything, and this project's rule is to fix
      // whatever fails. Underscore-prefixed names stay deliberately unused.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Reassigning a parameter is the most common way shared mutable state
      // sneaks back into functions that read as pure.
      "no-param-reassign": ["error", { props: true }],
      // `import type` keeps type-only imports out of the emitted bundle.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },

  /**
   * Config files run in Node, outside the app's own type project, and are
   * allowed the CommonJS globals (`__dirname`) that the app itself is not.
   */
  {
    files: ["*.config.mjs", "*.config.ts", "prisma.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },

  /**
   * Last, so it wins. This turns off every ESLint rule that only concerns
   * formatting, because Prettier owns that entirely. Without it the two tools
   * disagree and a file can never satisfy both at once.
   */
  eslintConfigPrettier,
]);

export default eslintConfig;

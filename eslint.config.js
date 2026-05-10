import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        game: 'readonly',
        ui: 'readonly',
        canvas: 'readonly',
        foundry: 'readonly',
        Hooks: 'readonly',
        Application: 'readonly',
        Dialog: 'readonly',
        CONFIG: 'readonly',
        CONST: 'readonly',
        console: 'readonly'
      }
    }
  }
];

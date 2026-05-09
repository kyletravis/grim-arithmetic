import js from '@eslint/js';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      },
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
    },
    rules: {
      'no-unused-vars': 'off'
    }
  }
];

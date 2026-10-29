import { defineConfig } from 'vitest/config';

// Testes unitários (rotas de servidor da assinatura remota, com a Lara mockada).
// Os testes de ponta a ponta ficam no Playwright (playwright.config.ts).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});

import { defineConfig } from '@playwright/test';

/**
 * Testes de ponta a ponta da assinatura remota (/assinar), contra uma Lara
 * FALSA (tests/e2e/lara-falsa.mjs). O `next dev` sobe com a URL e o token
 * apontados para ela: as variáveis passadas aqui têm prioridade sobre o .env,
 * então nenhum teste alcança a Lara de verdade.
 *
 * Câmera: o Chromium usa um dispositivo falso (`--use-fake-device-for-media-stream`).
 * X-Real-IP: simula o header que o nginx põe na frente do site.
 */

const PORTA_SITE = 3100;
const PORTA_LARA = 4010;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // a Lara falsa tem um estado só
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORTA_SITE}`,
    viewport: { width: 360, height: 740 },
    hasTouch: false,
    permissions: ['camera'],
    extraHTTPHeaders: { 'X-Real-IP': '203.0.113.7' },
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  webServer: [
    {
      command: 'node tests/e2e/lara-falsa.mjs',
      url: `http://127.0.0.1:${PORTA_LARA}/__saude`,
      env: { LARA_FALSA_PORTA: String(PORTA_LARA) },
      reuseExistingServer: false,
    },
    {
      command: `npx next dev -p ${PORTA_SITE} -H 127.0.0.1`,
      url: `http://127.0.0.1:${PORTA_SITE}/assinar`,
      env: {
        INTERNAL_LARA_API_URL: `http://127.0.0.1:${PORTA_LARA}`,
        LARA_SIGNATURE_API_TOKEN: 'token-teste',
        NEXT_PUBLIC_BASE_PATH: '',
      },
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
});

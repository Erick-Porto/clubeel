/**
 * Carga sob demanda do PDF.js, só no navegador e só na etapa de leitura.
 *
 * Build `legacy`: inclui os polyfills para navegadores de celular mais antigos,
 * comuns no público do clube. O worker é empacotado pelo próprio Next (padrão
 * `new Worker(new URL(...))`) e servido do mesmo site, com o basePath — nada
 * vem de CDN.
 */

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let carga: Promise<PdfJs> | null = null;

export function carregarPdfJs(): Promise<PdfJs> {
  if (!carga) {
    carga = import('pdfjs-dist/legacy/build/pdf.mjs')
      .then((pdfjs) => {
        if (!pdfjs.GlobalWorkerOptions.workerPort) {
          pdfjs.GlobalWorkerOptions.workerPort = new Worker(
            new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url),
            { type: 'module' }
          );
        }
        return pdfjs;
      })
      .catch((erro) => {
        carga = null; // permite tentar de novo
        throw erro;
      });
  }
  return carga;
}

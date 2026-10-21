/**
 * robots.txt do site.
 *
 * Só existe para tirar a assinatura remota dos buscadores (as páginas dela
 * também vão com `noindex` e `X-Robots-Tag`). O robots.txt só vale na raiz do
 * domínio, servida pela instância de produção; por isso o caminho da
 * homologação (/homolog/assinar) entra aqui também.
 */

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: ['/assinar', '/homolog/assinar'] },
  };
}

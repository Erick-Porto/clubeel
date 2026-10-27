/**
 * robots.txt do site.
 *
 * Só existe para tirar dos buscadores as páginas abertas por link de e-mail: a
 * assinatura remota e o pedido de ingresso do não sócio (as páginas também vão
 * com `X-Robots-Tag`). O robots.txt só vale na raiz do domínio, servida pela
 * instância de produção; por isso os caminhos da homologação (/homolog/…)
 * entram aqui também.
 */

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: ['/assinar', '/homolog/assinar', '/ingressos/pedido', '/homolog/ingressos/pedido'],
    },
  };
}

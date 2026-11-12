import { EM_HOMOLOGACAO } from "./base-path";

/**
 * Módulos ainda não liberados em produção.
 *
 * Produção e homologação compilam o mesmo código: a homologação (compilada com
 * `NEXT_PUBLIC_BASE_PATH=/homolog`) mostra tudo; produção esconde estes. Para
 * ver tudo fora da homologação (ex.: no `npm run dev`), compile com
 * `NEXT_PUBLIC_MODULOS_EXTRAS=1`.
 *
 * Só some a entrada (menu, cartões, atalhos, avisos): as páginas e o proxy
 * continuam no ar para quem tiver o endereço — decisão do clube na liberação
 * de 2026-10-29. Para liberar um módulo, basta tirá-lo da lista.
 *
 * Eventos (chaves `ingressos` e `torneios`) foi liberado em 2026-11-04.
 * `painel` (dashboards do administrador) entrou em 2026-11-12: some só o link
 * do menu do usuário.
 */
const OCULTOS_EM_PRODUCAO = ["social", "painel"];

const MOSTRAR_TUDO = EM_HOMOLOGACAO || process.env.NEXT_PUBLIC_MODULOS_EXTRAS === "1";

/** Se o módulo (chave do `Area`, ui.tsx) aparece nesta instância. */
export function moduloVisivel(modulo: string): boolean {
    return MOSTRAR_TUDO || !OCULTOS_EM_PRODUCAO.includes(modulo);
}

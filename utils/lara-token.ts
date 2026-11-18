/**
 * Recusa do token da APLICAÇÃO (`INTERNAL_LARA_API_TOKEN`) pela Lara.
 *
 * Desde 17/11/2026 a Lara emite um token por instalação (produção e
 * homologação diferentes), com escopo `site` e validade. Quando ele está
 * errado, vencido, revogado ou sem o escopo, a Lara responde 401/403 com uma
 * destas mensagens. Isso é erro de CONFIGURAÇÃO do servidor, não do sócio:
 * não pode virar "sessão expirada" (o cliente faria signOut), "senha errada"
 * nem "seu acesso venceu". Quem recebe registra no log do servidor (sem o
 * token) e devolve 503 com a mensagem genérica de indisponibilidade.
 *
 * O 401 do `Session` do sócio tem outra mensagem e continua passando direto.
 */

const RECUSAS_DO_TOKEN = new Map<string, string>([
    ['Invalid API Token', 'token errado, ausente ou o antigo já desligado'],
    ['Token revogado, vencido ou de integração desativada', 'token vencido ou revogado — a TI precisa gerar outro'],
    ['Este token não tem acesso a esta API', 'token sem o escopo "site" — confira a variável'],
]);

export const MENSAGEM_LARA_INDISPONIVEL = 'Não foi possível falar com o servidor. Tente de novo em instantes.';

/** Corpo devolvido ao navegador no lugar da recusa do token. */
export const RESPOSTA_LARA_INDISPONIVEL = { message: MENSAGEM_LARA_INDISPONIVEL, reason: 'unavailable' };

/** Diagnóstico para o log se a resposta for recusa do token da aplicação; `null` caso contrário. */
export function recusaDoTokenDaLara(status: number, corpo: unknown): string | null {
    if (status !== 401 && status !== 403) return null;
    if (!corpo || typeof corpo !== 'object') return null;
    const { message, error } = corpo as Record<string, unknown>;
    const texto = typeof message === 'string' ? message : typeof error === 'string' ? error : null;
    const motivo = texto ? RECUSAS_DO_TOKEN.get(texto) : undefined;
    if (!motivo) return null;
    return `${status} "${texto}" (${motivo})`;
}

/** Loga a recusa (só status, mensagem e rota; nunca o token). */
export function logarRecusaDoToken(origem: string, rota: string, diagnostico: string): void {
    console.error(`[${origem}] A Lara recusou INTERNAL_LARA_API_TOKEN em ${rota}: ${diagnostico}`);
}

/**
 * Tipos compartilhados entre servidor e cliente nesta área.
 *
 * Vivem fora de `actions.ts` porque um arquivo `'use server'` só pode exportar
 * funções assíncronas — um `interface` ali quebra a verificação do Next mesmo
 * sendo apagado na compilação.
 */

import type { Aprovacao } from '../../services/aprovacao-api';

export interface EstadoLogin {
  erro: string | null;
}

export interface EstadoDecisao {
  /** Mensagem de recusa da API (422) ou de falha, exibida como veio. */
  erro: string | null;
  /**
   * Presente só quando a decisão foi aceita. `resultado` é o estado do
   * PROCESSO, não da decisão isolada — a diferença entre "fiz a minha parte" e
   * "a compra está liberada".
   */
  decidido: {
    resultado: string;
    gravado_no_questor: boolean;
    aprovacao: Aprovacao | null;
  } | null;
}

/**
 * Cache em memória (janela curta) do valor já validado no servidor para uma
 * transação em criação. Existe para que `success.ts` NAO precise recalcular
 * o valor esperado uma segunda vez (nova ida a rede na API Lara) so para
 * confirmar algo que `payment_methods.ts` ja validou segundos antes -- essa
 * segunda chamada era uma fonte de lentidao extra (risco de expirar o hold
 * do agendamento) e de falso-positivo de "valor divergente".
 *
 * Adequado para uma unica instancia (PM2 single process), mesmo modelo do
 * rate-limit.ts. Para escala horizontal, migrar para um store compartilhado
 * (Redis).
 */

export interface PendingPayment {
  userId: string | number;
  scheduleIds: Array<number | string>;
  amountCents: number;
  method: string;
  createdAt: number;
}

// Generosa o suficiente para cobrir a confirmacao (normalmente quase
// instantanea); mesma ordem de grandeza da janela do QR Pix (30 min).
const TTL_MS = 30 * 60 * 1000;

const store = new Map<string, PendingPayment>();

function prune(now: number) {
  if (store.size < 5000) return;
  for (const [key, entry] of store) {
    if (now - entry.createdAt > TTL_MS) store.delete(key);
  }
}

export function savePendingPayment(reference: string, data: PendingPayment): void {
  prune(Date.now());
  store.set(reference, data);
}

/**
 * Consome (le e remove) o registro pendente. A remocao evita reuso da mesma
 * referencia para confirmar o agendamento mais de uma vez.
 */
export function takePendingPayment(reference: string | undefined): PendingPayment | undefined {
  if (!reference) return undefined;
  const entry = store.get(reference);
  if (!entry) return undefined;
  store.delete(reference);
  if (Date.now() - entry.createdAt > TTL_MS) return undefined;
  return entry;
}

/**
 * Helpers da API interna (Lara). O ponto crítico aqui é computeAmountInCents:
 * o valor de uma cobrança NUNCA deve vir do cliente — é recalculado no servidor
 * a partir dos agendamentos pendentes do próprio usuário.
 */

const INTERNAL_API = process.env.INTERNAL_LARA_API_URL;
const APP_TOKEN = process.env.INTERNAL_LARA_API_TOKEN;

interface ScheduleRow {
  id?: unknown;
  status_id?: unknown;
  status?: unknown;
  price?: unknown;
}

// A API interna às vezes devolve o array de agendamentos aninhado em
// propriedades variadas; esta extração espelha a usada no CartContext.
function extractArray(raw: unknown): ScheduleRow[] {
  if (Array.isArray(raw)) return raw as ScheduleRow[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as ScheduleRow[];
    if (Array.isArray(obj.pending)) return obj.pending as ScheduleRow[];
    const found = Object.values(obj).find((v) => Array.isArray(v));
    return (found as ScheduleRow[]) || [];
  }
  return [];
}

/**
 * Recalcula, no servidor, o valor total (em centavos) dos agendamentos
 * informados. Valida que todos pertencem ao usuário e estão pendentes de
 * pagamento (status_id === 3). Lança erro se algo não bater.
 */
export async function computeAmountInCents(
  scheduleIds: Array<number | string>,
  userId: string | number,
  sessionToken: string
): Promise<number> {
  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    throw new Error('Nenhum agendamento informado.');
  }

  const res = await fetch(
    `${INTERNAL_API}/api/schedule/member/${encodeURIComponent(String(userId))}/`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${APP_TOKEN}`,
        Session: sessionToken,
      },
    }
  );

  if (!res.ok) throw new Error(`Falha ao carregar agendamentos (${res.status}).`);

  const schedules = extractArray(await res.json());
  const wanted = new Set(scheduleIds.map((id) => String(id)));
  const matched = schedules.filter((s) => wanted.has(String(s.id)));

  // Todo id solicitado precisa existir entre os agendamentos do usuário.
  if (matched.length !== wanted.size) {
    throw new Error('Um ou mais agendamentos não pertencem ao usuário.');
  }

  let totalReais = 0;
  for (const s of matched) {
    const status = String(s.status_id ?? s.status ?? '');
    if (status !== '3') {
      throw new Error('Agendamento não está pendente de pagamento.');
    }
    const price = Number(s.price) || 0;
    if (price <= 0) throw new Error('Preço inválido no agendamento.');
    totalReais += price;
  }

  const cents = Math.round(totalReais * 100);
  if (cents <= 0) throw new Error('Valor total inválido.');
  return cents;
}

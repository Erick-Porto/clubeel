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

/**
 * Cobrança de uma reserva de ESPAÇO SOCIAL (churrasqueira, salão).
 *
 * Não passa por computeAmountInCents: a reserva social não é um agendamento
 * pendente de carrinho (status 3) e o preço dela não é a soma dos `price` —
 * é o `total` que a Lara calculou (diária + extras + bebidas − desconto),
 * com os preços congelados na pré-reserva.
 *
 * A reserva é lida com o Session do sócio, então reserva de outro sócio dá
 * 404 aqui. Só cobra o que a Lara diz que pode ser pago agora (`can_pay`, que
 * já embute estágio `awaiting_payment` e prazo `payment_due_at`). A Lara
 * confere de novo no `schedule/payment` (`paid_amount` = `total`).
 */
export interface SocialCharge {
  bookingId: number;
  scheduleId: number;
  amountCents: number;
}

export async function computeSocialBookingCharge(
  bookingId: number | string,
  sessionToken: string
): Promise<SocialCharge> {
  const id = Number(bookingId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Reserva inválida.');

  const res = await fetch(`${INTERNAL_API}/api/social/bookings/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${APP_TOKEN}`,
      Session: sessionToken,
    },
  });

  if (!res.ok) throw new Error(`Falha ao carregar a reserva (${res.status}).`);

  const raw = (await res.json()) as Record<string, unknown>;
  // Mesmo tratamento de envelope do cliente (services/social-api.ts).
  const booking = (
    raw && typeof raw.booking === 'object' && raw.booking
      ? raw.booking
      : raw && typeof raw.data === 'object' && raw.data && !Array.isArray(raw.data)
        ? raw.data
        : raw
  ) as Record<string, unknown>;

  if (booking.can_pay !== true || booking.stage !== 'awaiting_payment') {
    throw new Error('Esta reserva não está liberada para pagamento.');
  }

  const scheduleId = Number(booking.schedule_id);
  if (!Number.isInteger(scheduleId) || scheduleId <= 0) {
    throw new Error('Reserva sem agendamento associado.');
  }

  const cents = Math.round(Number(booking.total) * 100);
  if (!Number.isFinite(cents) || cents <= 0) throw new Error('Valor total inválido.');

  return { bookingId: id, scheduleId, amountCents: cents };
}

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

/**
 * O que se queria cobrar já está pago — tipicamente uma baixa manual da
 * secretaria (dinheiro, Pix direto ao clube, maquininha) feita enquanto o
 * sócio estava no checkout. Não é falha do cartão: quem recebe este erro não
 * cobra (ou estorna o que cobrou) e manda a tela reler o estado.
 */
export class AlreadyPaidError extends Error {
  constructor(message = 'Já pago por outro caminho.') {
    super(message);
    this.name = 'AlreadyPaidError';
  }
}

/** Status de agendamento confirmado/pago (1, e 2 também tratado como confirmado). */
const PAID_STATUSES = new Set(['1', '2']);

function laraHeaders(sessionToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${APP_TOKEN}`,
    Session: sessionToken,
  };
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

function scheduleStatus(row: ScheduleRow): string {
  return String(row.status_id ?? row.status ?? '');
}

/** Agendamentos do sócio pedidos, lidos na Lara com o Session dele. */
async function fetchMemberSchedules(
  scheduleIds: Array<number | string>,
  userId: string | number,
  sessionToken: string
): Promise<{ wanted: Set<string>; matched: ScheduleRow[] }> {
  const res = await fetch(
    `${INTERNAL_API}/api/schedule/member/${encodeURIComponent(String(userId))}/`,
    { method: 'GET', headers: laraHeaders(sessionToken) }
  );

  if (!res.ok) throw new Error(`Falha ao carregar agendamentos (${res.status}).`);

  const schedules = extractArray(await res.json());
  const wanted = new Set(scheduleIds.map((id) => String(id)));
  return { wanted, matched: schedules.filter((s) => wanted.has(String(s.id))) };
}

/**
 * Recalcula, no servidor, o valor total (em centavos) dos agendamentos
 * informados. Valida que todos pertencem ao usuário e estão pendentes de
 * pagamento (status_id === 3). Lança erro se algo não bater — e
 * AlreadyPaidError se algum já foi confirmado (baixa manual da secretaria).
 */
export async function computeAmountInCents(
  scheduleIds: Array<number | string>,
  userId: string | number,
  sessionToken: string
): Promise<number> {
  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    throw new Error('Nenhum agendamento informado.');
  }

  const { wanted, matched } = await fetchMemberSchedules(scheduleIds, userId, sessionToken);

  // Todo id solicitado precisa existir entre os agendamentos do usuário.
  if (matched.length !== wanted.size) {
    throw new Error('Um ou mais agendamentos não pertencem ao usuário.');
  }

  if (matched.some((s) => PAID_STATUSES.has(scheduleStatus(s)))) {
    throw new AlreadyPaidError('Um ou mais agendamentos já foram pagos.');
  }

  let totalReais = 0;
  for (const s of matched) {
    if (scheduleStatus(s) !== '3') {
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
 * Depois de a Lara recusar o `schedule/payment` de quadras: os agendamentos
 * estão todos confirmados? Se sim, foi baixa manual (ou outro pagamento) — e
 * não "hold expirado". Decide pelo estado, não pelo texto da recusa. Erro na
 * leitura conta como "não".
 */
export async function schedulesArePaid(
  scheduleIds: Array<number | string>,
  userId: string | number,
  sessionToken: string
): Promise<boolean> {
  try {
    const { wanted, matched } = await fetchMemberSchedules(scheduleIds, userId, sessionToken);
    return matched.length === wanted.size && matched.every((s) => PAID_STATUSES.has(scheduleStatus(s)));
  } catch {
    return false;
  }
}

/** Reserva social lida com o Session do sócio (de outro sócio = 404). */
async function fetchSocialBooking(id: number, sessionToken: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${INTERNAL_API}/api/social/bookings/${id}`, {
    method: 'GET',
    headers: laraHeaders(sessionToken),
  });

  if (!res.ok) throw new Error(`Falha ao carregar a reserva (${res.status}).`);

  const raw = (await res.json()) as Record<string, unknown>;
  // Mesmo tratamento de envelope do cliente (services/social-api.ts).
  return (
    raw && typeof raw.booking === 'object' && raw.booking
      ? raw.booking
      : raw && typeof raw.data === 'object' && raw.data && !Array.isArray(raw.data)
        ? raw.data
        : raw
  ) as Record<string, unknown>;
}

/** Já há pagamento registrado (Rede ou baixa manual)? */
function socialIsPaid(booking: Record<string, unknown>): boolean {
  return (booking.payment !== null && typeof booking.payment === 'object') || booking.stage === 'confirmed';
}

/**
 * Cobrança de uma reserva de ESPAÇO SOCIAL (churrasqueira, salão).
 *
 * Não passa por computeAmountInCents: a reserva social não é um agendamento
 * pendente de carrinho (status 3) e o preço dela não é a soma dos `price` —
 * é o `total` que a Lara calculou (diária + extras + itens − desconto),
 * com os preços congelados na pré-reserva.
 *
 * A reserva é lida com o Session do sócio, então reserva de outro sócio dá
 * 404 aqui. Só cobra o que a Lara diz que pode ser pago agora (`can_pay`, que
 * já embute estágio `awaiting_payment` e prazo `payment_due_at`). A Lara
 * confere de novo no `schedule/payment` (`paid_amount` = `total`). Reserva
 * que já tem `payment` (baixa manual da secretaria) → AlreadyPaidError.
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

  const booking = await fetchSocialBooking(id, sessionToken);

  if (socialIsPaid(booking)) {
    throw new AlreadyPaidError('Esta reserva já está paga.');
  }

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

/**
 * Depois de a Lara recusar o pagamento de uma reserva social sem `reason`
 * (o 409 de "já foram pagos"): a reserva tem pagamento registrado agora?
 * Erro na leitura conta como "não".
 */
export async function socialBookingIsPaid(bookingId: number, sessionToken: string): Promise<boolean> {
  try {
    return socialIsPaid(await fetchSocialBooking(bookingId, sessionToken));
  } catch {
    return false;
  }
}

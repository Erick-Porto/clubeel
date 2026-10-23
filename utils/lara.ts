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

/* -------------------------------------------------------------------------- */
/* Torneios                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Recusa ANTES de cobrar, com o código da Lara (`category_full`,
 * `registration_closed`, `invalid_status`): nada foi à eRede, e a tela relê as
 * inscrições como faria com a recusa da própria Lara.
 */
export class TournamentChargeRefusal extends Error {
  readonly reason: string;
  constructor(reason: string, message: string) {
    super(message);
    this.name = 'TournamentChargeRefusal';
    this.reason = reason;
  }
}

export interface TournamentCharge {
  registrationIds: number[];
  amountCents: number;
}

type LaraObj = Record<string, unknown>;

function laraObj(raw: unknown): LaraObj {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as LaraObj) : {};
}

/** Inscrições do sócio dono do Session (`GET tournaments/my-registrations`). */
async function fetchTournamentRegistrations(sessionToken: string): Promise<LaraObj[]> {
  const res = await fetch(`${INTERNAL_API}/api/tournaments/my-registrations`, {
    method: 'GET',
    headers: laraHeaders(sessionToken),
  });
  if (!res.ok) throw new Error(`Falha ao carregar as inscrições (${res.status}).`);
  return (extractArray(await res.json()) as unknown[]).map(laraObj);
}

function registrationTournamentId(registration: LaraObj): number {
  return Number(laraObj(registration.tournament).id);
}

function registrationCategoryId(registration: LaraObj): number {
  return Number(laraObj(registration.category).id);
}

/**
 * Cobrança de inscrições de TORNEIO (uma ou várias, pagas juntas).
 *
 * O valor é a soma dos `amount` das inscrições lidas na Lara com o Session do
 * sócio — inscrição de outro sócio nem aparece na lista, então não passa. Só
 * entra o que está `pending_payment`; já paga (inclusive na secretaria) →
 * AlreadyPaidError.
 *
 * As vagas são de quem PAGA primeiro: a inscrição não segura vaga. Por isso,
 * antes de mandar o cartão para a eRede, o torneio é relido para conferir que
 * o período de inscrição segue aberto e que cada categoria ainda tem vaga — é
 * o que o contrato da Lara pede ("cobre na eRede só depois de conferir a
 * vaga"). A Lara confere tudo de novo no `tournaments/payment`; se recusar
 * depois da cobrança, o success.ts estorna.
 */
export async function computeTournamentCharge(
  registrationIds: unknown,
  sessionToken: string
): Promise<TournamentCharge> {
  if (!Array.isArray(registrationIds) || registrationIds.length === 0 || registrationIds.length > 50) {
    throw new Error('Nenhuma inscrição informada.');
  }
  const ids = [...new Set(registrationIds.map((id) => Number(id)))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error('Inscrição inválida.');

  const all = await fetchTournamentRegistrations(sessionToken);
  const byId = new Map(all.map((registration) => [Number(registration.id), registration]));
  const wanted = ids.map((id) => byId.get(id));
  if (wanted.some((registration) => !registration)) {
    throw new TournamentChargeRefusal('not_owner', 'Inscrição não encontrada.');
  }
  const registrations = wanted as LaraObj[];

  if (registrations.some((registration) => registration.status === 'paid')) {
    throw new AlreadyPaidError('Uma ou mais inscrições já estão pagas.');
  }
  if (registrations.some((registration) => registration.status !== 'pending_payment')) {
    throw new TournamentChargeRefusal('invalid_status', 'Uma ou mais inscrições não estão aguardando pagamento.');
  }

  // Vaga e período: relê cada torneio envolvido (normalmente um só).
  const tournamentIds = [...new Set(registrations.map(registrationTournamentId))];
  for (const tournamentId of tournamentIds) {
    if (!Number.isInteger(tournamentId) || tournamentId <= 0) throw new Error('Inscrição sem torneio.');
    const res = await fetch(`${INTERNAL_API}/api/tournaments/${tournamentId}`, {
      method: 'GET',
      headers: laraHeaders(sessionToken),
    });
    if (!res.ok) throw new Error(`Falha ao carregar o torneio (${res.status}).`);
    const raw = laraObj(await res.json());
    const tournament = laraObj(raw.tournament ?? raw.data ?? raw);

    if (tournament.registration_open !== true) {
      throw new TournamentChargeRefusal('registration_closed', 'O período de inscrição deste torneio terminou.');
    }

    const categories = (extractArray(tournament.categories) as unknown[]).map(laraObj);
    for (const registration of registrations.filter((r) => registrationTournamentId(r) === tournamentId)) {
      const category = categories.find((c) => Number(c.id) === registrationCategoryId(registration));
      if (!category) throw new TournamentChargeRefusal('category_not_found', 'Categoria não encontrada no torneio.');
      // `null` = sem limite de vagas.
      const left = category.vacancies_left;
      if (left !== null && left !== undefined && Number(left) <= 0) {
        const name = category.name ? ` ${String(category.name)}` : '';
        throw new TournamentChargeRefusal('category_full', `As vagas da categoria${name} acabaram.`);
      }
    }
  }

  const totalReais = registrations.reduce((sum, registration) => sum + (Number(registration.amount) || 0), 0);
  const cents = Math.round(totalReais * 100);
  if (!Number.isFinite(cents) || cents <= 0) throw new Error('Valor total inválido.');

  return { registrationIds: ids, amountCents: cents };
}

/**
 * Depois de a Lara recusar (ou de a resposta se perder): as inscrições estão
 * todas pagas agora, e por onde? `manual` = alguma foi paga na secretaria
 * (`payment.manual`). Decide pelo estado, não pelo texto. Erro na leitura
 * conta como "não pagas".
 */
export async function tournamentPaymentState(
  registrationIds: number[],
  sessionToken: string
): Promise<{ allPaid: boolean; manual: boolean }> {
  try {
    const all = await fetchTournamentRegistrations(sessionToken);
    const byId = new Map(all.map((registration) => [Number(registration.id), registration]));
    const wanted = registrationIds.map((id) => byId.get(id));
    const allPaid = wanted.length > 0 && wanted.every((registration) => registration?.status === 'paid');
    const manual = wanted.some((registration) => laraObj(registration?.payment).manual === true);
    return { allPaid, manual };
  } catch {
    return { allPaid: false, manual: false };
  }
}

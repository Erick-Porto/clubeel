"use client";

/**
 * Minhas inscrições em torneios (sócio logado; no matcher do middleware).
 *
 * - Convites de time recebidos: aceitar (se a pessoa ainda não estava inscrita
 *   na categoria, a inscrição nasce ali, aguardando pagamento — e a tela leva
 *   direto ao pagamento) ou recusar.
 * - Cada inscrição com a situação da Lara (`status_label`), o time e as ações:
 *   pagar enquanto `pending_payment` (até o fim das inscrições), desistir só
 *   antes de pagar (paga: fala com a organização), criar o time numa categoria
 *   de capitão.
 *
 * Como o time se forma (`team_formation`) não vem na inscrição: sai do detalhe
 * de cada torneio, lido junto. Depois de cada ação tudo é relido.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCheck,
    faCircleExclamation,
    faCreditCard,
    faEnvelopeOpenText,
    faMagnifyingGlass,
    faPeopleGroup,
    faPlus,
    faRotateRight,
    faTrophy,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../../styles/page.module.css";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/tournament.module.css";
import Header from "../../components/Common/header";
import Footer from "../../components/Common/footer";
import { Loading, LoadingScreen } from "../../components/Common/loading";
import ReplayNotice from "../../components/Replay/ReplayNotice";
import SocialFlashBox from "../../components/Social/SocialFlashBox";
import { TournamentCover } from "../../components/UI/covers";
import { PageHeader, Pill, SearchBar, matchesSearch } from "../../components/UI/ui";
import TournamentPaymentPanel from "../../components/Tournament/TournamentPaymentPanel";
import type { SocialPaymentOutcome } from "../../components/Checkout/CheckoutPayment";
import {
    acceptInvite,
    createTeam,
    declineInvite,
    fetchMyInvites,
    fetchMyRegistrations,
    fetchMyTeams,
    fetchTournament,
    withdrawRegistration,
    type MyTeam,
    type TeamInvite,
    type Tournament,
    type TournamentFailure,
    type TournamentRegistration,
} from "../../../services/tournament-api";
import {
    formatBRL,
    formatDay,
    formatInstant,
    isPayable,
    isSilent,
    refusalFlash,
    registrationTone,
    teamStatusLabel,
    teamTone,
    tournamentHref,
    type TournamentFlash,
} from "../../../utils/tournament";

interface PaymentState {
    registrations: TournamentRegistration[];
    payUntil: string | null;
}

export default function MyRegistrationsPage() {
    const { status } = useSession();
    const router = useRouter();

    const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
    const [invites, setInvites] = useState<TeamInvite[]>([]);
    const [teams, setTeams] = useState<MyTeam[]>([]);
    const [tournaments, setTournaments] = useState<Map<number, Tournament>>(new Map());
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<TournamentFailure | null>(null);
    const [flash, setFlash] = useState<TournamentFlash | null>(null);
    const [payment, setPayment] = useState<PaymentState | null>(null);
    const [confirmWithdraw, setConfirmWithdraw] = useState<number | null>(null);
    const [creatingTeam, setCreatingTeam] = useState<number | null>(null);
    const [teamName, setTeamName] = useState("");
    const [query, setQuery] = useState("");
    const [pending, setPending] = useState(false);
    const busy = useRef(false);
    const flashRef = useRef<HTMLDivElement>(null);
    const paymentRef = useRef<HTMLDivElement>(null);
    const loaded = useRef(false);

    const load = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        const [registrationsResult, invitesResult, teamsResult] = await Promise.all([
            fetchMyRegistrations(),
            fetchMyInvites(),
            fetchMyTeams(),
        ]);
        if (!registrationsResult.ok) {
            if (!isSilent(registrationsResult) && (!quiet || !loaded.current)) setLoadError(registrationsResult);
            setLoading(false);
            return;
        }
        loaded.current = true;
        setLoadError(null);
        setRegistrations(registrationsResult.data);
        setInvites(invitesResult.ok ? invitesResult.data : []);
        setTeams(teamsResult.ok ? teamsResult.data : []);

        // Formação de time e período de inscrição de cada torneio envolvido.
        const ids = [...new Set(registrationsResult.data.map((registration) => registration.tournament.id))];
        const details = await Promise.all(ids.map((id) => fetchTournament(id)));
        setTournaments(new Map(details.flatMap((result) => (result.ok ? [[result.data.id, result.data] as const] : []))));
        setLoading(false);
    }, []);

    useEffect(() => {
        if (status === "authenticated") load();
    }, [status, load]);

    const showFlash = (next: TournamentFlash) => {
        setFlash(next);
        requestAnimationFrame(() => flashRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    };

    const openPayment = (next: PaymentState) => {
        setPayment(next);
        setConfirmWithdraw(null);
        requestAnimationFrame(() => paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };

    const runAction = async (action: () => Promise<void>) => {
        if (busy.current) return;
        busy.current = true;
        setPending(true);
        setFlash(null);
        try {
            await action();
        } finally {
            busy.current = false;
            setPending(false);
        }
    };

    const refuse = (failure: TournamentFailure, fallbackTitle: string) => {
        if (!isSilent(failure)) showFlash(refusalFlash(failure, fallbackTitle));
    };

    const withdraw = (registration: TournamentRegistration) =>
        runAction(async () => {
            const result = await withdrawRegistration(registration.id);
            setConfirmWithdraw(null);
            if (result.ok) {
                toast.success("Você desistiu da inscrição.");
                if (payment?.registrations.some((r) => r.id === registration.id)) setPayment(null);
            } else {
                refuse(result, "Não foi possível desistir");
            }
            await load(true);
        });

    const accept = (invite: TeamInvite) =>
        runAction(async () => {
            const result = await acceptInvite(invite.id);
            if (result.ok) {
                const registration = result.data.registration;
                if (registration.status === "pending_payment" && registration.amount > 0) {
                    toast.success(`Você entrou no time ${invite.team.name}. Falta o pagamento da inscrição.`);
                    openPayment({ registrations: [registration], payUntil: invite.tournament.registration_ends_at });
                } else {
                    toast.success(`Você entrou no time ${invite.team.name}.`);
                }
            } else {
                refuse(result, "Não foi possível aceitar o convite");
            }
            await load(true);
        });

    const decline = (invite: TeamInvite) =>
        runAction(async () => {
            const result = await declineInvite(invite.id);
            if (result.ok) toast.info("Convite recusado.");
            else refuse(result, "Não foi possível recusar o convite");
            await load(true);
        });

    const submitTeam = (registration: TournamentRegistration) =>
        runAction(async () => {
            const result = await createTeam(registration.category.id, teamName);
            if (result.ok) {
                toast.success("Time criado. Agora convide os parceiros.");
                setCreatingTeam(null);
                setTeamName("");
                router.push(`/torneios/times/${result.data.id}`);
                return;
            }
            refuse(result, "Não foi possível criar o time");
            await load(true);
        });

    const onPaymentResult = async (outcome: SocialPaymentOutcome) => {
        if (outcome.type === "success") {
            toast.success("Pagamento confirmado! Você vai receber o e-mail de confirmação.");
            setPayment(null);
        } else if (outcome.type === "refused") {
            setPayment(null);
            showFlash(
                refusalFlash(
                    {
                        ok: false,
                        status: 409,
                        kind: outcome.reason ? "rule" : "server",
                        reason: outcome.reason,
                        error: outcome.reason === "already_paid" ? "" : outcome.message,
                        context: {},
                        fieldErrors: {},
                    },
                    "Pagamento não confirmado"
                )
            );
        }
        await load(true);
    };

    if (status === "loading") return <LoadingScreen />;

    const teamById = new Map(teams.map((team) => [team.id, team]));
    const payable = registrations.filter((registration) => isPayable(registration));
    const visible = registrations.filter((registration) =>
        matchesSearch(query, registration.tournament.title, registration.category.name, registration.team?.name)
    );
    // Agrupa por torneio, na ordem da Lara.
    const groups: { tournament: TournamentRegistration["tournament"]; items: TournamentRegistration[] }[] = [];
    for (const registration of visible) {
        const group = groups.find((entry) => entry.tournament.id === registration.tournament.id);
        if (group) group.items.push(registration);
        else groups.push({ tournament: registration.tournament, items: [registration] });
    }

    const renderTeam = (registration: TournamentRegistration) => {
        const tournament = tournaments.get(registration.tournament.id);
        const category = tournament?.categories.find((c) => c.id === registration.category.id);
        const active = registration.status === "pending_payment" || registration.status === "paid";

        if (registration.team) {
            const mine = teamById.get(registration.team.id);
            return (
                <div className={style.teamLine}>
                    <FontAwesomeIcon icon={faPeopleGroup} />
                    <span>
                        Time <strong>{registration.team.name}</strong>
                    </span>
                    {category && category.team_size > 1 && (
                        <Pill kind={teamTone(registration.team.status)}>{mine?.status_label || teamStatusLabel(registration.team.status)}</Pill>
                    )}
                    {mine && (
                        <Link href={`/torneios/times/${mine.id}`} className={ui.linkButton}>
                            {mine.is_captain ? "Gerenciar time" : "Ver time"}
                        </Link>
                    )}
                </div>
            );
        }

        if (!active || !category || category.team_size <= 1) return null;

        if (category.team_formation !== "captain") {
            return <p className={style.hint}>O time é montado pela organização do torneio.</p>;
        }
        if (!tournament?.registration_open) {
            return <p className={style.hint}>Sem time. Depois do fim das inscrições, só a organização mexe nos times.</p>;
        }
        if (creatingTeam === registration.id) {
            return (
                <form
                    className={style.inlineForm}
                    onSubmit={(event) => {
                        event.preventDefault();
                        submitTeam(registration);
                    }}
                >
                    <label>
                        Nome do time (opcional)
                        <input
                            type="text"
                            value={teamName}
                            maxLength={60}
                            onChange={(event) => setTeamName(event.target.value)}
                            placeholder="Em branco, usamos o seu primeiro nome"
                        />
                    </label>
                    <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`} disabled={pending}>
                        {pending ? "Criando..." : "Criar time"}
                    </button>
                    <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={() => setCreatingTeam(null)} disabled={pending}>
                        Cancelar
                    </button>
                </form>
            );
        }
        return (
            <div className={style.teamLine}>
                <span>Você ainda não está num time. Monte o seu e convide os parceiros, ou aguarde um convite.</span>
                <button
                    type="button"
                    className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`}
                    onClick={() => {
                        setCreatingTeam(registration.id);
                        setTeamName("");
                    }}
                >
                    <FontAwesomeIcon icon={faPlus} /> Criar time
                </button>
            </div>
        );
    };

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (loadError) {
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title={refusalFlash(loadError, "Não conseguimos carregar suas inscrições").title}
                description={refusalFlash(loadError).text}
                tone="alert"
                action={
                    <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => load()}>
                        <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                    </button>
                }
            />
        );
    } else {
        body = (
            <>
                <div ref={flashRef}>{flash && <SocialFlashBox flash={flash} onClose={() => setFlash(null)} />}</div>

                {invites.length > 0 && (
                    <section className={ui.section} aria-labelledby="convites">
                        <h2 className={ui.sectionTitle} id="convites">
                            <FontAwesomeIcon icon={faEnvelopeOpenText} /> Convites recebidos
                        </h2>
                        <div className={style.registrationList}>
                            {invites.map((invite) => (
                                <article key={invite.id} className={style.invite}>
                                    <span className={style.moduleTag}>{invite.tournament.title}</span>
                                    <h3 className={style.registrationName}>
                                        {invite.team.name} · {invite.category.name}
                                    </h3>
                                    <p className={style.hint}>
                                        {invite.invited_by ? <>Convite de <strong>{invite.invited_by}</strong>. </> : null}
                                        {invite.team.members.length > 0 && <>No time: {invite.team.members.join(", ")}. </>}
                                        Inscrição: <strong className={style.mono}>{invite.category.price > 0 ? formatBRL(invite.category.price) : "gratuita"}</strong>
                                        {invite.tournament.registration_ends_at
                                            ? ` · responda até ${formatInstant(invite.tournament.registration_ends_at)}`
                                            : ""}
                                        .
                                    </p>
                                    <div className={style.row}>
                                        <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => accept(invite)} disabled={pending}>
                                            <FontAwesomeIcon icon={faCheck} /> Aceitar
                                        </button>
                                        <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={() => decline(invite)} disabled={pending}>
                                            <FontAwesomeIcon icon={faXmark} /> Recusar
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                )}

                <div ref={paymentRef}>
                    {payment && (
                        <TournamentPaymentPanel
                            registrations={payment.registrations}
                            payUntil={payment.payUntil}
                            onResult={onPaymentResult}
                            onClose={() => setPayment(null)}
                        />
                    )}
                </div>

                {registrations.length === 0 ? (
                    <ReplayNotice
                        icon={faTrophy}
                        title="Você ainda não se inscreveu em nenhum torneio"
                        description="Veja os torneios com inscrições abertas e escolha suas categorias."
                        action={
                            <Link href="/torneios" className={`${ui.btn} ${ui.btnPrimary}`}>
                                Ver torneios
                            </Link>
                        }
                    />
                ) : (
                    <section className={ui.section} aria-labelledby="inscricoes">
                        <div className={ui.sectionHead}>
                            <h2 className={ui.sectionTitle} id="inscricoes">
                                Inscrições
                            </h2>
                            {payable.length > 1 && !payment && (
                                <button
                                    type="button"
                                    className={`${ui.btn} ${ui.btnSm} ${ui.btnPrimary}`}
                                    onClick={() => openPayment({ registrations: payable, payUntil: null })}
                                >
                                    <FontAwesomeIcon icon={faCreditCard} /> Pagar as {payable.length} pendentes
                                </button>
                            )}
                        </div>
                        <SearchBar id="busca-inscricoes" value={query} onChange={setQuery} placeholder="Buscar torneio, categoria ou time" />

                        {groups.length === 0 ? (
                            <ReplayNotice
                                icon={faMagnifyingGlass}
                                title={`Nada encontrado para “${query}”`}
                                description="Confira a grafia ou limpe a busca."
                            />
                        ) : (
                            groups.map((group) => (
                                <div key={group.tournament.id} className={ui.section}>
                                    <div className={style.rowBetween}>
                                        <h3 className={style.groupTitle}>
                                            <Link href={tournamentHref(group.tournament.title, group.tournament.id)}>{group.tournament.title}</Link>
                                        </h3>
                                        {group.tournament.starts_on && (
                                            <span className={`${ui.muted} ${style.mono}`}>{formatDay(group.tournament.starts_on)}</span>
                                        )}
                                    </div>
                                    <div className={style.registrationList}>
                                        {group.items.map((registration) => (
                                            <article key={registration.id} className={style.registration}>
                                                <div className={style.registrationMain}>
                                                    <div className={style.row}>
                                                        <Pill kind={registrationTone(registration.status)}>{registration.status_label}</Pill>
                                                        {registration.payment?.manual && <Pill kind="off">Pago na secretaria</Pill>}
                                                    </div>
                                                    <h4 className={style.registrationName}>{registration.category.name}</h4>
                                                    <span className={style.amount}>
                                                        {registration.amount > 0 ? formatBRL(registration.amount) : "Gratuita"}
                                                    </span>
                                                    {registration.paid_at && (
                                                        <span className={style.hint}>Paga em {formatInstant(registration.paid_at)}</span>
                                                    )}
                                                    {registration.status === "pending_payment" && registration.tournament.registration_ends_at && (
                                                        <span className={style.deadline}>
                                                            Pague até <strong>{formatInstant(registration.tournament.registration_ends_at)}</strong> para
                                                            garantir a vaga.
                                                        </span>
                                                    )}
                                                    {renderTeam(registration)}
                                                </div>

                                                {(registration.status === "pending_payment" || registration.status === "paid") && (
                                                    <div className={style.registrationFoot}>
                                                        {confirmWithdraw === registration.id ? (
                                                            <div className={style.confirmBox}>
                                                                <span>Desistir desta inscrição? Não dá para desfazer.</span>
                                                                <div className={style.row}>
                                                                    <button
                                                                        type="button"
                                                                        className={`${ui.btn} ${ui.btnSm} ${ui.btnDanger}`}
                                                                        onClick={() => withdraw(registration)}
                                                                        disabled={pending}
                                                                    >
                                                                        {pending ? "Desistindo..." : "Sim, desistir"}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`}
                                                                        onClick={() => setConfirmWithdraw(null)}
                                                                        disabled={pending}
                                                                    >
                                                                        Manter
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : registration.status === "paid" ? (
                                                            <span className={style.hint}>
                                                                Para desistir de uma inscrição paga, fale com a organização do torneio.
                                                            </span>
                                                        ) : (
                                                            <>
                                                                {isPayable(registration) && !payment && (
                                                                    <button
                                                                        type="button"
                                                                        className={`${ui.btn} ${ui.btnSm} ${ui.btnPrimary}`}
                                                                        onClick={() =>
                                                                            openPayment({
                                                                                registrations: [registration],
                                                                                payUntil: registration.tournament.registration_ends_at,
                                                                            })
                                                                        }
                                                                        disabled={pending}
                                                                    >
                                                                        <FontAwesomeIcon icon={faCreditCard} /> Pagar
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    className={`${ui.btn} ${ui.btnSm} ${ui.btnDanger}`}
                                                                    onClick={() => setConfirmWithdraw(registration.id)}
                                                                    disabled={pending}
                                                                >
                                                                    Desistir
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </article>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </section>
                )}
            </>
        );
    }

    return (
        <div className={globalStyle.page}>
            <Header />
            <TournamentCover />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <PageHeader
                    title="Minhas inscrições"
                    lead="Situação de cada inscrição, pagamento, time e convites. A vaga só fica garantida depois de pagar."
                />
                {body}
            </main>

            <Footer />
        </div>
    );
}

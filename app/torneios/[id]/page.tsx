"use client";

/**
 * Detalhe do torneio — aberto a qualquer visitante: descrição, regulamento,
 * categorias (resumo, preço, vagas), times e link do chaveamento divulgado.
 *
 * Com o sócio logado entra a inscrição: `GET tournaments/{id}/eligibility`
 * diz, categoria a categoria, se ele pode escolher (sexo e idade conferidos
 * pela Lara no cadastro do clube) e se já tem inscrição ativa. As não
 * elegíveis aparecem desabilitadas com o motivo. A inscrição é individual,
 * pode pegar várias categorias de uma vez (ou entram todas, ou nenhuma) e
 * nasce aguardando pagamento — sem segurar vaga: as vagas são de quem paga
 * primeiro. O pagamento abre logo em seguida, no cartão de sempre.
 *
 * Depois de cada ação o torneio e a elegibilidade são relidos; a tela nunca
 * deduz vaga ou situação da resposta da ação.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faCircleExclamation,
    faCreditCard,
    faDiagramProject,
    faRightToBracket,
    faRotateRight,
    faTrophy,
    faUserGroup,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../../styles/page.module.css";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/tournament.module.css";
import Header from "../../components/Common/header";
import Footer from "../../components/Common/footer";
import { Loading } from "../../components/Common/loading";
import ReplayNotice from "../../components/Replay/ReplayNotice";
import SocialFlashBox from "../../components/Social/SocialFlashBox";
import { TournamentCover } from "../../components/UI/covers";
import { Media, Note, Pill } from "../../components/UI/ui";
import { TournamentStatusPill } from "../../components/Tournament/TournamentCard";
import TournamentPaymentPanel from "../../components/Tournament/TournamentPaymentPanel";
import type { SocialPaymentOutcome } from "../../components/Checkout/CheckoutPayment";
import {
    fetchEligibility,
    fetchTournament,
    registerInCategories,
    type Tournament,
    type TournamentEligibility,
    type TournamentFailure,
    type TournamentRegistration,
} from "../../../services/tournament-api";
import {
    bracketHref,
    eligibilityText,
    formatBRL,
    formatDayRange,
    formatInstant,
    formationText,
    idFromParam,
    isPayable,
    isSilent,
    refusalFlash,
    registrationTone,
    teamStatusLabel,
    teamTone,
    vacanciesText,
    type TournamentFlash,
} from "../../../utils/tournament";

interface PaymentState {
    registrations: TournamentRegistration[];
    payUntil: string | null;
    totalDue?: number;
}

/** Recusas em que a situação das categorias mudou: relê vagas e elegibilidade. */
const RELOAD_REASONS = new Set(["category_full", "ineligible", "already_registered", "registration_closed", "category_not_found"]);

export default function TournamentDetailPage() {
    const { status } = useSession();
    const params = useParams();
    const pathname = usePathname() ?? "";
    const tournamentId = idFromParam(params?.id);

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<TournamentFailure | null>(null);
    const [eligibility, setEligibility] = useState<TournamentEligibility | null>(null);
    const [eligibilityError, setEligibilityError] = useState<TournamentFailure | null>(null);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [flash, setFlash] = useState<TournamentFlash | null>(null);
    const [payment, setPayment] = useState<PaymentState | null>(null);
    const [pending, setPending] = useState(false);
    // Trava síncrona: dois toques antes do re-render não viram duas inscrições.
    const busy = useRef(false);
    const flashRef = useRef<HTMLDivElement>(null);
    const paymentRef = useRef<HTMLDivElement>(null);
    const hasTournament = useRef(false);

    const loadTournament = useCallback(
        async (quiet = false) => {
            if (!tournamentId) {
                setLoading(false);
                return;
            }
            if (!quiet) setLoading(true);
            const result = await fetchTournament(tournamentId);
            if (result.ok) {
                hasTournament.current = true;
                setTournament(result.data);
                setLoadError(null);
            } else if (!quiet || !hasTournament.current) {
                setLoadError(result);
            }
            setLoading(false);
        },
        [tournamentId]
    );

    const loadEligibility = useCallback(async () => {
        if (!tournamentId) return;
        const result = await fetchEligibility(tournamentId);
        if (result.ok) {
            setEligibility(result.data);
            setEligibilityError(null);
            // Categoria que deixou de poder ser escolhida sai da seleção.
            setSelected((current) => {
                const allowed = new Set(
                    result.data.categories.filter((c) => c.eligible && !c.registration).map((c) => c.category_id)
                );
                return new Set([...current].filter((id) => allowed.has(id)));
            });
        } else if (!isSilent(result)) {
            setEligibility(null);
            setEligibilityError(result);
        }
    }, [tournamentId]);

    useEffect(() => {
        loadTournament();
    }, [loadTournament]);

    useEffect(() => {
        if (status === "authenticated") loadEligibility();
    }, [status, loadEligibility]);

    const reloadAll = async () => {
        await Promise.all([loadTournament(true), status === "authenticated" ? loadEligibility() : Promise.resolve()]);
    };

    const showFlash = (next: TournamentFlash) => {
        setFlash(next);
        requestAnimationFrame(() => flashRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    };

    const openPayment = (next: PaymentState) => {
        setPayment(next);
        requestAnimationFrame(() => paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };

    const toggle = (categoryId: number) => {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(categoryId)) next.delete(categoryId);
            else next.add(categoryId);
            return next;
        });
    };

    const register = async () => {
        if (!tournament || selected.size === 0 || busy.current) return;
        busy.current = true;
        setPending(true);
        setFlash(null);
        try {
            const result = await registerInCategories(tournament.id, [...selected]);
            if (result.ok) {
                setSelected(new Set());
                const toPay = result.data.registrations.filter((r) => r.status === "pending_payment" && r.amount > 0);
                if (toPay.length > 0) {
                    toast.success("Inscrição recebida! Falta o pagamento para garantir a vaga.");
                    openPayment({ registrations: toPay, payUntil: result.data.pay_until, totalDue: result.data.total_due });
                } else {
                    toast.success("Inscrição confirmada. Você vai receber a confirmação por e-mail.");
                }
            } else if (!isSilent(result)) {
                showFlash(refusalFlash(result, "Não foi possível fazer a inscrição"));
                if (result.reason && !RELOAD_REASONS.has(result.reason)) return;
            }
            await reloadAll();
        } finally {
            busy.current = false;
            setPending(false);
        }
    };

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
        // Em qualquer desfecho relê: vagas e situação só vêm da Lara.
        await reloadAll();
    };

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (!tournamentId || loadError || !tournament) {
        const notFound = !tournamentId || loadError?.status === 404;
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title={notFound ? "Torneio não encontrado" : "Não conseguimos carregar o torneio"}
                description={notFound ? "Ele pode ter sido retirado do site." : loadError?.error}
                tone="alert"
                action={
                    notFound ? (
                        <Link href="/torneios" className={`${ui.btn} ${ui.btnPrimary}`}>
                            Ver torneios
                        </Link>
                    ) : (
                        <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => loadTournament()}>
                            <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                        </button>
                    )
                }
            />
        );
    } else {
        const logged = status === "authenticated";
        const canChoose = logged && eligibility?.registration_open === true;
        const byCategory = new Map(eligibility?.categories.map((entry) => [entry.category_id, entry]) ?? []);
        const payable = (eligibility?.categories ?? [])
            .map((entry) => entry.registration)
            .filter((registration): registration is TournamentRegistration => !!registration && isPayable(registration));
        const selectedTotal = tournament.categories
            .filter((category) => selected.has(category.id))
            .reduce((sum, category) => sum + category.price, 0);

        body = (
            <>
                <div className={style.hero}>
                    <div className={style.heroMedia}>
                        <Media src={tournament.image_url} alt={`Imagem de ${tournament.title}`} area="torneios" icon={faTrophy} ratio="wide" />
                    </div>
                    <div className={style.heroBody}>
                        <div className={style.row}>
                            <TournamentStatusPill tournament={tournament} />
                            {tournament.place_group && <span className={style.moduleTag}>{tournament.place_group.name}</span>}
                        </div>
                        <h1 className={ui.title}>{tournament.title}</h1>
                        <dl className={style.facts}>
                            {tournament.starts_on && (
                                <>
                                    <dt>Datas</dt>
                                    <dd className={style.mono}>{formatDayRange(tournament.starts_on, tournament.ends_on)}</dd>
                                </>
                            )}
                            {(tournament.registration_starts_at || tournament.registration_ends_at) && (
                                <>
                                    <dt>Inscrições</dt>
                                    <dd>
                                        {tournament.registration_starts_at && (
                                            <>
                                                de <span className={style.mono}>{formatInstant(tournament.registration_starts_at)}</span>{" "}
                                            </>
                                        )}
                                        {tournament.registration_ends_at && (
                                            <>
                                                até <span className={style.mono}>{formatInstant(tournament.registration_ends_at)}</span>
                                            </>
                                        )}
                                    </dd>
                                </>
                            )}
                        </dl>
                        {tournament.description && <p className={style.description}>{tournament.description}</p>}
                    </div>
                </div>

                {tournament.rules && (
                    <details className={style.rules}>
                        <summary>Regulamento</summary>
                        <p className={style.rulesText}>{tournament.rules}</p>
                    </details>
                )}

                {tournament.registration_open && status === "unauthenticated" && (
                    <Note tone="info" icon={faRightToBracket}>
                        As inscrições estão abertas para sócios titulares e dependentes.{" "}
                        <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`} className={ui.linkButton}>
                            Entre com sua conta para se inscrever
                        </Link>
                        .
                    </Note>
                )}

                {logged && eligibilityError && (
                    <Note tone="warn" icon={faCircleExclamation}>
                        <strong>{refusalFlash(eligibilityError, "Não conseguimos conferir as categorias").title}</strong>
                        <br />
                        {refusalFlash(eligibilityError).text}
                    </Note>
                )}

                <div ref={flashRef}>{flash && <SocialFlashBox flash={flash} onClose={() => setFlash(null)} />}</div>

                {payable.length > 0 && !payment && (
                    <Note tone="warn" icon={faCreditCard}>
                        Você tem {payable.length === 1 ? "uma inscrição" : `${payable.length} inscrições`} aguardando pagamento
                        neste torneio. A vaga só fica garantida depois de pagar.{" "}
                        <button
                            type="button"
                            className={ui.linkButton}
                            onClick={() => openPayment({ registrations: payable, payUntil: tournament.registration_ends_at })}
                        >
                            Pagar agora
                        </button>
                    </Note>
                )}

                <div ref={paymentRef}>
                    {payment && (
                        <TournamentPaymentPanel
                            registrations={payment.registrations}
                            payUntil={payment.payUntil}
                            totalDue={payment.totalDue}
                            onResult={onPaymentResult}
                            onClose={() => setPayment(null)}
                        />
                    )}
                </div>

                <section className={ui.section} aria-labelledby="categorias">
                    <div className={ui.sectionHead}>
                        <h2 className={ui.sectionTitle} id="categorias">
                            Categorias
                        </h2>
                        {canChoose && <span className={ui.muted}>Marque uma ou mais para se inscrever.</span>}
                    </div>

                    {tournament.categories.length === 0 ? (
                        <p className={style.hint}>Nenhuma categoria cadastrada.</p>
                    ) : (
                        <div className={style.categoryList}>
                            {tournament.categories.map((category) => {
                                const entry = byCategory.get(category.id);
                                const registration = entry?.registration ?? null;
                                const selectable = canChoose && !!entry && entry.eligible && !registration;
                                const isSelected = selected.has(category.id);
                                const formation = formationText(category.team_formation, category.team_size);
                                return (
                                    <article
                                        key={category.id}
                                        className={`${style.category} ${isSelected ? style.categorySelected : ""}`}
                                    >
                                        <div className={style.categoryHead}>
                                            {canChoose && entry && !registration && (
                                                <input
                                                    type="checkbox"
                                                    className={style.categoryCheck}
                                                    id={`categoria-${category.id}`}
                                                    checked={isSelected}
                                                    disabled={!selectable || pending}
                                                    onChange={() => toggle(category.id)}
                                                    aria-describedby={`categoria-${category.id}-resumo`}
                                                />
                                            )}
                                            <div>
                                                <label htmlFor={`categoria-${category.id}`} className={style.categoryTitle}>
                                                    {category.name}
                                                </label>
                                                <p className={style.categorySummary} id={`categoria-${category.id}-resumo`}>
                                                    {category.summary}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={style.categoryBody}>
                                            <div className={style.categoryFacts}>
                                                <span>
                                                    <strong className={style.mono}>
                                                        {category.price > 0 ? formatBRL(category.price) : "Gratuita"}
                                                    </strong>
                                                    {category.price > 0 && category.team_size > 1 ? " por pessoa" : ""}
                                                </span>
                                                <span>{vacanciesText(category.vacancies_left)}</span>
                                                {formation && <span>{formation}</span>}
                                            </div>
                                            {canChoose && entry && !entry.eligible && !registration && (
                                                <p className={style.ineligible}>{eligibilityText(entry.reason)}</p>
                                            )}
                                            {registration && (
                                                <div className={style.row}>
                                                    <Pill kind={registrationTone(registration.status)}>{registration.status_label}</Pill>
                                                    {registration.team && (
                                                        <span className={style.hint}>
                                                            Time: <strong>{registration.team.name}</strong>
                                                        </span>
                                                    )}
                                                    {isPayable(registration) && !payment && (
                                                        <button
                                                            type="button"
                                                            className={`${ui.btn} ${ui.btnSm} ${ui.btnPrimary}`}
                                                            onClick={() =>
                                                                openPayment({
                                                                    registrations: [registration],
                                                                    payUntil: tournament.registration_ends_at,
                                                                })
                                                            }
                                                        >
                                                            <FontAwesomeIcon icon={faCreditCard} /> Pagar {formatBRL(registration.amount)}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {category.teams.length > 0 && (
                                                <details className={style.teamsToggle}>
                                                    <summary>
                                                        <FontAwesomeIcon icon={faUserGroup} /> {category.team_size > 1 ? "Times" : "Inscritos"} (
                                                        {category.teams.length})
                                                    </summary>
                                                    <ul className={style.teamList}>
                                                        {category.teams.map((team) => (
                                                            <li key={team.id} className={style.teamItem}>
                                                                <strong>{team.name}</strong>
                                                                {team.members.length > 0 && team.members.join(" / ") !== team.name && (
                                                                    <span className={style.teamMembers}>{team.members.join(", ")}</span>
                                                                )}
                                                                {category.team_size > 1 && (
                                                                    <Pill kind={teamTone(team.status)}>{teamStatusLabel(team.status)}</Pill>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </details>
                                            )}
                                        </div>
                                        {(category.bracket_published || registration) && (
                                            <div className={style.categoryFoot}>
                                                {category.bracket_published && (
                                                    <Link href={bracketHref(tournament, category)} className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`}>
                                                        <FontAwesomeIcon icon={faDiagramProject} /> Chaveamento
                                                    </Link>
                                                )}
                                                {registration && (
                                                    <Link href="/torneios/inscricoes" className={ui.linkButton}>
                                                        Minhas inscrições
                                                    </Link>
                                                )}
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>

                {canChoose && selected.size > 0 && (
                    <div className={style.actionBar}>
                        <div className={style.actionTotal}>
                            <strong>{formatBRL(selectedTotal)}</strong>
                            <span>
                                {selected.size} categoria{selected.size === 1 ? "" : "s"} · o pagamento vem em seguida
                            </span>
                        </div>
                        <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={register} disabled={pending}>
                            {pending ? "Enviando..." : "Inscrever-me"}
                        </button>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className={globalStyle.page}>
            <Header />
            <TournamentCover />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <Link href="/torneios" className={style.backLink}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Torneios
                </Link>
                {body}
            </main>

            <Footer />
        </div>
    );
}

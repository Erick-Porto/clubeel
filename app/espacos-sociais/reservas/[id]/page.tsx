"use client";

/**
 * Detalhe de uma reserva de espaço social: valor discriminado, pagamento,
 * lista de convidados e desistência.
 *
 * Quais botões aparecem é decidido pelos booleanos da Lara (`can_pay`,
 * `can_cancel`, `can_edit_guests`) — nunca por prazo calculado aqui. Depois de
 * cada ação a reserva é relida; o estado da tela nunca é montado a partir da
 * resposta da ação.
 *
 * Editar a pré-reserva (`can_edit`) troca o corpo da tela pelo formulário da
 * pré-reserva preenchido; ao salvar, a tela volta com a reserva que a Lara
 * devolveu (recalculada).
 *
 * Pagar usa o mesmo formulário de cartão das quadras (CheckoutPayment), no
 * modo `socialBookingId`: o servidor relê a reserva para saber quanto cobrar.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faCircleExclamation,
    faCreditCard,
    faPenToSquare,
    faPen,
    faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../../../styles/page.module.css";
import replayStyle from "../../../../styles/replay.module.css";
import style from "../../../../styles/social.module.css";
import Header from "../../../components/Common/header";
import Footer from "../../../components/Common/footer";
import { Loading, LoadingScreen } from "../../../components/Common/loading";
import ReplayNotice from "../../../components/Replay/ReplayNotice";
import SocialStageBadge from "../../../components/Social/SocialStageBadge";
import SocialFlashBox from "../../../components/Social/SocialFlashBox";
import SocialGuestsEditor, { type GuestDraft } from "../../../components/Social/SocialGuestsEditor";
import SocialBookingForm from "../../../components/Social/SocialBookingForm";
import CheckoutPayment, { type SocialPaymentOutcome } from "../../../components/Checkout/CheckoutPayment";
import {
    cancelSocialBooking,
    fetchSocialBeverages,
    fetchSocialBooking,
    fetchSocialGroupPlaces,
    replaceSocialGuests,
    type SocialBeverage,
    type SocialBooking,
    type SocialFailure,
    type SocialPlace,
} from "../../../../services/social-api";
import {
    formatBRL,
    formatDayLong,
    formatInstant,
    onlyDigits,
    refusalFlash,
    refusedGuestIndex,
    stageSentence,
    type SocialFlash,
} from "../../../../utils/social";

const SECRETARY_WHATSAPP =
    "https://wa.me/5524992510959?text=Olá,%20gostaria%20de%20falar%20sobre%20minha%20reserva%20de%20espaço%20social.";

export default function SocialBookingDetailPage() {
    const { status } = useSession();
    const params = useParams();
    const bookingId = Number(params?.id);
    const validId = Number.isInteger(bookingId) && bookingId > 0;

    const [booking, setBooking] = useState<SocialBooking | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<SocialFailure | null>(null);
    const [flash, setFlash] = useState<SocialFlash | null>(null);

    const [showPayment, setShowPayment] = useState(false);
    const [editingGuests, setEditingGuests] = useState(false);
    const [guestDrafts, setGuestDrafts] = useState<GuestDraft[]>([]);
    const [guestErrorIndex, setGuestErrorIndex] = useState<number | null>(null);
    const [confirmCancel, setConfirmCancel] = useState(false);
    // Edição da pré-reserva: precisa do espaço (máximo de extras, incluídos,
    // capacidade) e do catálogo de bebidas, lidos ao abrir.
    const [editPlace, setEditPlace] = useState<SocialPlace | null>(null);
    const [catalog, setCatalog] = useState<SocialBeverage[]>([]);
    const [pending, setPending] = useState(false);
    // Trava síncrona: dois toques antes do re-render não viram duas ações.
    const busy = useRef(false);
    const flashRef = useRef<HTMLDivElement>(null);
    // Numa releitura silenciosa com reserva já na tela, um erro não troca a tela.
    const hasBooking = useRef(false);

    const load = useCallback(
        async (quiet = false) => {
            if (!validId) {
                setLoading(false);
                return;
            }
            if (!quiet) setLoading(true);
            const result = await fetchSocialBooking(bookingId);
            if (result.ok) {
                hasBooking.current = true;
                setBooking(result.data);
                setLoadError(null);
            } else if (!quiet || !hasBooking.current) {
                setLoadError(result);
            }
            setLoading(false);
        },
        [bookingId, validId]
    );

    useEffect(() => {
        if (status === "authenticated") load();
    }, [status, load]);

    const showFlash = (next: SocialFlash) => {
        setFlash(next);
        requestAnimationFrame(() => flashRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    };

    /** Recusa de uma ação: aviso pelo `reason` e releitura da reserva. */
    const handleRefusal = async (failure: SocialFailure, fallbackTitle: string) => {
        if (failure.kind === "unauthorized") return; // o interceptor já levou ao login
        if (!(failure.kind === "server" && failure.status >= 500)) showFlash(refusalFlash(failure, fallbackTitle));
        await load(true);
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

    const onPaymentResult = async (outcome: SocialPaymentOutcome) => {
        if (outcome.type === "success") {
            toast.success("Pagamento confirmado! Você vai receber o e-mail de confirmação.");
            setShowPayment(false);
        } else if (outcome.type === "refused") {
            setShowPayment(false);
            showFlash(
                refusalFlash(
                    {
                        ok: false,
                        status: 409,
                        kind: outcome.reason ? "rule" : "server",
                        reason: outcome.reason,
                        error: outcome.message,
                        context: {},
                        fieldErrors: {},
                    },
                    "Pagamento não confirmado"
                )
            );
        }
        // Em qualquer desfecho a reserva é relida: o estágio só vem da Lara.
        await load(true);
    };

    const startEditingBooking = () =>
        runAction(async () => {
            if (!booking) return;
            const groupId = booking.place_group?.id;
            const [placesResult, beveragesResult] = await Promise.all([
                groupId ? fetchSocialGroupPlaces(groupId) : Promise.resolve(null),
                fetchSocialBeverages(),
            ]);
            const place = placesResult?.ok
                ? placesResult.data.places.find((item) => item.id === booking.place.id) ?? null
                : null;
            if (!place) {
                showFlash({
                    tone: "alert",
                    title: "Não conseguimos abrir a edição",
                    text: "Os dados do espaço não carregaram. Tente de novo em instantes.",
                });
                return;
            }
            setCatalog(beveragesResult.ok ? beveragesResult.data : []);
            setEditPlace(place);
            setShowPayment(false);
            setEditingGuests(false);
            setConfirmCancel(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
        });

    const closeBookingEdit = () => setEditPlace(null);

    /** A resposta do PUT já é a reserva recalculada: a tela volta com ela. */
    const onBookingSaved = (saved: SocialBooking) => {
        setBooking(saved);
        setEditPlace(null);
        toast.success("Pré-reserva atualizada.");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const onBookingEditRefusal = async (failure: SocialFailure) => {
        switch (failure.reason) {
            case "contract_closed":
            case "invalid_stage":
            case "not_owner":
                // Não há mais o que editar: fecha, avisa e relê (o can_edit virá false).
                setEditPlace(null);
                await handleRefusal(failure, "Não foi possível salvar");
                return;
            case "beverage_unavailable": {
                const beverages = await fetchSocialBeverages();
                if (beverages.ok) setCatalog(beverages.data);
                break;
            }
        }
        if (failure.kind === "unauthorized") return;
        if (!(failure.kind === "server" && failure.status >= 500)) {
            showFlash(refusalFlash(failure, "Não foi possível salvar"));
        }
    };

    const startEditingGuests = () => {
        if (!booking) return;
        // A Lara devolve CPFs mascarados e o PUT substitui a lista inteira: o
        // sócio redigita os CPFs (o salvo aparece como dica no campo).
        setGuestDrafts(booking.guests.map((guest) => ({ name: guest.name, cpf: "", savedCpf: guest.cpf })));
        setGuestErrorIndex(null);
        setEditingGuests(true);
    };

    const saveGuests = () =>
        runAction(async () => {
            if (!booking) return;
            setGuestErrorIndex(null);

            const sentIndex: number[] = [];
            const guests = guestDrafts.flatMap((guest, index) => {
                if (!guest.name.trim() && !guest.cpf.trim()) return [];
                sentIndex.push(index);
                return [{ name: guest.name.trim(), cpf: onlyDigits(guest.cpf) }];
            });

            const result = await replaceSocialGuests(booking.id, guests);
            if (result.ok) {
                toast.success("Lista de convidados salva.");
                setEditingGuests(false);
                await load(true);
                return;
            }

            const refused = refusedGuestIndex(result);
            if (refused !== null) setGuestErrorIndex(sentIndex[refused] ?? null);
            if (result.reason === "guests_locked") setEditingGuests(false);
            await handleRefusal(result, "Não foi possível salvar a lista");
        });

    const cancel = () =>
        runAction(async () => {
            if (!booking) return;
            const result = await cancelSocialBooking(booking.id);
            setConfirmCancel(false);
            if (result.ok) {
                toast.success("Você desistiu da reserva. A data foi liberada.");
                setShowPayment(false);
                setEditingGuests(false);
                await load(true);
                return;
            }
            await handleRefusal(result, "Não foi possível desistir");
        });

    if (status === "loading") return <LoadingScreen />;

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (!validId || loadError || !booking) {
        const notFound = !validId || loadError?.status === 404;
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title={notFound ? "Reserva não encontrada" : "Não conseguimos carregar a reserva"}
                description={notFound ? "Ela pode ter sido removida ou não pertence à sua conta." : loadError?.error}
                tone="alert"
                action={
                    notFound ? (
                        <Link href="/espacos-sociais/reservas" className={replayStyle.replayButton}>
                            Minhas reservas sociais
                        </Link>
                    ) : (
                        <button type="button" className={replayStyle.replayButton} onClick={() => load()}>
                            <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                        </button>
                    )
                }
            />
        );
    } else {
        const reason =
            booking.stage === "refused" ? booking.refusal_reason : booking.stage === "cancelled" ? booking.cancel_reason : null;

        body = (
            <>
                <div className={style.detailHead}>
                    <div className={style.detailTitleRow}>
                        <h1 className={replayStyle.replayTitle}>{booking.place.name}</h1>
                        <SocialStageBadge stage={booking.stage} label={booking.stage_label} />
                    </div>
                    <p className={replayStyle.replayLead}>
                        <span style={{ textTransform: "capitalize" }}>{formatDayLong(booking.date)}</span>
                        {booking.place_group ? ` · ${booking.place_group.name}` : ""}
                    </p>
                    {stageSentence(booking.stage) && <p className={style.limitNote}>{stageSentence(booking.stage)}</p>}
                    {reason && <p className={style.observation}>Motivo: {reason}</p>}
                    {booking.can_edit && !editPlace && (
                        <div className={style.headerActions}>
                            <button
                                type="button"
                                className={style.secondaryButton}
                                onClick={startEditingBooking}
                                disabled={pending}
                            >
                                <FontAwesomeIcon icon={faPenToSquare} /> {pending ? "Abrindo..." : "Editar pré-reserva"}
                            </button>
                        </div>
                    )}
                </div>

                <div ref={flashRef}>{flash && <SocialFlashBox flash={flash} onClose={() => setFlash(null)} />}</div>

                {editPlace ? (
                    <SocialBookingForm
                        place={editPlace}
                        date={booking.date}
                        beverages={catalog}
                        editing={booking}
                        onSaved={onBookingSaved}
                        onRefusal={onBookingEditRefusal}
                        onCancelEdit={closeBookingEdit}
                    />
                ) : (
                    <div className={style.detailGrid}>
                        <div className={style.detailColumn}>
                            <div className={style.panel}>
                                <h2 className={style.panelTitle}>Evento</h2>
                                <dl className={style.infoList}>
                                    <dt>Tipo</dt>
                                    <dd>{booking.event_type ?? "—"}</dd>
                                    <dt>Pessoas</dt>
                                    <dd>
                                        {booking.expected_guests ?? "—"}
                                        {booking.place.capacity > 0 ? ` (capacidade ${booking.place.capacity})` : ""}
                                    </dd>
                                    {booking.notes && (
                                        <>
                                            <dt>Observações</dt>
                                            <dd>{booking.notes}</dd>
                                        </>
                                    )}
                                </dl>
                            </div>

                            <div className={style.panel}>
                                <div className={style.row}>
                                    <h2 className={style.panelTitle}>Convidados não sócios</h2>
                                    {booking.can_edit_guests && !editingGuests && (
                                        <button
                                            type="button"
                                            className={style.secondaryButton}
                                            onClick={startEditingGuests}
                                            disabled={pending}
                                        >
                                            <FontAwesomeIcon icon={faPen} /> Editar lista
                                        </button>
                                    )}
                                </div>

                                {editingGuests ? (
                                    <>
                                        <p className={style.hint}>
                                            Nome e CPF de cada convidado — é o que a portaria confere no dia. Por segurança, os
                                            CPFs já salvos aparecem mascarados: para salvar, digite de novo o CPF de todos.
                                        </p>
                                        <SocialGuestsEditor
                                            guests={guestDrafts}
                                            onChange={(next) => {
                                                setGuestDrafts(next);
                                                setGuestErrorIndex(null);
                                            }}
                                            limit={booking.guest_limit}
                                            errorIndex={guestErrorIndex}
                                            disabled={pending}
                                        />
                                        <div className={style.headerActions}>
                                            <button
                                                type="button"
                                                className={replayStyle.replayButton}
                                                onClick={saveGuests}
                                                disabled={pending}
                                            >
                                                {pending ? "Salvando..." : "Salvar lista"}
                                            </button>
                                            <button
                                                type="button"
                                                className={style.secondaryButton}
                                                onClick={() => setEditingGuests(false)}
                                                disabled={pending}
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </>
                                ) : booking.guests.length > 0 ? (
                                    <div className={style.tableWrap}>
                                        <table className={style.guestTable}>
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Nome</th>
                                                    <th>CPF</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {booking.guests.map((guest, index) => (
                                                    <tr key={guest.id ?? index}>
                                                        <td>{index + 1}</td>
                                                        <td>{guest.name}</td>
                                                        <td>{guest.cpf}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className={style.hint}>Nenhum convidado na lista.</p>
                                )}

                                {!editingGuests && (
                                    <p className={style.hint}>
                                        {booking.guests.length} de {booking.guest_limit} convidados.
                                        {booking.can_edit_guests && booking.guests_editable_until
                                            ? ` Dá para alterar até ${formatInstant(booking.guests_editable_until)}.`
                                            : ""}
                                        {!booking.can_edit_guests && booking.stage === "confirmed"
                                            ? " A lista pelo site está fechada — para mudar, fale com a secretaria."
                                            : ""}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className={style.detailColumn}>
                            <div className={style.panel}>
                                <h2 className={style.panelTitle}>Valores</h2>
                                <div className={style.summary}>
                                    <div className={style.summaryLine}>
                                        <span>Diária</span>
                                        <span>{formatBRL(booking.base_price)}</span>
                                    </div>
                                    {booking.extra_guests > 0 && (
                                        <div className={style.summaryLine}>
                                            <span>
                                                {booking.extra_guests} convidado{booking.extra_guests === 1 ? "" : "s"} extra
                                                {booking.extra_guests === 1 ? "" : "s"} × {formatBRL(booking.extra_guest_price)}
                                            </span>
                                            <span>{formatBRL(booking.extras_total)}</span>
                                        </div>
                                    )}
                                    {booking.items.map((item) => (
                                        <div key={item.beverage_id} className={style.summaryLine}>
                                            <span>
                                                {item.quantity} × {item.name}
                                                {item.unit ? ` (${item.unit})` : ""}
                                            </span>
                                            <span>{formatBRL(item.subtotal)}</span>
                                        </div>
                                    ))}
                                    {booking.discount > 0 && (
                                        <div className={style.summaryDiscount}>
                                            <span>Desconto</span>
                                            <span>− {formatBRL(booking.discount)}</span>
                                        </div>
                                    )}
                                    <div className={style.summaryTotal}>
                                        <span>{booking.stage === "requested" ? "Total (sujeito à análise)" : "Total"}</span>
                                        <span>{formatBRL(booking.total)}</span>
                                    </div>
                                </div>

                                {booking.stage === "awaiting_payment" && booking.payment_due_at && (
                                    <p className={style.deadline}>
                                        Pague até <strong>{formatInstant(booking.payment_due_at)}</strong>. Depois disso a
                                        reserva expira e a data volta a ficar livre.
                                    </p>
                                )}

                                {booking.can_pay && !showPayment && (
                                    <button
                                        type="button"
                                        className={replayStyle.replayButton}
                                        onClick={() => setShowPayment(true)}
                                        disabled={pending}
                                    >
                                        <FontAwesomeIcon icon={faCreditCard} /> Pagar {formatBRL(booking.total)}
                                    </button>
                                )}

                                {booking.can_pay && showPayment && (
                                    <>
                                        <CheckoutPayment socialBookingId={booking.id} onSocialResult={onPaymentResult} />
                                        <button type="button" className={style.linkButton} onClick={() => setShowPayment(false)}>
                                            Pagar depois
                                        </button>
                                    </>
                                )}
                            </div>

                            {booking.can_cancel && (
                                <div className={style.panel}>
                                    <h2 className={style.panelTitle}>Desistir</h2>
                                    {confirmCancel ? (
                                        <div className={style.confirmBox}>
                                            <p>
                                                Desistir libera a data para outros sócios. Não dá para desfazer. Confirma?
                                            </p>
                                            <div className={style.headerActions}>
                                                <button
                                                    type="button"
                                                    className={style.dangerButton}
                                                    onClick={cancel}
                                                    disabled={pending}
                                                >
                                                    {pending ? "Desistindo..." : "Sim, desistir da reserva"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={style.secondaryButton}
                                                    onClick={() => setConfirmCancel(false)}
                                                    disabled={pending}
                                                >
                                                    Manter reserva
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className={style.hint}>Enquanto não pagar, você pode desistir por aqui.</p>
                                            <button
                                                type="button"
                                                className={style.dangerButton}
                                                onClick={() => setConfirmCancel(true)}
                                                disabled={pending}
                                            >
                                                Desistir da reserva
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {booking.stage === "confirmed" && (
                                <p className={style.notice}>
                                    Para cancelar uma reserva já paga, fale com a secretaria pelo WhatsApp{" "}
                                    <a href={SECRETARY_WHATSAPP} target="_blank" rel="noopener noreferrer">
                                        <strong>(24) 9 9251-0959</strong>
                                    </a>
                                    . O estorno é decidido por ela.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={0} onlyScroll={false} />

            <section className={replayStyle.replaySection}>
                <Link href="/espacos-sociais/reservas" className={style.backLink}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Minhas reservas sociais
                </Link>
                {body}
            </section>

            <Footer />
        </div>
    );
}

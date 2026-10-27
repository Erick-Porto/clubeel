"use client";

/**
 * Página do evento — aberta a qualquer visitante: detalhes, regras e os tipos
 * de ingresso com o lote à venda agora e os dois preços (o que vale para quem
 * está vendo, realçado: sócio logado → sócio; senão → não sócio, com o aviso
 * "Sócio? Entre para pagar R$ y").
 *
 * [v4] Evento de vários dias: um bloco por dia com as diárias dele e o
 * horário, e o passaporte à parte, em destaque ("vale todos os dias") — só se
 * a Lara mandou algum tipo `passport`.
 *
 * Nada aqui é calculado: lote, preço, estoque e a janela de vendas vêm da Lara.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faCircleExclamation,
    faRightToBracket,
    faRotateRight,
    faTicket,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../../styles/page.module.css";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/ticket.module.css";
import Header from "../../components/Common/header";
import Footer from "../../components/Common/footer";
import { Loading } from "../../components/Common/loading";
import ReplayNotice from "../../components/Replay/ReplayNotice";
import { TicketCover } from "../../components/UI/covers";
import { Media, Note } from "../../components/UI/ui";
import { EventStatusPill } from "../../components/Ticket/EventCard";
import TicketTypeCard from "../../components/Ticket/TicketTypeCard";
import { fetchEvent, type TicketEvent, type TicketFailure } from "../../../services/ticket-api";
import {
    buyHref,
    formatBRL,
    formatDayHours,
    formatInstant,
    formatWhen,
    groupTypes,
    idFromParam,
    lowestPrice,
} from "../../../utils/ticket";

export default function TicketEventPage() {
    const { status } = useSession();
    const params = useParams();
    const pathname = usePathname() ?? "";
    const eventId = idFromParam(params?.id);

    const [event, setEvent] = useState<TicketEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<TicketFailure | null>(null);

    const load = useCallback(async () => {
        if (!eventId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const result = await fetchEvent(eventId);
        if (result.ok) {
            setEvent(result.data);
            setError(null);
        } else {
            setError(result);
        }
        setLoading(false);
    }, [eventId]);

    useEffect(() => {
        load();
    }, [load]);

    const kind = status === "authenticated" ? "member" : "guest";
    const loginHref = `/login?callbackUrl=${encodeURIComponent(pathname)}`;

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (!eventId || error || !event) {
        const notFound = !eventId || error?.status === 404;
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title={notFound ? "Evento não encontrado" : "Não conseguimos carregar o evento"}
                description={notFound ? "Ele pode ter sido retirado do site." : error?.error}
                tone="alert"
                action={
                    notFound ? (
                        <Link href="/ingressos" className={`${ui.btn} ${ui.btnPrimary}`}>
                            Ver eventos
                        </Link>
                    ) : (
                        <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => load()}>
                            <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                        </button>
                    )
                }
            />
        );
    } else {
        const groups = groupTypes(event);
        const canBuy = event.sales_open && event.status !== "finished" && event.types.some((type) => type.available);
        const salesText = event.status === "finished"
            ? "Evento encerrado."
            : !event.sales_open && event.sales_starts_at && Date.parse(event.sales_starts_at) > Date.now()
              ? `Vendas a partir de ${formatInstant(event.sales_starts_at)}.`
              : !event.sales_open
                ? "Vendas encerradas."
                : null;
        const typeCard = (type: TicketEvent["types"][number]) => (
            <TicketTypeCard key={type.id} type={type} kind={kind} loginHref={kind === "guest" ? loginHref : undefined} />
        );

        body = (
            <>
                <div className={style.hero}>
                    <div className={style.heroMedia}>
                        <Media src={event.image_url} alt={`Imagem de ${event.title}`} area="ingressos" icon={faTicket} ratio="wide" />
                    </div>
                    <div className={style.heroBody}>
                        <EventStatusPill event={event} />
                        <h1 className={ui.title}>{event.title}</h1>
                        <dl className={style.facts}>
                            {event.starts_at && (
                                <>
                                    <dt>Quando</dt>
                                    <dd className={style.mono}>{formatWhen(event.starts_at, event.ends_at, event.days)}</dd>
                                </>
                            )}
                            {event.venue && (
                                <>
                                    <dt>Local</dt>
                                    <dd>{event.venue}</dd>
                                </>
                            )}
                            {(event.sales_starts_at || event.sales_ends_at) && (
                                <>
                                    <dt>Vendas</dt>
                                    <dd>
                                        {event.sales_starts_at && (
                                            <>
                                                de <span className={style.mono}>{formatInstant(event.sales_starts_at)}</span>{" "}
                                            </>
                                        )}
                                        {event.sales_ends_at && (
                                            <>
                                                até <span className={style.mono}>{formatInstant(event.sales_ends_at)}</span>
                                            </>
                                        )}
                                    </dd>
                                </>
                            )}
                            {event.capacity_left !== null && event.status !== "finished" && (
                                <>
                                    <dt>Lugares</dt>
                                    <dd>
                                        {event.capacity_left > 0
                                            ? `${event.capacity_left} restante${event.capacity_left === 1 ? "" : "s"}`
                                            : "Esgotado"}
                                    </dd>
                                </>
                            )}
                        </dl>
                        {event.description && <p className={style.description}>{event.description}</p>}
                        {canBuy && (
                            <div className={style.row}>
                                <Link href={buyHref(event)} className={`${ui.btn} ${ui.btnPrimary}`}>
                                    <FontAwesomeIcon icon={faTicket} /> Comprar
                                </Link>
                                {kind === "member" && (
                                    <Link href="/ingressos/meus" className={ui.linkButton}>
                                        Meus ingressos
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {salesText && (
                    <Note tone="info" icon={faCircleExclamation}>
                        {salesText}
                    </Note>
                )}

                {canBuy && kind === "guest" && (
                    <Note tone="info" icon={faRightToBracket}>
                        Sócio paga o preço de sócio.{" "}
                        <Link href={loginHref} className={ui.linkButton}>
                            Entre com sua conta
                        </Link>{" "}
                        para comprar para você e para as pessoas do seu título. Sem conta, compre como não sócio.
                    </Note>
                )}

                {event.rules && (
                    <details className={style.rules}>
                        <summary>Regras do evento</summary>
                        <p className={style.rulesText}>{event.rules}</p>
                    </details>
                )}

                <section className={ui.section} aria-labelledby="tipos">
                    <div className={ui.sectionHead}>
                        <h2 className={ui.sectionTitle} id="tipos">
                            Ingressos
                        </h2>
                    </div>

                    {event.types.length === 0 ? (
                        <p className={style.hint}>Nenhum ingresso cadastrado.</p>
                    ) : event.multi_day ? (
                        <>
                            {groups.passport.length > 0 && (
                                <div className={`${style.dayBlock} ${style.passport}`}>
                                    <div className={style.dayHead}>
                                        <h3 className={style.dayTitle}>Passaporte</h3>
                                        <span className={style.hint}>Vale todos os dias (uma entrada por dia)</span>
                                    </div>
                                    <div className={style.typeList}>{groups.passport.map(typeCard)}</div>
                                </div>
                            )}
                            {groups.days.map(({ day, types }) => (
                                <div key={day.id} className={style.dayBlock}>
                                    <div className={style.dayHead}>
                                        <h3 className={style.dayTitle}>{day.label}</h3>
                                        <span className={style.dayHours}>{formatDayHours(day)}</span>
                                        {day.capacity_left === 0 && <span className={style.taken}>Dia esgotado</span>}
                                    </div>
                                    {types.length === 0 ? (
                                        <p className={style.hint}>Sem diária à venda neste dia.</p>
                                    ) : (
                                        <div className={style.typeList}>{types.map(typeCard)}</div>
                                    )}
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className={style.typeList}>{groups.single.map(typeCard)}</div>
                    )}
                </section>

                {canBuy && (
                    <div className={style.actionBar}>
                        <div className={style.actionTotal}>
                            {lowestPrice(event, kind) !== null && <strong>a partir de {formatBRL(lowestPrice(event, kind) ?? 0)}</strong>}
                            <span>{kind === "member" ? "Preço de sócio" : "Compra sem cadastro, preço de não sócio"}</span>
                        </div>
                        <Link href={buyHref(event)} className={`${ui.btn} ${ui.btnPrimary}`}>
                            Comprar
                        </Link>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className={globalStyle.page}>
            <Header />
            <TicketCover />
            <main className={`${globalStyle.main} ${ui.page}`}>
                <Link href="/ingressos" className={style.backLink}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Eventos
                </Link>
                {body}
            </main>
            <Footer />
        </div>
    );
}

"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faCalendarDays, faChair, faLocationDot, faTicket } from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/ticket.module.css";
import { Media, MediaTag, Pill } from "../UI/ui";
import type { TicketEvent } from "../../../services/ticket-api";
import { eventHref, formatBRL, formatInstant, formatWhen, lowestPrice, seatBlockTitle, type BuyerKind } from "../../../utils/ticket";

/**
 * Selo do evento, só pelo que a Lara mandou: encerrado (`status`), vendas
 * abertas (`sales_open`), esgotado (`capacity_left` 0), "vendas a partir de…"
 * (a janela ainda não abriu) ou "vendas encerradas".
 */
export function EventStatusPill({ event }: { event: TicketEvent }) {
    let pill: React.ReactNode;
    if (event.status === "finished") {
        pill = <Pill kind="off">Evento encerrado</Pill>;
    } else if (event.sales_open && event.capacity_left === 0) {
        pill = <Pill kind="danger">Esgotado</Pill>;
    } else if (event.sales_open) {
        pill = (
            <Pill kind="ok" icon={faTicket}>
                Vendas abertas
            </Pill>
        );
    } else if (event.sales_starts_at && Date.parse(event.sales_starts_at) > Date.now()) {
        pill = <Pill kind="info">Vendas a partir de {formatInstant(event.sales_starts_at)}</Pill>;
    } else {
        pill = <Pill kind="off">Vendas encerradas</Pill>;
    }
    return <span className={style.pillSlot}>{pill}</span>;
}

/** Cartão da vitrine: imagem, título, data, local e "a partir de". */
export default function EventCard({ event, kind }: { event: TicketEvent; kind: BuyerKind }) {
    const from = event.sales_open ? lowestPrice(event, kind) : null;
    return (
        <Link href={eventHref(event)} className={ui.card}>
            <Media src={event.image_url} alt={`Imagem de ${event.title}`} area="ingressos" icon={faTicket}>
                {event.multi_day && event.days.length > 1 && <MediaTag>{event.days.length} dias</MediaTag>}
            </Media>
            <div className={ui.cardBody}>
                <EventStatusPill event={event} />
                <h3 className={ui.cardTitle}>{event.title}</h3>
                <div className={style.cardMeta}>
                    {event.starts_at && (
                        <span>
                            <FontAwesomeIcon icon={faCalendarDays} />
                            <span className={style.mono}>{formatWhen(event.starts_at, event.ends_at, event.days)}</span>
                        </span>
                    )}
                    {event.venue && (
                        <span>
                            <FontAwesomeIcon icon={faLocationDot} />
                            {event.venue}
                        </span>
                    )}
                    {event.has_map && (
                        <span>
                            <FontAwesomeIcon icon={faChair} />
                            {seatBlockTitle(event)} com lugar marcado (à parte da entrada)
                        </span>
                    )}
                </div>
                {from !== null && (
                    <span className={style.fromPrice}>
                        a partir de <strong>{formatBRL(from)}</strong>
                        {kind === "member" ? " (sócio)" : ""}
                    </span>
                )}
            </div>
            <div className={ui.cardFoot}>
                <span className={style.cardAction}>{event.sales_open ? "Ver ingressos" : "Ver evento"}</span>
                <span className={ui.spacer} />
                <FontAwesomeIcon icon={faArrowRight} className={ui.muted} />
            </div>
        </Link>
    );
}

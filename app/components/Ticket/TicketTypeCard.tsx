"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChair, faFire } from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/ticket.module.css";
import { Pill } from "../UI/ui";
import type { TicketLot, TicketType } from "../../../services/ticket-api";
import { SEAT_NOT_ENTRY, fewLeft, formatBRL, formatInstant, isMembersOnly, isSeatType, type BuyerKind } from "../../../utils/ticket";

interface TicketTypeCardProps {
    type: TicketType;
    /** Quem está vendo: o preço dele fica realçado. */
    kind: BuyerKind;
    /** Para o visitante: link de login que volta para esta página. */
    loginHref?: string;
    /** Nome a mostrar (ex.: com o dia, no lugar marcado do evento de vários dias). */
    title?: string;
}

function Prices({ lot, kind }: { lot: TicketLot; kind: BuyerKind }) {
    const membersOnly = isMembersOnly(lot);
    return (
        <div className={style.prices}>
            {lot.price_member !== null && (
                <div className={`${style.priceRow} ${kind === "member" ? style.priceMine : ""}`}>
                    <span>Sócio</span>
                    <strong>{formatBRL(lot.price_member)}</strong>
                </div>
            )}
            <div className={`${style.priceRow} ${kind === "guest" && !membersOnly ? style.priceMine : ""}`}>
                <span>Não sócio</span>
                {membersOnly || lot.price_non_member === null ? (
                    <span>Só para sócios</span>
                ) : (
                    <strong>{formatBRL(lot.price_non_member)}</strong>
                )}
            </div>
        </div>
    );
}

/**
 * Tipo de ingresso com o lote à venda agora e os dois preços (o que vale para
 * quem está vendo, realçado). Tipo sem lote à venda: "Próximo lote a partir
 * de…", se a Lara mandou `next_lot`. O site não calcula lote nem preço.
 *
 * [lugares] Tipo de lugar marcado: "N lugares livres" (`seats_free`) e o aviso
 * de que não é entrada.
 */
export default function TicketTypeCard({ type, kind, loginHref, title }: TicketTypeCardProps) {
    const lot = type.available ? type.lot : null;
    const seat = isSeatType(type);
    const soldOut = !lot && (type.lot?.remaining === 0 || (seat && type.seats_free === 0));

    return (
        <article className={`${style.typeCard} ${lot ? "" : style.typeOff}`}>
            <div className={style.rowBetween}>
                <h3 className={style.typeName}>{title ?? type.name}</h3>
                {lot ? (
                    !seat &&
                    fewLeft(lot) && (
                        <Pill kind="warn" icon={faFire}>
                            Últimos ingressos
                        </Pill>
                    )
                ) : (
                    <Pill kind="off">{soldOut ? "Esgotado" : "Indisponível"}</Pill>
                )}
            </div>
            {type.description && <p className={style.typeDesc}>{type.description}</p>}
            {seat && (
                <span className={style.hint}>
                    <FontAwesomeIcon icon={faChair} />{" "}
                    {lot && type.seats_free !== null && (
                        <strong>
                            {type.seats_free} lugar{type.seats_free === 1 ? "" : "es"} livre{type.seats_free === 1 ? "" : "s"} ·{" "}
                        </strong>
                    )}
                    {SEAT_NOT_ENTRY}
                </span>
            )}

            {lot ? (
                <>
                    {lot.name && (
                        <span className={style.hint}>
                            {lot.name}
                            {lot.ends_at && (
                                <>
                                    {" "}
                                    · até <span className={style.mono}>{formatInstant(lot.ends_at)}</span>
                                </>
                            )}
                        </span>
                    )}
                    <Prices lot={lot} kind={kind} />
                    {kind === "guest" && lot.price_member !== null && loginHref && (
                        <span className={style.hint}>
                            Sócio?{" "}
                            <Link href={loginHref} className={ui.linkButton}>
                                Entre para pagar {formatBRL(lot.price_member)}
                            </Link>
                        </span>
                    )}
                </>
            ) : type.next_lot ? (
                <div className={style.stack}>
                    <p className={style.nextLot}>
                        Próximo lote{type.next_lot.name ? ` (${type.next_lot.name})` : ""}
                        {type.next_lot.starts_at && (
                            <>
                                {" "}
                                a partir de <strong>{formatInstant(type.next_lot.starts_at)}</strong>
                            </>
                        )}
                    </p>
                    <Prices lot={type.next_lot} kind={kind} />
                </div>
            ) : null}
        </article>
    );
}

"use client";

/**
 * Um pedido de ingressos, igual para o sócio e para o não sócio (muda só por
 * onde a tela lê e desiste — `onReload`/`onWithdraw` — e o modo do pagamento).
 *
 * O que aparece sai do `status` do pedido, como a Lara mandou:
 * - `pending_payment`: valor, contador até `hold_until`, Pagar e Desistir;
 * - `paid`: ingressos com QR Code, código e o PDF;
 * - `expired`: "o prazo acabou" e comprar de novo (novo pedido);
 * - `withdrawn`: desistência; `cancelled`: cancelado pela organização (+ estorno).
 *
 * Depois de pagar ou desistir a tela relê o pedido; nunca deduz a situação.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBan,
    faCalendarDays,
    faCircleCheck,
    faCreditCard,
    faFilePdf,
    faLocationDot,
    faTicket,
} from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/ticket.module.css";
import { Media, Note, Pill } from "../UI/ui";
import SocialFlashBox from "../Social/SocialFlashBox";
import CheckoutPayment, { type SocialPaymentOutcome } from "../Checkout/CheckoutPayment";
import HoldCountdown from "./HoldCountdown";
import {
    downloadOrderPdf,
    type OrderTicket,
    type TicketOrder,
    type TicketResult,
} from "../../../services/ticket-api";
import {
    buyHref,
    entryTexts,
    eventIsOver,
    formatBRL,
    formatInstant,
    formatWhen,
    orderTone,
    orderValueText,
    passportStillValid,
    refusalFlash,
    ticketStatusText,
    ticketTone,
    validityText,
    type BuyerKind,
    type TicketFlash,
} from "../../../utils/ticket";

interface TicketOrderViewProps {
    order: TicketOrder;
    kind: BuyerKind;
    onReload: () => Promise<void>;
    onWithdraw: () => Promise<TicketResult<TicketOrder>>;
}

function PriceText({ ticket, courtesy }: { ticket: OrderTicket; courtesy: boolean }) {
    if (courtesy) return <span>Cortesia</span>;
    if (ticket.discount_amount > 0) {
        return (
            <span>
                <span className={style.strike}>{formatBRL(ticket.list_price)}</span>
                {formatBRL(ticket.amount)}
            </span>
        );
    }
    return <span>{formatBRL(ticket.amount)}</span>;
}

function TicketCard({ ticket, order }: { ticket: OrderTicket; order: TicketOrder }) {
    const validity = validityText(ticket);
    const entries = entryTexts(ticket, order.event.days);
    const over = eventIsOver(order.event);
    // [v4] Passaporte "used" entrou num dia e segue valendo nos outros.
    const stillValid = passportStillValid(ticket, over);
    return (
        <article className={style.ticket}>
            <div className={style.rowBetween}>
                <span className={style.ticketHolder}>{ticket.holder_name}</span>
                {stillValid ? (
                    <Pill kind="ok">Válido nos outros dias</Pill>
                ) : (
                    <Pill kind={ticketTone(ticket.status)}>{ticketStatusText(ticket)}</Pill>
                )}
            </div>
            <span className={style.hint}>
                {ticket.type.name}
                {validity && ` · ${validity}`}
                {ticket.holder_cpf && (
                    <>
                        {" "}
                        · CPF <span className={style.mono}>{ticket.holder_cpf}</span>
                    </>
                )}
            </span>
            {ticket.qr_code && (
                <div className={style.qr}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- SVG em data URI da Lara */}
                    <img src={ticket.qr_code} alt={`QR Code do ingresso de ${ticket.holder_name}`} />
                </div>
            )}
            {ticket.code && (
                <span className={style.code} aria-label={`Código do ingresso: ${ticket.code}`}>
                    {ticket.code}
                </span>
            )}
            {entries.length > 0 ? (
                <ul className={style.entries}>
                    {entries.map((text) => (
                        <li key={text}>{text}</li>
                    ))}
                </ul>
            ) : (
                ticket.checked_in_at && <span className={style.hint}>Entrada em {formatInstant(ticket.checked_in_at)}</span>
            )}
            {ticket.validity === "passport" && (ticket.status === "valid" || stillValid) && entries.length > 0 && !over && (
                <span className={style.hint}>O passaporte continua valendo nos outros dias, com o mesmo QR Code.</span>
            )}
        </article>
    );
}

export default function TicketOrderView({ order, kind, onReload, onWithdraw }: TicketOrderViewProps) {
    const [flash, setFlash] = useState<TicketFlash | null>(null);
    const [paying, setPaying] = useState(false);
    const [confirmWithdraw, setConfirmWithdraw] = useState(false);
    const [busy, setBusy] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const flashRef = useRef<HTMLDivElement>(null);

    const showFlash = (next: TicketFlash) => {
        setFlash(next);
        requestAnimationFrame(() => flashRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    };

    const onPaymentResult = async (outcome: SocialPaymentOutcome) => {
        if (outcome.type === "success") {
            toast.success("Pagamento confirmado! Os ingressos também vão por e-mail.");
            setPaying(false);
            setFlash(null);
        } else if (outcome.type === "refused") {
            setPaying(false);
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
        // Em qualquer desfecho relê: a situação só vem da Lara.
        await onReload();
    };

    const withdraw = async () => {
        if (busy) return;
        setBusy(true);
        const result = await onWithdraw();
        setBusy(false);
        setConfirmWithdraw(false);
        if (result.ok) {
            toast.info("Você desistiu do pedido. Os lugares foram liberados.");
        } else if (result.kind !== "unauthorized") {
            showFlash(refusalFlash(result, "Não foi possível desistir"));
        }
        await onReload();
    };

    const downloadPdf = async () => {
        if (downloading) return;
        setDownloading(true);
        const result = await downloadOrderPdf(order.id);
        setDownloading(false);
        if (!result.ok) {
            showFlash(refusalFlash(result, "Não foi possível baixar o PDF"));
            if (result.reason === "invalid_status") await onReload();
            return;
        }
        const url = URL.createObjectURL(result.data);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ingressos-pedido-${order.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
    };

    const pending = order.status === "pending_payment";
    const paid = order.status === "paid";

    return (
        <div className={style.stack}>
            <div className={style.orderHead}>
                <div className={style.orderMedia}>
                    <Media src={order.event.image_url} alt={`Imagem de ${order.event.title}`} area="ingressos" icon={faTicket} ratio="video" />
                </div>
                <div className={style.stack}>
                    <div className={style.row}>
                        <Pill kind={orderTone(order.status)}>{order.status_label}</Pill>
                        <span className={`${style.hint} ${style.mono}`}>Pedido nº {order.id}</span>
                        {order.origin === "secretaria" && <span className={style.moduleTag}>Emitido pela secretaria</span>}
                    </div>
                    <h1 className={style.orderTitle}>{order.event.title}</h1>
                    <div className={style.hint}>
                        {order.event.starts_at && (
                            <div>
                                <FontAwesomeIcon icon={faCalendarDays} />{" "}
                                <span className={style.mono}>{formatWhen(order.event.starts_at, order.event.ends_at, order.event.days)}</span>
                            </div>
                        )}
                        {order.event.venue && (
                            <div>
                                <FontAwesomeIcon icon={faLocationDot} /> {order.event.venue}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div ref={flashRef}>{flash && <SocialFlashBox flash={flash} onClose={() => setFlash(null)} />}</div>

            {order.status === "expired" && (
                <Note tone="warn" icon={faBan}>
                    <strong>O prazo para pagar acabou.</strong> Os lugares foram liberados.{" "}
                    <Link href={buyHref(order.event, kind === "guest")} className={ui.linkButton}>
                        Comprar de novo
                    </Link>
                </Note>
            )}
            {order.status === "withdrawn" && (
                <Note tone="info" icon={faBan}>
                    Você desistiu deste pedido.
                </Note>
            )}
            {order.status === "cancelled" && (
                <Note tone="danger" icon={faBan}>
                    <strong>Pedido cancelado pela organização.</strong>
                    {order.payment?.refunded_amount ? (
                        <> Valor estornado: {formatBRL(order.payment.refunded_amount)}.</>
                    ) : null}
                </Note>
            )}
            {paid && (
                <Note tone="ok" icon={faCircleCheck}>
                    <strong>Pedido pago.</strong> Mostre o QR Code (ou o código) na portaria. Os ingressos também foram
                    enviados por e-mail.
                </Note>
            )}

            {pending && order.hold_until && <HoldCountdown until={order.hold_until} onExpire={onReload} />}

            <section className={ui.panel} aria-labelledby="resumo-pedido">
                <h2 className={ui.sectionTitle} id="resumo-pedido">
                    Resumo
                </h2>
                <ul className={style.summary}>
                    {order.tickets.map((ticket) => {
                        const validity = validityText(ticket);
                        return (
                            <li key={ticket.id} className={style.summaryLine}>
                                <span>
                                    {ticket.holder_name}
                                    <span className={ui.muted}>
                                        {" "}
                                        · {ticket.type.name}
                                        {validity && ` · ${validity}`}
                                        {ticket.lot?.name && ` · ${ticket.lot.name}`}
                                    </span>
                                </span>
                                <PriceText ticket={ticket} courtesy={order.courtesy} />
                            </li>
                        );
                    })}
                    {order.discount_total > 0 && !order.courtesy && (
                        <li className={`${style.summaryLine} ${style.discount}`}>
                            <span>Desconto{order.coupon_code ? ` (cupom ${order.coupon_code})` : ""}</span>
                            <span>− {formatBRL(order.discount_total)}</span>
                        </li>
                    )}
                </ul>
                <div className={style.summaryTotal}>
                    <span>Total</span>
                    <span>{orderValueText(order)}</span>
                </div>
                {order.paid_at && <span className={style.hint}>Pago em {formatInstant(order.paid_at)}</span>}
            </section>

            {pending && (
                <section className={ui.panel} aria-labelledby="pagamento">
                    <h2 className={ui.sectionTitle} id="pagamento">
                        Pagamento
                    </h2>
                    {paying ? (
                        <>
                            <CheckoutPayment ticketOrderId={order.id} ticketGuest={kind === "guest"} onTicketResult={onPaymentResult} />
                            <button type="button" className={ui.linkButton} onClick={() => setPaying(false)}>
                                Voltar
                            </button>
                        </>
                    ) : confirmWithdraw ? (
                        <div className={style.confirmBox}>
                            <span>Desistir deste pedido? Os lugares serão liberados e não dá para desfazer.</span>
                            <div className={style.row}>
                                <button type="button" className={`${ui.btn} ${ui.btnSm} ${ui.btnDanger}`} onClick={withdraw} disabled={busy}>
                                    {busy ? "Desistindo..." : "Sim, desistir"}
                                </button>
                                <button
                                    type="button"
                                    className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`}
                                    onClick={() => setConfirmWithdraw(false)}
                                    disabled={busy}
                                >
                                    Manter
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={style.row}>
                            <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => setPaying(true)}>
                                <FontAwesomeIcon icon={faCreditCard} /> Pagar {formatBRL(order.total)}
                            </button>
                            <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={() => setConfirmWithdraw(true)}>
                                Desistir
                            </button>
                        </div>
                    )}
                </section>
            )}

            {paid && (
                <section className={ui.section} aria-labelledby="ingressos">
                    <div className={ui.sectionHead}>
                        <h2 className={ui.sectionTitle} id="ingressos">
                            Ingressos
                        </h2>
                        <button type="button" className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`} onClick={downloadPdf} disabled={downloading}>
                            <FontAwesomeIcon icon={faFilePdf} /> {downloading ? "Gerando..." : "Baixar PDF"}
                        </button>
                    </div>
                    <div className={style.ticketGrid}>
                        {order.tickets.map((ticket) => (
                            <TicketCard key={ticket.id} ticket={ticket} order={order} />
                        ))}
                    </div>
                    <p className={style.hint}>Para desistir de um pedido pago, fale com a organização do evento.</p>
                </section>
            )}
        </div>
    );
}

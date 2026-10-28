"use client";

/**
 * Meus ingressos — para os dois públicos (fora do matcher do middleware):
 * - sócio logado: todos os pedidos dele (`GET tickets/my-orders`), inclusive
 *   os emitidos pela secretaria (pago por fora ou cortesia). Cada cartão abre
 *   o pedido, com os ingressos, o QR Code e o PDF;
 * - sem login: o "Meus ingressos" de quem comprou sem ser sócio (CPF + e-mail
 *   da compra + código enviado por e-mail) — ver GuestAccess.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faCalendarDays,
    faCircleExclamation,
    faMagnifyingGlass,
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
import GuestAccess from "../../components/Ticket/GuestAccess";
import { Media, PageHeader, Pill, SearchBar, matchesSearch } from "../../components/UI/ui";
import { fetchMyOrders, type TicketFailure, type TicketOrder } from "../../../services/ticket-api";
import { formatWhen, isSilent, orderCountText, orderHref, orderTone, orderValueText } from "../../../utils/ticket";

function OrderCard({ order }: { order: TicketOrder }) {
    const people = [...new Set(order.tickets.map((ticket) => ticket.holder_name))];
    return (
        <Link href={orderHref(order.id, "member")} className={ui.card}>
            <Media src={order.event.image_url} alt={`Imagem de ${order.event.title}`} area="ingressos" icon={faTicket} ratio="short" />
            <div className={ui.cardBody}>
                <span className={style.pillSlot}>
                    <Pill kind={orderTone(order.status)}>{order.status_label}</Pill>
                </span>
                <h3 className={ui.cardTitle}>{order.event.title}</h3>
                <div className={style.cardMeta}>
                    {order.event.starts_at && (
                        <span>
                            <FontAwesomeIcon icon={faCalendarDays} />
                            <span className={style.mono}>{formatWhen(order.event.starts_at, order.event.ends_at, order.event.days)}</span>
                        </span>
                    )}
                    <span>
                        <FontAwesomeIcon icon={faTicket} />
                        {orderCountText(order.tickets)}
                        {people.length > 0 && ` · ${people.join(", ")}`}
                    </span>
                </div>
            </div>
            <div className={ui.cardFoot}>
                <span className={style.mono}>{orderValueText(order)}</span>
                <span className={ui.spacer} />
                <span className={style.cardAction}>{order.status === "pending_payment" ? "Pagar" : "Ver"}</span>
                <FontAwesomeIcon icon={faArrowRight} className={ui.muted} />
            </div>
        </Link>
    );
}

function MemberOrders() {
    const [orders, setOrders] = useState<TicketOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<TicketFailure | null>(null);
    const [query, setQuery] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        const result = await fetchMyOrders();
        if (result.ok) {
            setOrders(result.data);
            setError(null);
        } else if (!isSilent(result)) {
            setError(result);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const visible = orders.filter((order) =>
        matchesSearch(query, order.event.title, order.status_label, ...order.tickets.map((ticket) => ticket.holder_name))
    );

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (error) {
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title="Não conseguimos carregar seus ingressos"
                description={error.error}
                tone="alert"
                action={
                    <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => load()}>
                        <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                    </button>
                }
            />
        );
    } else if (orders.length === 0) {
        body = (
            <ReplayNotice
                icon={faTicket}
                title="Você ainda não tem ingressos"
                description="Os pedidos que você fizer (e os emitidos pela secretaria) aparecem aqui."
                action={
                    <Link href="/ingressos" className={`${ui.btn} ${ui.btnPrimary}`}>
                        Ver eventos
                    </Link>
                }
            />
        );
    } else {
        body = (
            <>
                <SearchBar id="busca-meus-ingressos" value={query} onChange={setQuery} placeholder="Buscar evento ou pessoa" />
                {visible.length === 0 ? (
                    <ReplayNotice icon={faMagnifyingGlass} title={`Nada encontrado para “${query}”`} description="Confira a grafia ou limpe a busca." />
                ) : (
                    <div className={style.orderList}>
                        {visible.map((order) => (
                            <OrderCard key={order.id} order={order} />
                        ))}
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
                <PageHeader title="Meus ingressos" lead="Pedidos seus e das pessoas do seu título." />
                {body}
            </main>
            <Footer />
        </div>
    );
}

export default function MyTicketsPage() {
    const { status } = useSession();
    if (status === "authenticated") return <MemberOrders />;

    return (
        <div className={globalStyle.page}>
            <Header />
            <TicketCover />
            <main className={`${globalStyle.main} ${ui.page}`}>
                <PageHeader title="Meus ingressos" lead="Para quem comprou sem ser sócio: todos os seus pedidos, com QR Code e PDF." />
                {status === "loading" ? <Loading /> : <GuestAccess />}
            </main>
            <Footer />
        </div>
    );
}

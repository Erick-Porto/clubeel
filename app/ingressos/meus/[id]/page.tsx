"use client";

/**
 * Um pedido do sócio (`GET tickets/orders/{id}`; de outro sócio a Lara
 * responde 404 `order_not_found`). É também a confirmação depois da compra:
 * contador, pagamento, desistência e, pago, os ingressos com QR e PDF.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faCircleExclamation, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../../../styles/page.module.css";
import ui from "../../../../styles/ui.module.css";
import style from "../../../../styles/ticket.module.css";
import Header from "../../../components/Common/header";
import Footer from "../../../components/Common/footer";
import { Loading } from "../../../components/Common/loading";
import ReplayNotice from "../../../components/Replay/ReplayNotice";
import { TicketCover } from "../../../components/UI/covers";
import TicketOrderView from "../../../components/Ticket/TicketOrderView";
import { fetchMyOrder, withdrawMyOrder, type TicketFailure, type TicketOrder } from "../../../../services/ticket-api";
import { idFromParam, isSilent } from "../../../../utils/ticket";

export default function MyTicketOrderPage() {
    const params = useParams();
    const orderId = idFromParam(params?.id);
    const [order, setOrder] = useState<TicketOrder | null>(null);
    const [error, setError] = useState<TicketFailure | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!orderId) {
            setLoading(false);
            return;
        }
        const result = await fetchMyOrder(orderId);
        if (result.ok) {
            setOrder(result.data);
            setError(null);
        } else if (!isSilent(result)) {
            setError(result);
        }
        setLoading(false);
    }, [orderId]);

    useEffect(() => {
        load();
    }, [load]);

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (!order) {
        const notFound = !orderId || error?.status === 404;
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title={notFound ? "Pedido não encontrado" : "Não conseguimos carregar o pedido"}
                description={notFound ? "Confira seus pedidos em Meus ingressos." : error?.error}
                tone="alert"
                action={
                    notFound ? (
                        <Link href="/ingressos/meus" className={`${ui.btn} ${ui.btnPrimary}`}>
                            Meus ingressos
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
        body = <TicketOrderView order={order} kind="member" onReload={load} onWithdraw={() => withdrawMyOrder(order.id)} />;
    }

    return (
        <div className={globalStyle.page}>
            <Header />
            <TicketCover />
            <main className={`${globalStyle.main} ${ui.page}`}>
                <Link href="/ingressos/meus" className={style.backLink}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Meus ingressos
                </Link>
                {body}
            </main>
            <Footer />
        </div>
    );
}

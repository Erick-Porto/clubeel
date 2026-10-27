"use client";

/**
 * Pedido do NÃO SÓCIO — a confirmação depois da compra e a página do link do
 * e-mail (`/ingressos/pedido/{id}?token=…`).
 *
 * Com `?token=` na URL, o token é trocado pelo cookie httpOnly deste aparelho
 * (`/api/ingressos/pedidos/{id}/abrir`, que confere na Lara) e sai da URL na
 * mesma hora — não fica no histórico nem vai no Referer. Sem token, a página
 * lê o pedido com o cookie gravado na compra ou num link aberto antes.
 * Sem cookie ou com token errado: a Lara responde `order_not_found` e a página
 * oferece o "perdi o link".
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import {
    fetchGuestOrder,
    openGuestOrder,
    withdrawGuestOrder,
    type TicketFailure,
    type TicketOrder,
} from "../../../../services/ticket-api";
import { idFromParam } from "../../../../utils/ticket";

function GuestOrderContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = idFromParam(params?.id);
    const token = searchParams?.get("token") ?? null;

    const [order, setOrder] = useState<TicketOrder | null>(null);
    const [error, setError] = useState<TicketFailure | null>(null);
    const [loading, setLoading] = useState(true);
    const opened = useRef(false);
    // Com o pedido na tela, uma releitura que falha não o substitui pelo erro.
    const hasOrder = useRef(false);

    const show = (next: TicketOrder) => {
        hasOrder.current = true;
        setOrder(next);
        setError(null);
    };

    const load = useCallback(async () => {
        if (!orderId) return;
        const result = await fetchGuestOrder(orderId);
        if (result.ok) show(result.data);
        else if (!hasOrder.current) setError(result);
        setLoading(false);
    }, [orderId]);

    useEffect(() => {
        if (!orderId) {
            setLoading(false);
            return;
        }
        if (token && !opened.current) {
            opened.current = true;
            (async () => {
                const result = await openGuestOrder(orderId, token);
                // Tira o token da URL de qualquer jeito (valendo ou não).
                router.replace(`/ingressos/pedido/${orderId}`);
                if (result.ok) show(result.data);
                else setError(result);
                setLoading(false);
            })();
            return;
        }
        if (!token && !opened.current) {
            opened.current = true;
            load();
        }
    }, [orderId, token, router, load]);

    if (loading) return <Loading />;

    if (!order) {
        const notFound = !orderId || error?.reason === "order_not_found" || error?.status === 404;
        return (
            <ReplayNotice
                icon={faCircleExclamation}
                title={notFound ? "Não encontramos este pedido" : "Não conseguimos carregar o pedido"}
                description={
                    notFound
                        ? "Abra o link que enviamos para o seu e-mail neste aparelho. Se não encontrar o e-mail, peça o link de novo."
                        : error?.error
                }
                tone="alert"
                action={
                    notFound ? (
                        <Link href="/ingressos/perdi-o-link" className={`${ui.btn} ${ui.btnPrimary}`}>
                            Perdi o link
                        </Link>
                    ) : (
                        <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => load()}>
                            <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                        </button>
                    )
                }
            />
        );
    }

    return (
        <TicketOrderView
            order={order}
            kind="guest"
            onReload={load}
            onWithdraw={() => withdrawGuestOrder(order.id)}
        />
    );
}

export default function GuestOrderPage() {
    return (
        <div className={globalStyle.page}>
            <Header />
            <TicketCover />
            <main className={`${globalStyle.main} ${ui.page}`}>
                <Link href="/ingressos" className={style.backLink}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Eventos
                </Link>
                <Suspense fallback={<Loading />}>
                    <GuestOrderContent />
                </Suspense>
            </main>
            <Footer />
        </div>
    );
}

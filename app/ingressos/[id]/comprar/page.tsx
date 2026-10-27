"use client";

/**
 * Compra de ingressos de um evento. Aberta (o não sócio compra sem login):
 * - sócio logado → checkout do sócio (pessoas do título, preço de sócio);
 * - sem login, ou o sócio no atalho `?modo=nao-socio` (alguém de fora do
 *   título) → checkout do não sócio.
 *
 * O evento é RELIDO ao abrir (o lote vira sozinho: esgotou ou passou a data);
 * o site nunca usa preço guardado de outra tela. Criado o pedido, a pessoa
 * segue para a página dele, onde estão o contador e o pagamento.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
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
import { PageHeader } from "../../../components/UI/ui";
import MemberCheckout from "../../../components/Ticket/MemberCheckout";
import GuestCheckout from "../../../components/Ticket/GuestCheckout";
import { fetchEvent, type TicketEvent, type TicketFailure } from "../../../../services/ticket-api";
import { eventHref, formatInstant, formatWhen, idFromParam } from "../../../../utils/ticket";

function BuyContent() {
    const { status } = useSession();
    const params = useParams();
    const pathname = usePathname() ?? "";
    const router = useRouter();
    const searchParams = useSearchParams();
    const eventId = idFromParam(params?.id);
    const guestMode = searchParams?.get("modo") === "nao-socio";

    const [event, setEvent] = useState<TicketEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<TicketFailure | null>(null);

    const load = useCallback(
        async (quiet = false) => {
            if (!eventId) {
                setLoading(false);
                return;
            }
            if (!quiet) setLoading(true);
            const result = await fetchEvent(eventId);
            if (result.ok) {
                setEvent(result.data);
                setError(null);
            } else if (!quiet) {
                setError(result);
            }
            setLoading(false);
        },
        [eventId]
    );

    useEffect(() => {
        load();
    }, [load]);

    const reloadQuiet = useCallback(() => load(true), [load]);

    let body: React.ReactNode;
    if (loading || status === "loading") {
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
    } else if (!event.sales_open || event.status === "finished") {
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title={event.status === "finished" ? "Evento encerrado" : "Vendas fechadas"}
                description={
                    event.status !== "finished" && event.sales_starts_at && Date.parse(event.sales_starts_at) > Date.now()
                        ? `As vendas abrem em ${formatInstant(event.sales_starts_at)}.`
                        : "As vendas deste evento não estão abertas."
                }
                action={
                    <Link href={eventHref(event)} className={`${ui.btn} ${ui.btnPrimary}`}>
                        Ver o evento
                    </Link>
                }
            />
        );
    } else if (status === "authenticated" && !guestMode) {
        body = (
            <MemberCheckout
                event={event}
                onEventReload={reloadQuiet}
                onGuestMode={() => router.push(`${pathname}?modo=nao-socio`)}
            />
        );
    } else {
        body = (
            <GuestCheckout
                event={event}
                onEventReload={reloadQuiet}
                onMemberMode={status === "authenticated" ? () => router.push(pathname) : undefined}
            />
        );
    }

    return (
        <>
            {event && (
                <Link href={eventHref(event)} className={style.backLink}>
                    <FontAwesomeIcon icon={faArrowLeft} /> {event.title}
                </Link>
            )}
            {event && (
                <PageHeader
                    kicker={status === "authenticated" && !guestMode ? "Compra de sócio" : "Compra sem cadastro"}
                    title="Comprar ingressos"
                    lead={[formatWhen(event.starts_at, event.ends_at, event.days), event.venue].filter(Boolean).join(" · ")}
                />
            )}
            {body}
        </>
    );
}

export default function TicketBuyPage() {
    return (
        <div className={globalStyle.page}>
            <Header />
            <TicketCover />
            <main className={`${globalStyle.main} ${ui.page}`}>
                <Suspense fallback={<Loading />}>
                    <BuyContent />
                </Suspense>
            </main>
            <Footer />
        </div>
    );
}

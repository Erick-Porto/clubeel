"use client";

/**
 * Vitrine de eventos — aberta a qualquer visitante (o não sócio compra sem
 * login). Cartões com imagem, título, data, local e "a partir de" (o menor
 * preço à venda para quem está vendo: sócio logado → preço de sócio).
 * Encerrados ficam no fim da lista.
 */

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleExclamation, faMagnifyingGlass, faRotateRight, faTicket } from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../styles/page.module.css";
import ui from "../../styles/ui.module.css";
import Header from "../components/Common/header";
import Footer from "../components/Common/footer";
import { Loading } from "../components/Common/loading";
import ReplayNotice from "../components/Replay/ReplayNotice";
import { TicketCover } from "../components/UI/covers";
import { PageHeader, SearchBar, matchesSearch } from "../components/UI/ui";
import EventCard from "../components/Ticket/EventCard";
import { fetchEvents, type TicketEvent, type TicketFailure } from "../../services/ticket-api";

function startTime(event: TicketEvent): number {
    const time = event.starts_at ? Date.parse(event.starts_at) : NaN;
    return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

export default function TicketEventsPage() {
    const { status } = useSession();
    const [events, setEvents] = useState<TicketEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<TicketFailure | null>(null);
    const [query, setQuery] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        const result = await fetchEvents();
        if (result.ok) {
            setEvents(result.data);
            setError(null);
        } else {
            setError(result);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const kind = status === "authenticated" ? "member" : "guest";
    const visible = events
        .filter((event) => matchesSearch(query, event.title, event.venue, event.description))
        .sort((a, b) => Number(a.status === "finished") - Number(b.status === "finished") || startTime(a) - startTime(b));

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (error) {
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title="Não conseguimos carregar os eventos"
                description={error.error}
                tone="alert"
                action={
                    <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => load()}>
                        <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                    </button>
                }
            />
        );
    } else if (events.length === 0) {
        body = (
            <ReplayNotice
                icon={faTicket}
                title="Nenhum evento à venda agora"
                description="Quando o clube abrir as vendas de um evento, ele aparece nesta página."
            />
        );
    } else {
        body = (
            <>
                <SearchBar id="busca-eventos" value={query} onChange={setQuery} placeholder="Buscar evento ou local" />
                {visible.length === 0 ? (
                    <ReplayNotice
                        icon={faMagnifyingGlass}
                        title={`Nada encontrado para “${query}”`}
                        description="Confira a grafia ou limpe a busca."
                    />
                ) : (
                    <div className={ui.grid}>
                        {visible.map((event) => (
                            <EventCard key={event.id} event={event} kind={kind} />
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
                <PageHeader
                    title="Eventos"
                    lead={
                        kind === "member"
                            ? "Compre para você e para as pessoas do seu título, pelo preço de sócio."
                            : "Compre sem cadastro. Sócio paga menos entrando com a conta dele."
                    }
                />
                {body}
            </main>
            <Footer />
        </div>
    );
}

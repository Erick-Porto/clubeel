"use client";

/**
 * Lista de torneios — aberta a qualquer visitante (fora do matcher do
 * middleware). Mostra exatamente o que a Lara devolve em `GET tournaments`:
 * publicados, em andamento e encerrados, do mais recente para o mais antigo
 * (rascunho e cancelado nunca chegam). O filtro por modalidade usa as
 * modalidades que vieram na própria lista.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleExclamation, faMagnifyingGlass, faRotateRight, faTrophy } from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../styles/page.module.css";
import ui from "../../styles/ui.module.css";
import style from "../../styles/tournament.module.css";
import Header from "../components/Common/header";
import Footer from "../components/Common/footer";
import { Loading } from "../components/Common/loading";
import ReplayNotice from "../components/Replay/ReplayNotice";
import { TournamentCover } from "../components/UI/covers";
import { PageHeader, SearchBar, matchesSearch } from "../components/UI/ui";
import TournamentCard from "../components/Tournament/TournamentCard";
import { fetchTournaments, type Tournament, type TournamentFailure } from "../../services/tournament-api";

export default function TournamentsPage() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<TournamentFailure | null>(null);
    const [query, setQuery] = useState("");
    const [groupId, setGroupId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const result = await fetchTournaments();
        if (result.ok) setTournaments(result.data);
        else setError(result);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const groups = useMemo(() => {
        const map = new Map<number, string>();
        tournaments.forEach((tournament) => {
            if (tournament.place_group) map.set(tournament.place_group.id, tournament.place_group.name);
        });
        return [...map.entries()];
    }, [tournaments]);

    const visible = tournaments.filter(
        (tournament) =>
            (groupId === null || tournament.place_group?.id === groupId) &&
            matchesSearch(
                query,
                tournament.title,
                tournament.place_group?.name,
                ...tournament.categories.map((category) => category.name)
            )
    );

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (error) {
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title="Não conseguimos carregar os torneios"
                description={error.error}
                tone="alert"
                action={
                    <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => load()}>
                        <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                    </button>
                }
            />
        );
    } else if (tournaments.length === 0) {
        body = (
            <ReplayNotice
                icon={faTrophy}
                title="Nenhum torneio por aqui ainda"
                description="Quando o clube abrir um torneio, ele aparece nesta página."
            />
        );
    } else {
        body = (
            <>
                <div className={style.filters}>
                    <SearchBar id="busca-torneios" value={query} onChange={setQuery} placeholder="Buscar torneio ou categoria" />
                    {groups.length > 1 && (
                        <nav className={ui.seg} aria-label="Modalidade">
                            <button
                                type="button"
                                className={`${ui.segItem} ${groupId === null ? ui.segActive : ""}`}
                                aria-pressed={groupId === null}
                                onClick={() => setGroupId(null)}
                            >
                                Todas
                            </button>
                            {groups.map(([id, name]) => (
                                <button
                                    key={id}
                                    type="button"
                                    className={`${ui.segItem} ${groupId === id ? ui.segActive : ""}`}
                                    aria-pressed={groupId === id}
                                    onClick={() => setGroupId(id)}
                                >
                                    {name}
                                </button>
                            ))}
                        </nav>
                    )}
                </div>
                {visible.length === 0 ? (
                    <ReplayNotice
                        icon={faMagnifyingGlass}
                        title={query ? `Nada encontrado para “${query}”` : "Nenhum torneio nesta modalidade"}
                        description="Confira a grafia ou limpe os filtros."
                    />
                ) : (
                    <div className={ui.grid}>
                        {visible.map((tournament) => (
                            <TournamentCard key={tournament.id} tournament={tournament} />
                        ))}
                    </div>
                )}
            </>
        );
    }

    return (
        <div className={globalStyle.page}>
            <Header />
            <TournamentCover />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <PageHeader
                    title="Torneios"
                    lead="Escolha um torneio para ver as categorias, o regulamento e, nas inscrições abertas, inscrever-se. Sócios titulares e dependentes podem participar."
                />
                {body}
            </main>

            <Footer />
        </div>
    );
}

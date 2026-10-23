"use client";

/**
 * Entrada da EQUIPE DO CLUBE (lançamento de resultados): escolhe o torneio e
 * segue para /torneios/<id>/equipe, onde vai o código de lançamento.
 *
 * Aberta, como a tela do lançamento (fora do matcher; o código é a
 * autorização). A lista é a mesma pública de `GET tournaments`, só com os
 * torneios publicados ou em andamento — pelo contrato da Lara, encerrado não
 * aceita resultado pelo site (`results_closed`). Em andamento vem primeiro.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faCircleExclamation, faRotateRight, faTrophy } from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/tournament.module.css";
import { Loading } from "../../components/Common/loading";
import ReplayNotice from "../../components/Replay/ReplayNotice";
import StaffShell from "../../components/Tournament/StaffShell";
import { TournamentStatusPill } from "../../components/Tournament/TournamentCard";
import { fetchTournaments, type Tournament, type TournamentFailure } from "../../../services/tournament-api";
import { formatDayRange, tournamentSlug } from "../../../utils/tournament";

const ACCEPTS_RESULTS = ["in_progress", "published"];

export default function StaffEntryPage() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<TournamentFailure | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const result = await fetchTournaments();
        if (result.ok) {
            setTournaments(
                result.data
                    .filter((tournament) => ACCEPTS_RESULTS.includes(tournament.status))
                    .sort((a, b) => ACCEPTS_RESULTS.indexOf(a.status) - ACCEPTS_RESULTS.indexOf(b.status))
            );
        } else {
            setError(result);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

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
                title="Nenhum torneio aceitando resultados"
                description="Os torneios publicados ou em andamento aparecem aqui."
            />
        );
    } else {
        body = (
            <div className={style.matchStack}>
                {tournaments.map((tournament) => (
                    <Link
                        key={tournament.id}
                        href={`/torneios/${tournamentSlug(tournament.title, tournament.id)}/equipe`}
                        className={`${ui.card} ${style.staffPick}`}
                    >
                        <div className={ui.cardBody}>
                            <TournamentStatusPill tournament={tournament} />
                            <strong className={ui.cardTitle}>{tournament.title}</strong>
                            <span className={style.hint}>
                                {[tournament.place_group?.name, formatDayRange(tournament.starts_on, tournament.ends_on)]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </span>
                        </div>
                        <FontAwesomeIcon icon={faArrowRight} className={ui.muted} />
                    </Link>
                ))}
            </div>
        );
    }

    return (
        <StaffShell title="Área da equipe" subtitle="Lançamento de resultados">
            <div className={ui.panel}>
                <h1 className={ui.sectionTitle}>Qual torneio?</h1>
                <p className={style.hint}>
                    Escolha o torneio e entre com o código de lançamento que a organização passou para você.
                </p>
            </div>
            {body}
        </StaffShell>
    );
}

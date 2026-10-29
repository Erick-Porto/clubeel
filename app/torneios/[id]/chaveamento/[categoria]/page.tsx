"use client";

/**
 * Chaveamento de uma categoria — aberto a qualquer visitante. Só existe depois
 * que a organização o DIVULGA no Lara (antes: 404 `bracket_not_published`);
 * gerar de novo tira do site até nova divulgação.
 *
 * Os resultados aparecem no mesmo endpoint conforme são lançados (no Lara ou
 * pela equipe no site). Com o torneio em andamento, a tela relê a cada minuto.
 * O time do sócio logado é destacado (comparado com os times das inscrições
 * dele).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faCircleExclamation, faDiagramProject, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../../../../styles/page.module.css";
import ui from "../../../../../styles/ui.module.css";
import style from "../../../../../styles/tournament.module.css";
import Header from "../../../../components/Common/header";
import Footer from "../../../../components/Common/footer";
import { Loading } from "../../../../components/Common/loading";
import ReplayNotice from "../../../../components/Replay/ReplayNotice";
import { TournamentCover } from "../../../../components/UI/covers";
import { PageHeader } from "../../../../components/UI/ui";
import BracketView from "../../../../components/Tournament/BracketView";
import {
    fetchBracket,
    fetchMyRegistrations,
    fetchTournament,
    type Tournament,
    type TournamentBracket,
    type TournamentFailure,
} from "../../../../../services/tournament-api";
import { bracketHref, formatInstant, idFromParam, refusalFlash, tournamentHref } from "../../../../../utils/tournament";

const REFRESH_MS = 60_000;

export default function BracketPage() {
    const { status } = useSession();
    const params = useParams();
    const tournamentId = idFromParam(params?.id);
    const categoryId = idFromParam(params?.categoria);

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [bracket, setBracket] = useState<TournamentBracket | null>(null);
    const [error, setError] = useState<TournamentFailure | null>(null);
    const [loading, setLoading] = useState(true);
    const [myTeams, setMyTeams] = useState<Set<number>>(new Set());
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const hasBracket = useRef(false);

    const load = useCallback(
        async (quiet = false) => {
            if (!tournamentId || !categoryId) {
                setLoading(false);
                return;
            }
            if (!quiet) setLoading(true);
            const [tournamentResult, bracketResult] = await Promise.all([
                fetchTournament(tournamentId),
                fetchBracket(tournamentId, categoryId),
            ]);
            if (tournamentResult.ok) setTournament(tournamentResult.data);
            if (bracketResult.ok) {
                hasBracket.current = true;
                setBracket(bracketResult.data);
                setError(null);
                setUpdatedAt(new Date());
            } else if (!quiet || !hasBracket.current || bracketResult.status === 404) {
                // 404 numa releitura = a organização tirou do ar (gerou de novo): some da tela.
                hasBracket.current = false;
                setBracket(null);
                setError(bracketResult);
            }
            setLoading(false);
        },
        [tournamentId, categoryId]
    );

    useEffect(() => {
        load();
    }, [load]);

    // Releitura a cada minuto só com o torneio em andamento e a aba visível.
    const live = tournament?.status === "in_progress";
    useEffect(() => {
        if (!live) return;
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") load(true);
        }, REFRESH_MS);
        return () => clearInterval(timer);
    }, [live, load]);

    useEffect(() => {
        if (status !== "authenticated" || !tournamentId) return;
        let active = true;
        fetchMyRegistrations().then((result) => {
            if (!active || !result.ok) return;
            setMyTeams(
                new Set(
                    result.data
                        .filter((registration) => registration.tournament.id === tournamentId && registration.team)
                        .map((registration) => registration.team!.id)
                )
            );
        });
        return () => {
            active = false;
        };
    }, [status, tournamentId]);

    const otherCategories = (tournament?.categories ?? []).filter(
        (category) => category.bracket_published && category.id !== categoryId
    );
    const backHref = tournament ? tournamentHref(tournament.title, tournament.id) : "/torneios";

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (!bracket) {
        const flash = error ? refusalFlash(error, "Não conseguimos carregar o chaveamento") : null;
        const notPublished = error?.reason === "bracket_not_published";
        body = (
            <ReplayNotice
                icon={notPublished ? faDiagramProject : faCircleExclamation}
                title={flash?.title ?? "Chaveamento não encontrado"}
                description={
                    notPublished
                        ? "Assim que a organização divulgar o chaveamento desta categoria, ele aparece aqui."
                        : flash?.text
                }
                tone={notPublished ? "neutral" : "alert"}
                action={
                    error && error.status !== 404 ? (
                        <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => load()}>
                            <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                        </button>
                    ) : (
                        <Link href={backHref} className={`${ui.btn} ${ui.btnSecondary}`}>
                            Voltar ao torneio
                        </Link>
                    )
                }
            />
        );
    } else {
        body = (
            <>
                {bracket.stages.length === 0 ? (
                    <p className={style.hint}>Sem jogos nesta categoria.</p>
                ) : (
                    <BracketView stages={bracket.stages} highlight={myTeams} />
                )}
                <p className={style.hint}>
                    {bracket.published_at ? `Divulgado em ${formatInstant(bracket.published_at)}. ` : ""}
                    {live && updatedAt
                        ? `Atualiza sozinho a cada minuto (última leitura às ${updatedAt.toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                          })}).`
                        : ""}
                </p>
            </>
        );
    }

    return (
        <div className={globalStyle.page}>
            <Header />
            <TournamentCover />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <Link href={backHref} className={style.backLink}>
                    <FontAwesomeIcon icon={faArrowLeft} /> {tournament?.title ?? "Torneio"}
                </Link>
                <PageHeader
                    kicker="Chaveamento"
                    title={bracket?.category_name ?? tournament?.categories.find((c) => c.id === categoryId)?.name ?? "Categoria"}
                    actions={
                        bracket ? (
                            <button type="button" className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`} onClick={() => load(true)}>
                                <FontAwesomeIcon icon={faRotateRight} /> Atualizar
                            </button>
                        ) : undefined
                    }
                />
                {tournament && otherCategories.length > 0 && (
                    <nav className={ui.seg} aria-label="Outras categorias">
                        <span className={`${ui.segItem} ${ui.segActive}`} aria-current="page">
                            {bracket?.category_name ?? "Esta categoria"}
                        </span>
                        {otherCategories.map((category) => (
                            <Link key={category.id} href={bracketHref(tournament, category)} className={ui.segItem}>
                                {category.name}
                            </Link>
                        ))}
                    </nav>
                )}
                {body}
            </main>

            <Footer />
        </div>
    );
}

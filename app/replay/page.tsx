"use client";

/**
 * Entrada da área de Replay, organizada por esporte.
 *
 * O primeiro nível é o esporte; a escolha da quadra acontece dentro dele. Numa
 * lista corrida, "Quadra 1", "Quadra 2" e "Quadra 3" não dizem de que jogo se
 * trata — o esporte é o que a pessoa tem na cabeça quando vem procurar o lance.
 *
 * Página ABERTA — não exige login, por decisão de negócio: o replay é do jogo,
 * e o jogo aconteceu em espaço coletivo. Por isso `/replay` não entra no
 * matcher do `middleware.ts`.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faCircleExclamation,
    faFilm,
    faMagnifyingGlass,
    faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../styles/page.module.css";
import ui from "../../styles/ui.module.css";
import style from "../../styles/replay.module.css";
import Header from "../components/Common/header";
import Footer from "../components/Common/footer";
import { Loading } from "../components/Common/loading";
import ReplayNotice from "../components/Replay/ReplayNotice";
import ReplaySportSection from "../components/Replay/ReplaySportSection";
import { ReplayCover } from "../components/UI/covers";
import { PageHeader, SearchBar, matchesSearch } from "../components/UI/ui";
import { fetchReplayPlaces } from "../../services/replay-api";
import {
    formatRelative,
    groupPlacesBySport,
    placeSlug,
    type ReplayGroupedPlaces,
} from "../../utils/replay";

export default function ReplayPlacesPage() {
    const [groups, setGroups] = useState<ReplayGroupedPlaces[]>([]);
    const [openGroups, setOpenGroups] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const result = await fetchReplayPlaces();

        if (!result.ok) {
            setError(result.message);
            setGroups([]);
            setOpenGroups([]);
        } else {
            setGroups(groupPlacesBySport(result.data));
            // Todos os esportes começam fechados: a tela abre mostrando a
            // lista inteira de uma vez, e quem procura escolhe o seu.
            setOpenGroups([]);
        }

        setIsLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const toggleGroup = (id: number) => {
        setOpenGroups((current) =>
            current.includes(id) ? current.filter((openId) => openId !== id) : [...current, id]
        );
    };

    // A busca acha pelo esporte (mostra todas as quadras dele) ou pelo nome da
    // quadra (mostra só as que casam). Com busca ativa, os esportes achados abrem.
    const searching = query.trim() !== "";
    const visibleGroups = groups
        .map((group) =>
            matchesSearch(query, group.name)
                ? group
                : { ...group, places: group.places.filter((place) => matchesSearch(query, place.name)) }
        )
        .filter((group) => group.places.length > 0);

    return (
        <div className={globalStyle.page}>
            <Header />
            <ReplayCover />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <PageHeader
                    title="Os melhores lances das quadras"
                    lead={
                        <>
                            Apertou o botão na quadra, o lance fica gravado aqui. Os vídeos ficam
                            disponíveis por <strong>7 dias</strong> — depois disso são apagados, então
                            baixe o que quiser guardar.
                        </>
                    }
                />

                {isLoading ? (
                    <Loading />
                ) : error ? (
                    <ReplayNotice
                        icon={faCircleExclamation}
                        title="Não conseguimos carregar as quadras"
                        description={error}
                        tone="alert"
                        action={
                            <button type="button" className={style.replayButton} onClick={load}>
                                <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                            </button>
                        }
                    />
                ) : groups.length === 0 ? (
                    <ReplayNotice
                        icon={faFilm}
                        title="Nenhum vídeo disponível no momento"
                        description="Assim que alguém apertar o botão de replay em uma quadra, o vídeo aparece aqui."
                    />
                ) : (
                    <>
                        <SearchBar id="busca-replay" value={query} onChange={setQuery} placeholder="Buscar esporte ou quadra" />

                        {visibleGroups.length === 0 ? (
                            <ReplayNotice
                                icon={faMagnifyingGlass}
                                title={`Nada encontrado para “${query}”`}
                                description="Confira a grafia ou limpe a busca."
                            />
                        ) : (
                            <div className={style.groupList}>
                                {visibleGroups.map((group) => {
                                    const isOpen = searching || openGroups.includes(group.id);
                                    const panelId = `replay-grupo-${group.id}`;

                                    return (
                                        <ReplaySportSection
                                            key={group.id}
                                            name={group.name}
                                            meta={
                                                `${
                                                    group.places.length === 1
                                                        ? "1 quadra"
                                                        : `${group.places.length} quadras`
                                                } · ${
                                                    group.videosCount === 1
                                                        ? "1 vídeo"
                                                        : `${group.videosCount} vídeos`
                                                } · último ${formatRelative(group.lastRecordedAt)}`
                                            }
                                            openLabel="Ver quadras"
                                            isOpen={isOpen}
                                            onToggle={() => toggleGroup(group.id)}
                                            panelId={panelId}
                                        >
                                            <div className={style.placeGrid}>
                                                    {group.places.map((place) => (
                                                        <Link
                                                            key={place.id}
                                                            href={`/replay/${placeSlug(place.name, place.id)}`}
                                                            className={style.placeCard}
                                                            referrerPolicy="no-referrer"
                                                            rel="noopener noreferrer"
                                                        >
                                                            {/* O número é o que a pessoa compara ao escolher a quadra. */}
                                                            <span className={style.placeCardTally}>
                                                                <strong>{place.videos_count}</strong>
                                                                <small>
                                                                    {place.videos_count === 1
                                                                        ? "vídeo"
                                                                        : "vídeos"}
                                                                </small>
                                                            </span>

                                                            <span className={style.placeCardBody}>
                                                                {/* O esporte já está na banda acima. */}
                                                                <span className={style.placeCardName}>
                                                                    {place.name}
                                                                </span>
                                                                <span className={style.placeCardLast}>
                                                                    último{" "}
                                                                    {formatRelative(place.last_recorded_at)}
                                                                </span>
                                                                <span className={style.placeCardAction}>
                                                                    Ver replays
                                                                    <FontAwesomeIcon icon={faArrowRight} />
                                                                </span>
                                                            </span>
                                                        </Link>
                                                    ))}
                                            </div>
                                        </ReplaySportSection>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </main>

            <Footer />
        </div>
    );
}

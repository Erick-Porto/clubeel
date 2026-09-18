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
    faRotateRight,
    faVideo,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../styles/page.module.css";
import style from "../../styles/replay.module.css";
import Header from "../components/Common/header";
import Footer from "../components/Common/footer";
import { Loading } from "../components/Common/loading";
import ReplayNotice from "../components/Replay/ReplayNotice";
import ReplaySportSection from "../components/Replay/ReplaySportSection";
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

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const result = await fetchReplayPlaces();

        if (!result.ok) {
            setError(result.message);
            setGroups([]);
            setOpenGroups([]);
        } else {
            const grouped = groupPlacesBySport(result.data);
            setGroups(grouped);
            // O esporte com gravação mais recente já vem aberto: quem chega
            // aqui quase sempre quer o jogo que acabou de acontecer.
            setOpenGroups(grouped.length > 0 ? [grouped[0].id] : []);
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

    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={0} onlyScroll={false} />

            <section className={style.replaySection}>
                <div className={style.replayHeader}>
                    <span className={style.replayKicker}>
                        <FontAwesomeIcon icon={faVideo} /> Replay
                    </span>
                    <h1 className={style.replayTitle}>Os melhores lances das quadras</h1>
                    <p className={style.replayLead}>
                        Apertou o botão na quadra, o lance fica gravado aqui. Os vídeos ficam
                        disponíveis por <strong>7 dias</strong> — depois disso são apagados, então
                        baixe o que quiser guardar.
                    </p>
                    <Link href="/meus-videos" className={style.replayLinkInline}>
                        Ver os vídeos das minhas reservas <FontAwesomeIcon icon={faArrowRight} />
                    </Link>
                </div>

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
                    <div className={style.groupList}>
                        {groups.map((group) => {
                            const isOpen = openGroups.includes(group.id);
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
            </section>

            <Footer />
        </div>
    );
}

"use client";

/**
 * Entrada da área de Replay: as quadras que têm vídeo disponível agora.
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
import { fetchReplayPlaces, type ReplayPlace } from "../../services/replay-api";
import { formatRelative, placeSlug } from "../../utils/replay";

export default function ReplayPlacesPage() {
    const [places, setPlaces] = useState<ReplayPlace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const result = await fetchReplayPlaces();

        if (!result.ok) {
            setError(result.message);
            setPlaces([]);
        } else {
            setPlaces(result.data);
        }

        setIsLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

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
                ) : places.length === 0 ? (
                    <ReplayNotice
                        icon={faFilm}
                        title="Nenhum vídeo disponível no momento"
                        description="Assim que alguém apertar o botão de replay em uma quadra, o vídeo aparece aqui."
                    />
                ) : (
                    <div className={style.placeGrid}>
                        {places.map((place) => (
                            <Link
                                key={place.id}
                                href={`/replay/${placeSlug(place.name, place.id)}`}
                                className={style.placeCard}
                                referrerPolicy="no-referrer"
                                rel="noopener noreferrer"
                            >
                                <div className={style.placeCardTop}>
                                    <FontAwesomeIcon icon={faFilm} className={style.placeCardIcon} />
                                    <div>
                                        <h2 className={style.placeCardName}>{place.name}</h2>
                                        {place.place_group?.name && (
                                            <span className={style.placeCardGroup}>
                                                {place.place_group.name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className={style.placeCardFooter}>
                                    <span className={style.placeCardCount}>
                                        {place.videos_count === 1
                                            ? "1 vídeo"
                                            : `${place.videos_count} vídeos`}
                                    </span>
                                    <span className={style.placeCardLast}>
                                        último: {formatRelative(place.last_recorded_at)}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            <Footer />
        </div>
    );
}

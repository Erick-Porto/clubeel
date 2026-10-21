"use client";

/**
 * Galeria pública de uma quadra.
 *
 * Aberta a qualquer visitante, sem login — inclusive os vídeos gravados durante
 * reservas. O selo "vídeo de reserva" diz que houve reserva e nada além disso:
 * a API não manda identificação de sócio, e esta tela não tenta inferir nenhuma.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faCalendarDay,
    faCircleExclamation,
    faFilm,
    faRotateRight,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../../styles/page.module.css";
import style from "../../../styles/replay.module.css";
import Header from "../../components/Common/header";
import Footer from "../../components/Common/footer";
import { Loading } from "../../components/Common/loading";
import ReplayNotice from "../../components/Replay/ReplayNotice";
import ReplayVideoGrid from "../../components/Replay/ReplayVideoGrid";
import {
    fetchPlaceVideos,
    type ReplayPageMeta,
    type ReplayVideo,
} from "../../../services/replay-api";
import { placeIdFromSlug, sportImage, toApiDate } from "../../../utils/replay";

export default function ReplayPlaceGalleryPage() {
    const params = useParams();
    const slug = (params?.placeName as string) || "";
    const placeId = placeIdFromSlug(slug);

    const [videos, setVideos] = useState<ReplayVideo[]>([]);
    const [meta, setMeta] = useState<ReplayPageMeta>({ current_page: 1, last_page: 1 });
    const [placeName, setPlaceName] = useState("");
    const [groupName, setGroupName] = useState("");
    const [date, setDate] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Corrida entre respostas: trocar a data enquanto uma página ainda está no
    // ar faria a resposta antiga sobrescrever a nova.
    const requestRef = useRef(0);

    const load = useCallback(
        async (page: number, selectedDate: string, append: boolean) => {
            if (!placeId) {
                setError("Quadra não identificada no endereço.");
                setIsLoading(false);
                return;
            }

            const requestId = ++requestRef.current;

            if (append) setIsLoadingMore(true);
            else {
                setIsLoading(true);
                setError(null);
            }

            const result = await fetchPlaceVideos(placeId, {
                date: selectedDate || null,
                page,
            });

            if (requestId !== requestRef.current) return;

            if (!result.ok) {
                setError(result.message);
                if (!append) setVideos([]);
            } else {
                setVideos((current) =>
                    append ? [...current, ...result.data.videos] : result.data.videos
                );
                setMeta(result.data.meta);
                if (result.data.place?.name) setPlaceName(result.data.place.name);
                if (result.data.place?.place_group?.name) {
                    setGroupName(result.data.place.place_group.name);
                }
                setError(null);
            }

            setIsLoading(false);
            setIsLoadingMore(false);
        },
        [placeId]
    );

    useEffect(() => {
        load(1, date, false);
    }, [load, date]);

    const hasMore = meta.current_page < meta.last_page;

    // Fallback do título enquanto a API não responde: o slug da URL é
    // `nome-da-quadra-id`.
    const fallbackName = slug
        .split("-")
        .slice(0, -1)
        .join(" ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

    // Sem o esporte ainda carregado, o degradê cobre o intervalo sem piscar foto.
    const bannerImage = groupName ? sportImage(groupName) : null;

    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={0} onlyScroll={false} />

            <section className={style.replaySection}>
                {/* Mesma banda de foto da tela de esportes, para não destoar. */}
                <div
                    className={`${style.galleryBanner} ${bannerImage ? "" : style.galleryBannerPlain}`}
                    style={bannerImage ? { backgroundImage: `url(${bannerImage})` } : undefined}
                >
                    <Link href="/replay" className={style.galleryBannerBack}>
                        <FontAwesomeIcon icon={faArrowLeft} /> Todas as quadras
                    </Link>

                    <div className={style.galleryBannerContent}>
                        {groupName && (
                            <span className={style.galleryBannerSport}>{groupName}</span>
                        )}
                        <h1 className={style.galleryBannerTitle}>
                            {placeName || fallbackName || "Replay"}
                        </h1>
                        <p className={style.galleryBannerLead}>
                            Os lances gravados nesta quadra. Cada vídeo fica disponível por 7 dias.
                        </p>
                    </div>
                </div>

                <div className={style.filterBar}>
                    <label className={style.filterField} htmlFor="replay-date">
                        <FontAwesomeIcon icon={faCalendarDay} />
                        <span className={style.filterLabel}>Data</span>
                        <input
                            id="replay-date"
                            type="date"
                            className={style.filterInput}
                            value={date}
                            max={toApiDate(new Date())}
                            onChange={(event) => setDate(event.target.value)}
                        />
                    </label>

                    {date && (
                        <button
                            type="button"
                            className={style.filterClear}
                            onClick={() => setDate("")}
                        >
                            <FontAwesomeIcon icon={faXmark} /> Limpar
                        </button>
                    )}

                    {!isLoading && !error && videos.length > 0 && (
                        <span className={style.filterCount}>
                            {meta.total ?? videos.length} vídeo
                            {(meta.total ?? videos.length) === 1 ? "" : "s"}
                        </span>
                    )}
                </div>

                {isLoading ? (
                    <Loading />
                ) : error ? (
                    <ReplayNotice
                        icon={faCircleExclamation}
                        title="Não conseguimos carregar os vídeos"
                        description={error}
                        tone="alert"
                        action={
                            <button
                                type="button"
                                className={style.replayButton}
                                onClick={() => load(1, date, false)}
                            >
                                <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                            </button>
                        }
                    />
                ) : videos.length === 0 ? (
                    <ReplayNotice
                        icon={faFilm}
                        title={date ? "Nenhum vídeo nesta data" : "Nenhum vídeo nesta quadra"}
                        description={
                            date
                                ? "Tente outra data — lembrando que os replays são apagados depois de 7 dias."
                                : "Assim que alguém apertar o botão de replay aqui, o vídeo aparece nesta página."
                        }
                        action={
                            date ? (
                                <button
                                    type="button"
                                    className={style.replayButton}
                                    onClick={() => setDate("")}
                                >
                                    Ver todas as datas
                                </button>
                            ) : undefined
                        }
                    />
                ) : (
                    <>
                        <ReplayVideoGrid videos={videos} showReservationBadge />

                        {hasMore && (
                            <div className={style.pagination}>
                                <button
                                    type="button"
                                    className={style.replayButton}
                                    disabled={isLoadingMore}
                                    onClick={() => load(meta.current_page + 1, date, true)}
                                >
                                    {isLoadingMore ? "Carregando..." : "Carregar mais vídeos"}
                                </button>
                                <span className={style.paginationInfo}>
                                    Página {meta.current_page} de {meta.last_page}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </section>

            <Footer />
        </div>
    );
}

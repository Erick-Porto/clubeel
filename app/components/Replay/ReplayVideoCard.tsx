"use client";

import { useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCirclePlay,
    faClock,
    faDownload,
    faHourglassHalf,
    faLock,
    faVideoSlash,
} from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/replay.module.css";
import type { ReplayVideo } from "../../../services/replay-api";
import {
    aspectRatioFor,
    formatDaysLeft,
    formatDuration,
    formatRecordedAt,
    formatSize,
    isExpired,
    isUrgent,
} from "../../../utils/replay";

interface ReplayVideoCardProps {
    video: ReplayVideo;
    /**
     * Mostra o selo "vídeo de reserva". Faz sentido na galeria pública, onde os
     * vídeos são de origens diferentes; em "meus vídeos" todos são de reserva,
     * então o selo vira ruído.
     *
     * O selo diz APENAS que houve reserva. Nunca de quem — a API não manda essa
     * informação, e é de propósito: a galeria da quadra é pública.
     */
    showReservationBadge?: boolean;
    /** Nome da quadra no card (útil quando a grade mistura quadras). */
    showPlaceName?: boolean;
}

export default function ReplayVideoCard({
    video,
    showReservationBadge = false,
    showPlaceName = false,
}: ReplayVideoCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [started, setStarted] = useState(false);
    // 404 no arquivo significa que a Lara já apagou o vídeo (7 dias), não que o
    // site quebrou. O `days_left` pode estar defasado se a aba ficou aberta.
    const [gone, setGone] = useState(() => isExpired(video));

    const urgent = isUrgent(video.days_left);
    const size = formatSize(video.size_bytes);

    const handlePlayClick = () => {
        setStarted(true);
        videoRef.current?.play().catch(() => {
            // Autoplay negado ou arquivo indisponível: os controls nativos
            // continuam à mão, e o onError cobre o caso do arquivo apagado.
        });
    };

    return (
        <article className={style.videoCard}>
            <div
                className={style.videoFrame}
                style={{ aspectRatio: aspectRatioFor(video.orientation) }}
            >
                {gone ? (
                    <div className={style.videoGone}>
                        <FontAwesomeIcon icon={faVideoSlash} />
                        <strong>Este vídeo expirou</strong>
                        <span>Os replays ficam disponíveis por 7 dias.</span>
                    </div>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            className={style.videoPlayer}
                            src={video.url}
                            controls
                            playsInline
                            /*
                             * São até 24 vídeos por página. Sem preload="none" o
                             * navegador buscaria todos de uma vez — centenas de MB
                             * no 4G de quem está na beira da quadra.
                             */
                            preload="none"
                            onPlay={() => setStarted(true)}
                            onError={() => setGone(true)}
                        />

                        {!started && (
                            <button
                                type="button"
                                className={style.videoPoster}
                                onClick={handlePlayClick}
                                aria-label={`Reproduzir replay de ${formatRecordedAt(
                                    video.recorded_at
                                )}`}
                            >
                                <FontAwesomeIcon icon={faCirclePlay} />
                                <span>{formatDuration(video.duration_seconds)}</span>
                            </button>
                        )}
                    </>
                )}

                <div className={style.videoBadges}>
                    {showReservationBadge && video.has_member && (
                        <span className={style.badgeReserved} title="Gravado durante uma reserva">
                            <FontAwesomeIcon icon={faLock} /> Vídeo de reserva
                        </span>
                    )}
                </div>
            </div>

            <div className={style.videoInfo}>
                <div className={style.videoMetaTop}>
                    <h3 className={style.videoTitle}>
                        {showPlaceName && video.place.name
                            ? video.place.name
                            : formatRecordedAt(video.recorded_at)}
                    </h3>
                    {showPlaceName && (
                        <span className={style.videoSubtitle}>
                            {formatRecordedAt(video.recorded_at)}
                        </span>
                    )}
                </div>

                <ul className={style.videoMeta}>
                    <li>
                        <FontAwesomeIcon icon={faClock} /> {formatDuration(video.duration_seconds)}
                    </li>
                    {size && <li>{size}</li>}
                    <li
                        className={`${style.videoExpiry} ${urgent ? style.videoExpiryUrgent : ""}`}
                        title="Depois disso o arquivo é apagado. Baixe para guardar."
                    >
                        <FontAwesomeIcon icon={faHourglassHalf} /> {formatDaysLeft(video.days_left)}
                    </li>
                </ul>

                {/*
                 * Link direto para o arquivo na Lara. Sem proxy pelo Next: é o
                 * arquivo estático que suporta range request, e é isso que deixa
                 * o visitante arrastar a barra do player.
                 */}
                <a
                    className={`${style.videoDownload} ${gone ? style.videoDownloadDisabled : ""}`}
                    href={gone ? undefined : video.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    aria-disabled={gone}
                    onClick={(event) => {
                        if (gone) event.preventDefault();
                    }}
                >
                    <FontAwesomeIcon icon={faDownload} /> Baixar
                </a>
            </div>
        </article>
    );
}

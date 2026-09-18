"use client";

/**
 * "Meus vídeos": os replays gravados durante as reservas pagas do sócio.
 *
 * É o destino do link que o sócio recebe por e-mail. Ele chega deslogado, o
 * middleware manda para /login com `callbackUrl=/meus-videos`, e depois do login
 * ele cai aqui — sem passo extra. O guard abaixo cobre o caso em que a sessão
 * cai com a página já aberta.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faCircleExclamation,
    faFilm,
    faRightToBracket,
    faRotateRight,
    faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../styles/page.module.css";
import style from "../../styles/replay.module.css";
import Header from "../components/Common/header";
import Footer from "../components/Common/footer";
import { Loading, LoadingScreen } from "../components/Common/loading";
import ReplayNotice from "../components/Replay/ReplayNotice";
import ReplayVideoGrid from "../components/Replay/ReplayVideoGrid";
import { fetchMyVideos, type ReplayVideo } from "../../services/replay-api";
import { REPLAY_URGENT_DAYS } from "../../utils/replay";

const LOGIN_HREF = "/login?callbackUrl=%2Fmeus-videos";

export default function MyVideosPage() {
    const { status } = useSession();

    const [videos, setVideos] = useState<ReplayVideo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sessionExpired, setSessionExpired] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSessionExpired(false);

        const result = await fetchMyVideos();

        if (!result.ok) {
            // 401/403 aqui não derruba a sessão do site inteiro (o serviço usa
            // skipAuthCheck): vira um estado de tela com o caminho de volta.
            if (result.reason === "unauthorized") setSessionExpired(true);
            else setError(result.message);
            setVideos([]);
        } else {
            setVideos(result.data);
        }

        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (status === "authenticated") load();
        else if (status === "unauthenticated") setIsLoading(false);
    }, [status, load]);

    if (status === "loading") return <LoadingScreen />;

    const expiringSoon = videos.filter((video) => video.days_left <= REPLAY_URGENT_DAYS).length;

    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={0} onlyScroll={false} />

            <section className={style.replaySection}>
                <div className={style.replayHeader}>
                    <h1 className={style.replayTitle}>Meus vídeos</h1>
                    <p className={style.replayLead}>
                        Os replays gravados durante as suas reservas. Cada vídeo fica disponível por{" "}
                        <strong>7 dias</strong> a partir da gravação — baixe o que quiser guardar.
                    </p>
                    <Link href="/replay" className={style.replayLinkInline}>
                        Ver a galeria das quadras <FontAwesomeIcon icon={faArrowRight} />
                    </Link>
                </div>

                {status === "unauthenticated" || sessionExpired ? (
                    <ReplayNotice
                        icon={faRightToBracket}
                        title={sessionExpired ? "Sua sessão expirou" : "Entre para ver seus vídeos"}
                        description="Seus replays são privados. Faça login com seu CPF e senha para acessá-los."
                        tone="alert"
                        action={
                            <Link href={LOGIN_HREF} className={style.replayButton}>
                                <FontAwesomeIcon icon={faRightToBracket} /> Entrar
                            </Link>
                        }
                    />
                ) : isLoading ? (
                    <Loading />
                ) : error ? (
                    <ReplayNotice
                        icon={faCircleExclamation}
                        title="Não conseguimos carregar seus vídeos"
                        description={error}
                        tone="alert"
                        action={
                            <button type="button" className={style.replayButton} onClick={load}>
                                <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                            </button>
                        }
                    />
                ) : videos.length === 0 ? (
                    <ReplayNotice
                        icon={faFilm}
                        title="Você ainda não tem replays"
                        description="Os vídeos aparecem aqui quando alguém aperta o botão de replay durante uma reserva sua."
                        action={
                            <Link href="/replay" className={style.replayButton}>
                                Ver a galeria das quadras
                            </Link>
                        }
                    />
                ) : (
                    <>
                        {expiringSoon > 0 && (
                            <div className={style.expiryWarning}>
                                <FontAwesomeIcon icon={faTriangleExclamation} />
                                <span>
                                    {expiringSoon === 1
                                        ? "1 vídeo seu está prestes a expirar."
                                        : `${expiringSoon} vídeos seus estão prestes a expirar.`}{" "}
                                    Baixe antes que sejam apagados.
                                </span>
                            </div>
                        )}

                        <ReplayVideoGrid videos={videos} showPlaceName />
                    </>
                )}
            </section>

            <Footer />
        </div>
    );
}

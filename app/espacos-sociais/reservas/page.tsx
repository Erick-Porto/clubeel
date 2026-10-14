"use client";

/**
 * "Minhas reservas sociais": as reservas de espaço social do sócio, na ordem
 * da Lara (futuras primeiro, depois as passadas), com o estágio de cada uma.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faCalendarPlus,
    faChampagneGlasses,
    faChevronRight,
    faCircleExclamation,
    faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../../styles/page.module.css";
import replayStyle from "../../../styles/replay.module.css";
import style from "../../../styles/social.module.css";
import Header from "../../components/Common/header";
import Footer from "../../components/Common/footer";
import { Loading, LoadingScreen } from "../../components/Common/loading";
import ReplayNotice from "../../components/Replay/ReplayNotice";
import SocialStageBadge from "../../components/Social/SocialStageBadge";
import { fetchSocialBookings, type SocialBooking, type SocialFailure } from "../../../services/social-api";
import { formatBRL, formatDayShort, formatInstant } from "../../../utils/social";

export default function SocialBookingsPage() {
    const { status } = useSession();
    const [bookings, setBookings] = useState<SocialBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<SocialFailure | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const result = await fetchSocialBookings();
        if (result.ok) setBookings(result.data);
        else setError(result);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (status === "authenticated") load();
    }, [status, load]);

    if (status === "loading") return <LoadingScreen />;

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (error) {
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title="Não conseguimos carregar suas reservas"
                description={error.error}
                tone="alert"
                action={
                    <button type="button" className={replayStyle.replayButton} onClick={() => load()}>
                        <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                    </button>
                }
            />
        );
    } else if (bookings.length === 0) {
        body = (
            <ReplayNotice
                icon={faChampagneGlasses}
                title="Você ainda não tem reservas de espaço social"
                description="Escolha uma churrasqueira ou salão e envie a pré-reserva."
                action={
                    <Link href="/espacos-sociais" className={replayStyle.replayButton}>
                        <FontAwesomeIcon icon={faCalendarPlus} /> Ver espaços sociais
                    </Link>
                }
            />
        );
    } else {
        body = (
            <div className={style.bookingList}>
                {bookings.map((booking) => (
                    <Link key={booking.id} href={`/espacos-sociais/reservas/${booking.id}`} className={style.bookingCard}>
                        <div className={style.bookingMain}>
                            <span className={style.bookingPlace}>{booking.place.name}</span>
                            <span className={style.bookingMeta}>
                                {formatDayShort(booking.date)}
                                {booking.event_type ? ` · ${booking.event_type}` : ""}
                                {booking.place_group ? ` · ${booking.place_group.name}` : ""}
                            </span>
                            {booking.stage === "awaiting_payment" && booking.payment_due_at && (
                                <span className={style.bookingMeta}>
                                    Pagar até <strong>{formatInstant(booking.payment_due_at)}</strong>
                                </span>
                            )}
                        </div>
                        <div className={style.bookingSide}>
                            <SocialStageBadge stage={booking.stage} label={booking.stage_label} />
                            {booking.total > 0 && <span className={style.bookingTotal}>{formatBRL(booking.total)}</span>}
                            <span className={replayStyle.placeCardAction}>
                                Detalhes <FontAwesomeIcon icon={faChevronRight} />
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        );
    }

    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={0} onlyScroll={false} />

            <section className={replayStyle.replaySection}>
                <Link href="/espacos-sociais" className={style.backLink}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Espaços sociais
                </Link>
                <div className={replayStyle.replayHeader}>
                    <h1 className={replayStyle.replayTitle}>Minhas reservas sociais</h1>
                    <p className={replayStyle.replayLead}>
                        Acompanhe a análise da secretaria, pague quando a reserva for aprovada e mantenha a lista de
                        convidados em dia.
                    </p>
                </div>

                {body}
            </section>

            <Footer />
        </div>
    );
}

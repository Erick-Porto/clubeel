"use client";

/**
 * "Minhas reservas sociais": as reservas de espaço social do sócio — pedidas
 * aqui e feitas pela secretaria no balcão (`origin`) —, na ordem da Lara
 * (futuras primeiro, depois as passadas), com o estágio de cada uma.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBuilding,
    faCalendarPlus,
    faChampagneGlasses,
    faChevronRight,
    faCircleExclamation,
    faClock,
    faMagnifyingGlass,
    faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../../styles/page.module.css";
import ui from "../../../styles/ui.module.css";
import replayStyle from "../../../styles/replay.module.css";
import style from "../../../styles/social.module.css";
import Header from "../../components/Common/header";
import Footer from "../../components/Common/footer";
import { Loading, LoadingScreen } from "../../components/Common/loading";
import ReplayNotice from "../../components/Replay/ReplayNotice";
import SocialStageBadge from "../../components/Social/SocialStageBadge";
import { SocialCover } from "../../components/UI/covers";
import { PageHeader, SearchBar, matchesSearch } from "../../components/UI/ui";
import { fetchSocialBookings, type SocialBooking, type SocialFailure } from "../../../services/social-api";
import { formatBRL, formatDayShort, formatInstant, formatTimeRange } from "../../../utils/social";

export default function SocialBookingsPage() {
    const { status } = useSession();
    const [query, setQuery] = useState("");
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
        const visible = bookings.filter((booking) =>
            matchesSearch(
                query,
                booking.place.name,
                booking.event_type,
                booking.place_group?.name,
                booking.stage_label,
                String(booking.id)
            )
        );
        body = (
            <>
            <SearchBar id="busca-reservas" value={query} onChange={setQuery} placeholder="Buscar por espaço, evento ou estágio" />
            {visible.length === 0 ? (
                <ReplayNotice
                    icon={faMagnifyingGlass}
                    title={`Nada encontrado para “${query}”`}
                    description="Confira a grafia ou limpe a busca."
                />
            ) : (
            <div className={style.bookingList}>
                {visible.map((booking) => (
                    <Link key={booking.id} href={`/espacos-sociais/reservas/${booking.id}`} className={style.bookingCard}>
                        <div className={style.bookingMain}>
                            <div className={style.badgeRow}>
                                <SocialStageBadge stage={booking.stage} label={booking.stage_label} />
                                {booking.origin === "secretaria" && (
                                    <span className={style.originBadge}>
                                        <FontAwesomeIcon icon={faBuilding} /> Feita pela secretaria
                                    </span>
                                )}
                            </div>
                            <span className={style.bookingPlace}>{booking.place.name}</span>
                            <span className={style.bookingMeta}>
                                {formatDayShort(booking.date)}
                                {booking.start_time ? ` · ${formatTimeRange(booking.start_time, booking.end_time, booking.ends_next_day)}` : ""}
                                {booking.event_type ? ` · ${booking.event_type}` : ""}
                                {booking.place_group ? ` · ${booking.place_group.name}` : ""}
                            </span>
                            {booking.stage === "awaiting_payment" && booking.payment_due_at && (
                                <span className={style.bookingDue}>
                                    <FontAwesomeIcon icon={faClock} /> Pagar até <strong>{formatInstant(booking.payment_due_at)}</strong>
                                </span>
                            )}
                        </div>
                        <div className={style.bookingSide}>
                            {booking.total > 0 && <span className={style.bookingTotal}>{formatBRL(booking.total)}</span>}
                            <span className={style.bookingAction}>
                                Detalhes <FontAwesomeIcon icon={faChevronRight} />
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
            )}
            </>
        );
    }

    return (
        <div className={globalStyle.page}>
            <Header />
            <SocialCover />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <PageHeader
                    title="Minhas reservas sociais"
                    lead="Acompanhe a análise da secretaria, pague quando a reserva for aprovada e mantenha a lista de convidados em dia."
                    actions={
                        <Link href="/espacos-sociais" className={`${ui.btn} ${ui.btnPrimary}`}>
                            <FontAwesomeIcon icon={faCalendarPlus} /> Nova reserva
                        </Link>
                    }
                />

                {body}
            </main>

            <Footer />
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCreditCard } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/social.module.css";
import { fetchSocialBookings, type SocialBooking } from "../../../services/social-api";
import { formatDayShort, formatInstant } from "../../../utils/social";

/**
 * Destaque na entrada do perfil: reservas sociais que o sócio pode pagar agora
 * (`can_pay`). É por aqui que ele descobre a reserva que a secretaria aprovou
 * no balcão em nome dele. Sem nada a pagar — ou se a leitura falhar — não
 * aparece nada.
 */
export default function SocialPendingPaymentBanner() {
    const { status } = useSession();
    const [payable, setPayable] = useState<SocialBooking[]>([]);

    useEffect(() => {
        if (status !== "authenticated") return;
        let active = true;
        fetchSocialBookings().then((result) => {
            if (active && result.ok) setPayable(result.data.filter((booking) => booking.can_pay));
        });
        return () => {
            active = false;
        };
    }, [status]);

    if (payable.length === 0) return null;

    return (
        <div className={style.pendingList}>
            {payable.map((booking) => (
                <div key={booking.id} className={style.pendingBanner} role="status">
                    <p>
                        Você tem uma reserva aguardando pagamento
                        {booking.payment_due_at ? (
                            <>
                                {" "}
                                até <strong>{formatInstant(booking.payment_due_at)}</strong>
                            </>
                        ) : null}
                        : {booking.place.name}, {formatDayShort(booking.date)}.
                    </p>
                    <Link href={`/espacos-sociais/reservas/${booking.id}`} className={style.pendingBannerAction}>
                        <FontAwesomeIcon icon={faCreditCard} /> Ver e pagar
                    </Link>
                </div>
            ))}
        </div>
    );
}

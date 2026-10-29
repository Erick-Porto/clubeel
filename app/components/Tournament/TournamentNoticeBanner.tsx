"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCreditCard, faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/tournament.module.css";
import { fetchMyInvites, fetchMyRegistrations } from "../../../services/tournament-api";
import { isPayable } from "../../../utils/tournament";

/**
 * Destaque na entrada do perfil: inscrições de torneio aguardando pagamento e
 * convites de time recebidos. Sem nada — ou se a leitura falhar — não aparece
 * nada.
 */
export default function TournamentNoticeBanner() {
    const { status } = useSession();
    const [payable, setPayable] = useState(0);
    const [invites, setInvites] = useState(0);

    useEffect(() => {
        if (status !== "authenticated") return;
        let active = true;
        Promise.all([fetchMyRegistrations(), fetchMyInvites()]).then(([registrations, received]) => {
            if (!active) return;
            if (registrations.ok) setPayable(registrations.data.filter((registration) => isPayable(registration)).length);
            if (received.ok) setInvites(received.data.length);
        });
        return () => {
            active = false;
        };
    }, [status]);

    if (payable === 0 && invites === 0) return null;

    return (
        <div className={style.bannerList}>
            {invites > 0 && (
                <div className={style.banner} role="status">
                    <p>
                        Você recebeu {invites === 1 ? "um convite" : `${invites} convites`} para time de torneio.
                    </p>
                    <Link href="/torneios/inscricoes" className={style.bannerAction}>
                        <FontAwesomeIcon icon={faEnvelopeOpenText} /> Responder
                    </Link>
                </div>
            )}
            {payable > 0 && (
                <div className={style.banner} role="status">
                    <p>
                        Você tem {payable === 1 ? "uma inscrição" : `${payable} inscrições`} de torneio aguardando pagamento. A
                        vaga só fica garantida depois de pagar.
                    </p>
                    <Link href="/torneios/inscricoes" className={style.bannerAction}>
                        <FontAwesomeIcon icon={faCreditCard} /> Ver e pagar
                    </Link>
                </div>
            )}
        </div>
    );
}

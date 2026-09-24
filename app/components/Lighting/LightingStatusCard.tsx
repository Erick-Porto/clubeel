"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faLightbulb } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/lighting.module.css";
import { useLightingAvailability } from "../../hooks/useLightingAvailability";
import { formatClock, formatCountdown, parseInstant } from "../../../utils/lighting";

/**
 * "Luz acesa" nos agendamentos do perfil. Lê a mesma disponibilidade que a tela
 * da luz e só aparece quando a Lara diz que há acionamento — sem adivinhar.
 */
export default function LightingStatusCard() {
    const { data, serverNow } = useLightingAvailability();
    const activation = data?.activation;
    if (!activation) return null;

    const litUntil = activation.lit_until ?? activation.ends_at;
    const remaining = parseInstant(litUntil) - serverNow;

    return (
        <Link href="/luz" className={style.statusCard}>
            <span className={style.statusCardIcon}>
                <FontAwesomeIcon icon={faLightbulb} />
            </span>
            <span className={style.statusCardBody}>
                <strong>Luz acesa na {activation.place_name}</strong>
                <span>
                    até {formatClock(litUntil)}
                    {remaining > 0 ? ` · apaga em ${formatCountdown(remaining)}` : ""}
                </span>
            </span>
            <span className={style.statusCardAction}>
                Prolongar ou devolver <FontAwesomeIcon icon={faArrowRight} />
            </span>
        </Link>
    );
}

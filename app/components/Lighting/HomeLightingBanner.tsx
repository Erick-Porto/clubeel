"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faLightbulb } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/lighting.module.css";
import { useLightingAvailability } from "../../hooks/useLightingAvailability";
import { formatClock, formatCountdown, parseInstant, windowOccasion } from "../../../utils/lighting";
import { areaStyle } from "../UI/ui";

/**
 * Destaque da luz da quadra na home.
 *
 * Só aparece quando a Lara diz que dá para usar agora — alguma quadra aberta,
 * ou o sócio já com luz acesa. Fora disso some; a tela
 * /luz (pelo menu) continua explicando quando volta a funcionar. A decisão
 * vem da resposta, nunca de dia/hora calculados aqui.
 */
export default function HomeLightingBanner() {
    const { data, serverNow } = useLightingAvailability();
    if (!data) return null;

    const activation = data.activation;
    // `open` é agregado: alguma quadra aberta agora. Qual, e até quando, é na tela /luz.
    if (!activation && !data.open) return null;

    let title: string;
    let detail: string;
    let action: string;

    if (activation) {
        const litUntil = activation.lit_until ?? activation.ends_at;
        const remaining = parseInstant(litUntil) - serverNow;
        title = `Luz acesa na ${activation.place_name}`;
        detail = `Até ${formatClock(litUntil)}${remaining > 0 ? ` · apaga em ${formatCountdown(remaining)}` : ""}`;
        action = "Prolongar ou devolver";
    } else {
        // Sem "até HH:MM": cada quadra fecha num horário, e o do clube não vale para todas.
        const occasion = windowOccasion(data.club_window);
        title = "Acionar luzes";
        detail = `Acione as luzes da quadra por aqui.${occasion ? ` · ${occasion}` : ""}`;
        action = "Acender a luz";
    }

    return (
        <Link
            href="/luz"
            className={`${style.homeBanner} ${activation ? style.homeBannerLit : ""}`}
            style={areaStyle("luz")}
        >
            <span className={style.homeBannerIcon}>
                <FontAwesomeIcon icon={faLightbulb} />
            </span>
            <span className={style.homeBannerContent}>
                <span className={style.homeBannerKicker}>{activation ? "Luz acesa" : "Luz da quadra"}</span>
                <span className={style.homeBannerTitle}>{title}</span>
                <span className={style.homeBannerDetail}>{detail}</span>
            </span>
            <span className={style.homeBannerAction}>
                {action} <FontAwesomeIcon icon={faArrowRight} />
            </span>
        </Link>
    );
}

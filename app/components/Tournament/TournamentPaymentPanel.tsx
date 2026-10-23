"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/tournament.module.css";
import ui from "../../../styles/ui.module.css";
import CheckoutPayment, { type SocialPaymentOutcome } from "../Checkout/CheckoutPayment";
import type { TournamentRegistration } from "../../../services/tournament-api";
import { formatBRL, formatInstant } from "../../../utils/tournament";

interface TournamentPaymentPanelProps {
    /** Inscrições aguardando pagamento, pagas juntas. */
    registrations: TournamentRegistration[];
    /** Prazo (`pay_until` da inscrição, ou o fim das inscrições). */
    payUntil: string | null;
    /** Total que a Lara informou (`total_due`); sem ele, a soma dos `amount` só para exibir. */
    totalDue?: number;
    onResult: (outcome: SocialPaymentOutcome) => void;
    onClose?: () => void;
}

/**
 * Resumo do que vai ser cobrado e o formulário de cartão de sempre
 * (CheckoutPayment no modo torneio). O valor exibido é informativo: quem
 * decide quanto cobrar é o servidor, relendo as inscrições na Lara — e ele
 * confere a vaga antes de mandar o cartão para a eRede (a vaga é de quem paga
 * primeiro; a inscrição não segura vaga).
 */
export default function TournamentPaymentPanel({
    registrations,
    payUntil,
    totalDue,
    onResult,
    onClose,
}: TournamentPaymentPanelProps) {
    const total = totalDue ?? registrations.reduce((sum, registration) => sum + registration.amount, 0);

    return (
        <div className={ui.panel}>
            <h2 className={ui.sectionTitle}>Pagamento da inscrição</h2>
            <ul className={style.payList}>
                {registrations.map((registration) => (
                    <li key={registration.id} className={style.payLine}>
                        <span>
                            {registration.category.name}
                            <span className={ui.muted}> · {registration.tournament.title}</span>
                        </span>
                        <span>{formatBRL(registration.amount)}</span>
                    </li>
                ))}
            </ul>
            <div className={style.payTotal}>
                <span>Total</span>
                <span>{formatBRL(total)}</span>
            </div>
            {payUntil && (
                <p className={style.deadline}>
                    <FontAwesomeIcon icon={faClock} /> Pague até <strong>{formatInstant(payUntil)}</strong>.
                </p>
            )}
            <p className={style.hint}>
                A inscrição não segura vaga: as vagas são de quem paga primeiro. Conferimos a vaga antes de cobrar o
                cartão.
            </p>

            <CheckoutPayment tournamentRegistrationIds={registrations.map((r) => r.id)} onTournamentResult={onResult} />

            {onClose && (
                <button type="button" className={ui.linkButton} onClick={onClose}>
                    Pagar depois
                </button>
            )}
        </div>
    );
}

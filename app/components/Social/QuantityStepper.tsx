"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/social.module.css";

interface QuantityStepperProps {
    value: number;
    min?: number;
    /** Sem `max`, não há teto na tela (quem decide é a Lara). */
    max?: number;
    onChange: (value: number) => void;
    label: string;
    disabled?: boolean;
}

export default function QuantityStepper({ value, min = 0, max, onChange, label, disabled }: QuantityStepperProps) {
    return (
        <div className={style.stepper} role="group" aria-label={label}>
            <button
                type="button"
                onClick={() => onChange(Math.max(min, value - 1))}
                disabled={disabled || value <= min}
                aria-label={`Diminuir ${label}`}
            >
                <FontAwesomeIcon icon={faMinus} />
            </button>
            <output aria-live="polite">{value}</output>
            <button
                type="button"
                onClick={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))}
                disabled={disabled || (max !== undefined && value >= max)}
                aria-label={`Aumentar ${label}`}
            >
                <FontAwesomeIcon icon={faPlus} />
            </button>
        </div>
    );
}

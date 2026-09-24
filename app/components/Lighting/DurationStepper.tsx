"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/lighting.module.css";
import { formatDuration } from "../../../utils/lighting";

interface DurationStepperProps {
    /** Montadas com `durationOptions` a partir do que a Lara mandou. */
    options: number[];
    value: number;
    onChange: (minutes: number) => void;
    disabled?: boolean;
}

/**
 * Valor escolhido, sempre dentro das opções. Começa no maior (o que a Lara
 * usaria sem `minutes`); se as opções encolherem — a janela está acabando —
 * a escolha é presa no novo teto.
 */
export function useDurationChoice(options: number[]): [number, (minutes: number) => void] {
    const last = options.length > 0 ? options[options.length - 1] : 0;
    const [value, setValue] = useState(last);
    const key = options.join(",");

    useEffect(() => {
        setValue((current) => {
            if (options.includes(current)) return current;
            const fitting = options.filter((option) => option <= current);
            return fitting.length > 0 ? fitting[fitting.length - 1] : last;
        });
        // `key` resume `options`: só reage quando a lista muda de fato.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return [options.includes(value) ? value : last, setValue];
}

/**
 * Seletor de duração. Só oferece valores da lista — nunca sai dos limites do
 * servidor, e por isso o 422 de validação não acontece pela tela.
 */
export default function DurationStepper({ options, value, onChange, disabled }: DurationStepperProps) {
    const index = options.indexOf(value);
    const canDecrease = !disabled && index > 0;
    const canIncrease = !disabled && index >= 0 && index < options.length - 1;

    if (options.length === 0) return null;

    return (
        <div className={style.stepper} role="group" aria-label="Por quanto tempo">
            <button
                type="button"
                className={style.stepperButton}
                onClick={() => canDecrease && onChange(options[index - 1])}
                disabled={!canDecrease}
                aria-label="Menos tempo"
            >
                <FontAwesomeIcon icon={faMinus} />
            </button>

            <output className={style.stepperValue} aria-live="polite">
                {formatDuration(value)}
            </output>

            <button
                type="button"
                className={style.stepperButton}
                onClick={() => canIncrease && onChange(options[index + 1])}
                disabled={!canIncrease}
                aria-label="Mais tempo"
            >
                <FontAwesomeIcon icon={faPlus} />
            </button>

            <span className={style.stepperRange}>
                de {formatDuration(options[0])} a {formatDuration(options[options.length - 1])}
            </span>
        </div>
    );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/ticket.module.css";

function secondsLeft(until: string): number {
    const time = Date.parse(until);
    return Number.isNaN(time) ? 0 : Math.max(0, Math.floor((time - Date.now()) / 1000));
}

/**
 * Contador até o `hold_until` do pedido (os lugares ficam guardados por alguns
 * minutos). Chegando a zero avisa a tela uma vez, para ela reler o pedido —
 * quem diz se ele expirou é a Lara.
 */
export default function HoldCountdown({ until, onExpire }: { until: string; onExpire?: () => void }) {
    const [left, setLeft] = useState(() => secondsLeft(until));
    const fired = useRef(false);

    useEffect(() => {
        fired.current = false;
        setLeft(secondsLeft(until));
        const timer = setInterval(() => setLeft(secondsLeft(until)), 1000);
        return () => clearInterval(timer);
    }, [until]);

    useEffect(() => {
        if (left === 0 && !fired.current) {
            fired.current = true;
            onExpire?.();
        }
    }, [left, onExpire]);

    if (left === 0) {
        return (
            <span className={`${style.countdown} ${style.countdownLate}`} role="status">
                <FontAwesomeIcon icon={faClock} /> O prazo para guardar os lugares acabou
            </span>
        );
    }

    const minutes = Math.floor(left / 60);
    const seconds = left % 60;
    return (
        <span className={style.countdown} role="timer" aria-live="off">
            <FontAwesomeIcon icon={faClock} /> Lugares guardados por{" "}
            <strong>
                {minutes}:{String(seconds).padStart(2, "0")}
            </strong>
        </span>
    );
}

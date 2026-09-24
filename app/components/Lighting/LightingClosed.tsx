"use client";

import { faCalendarDay, faClock } from "@fortawesome/free-solid-svg-icons";
import ReplayNotice from "../Replay/ReplayNotice";
import style from "../../../styles/lighting.module.css";
import type { LightingAvailability } from "../../../services/lighting-api";
import { describeWindow, isWindowToday, parseInstant, windowOccasion } from "../../../utils/lighting";

interface LightingClosedProps {
    availability: LightingAvailability;
    serverNow: number;
}

/**
 * Estado "fechado": nenhuma quadra aberta agora (`open` agregado da Lara). Não
 * some com a opção: diz ao sócio que ela existe e quando volta a funcionar.
 *
 * Cada quadra tem o próprio horário, então o único horário que vale aqui é o
 * `next_window` — a primeira quadra a abrir. A frase fala em "a primeira quadra",
 * não em "o clube abre", porque as outras podem abrir mais tarde.
 */
export default function LightingClosed({ availability, serverNow }: LightingClosedProps) {
    const { next_window: next, now } = availability;
    const occasion = windowOccasion(next);
    const startsLater = next !== null && parseInstant(next.starts_at) > serverNow;

    if (!next) {
        return (
            <ReplayNotice
                icon={faCalendarDay}
                title="Fora do horário agora"
                description={
                    <span className={style.closedText}>
                        Agora não dá para acender a luz pelo app. O clube não tem horário de autoatendimento
                        marcado nas próximas semanas.
                    </span>
                }
            />
        );
    }

    const isToday = isWindowToday(next, now);

    return (
        <ReplayNotice
            icon={isToday ? faClock : faCalendarDay}
            title={isToday && startsLater ? `Hoje a partir das ${next.start}` : "Fora do horário agora"}
            description={
                <span className={style.closedText}>
                    Agora nenhuma quadra está liberada para acender a luz pelo app. A primeira abre{" "}
                    <strong>{describeWindow(next, now)}</strong>
                    {occasion ? <> — {occasion}</> : null}. Cada quadra tem o próprio horário; a tela libera
                    sozinha quando a primeira abrir.
                </span>
            }
        />
    );
}

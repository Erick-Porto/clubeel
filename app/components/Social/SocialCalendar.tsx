"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBan, faCheck, faChevronLeft, faChevronRight, faCircleCheck, faLock, faMinus } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/social.module.css";
import { Loading } from "../Common/loading";
import { Pill } from "../UI/ui";
import type { SocialCalendar as SocialCalendarData } from "../../../services/social-api";
import { firstWeekday, formatDayLong, formatMonth } from "../../../utils/social";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const STATUS_CLASS: Record<string, string> = {
    available: style.dayAvailable,
    reserved: style.dayReserved,
    blocked: style.dayBlocked,
    out_of_window: style.dayOut,
};

const STATUS_LABEL: Record<string, string> = {
    available: "disponível",
    reserved: "ocupada",
    blocked: "bloqueada pelo clube",
    out_of_window: "fora do período de reserva",
};

interface SocialCalendarProps {
    month: string;
    calendar: SocialCalendarData | null;
    loading: boolean;
    selectedDate: string | null;
    onSelect: (date: string) => void;
    onPrev: () => void;
    onNext: () => void;
    canPrev: boolean;
    canNext: boolean;
}

/**
 * Calendário do mês de um espaço. Cada dia pinta o `status` que a Lara mandou;
 * só `available` é clicável. Não diz — e não sabe — de quem é uma data ocupada.
 */
export default function SocialCalendar({
    month,
    calendar,
    loading,
    selectedDate,
    onSelect,
    onPrev,
    onNext,
    canPrev,
    canNext,
}: SocialCalendarProps) {
    // Só usa a resposta se ela for do mês na tela (evita piscar o mês anterior).
    const days = calendar && calendar.month === month ? calendar.days : [];
    const leading = firstWeekday(month);

    return (
        <div className={style.panel}>
            <div className={style.calendarNav}>
                <button
                    type="button"
                    className={style.calendarArrow}
                    onClick={onPrev}
                    disabled={!canPrev || loading}
                    aria-label="Mês anterior"
                >
                    <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <span className={style.calendarMonth}>{formatMonth(month)}</span>
                <button
                    type="button"
                    className={style.calendarArrow}
                    onClick={onNext}
                    disabled={!canNext || loading}
                    aria-label="Próximo mês"
                >
                    <FontAwesomeIcon icon={faChevronRight} />
                </button>
            </div>

            {loading || days.length === 0 ? (
                <div className={style.calendarLoading}>
                    {loading ? <Loading /> : <p className={style.hint}>Não foi possível carregar este mês.</p>}
                </div>
            ) : (
                <div className={style.calendarGrid}>
                    {WEEKDAYS.map((name) => (
                        <span key={name} className={style.weekday}>
                            {name}
                        </span>
                    ))}
                    {Array.from({ length: leading }, (_, i) => (
                        <span key={`blank-${i}`} />
                    ))}
                    {days.map((day) => {
                        const available = day.status === "available";
                        const selected = available && day.date === selectedDate;
                        const label = `${formatDayLong(day.date)}: ${STATUS_LABEL[day.status] ?? "indisponível"}`;
                        return (
                            <button
                                key={day.date}
                                type="button"
                                className={`${style.day} ${STATUS_CLASS[day.status] ?? style.dayOut} ${selected ? style.daySelected : ""}`}
                                disabled={!available}
                                onClick={() => onSelect(day.date)}
                                aria-label={label}
                                aria-pressed={selected}
                                title={label}
                            >
                                {Number(day.date.slice(8, 10))}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className={style.legend}>
                <Pill kind="ok" icon={faCheck}>Disponível</Pill>
                <Pill kind="off" icon={faBan}>Ocupada</Pill>
                <Pill kind="danger" icon={faLock}>Bloqueada pelo clube</Pill>
                <Pill kind="off" icon={faMinus}>Fora do período</Pill>
                <Pill kind="info" icon={faCircleCheck}>Escolhida</Pill>
            </div>
        </div>
    );
}

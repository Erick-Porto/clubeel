"use client";

/**
 * [lugares] Lugar marcado (mesa, bistrô, camarote): o bloco do checkout com os
 * tipos de lugar e os lugares escolhidos, e o mapa em tela cheia onde a pessoa
 * escolhe o lugar exato.
 *
 * O lugar NÃO é entrada: cada pessoa compra a própria entrada num tipo comum.
 * Ele é nominal no responsável (quem o checkout pedir) e é sempre de um dia
 * (`day_id` do tipo). O mesmo mapa pode ser vendido por vários tipos: cada
 * lugar diz qual tipo o vende (`type_id`) e o preço é o do lote desse tipo.
 *
 * O site só mostra e deixa escolher: quem garante que o lugar não é vendido
 * duas vezes é a Lara, no pedido (`seat_taken`). Enquanto o mapa está aberto e
 * visível ele é relido a cada `refresh_after` segundos; se um lugar escolhido
 * deixou de estar livre, sai do carrinho com o aviso.
 *
 * [cativas] Mesa cativa: guardada para uma matrícula até a liberação. O site
 * não sabe de quem é — a Lara diz em cada lugar. O sócio logado lê o mapa pela
 * rota do sócio, em que a cativa da matrícula dele vem livre (`captive_mine`) e
 * aparece em destaque. A cativa de outra matrícula (`captive`) aparece só como
 * "Indisponível": quem não é o dono não precisa saber que é cativa.
 */

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChair,
    faCircleExclamation,
    faMagnifyingGlassMinus,
    faMagnifyingGlassPlus,
    faMap,
    faRotateRight,
    faStar,
    faTrashCan,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/ticket.module.css";
import { Note, Pill } from "../UI/ui";
import {
    fetchSeatMap,
    type SeatMap,
    type SeatMapSeat,
    type TicketEvent,
    type TicketFailure,
    type TicketType,
} from "../../../services/ticket-api";
import {
    SEAT_NOT_ENTRY,
    captiveReleaseText,
    formatBRL,
    isBuyable,
    isMembersOnly,
    placesText,
    priceFor,
    refusalFlash,
    seatBlockTitle,
    seatName,
    typeLabel,
    type BuyerKind,
} from "../../../utils/ticket";

/** Um lugar no carrinho. O preço é só para a tela: o que vale é o do pedido. */
export interface SeatPick {
    seatId: number;
    typeId: number;
    typeName: string;
    mapId: number;
    dayId: number | null;
    label: string;
    places: number;
    price: number;
}

export const SEAT_TAKEN_TEXT = "Esse lugar acabou de ser reservado. Escolha outro.";
// [cativas] Sem dizer que é cativa: para os outros, o lugar está só indisponível.
export const SEAT_CAPTIVE_TEXT = "Esse lugar está indisponível. Escolha outro.";

interface SheetState {
    mapId: number;
    dayId: number | null;
    /** Lugares que a Lara acabou de recusar (`seat_taken`): marcados no mapa. */
    justTaken: number[];
    /** Aviso ao abrir (a recusa que trouxe de volta ao mapa). */
    notice: string | null;
}

/* -------------------------------------------------------------------------- */
/* O carrinho de lugares                                                       */
/* -------------------------------------------------------------------------- */

export function useSeatCart() {
    const [seats, setSeats] = useState<SeatPick[]>([]);
    const [sheet, setSheet] = useState<SheetState | null>(null);

    const openMap = useCallback((mapId: number, dayId: number | null, justTaken: number[] = [], notice: string | null = null) => {
        setSheet({ mapId, dayId, justTaken, notice });
    }, []);

    const openFor = useCallback(
        (type: TicketType) => {
            if (type.map_id !== null) openMap(type.map_id, type.day_id);
        },
        [openMap]
    );

    const closeMap = useCallback(() => setSheet(null), []);

    const toggle = useCallback((pick: SeatPick) => {
        setSeats((current) =>
            current.some((item) => item.seatId === pick.seatId)
                ? current.filter((item) => item.seatId !== pick.seatId)
                : [...current, pick]
        );
    }, []);

    const removeMany = useCallback((seatIds: number[]) => {
        setSeats((current) => current.filter((item) => !seatIds.includes(item.seatId)));
    }, []);

    /**
     * Recusas de lugar no pedido. `seatAt(index)` traduz o `context.index` do
     * item recusado no lugar do carrinho (o checkout sabe a ordem dos itens).
     * Volta o mapa (relido ao abrir) e mantém o resto do carrinho.
     */
    const handleRefusal = useCallback(
        (failure: TicketFailure, seatAt: (index: number) => SeatPick | undefined) => {
            const reason = failure.reason ?? "";
            const index = Number(failure.context.index);
            const byIndex = Number.isInteger(index) ? seatAt(index) : undefined;

            if (reason === "seat_taken") {
                const ids = Array.isArray(failure.context.seat_ids)
                    ? failure.context.seat_ids.map(Number).filter(Number.isInteger)
                    : byIndex
                      ? [byIndex.seatId]
                      : [];
                const first = seats.find((item) => ids.includes(item.seatId));
                removeMany(ids);
                if (first) openMap(first.mapId, first.dayId, ids, SEAT_TAKEN_TEXT);
                return;
            }
            // [cativas] Cativa de outra matrícula: o mapa relido já a mostra
            // indisponível. Não se diz que é cativa.
            if (reason === "seat_captive") {
                const seatId = Number(failure.context.seat_id);
                const pick = seats.find((item) => item.seatId === seatId) ?? byIndex;
                if (pick) {
                    removeMany([pick.seatId]);
                    openMap(pick.mapId, pick.dayId, [], SEAT_CAPTIVE_TEXT);
                }
                return;
            }
            if (reason === "seat_not_found" || reason === "seat_wrong_type") {
                const seatId = Number(failure.context.seat_id);
                const pick = seats.find((item) => item.seatId === seatId) ?? byIndex;
                if (pick) {
                    removeMany([pick.seatId]);
                    openMap(pick.mapId, pick.dayId);
                }
                return;
            }
            if (reason === "seat_required" && byIndex) openMap(byIndex.mapId, byIndex.dayId);
            if (reason === "map_not_found") setSheet(null);
        },
        [seats, removeMany, openMap]
    );

    return {
        seats,
        sheet,
        openFor,
        closeMap,
        toggle,
        remove: (seatId: number) => removeMany([seatId]),
        removeMany,
        handleRefusal,
    };
}

export type SeatCart = ReturnType<typeof useSeatCart>;

/** "2 ingressos · 1 lugar marcado" (rodapé do checkout). */
export function itemsCountText(entries: number, seats: number): string {
    const parts: string[] = [];
    if (entries > 0 || seats === 0) parts.push(`${entries} ingresso${entries === 1 ? "" : "s"}`);
    if (seats > 0) parts.push(`${seats} lugar${seats === 1 ? "" : "es"} marcado${seats === 1 ? "" : "s"}`);
    return parts.join(" · ");
}

/** "Para 4 pessoas — as entradas são compradas à parte." */
export function seatForText(places: number): string {
    return `Para ${places} pessoa${places === 1 ? "" : "s"} — as entradas são compradas à parte.`;
}

/** "Até N lugares por pedido" quando a recusa `limit_per_order` é dos lugares. */
export function seatLimitTitle(failure: TicketFailure, seatCount: number): string | null {
    const max = Number(failure.context.max);
    if (failure.reason !== "limit_per_order" || !Number.isFinite(max) || seatCount <= max) return null;
    return `Até ${max} lugar${max === 1 ? "" : "es"} por pedido`;
}

/* -------------------------------------------------------------------------- */
/* O bloco do checkout                                                         */
/* -------------------------------------------------------------------------- */

interface SeatSectionProps {
    event: TicketEvent;
    kind: BuyerKind;
    cart: SeatCart;
    /** `max_per_order`: vale para os lugares também do sócio. */
    max: number | null;
    /** O responsável de cada lugar (sócio: pessoa do título; não sócio: nome e CPF). */
    renderHolder: (pick: SeatPick) => ReactNode;
    errors: Record<number, string>;
    disabled: boolean;
}

export function SeatSection({ event, kind, cart, max, renderHolder, errors, disabled }: SeatSectionProps) {
    const seatTypes = event.types.filter((type) => type.kind === "seat");
    if (seatTypes.length === 0) return null;

    return (
        <section className={ui.section} aria-labelledby="lugares-marcados">
            <div className={ui.sectionHead}>
                <h2 className={ui.sectionTitle} id="lugares-marcados">
                    {seatBlockTitle(event)}
                </h2>
                <span className={ui.muted}>
                    Lugar marcado, escolhido no mapa{max !== null ? ` · até ${max} lugar${max === 1 ? "" : "es"} por pedido` : ""}.
                </span>
            </div>
            <Note tone="info" icon={faChair}>
                <strong>{SEAT_NOT_ENTRY}</strong> O lugar fica no nome de um responsável.
            </Note>

            <div className={style.seatTypeList}>
                {seatTypes.map((type) => {
                    const buyable = isBuyable(type, kind) && type.map_id !== null;
                    const price = priceFor(type.lot, kind);
                    const why =
                        type.seats_free === 0
                            ? "Esgotado"
                            : !type.available
                              ? "Indisponível"
                              : kind === "guest" && isMembersOnly(type.lot)
                                ? "Só para sócios"
                                : null;
                    return (
                        <div key={type.id} className={`${style.seatType} ${buyable ? "" : style.typeOff}`}>
                            <div className={style.seatTypeInfo}>
                                <strong>{typeLabel(type, event.days)}</strong>
                                <span className={style.hint}>
                                    {buyable && price !== null ? formatBRL(price) : why}
                                    {type.seats_free !== null && type.seats_free > 0 && (
                                        <>
                                            {" "}
                                            · {type.seats_free} lugar{type.seats_free === 1 ? "" : "es"} livre{type.seats_free === 1 ? "" : "s"}
                                        </>
                                    )}
                                </span>
                            </div>
                            <button
                                type="button"
                                className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`}
                                onClick={() => cart.openFor(type)}
                                disabled={disabled || !buyable}
                            >
                                <FontAwesomeIcon icon={faMap} /> Escolher no mapa
                            </button>
                        </div>
                    );
                })}
            </div>

            {cart.seats.map((pick) => {
                const day = event.days.find((item) => item.id === pick.dayId);
                const error = errors[pick.seatId];
                return (
                    <div key={pick.seatId} className={`${style.ticketRow} ${error ? style.ticketRowError : ""}`}>
                        <div className={style.ticketRowHead}>
                            <span className={style.ticketRowTitle}>
                                <FontAwesomeIcon icon={faChair} /> {seatName(pick.typeName, pick.label)} · {placesText(pick.places)} ·{" "}
                                {formatBRL(pick.price)}
                            </span>
                            <button
                                type="button"
                                className={ui.linkButton}
                                onClick={() => cart.remove(pick.seatId)}
                                disabled={disabled}
                                aria-label={`Tirar ${seatName(pick.typeName, pick.label)} do pedido`}
                            >
                                <FontAwesomeIcon icon={faTrashCan} /> Tirar
                            </button>
                        </div>
                        <span className={style.hint}>
                            {day ? `${day.label} · ` : ""}
                            {seatForText(pick.places)}
                        </span>
                        {renderHolder(pick)}
                        {error && <span className={style.fieldError}>{error}</span>}
                    </div>
                );
            })}

            {cart.sheet && (
                <SeatMapSheet
                    key={`${cart.sheet.mapId}-${cart.sheet.dayId}-${cart.sheet.justTaken.join(",")}-${cart.sheet.notice ?? ""}`}
                    event={event}
                    kind={kind}
                    mapId={cart.sheet.mapId}
                    dayId={cart.sheet.dayId}
                    justTaken={cart.sheet.justTaken}
                    initialNotice={cart.sheet.notice}
                    picks={cart.seats}
                    max={max}
                    onToggle={cart.toggle}
                    onLost={cart.removeMany}
                    onClose={cart.closeMap}
                />
            )}
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/* O mapa                                                                      */
/* -------------------------------------------------------------------------- */

const STATUS_TEXT: Record<string, string> = {
    free: "Livre",
    held: "Reservado — alguém está pagando",
    sold: "Vendido",
    unavailable: "Indisponível",
    // [cativas] Cativa de outra matrícula: para quem vê, só indisponível.
    captive: "Indisponível",
};

const AREA_COLORS = new Set(["stage", "water", "green", "service", "warn"]);

interface SeatMapSheetProps {
    event: TicketEvent;
    kind: BuyerKind;
    mapId: number;
    dayId: number | null;
    justTaken: number[];
    initialNotice: string | null;
    picks: SeatPick[];
    max: number | null;
    onToggle: (pick: SeatPick) => void;
    onLost: (seatIds: number[]) => void;
    onClose: () => void;
}

function SeatMapSheet({ event, kind, mapId, dayId, justTaken, initialNotice, picks, max, onToggle, onLost, onClose }: SeatMapSheetProps) {
    const titleId = useId();
    const [map, setMap] = useState<SeatMap | null>(null);
    const [error, setError] = useState<TicketFailure | null>(null);
    const [focused, setFocused] = useState<number | null>(null);
    const [notice, setNotice] = useState<string | null>(initialNotice);
    const [taken, setTaken] = useState<number[]>(justTaken);
    const closeRef = useRef<HTMLButtonElement>(null);
    const pointerDown = useRef<{ x: number; y: number } | null>(null);
    const pointers = useRef(0);
    const pinched = useRef(false);
    // A releitura compara com o carrinho de AGORA, não o do momento em que o timer foi armado.
    const picksRef = useRef(picks);
    useEffect(() => {
        picksRef.current = picks;
    }, [picks]);

    const load = useCallback(async () => {
        // [cativas] O sócio lê o mapa dele (a cativa da matrícula vem livre).
        const result = await fetchSeatMap(event.id, mapId, dayId, kind === "member");
        if (!result.ok) {
            // Com o mapa já na tela, uma releitura que falhou só espera a próxima.
            setError(result);
            return null;
        }
        setError(null);
        setMap(result.data);
        const lost = picksRef.current
            .filter((pick) => pick.mapId === mapId && pick.dayId === dayId)
            .filter((pick) => result.data.seats.find((seat) => seat.id === pick.seatId)?.status !== "free")
            .map((pick) => pick.seatId);
        if (lost.length > 0) {
            onLost(lost);
            setTaken((current) => [...new Set([...current, ...lost])]);
            setNotice(SEAT_TAKEN_TEXT);
        }
        return result.data;
    }, [event.id, mapId, dayId, kind, onLost]);

    // Primeira leitura e releitura a cada `refresh_after`, só com a tela visível.
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        let alive = true;
        const schedule = (seconds: number) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(tick, seconds * 1000);
        };
        const tick = async () => {
            if (!alive || document.visibilityState !== "visible") return;
            const data = await load();
            if (alive) schedule(data?.refresh_after ?? 15);
        };
        const onVisibility = () => {
            if (document.visibilityState === "visible") tick();
            else if (timer) clearTimeout(timer);
        };
        tick();
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            alive = false;
            if (timer) clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [load]);

    // Tela cheia: trava a rolagem da página, Esc fecha, foco no "fechar".
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeRef.current?.focus();
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = previous;
            document.removeEventListener("keydown", onKey);
        };
    }, [onClose]);

    const typeOf = (seat: SeatMapSeat) => map?.types.find((type) => type.id === seat.type_id) ?? null;
    const isPicked = (seatId: number) => picks.some((pick) => pick.seatId === seatId);
    const priceOf = (seat: SeatMapSeat) => {
        const type = typeOf(seat);
        return type?.available ? priceFor(type.lot, kind) : null;
    };
    const selectable = (seat: SeatMapSeat) => seat.status === "free" && priceOf(seat) !== null;

    const choose = (seat: SeatMapSeat) => {
        setFocused(seat.id);
        const type = typeOf(seat);
        if (isPicked(seat.id)) {
            const pick = picks.find((item) => item.seatId === seat.id);
            if (pick) onToggle(pick);
            setNotice(null);
            return;
        }
        if (!selectable(seat) || !type) return;
        if (max !== null && picks.length >= max) {
            setNotice(`Até ${max} lugar${max === 1 ? "" : "es"} por pedido.`);
            return;
        }
        setNotice(null);
        onToggle({
            seatId: seat.id,
            typeId: type.id,
            typeName: type.name,
            mapId,
            dayId,
            label: seat.label,
            places: seat.places,
            price: priceOf(seat) ?? 0,
        });
    };

    // Escolhe no `pointerup` (o zoom pode engolir o `click` no toque, como no
    // mapa da home) — mas toque que virou arrasto ou pinça não escolhe lugar.
    const onPointerDown = (e: PointerEvent) => {
        pointers.current += 1;
        if (pointers.current === 1) {
            pinched.current = false;
            pointerDown.current = { x: e.clientX, y: e.clientY };
        } else {
            pinched.current = true;
        }
    };
    const onPointerEnd = () => {
        pointers.current = Math.max(0, pointers.current - 1);
    };
    const wasDrag = (e: { clientX: number; clientY: number }) => {
        const start = pointerDown.current;
        return pinched.current || !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8;
    };
    const onSeatKey = (e: KeyboardEvent, seat: SeatMapSeat) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            choose(seat);
        }
    };

    const day = event.days.find((item) => item.id === dayId);
    const focusedSeat = map?.seats.find((seat) => seat.id === focused) ?? null;
    const mine = picks.filter((pick) => pick.mapId === mapId && pick.dayId === dayId);

    const release = captiveReleaseText(map?.captive_release_at ?? null);
    const isMine = (seat: SeatMapSeat) => seat.captive_mine && seat.status === "free";
    const myCaptives = map?.seats.filter(isMine) ?? [];

    const seatStatusText = (seat: SeatMapSeat) => {
        if (isPicked(seat.id)) return isMine(seat) ? "Escolhido · sua mesa cativa" : "Escolhido";
        if (taken.includes(seat.id) && seat.status !== "free") return "Acabou de ser reservado";
        if (isMine(seat)) return `Sua mesa cativa${release ? ` — garanta até ${release}` : ""}`;
        const type = typeOf(seat);
        if (seat.status === "free" && kind === "guest" && type && isMembersOnly(type.lot)) return "Só para sócios";
        if (seat.status === "free" && priceOf(seat) === null) return "Indisponível";
        return STATUS_TEXT[seat.status] ?? seat.status;
    };

    let body: ReactNode;
    if (!map && error) {
        const gone = error.reason === "map_not_found";
        const flash = refusalFlash(error, "Não conseguimos carregar o mapa");
        body = (
            <div className={style.seatMapMessage}>
                <Note tone="warn" icon={faCircleExclamation}>
                    <strong>{flash.title}</strong>
                    {flash.text && (
                        <>
                            <br />
                            {flash.text}
                        </>
                    )}
                </Note>
                {gone ? (
                    <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={onClose}>
                        Voltar
                    </button>
                ) : (
                    <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={() => load()}>
                        <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                    </button>
                )}
            </div>
        );
    } else if (!map) {
        body = <div className={style.seatMapMessage}>Carregando o mapa...</div>;
    } else {
        body = (
            <TransformWrapper minScale={1} maxScale={6} centerOnInit doubleClick={{ disabled: true }} wheel={{ step: 0.15 }}>
                {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                        <div className={style.seatZoom} role="group" aria-label="Zoom do mapa">
                            <button type="button" onClick={() => zoomIn()} aria-label="Aproximar">
                                <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                            </button>
                            <button type="button" onClick={() => zoomOut()} aria-label="Afastar">
                                <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
                            </button>
                            <button type="button" onClick={() => resetTransform()} aria-label="Mapa inteiro">
                                <FontAwesomeIcon icon={faRotateRight} />
                            </button>
                        </div>
                        <TransformComponent wrapperClass={style.seatCanvas} contentClass={style.seatCanvasContent}>
                            <svg
                                className={style.seatSvg}
                                viewBox={`0 0 ${map.width} ${map.height}`}
                                preserveAspectRatio="xMidYMid meet"
                                onPointerDown={onPointerDown}
                                onPointerUp={onPointerEnd}
                                onPointerCancel={onPointerEnd}
                                role="group"
                                aria-label={`Mapa ${map.name}`}
                            >
                                {map.background_url && (
                                    <image
                                        href={map.background_url}
                                        x={0}
                                        y={0}
                                        width={map.width}
                                        height={map.height}
                                        preserveAspectRatio="xMidYMid meet"
                                    />
                                )}
                                {map.areas.map((area, index) => {
                                    const color = AREA_COLORS.has(area.color) ? area.color : "service";
                                    const className = `${style.seatArea} ${style[`area_${color}`]}`;
                                    return (
                                        <g key={`area-${index}`} aria-hidden="true">
                                            {area.shape === "ellipse" ? (
                                                <ellipse
                                                    className={className}
                                                    cx={area.x + area.w / 2}
                                                    cy={area.y + area.h / 2}
                                                    rx={area.w / 2}
                                                    ry={area.h / 2}
                                                />
                                            ) : (
                                                <rect className={className} x={area.x} y={area.y} width={area.w} height={area.h} rx={8} />
                                            )}
                                            {area.label && (
                                                <text
                                                    className={style.seatAreaLabel}
                                                    x={area.x + area.w / 2}
                                                    y={area.y + area.h / 2}
                                                    fontSize={Math.max(12, Math.min(28, area.h * 0.28))}
                                                >
                                                    {area.label}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                                {map.seats.map((seat) => {
                                    const picked = isPicked(seat.id);
                                    const canPick = selectable(seat);
                                    const stateClass = picked
                                        ? style.seatPicked
                                        : taken.includes(seat.id) && seat.status !== "free"
                                          ? style.seatTaken
                                          : canPick
                                            ? isMine(seat)
                                                ? style.seatMine
                                                : style.seatFree
                                            : seat.status === "held"
                                              ? style.seatHeld
                                              : seat.status === "sold"
                                                ? style.seatSold
                                                : style.seatOff;
                                    const interactive = picked || canPick;
                                    const name = seatName(typeOf(seat)?.name ?? "", seat.label);
                                    return (
                                        <g
                                            key={seat.id}
                                            className={`${style.seat} ${stateClass} ${focused === seat.id ? style.seatFocused : ""}`}
                                            role={interactive ? "button" : undefined}
                                            tabIndex={interactive ? 0 : -1}
                                            aria-pressed={interactive ? picked : undefined}
                                            aria-label={`${name}, ${placesText(seat.places)}, ${seatStatusText(seat)}`}
                                            onPointerUp={(e) => {
                                                if (e.button === 0 && !wasDrag(e)) choose(seat);
                                            }}
                                            onKeyDown={(e) => onSeatKey(e, seat)}
                                        >
                                            {seat.shape === "circle" ? (
                                                <ellipse cx={seat.x} cy={seat.y} rx={seat.w / 2} ry={seat.h / 2} />
                                            ) : (
                                                <rect x={seat.x - seat.w / 2} y={seat.y - seat.h / 2} width={seat.w} height={seat.h} rx={6} />
                                            )}
                                            <text x={seat.x} y={seat.y} fontSize={Math.max(10, Math.min(seat.w, seat.h) * 0.34)}>
                                                {seat.label}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </TransformComponent>
                    </>
                )}
            </TransformWrapper>
        );
    }

    const focusedType = focusedSeat ? typeOf(focusedSeat) : null;
    const focusedPrice = focusedSeat ? priceOf(focusedSeat) : null;

    return (
        <div className={style.seatSheetVeil}>
            <div className={style.seatSheet} role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <header className={style.seatSheetHead}>
                    <div>
                        <h2 className={style.seatSheetTitle} id={titleId}>
                            {map?.name ?? "Mapa"}
                            {day ? ` · ${day.label}` : ""}
                        </h2>
                        <span className={style.hint}>Toque num lugar livre para escolher; toque de novo para tirar.</span>
                    </div>
                    <button ref={closeRef} type="button" className={style.seatSheetClose} onClick={onClose} aria-label="Fechar o mapa">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </header>

                <div className={style.seatSheetBody}>{body}</div>

                <footer className={style.seatSheetFoot}>
                    <div aria-live="polite">
                        {notice && <p className={style.seatNotice}>{notice}</p>}
                        {myCaptives.length > 0 && (
                            <p className={style.seatMineNote}>
                                <FontAwesomeIcon icon={faStar} /> Sua mesa cativa:{" "}
                                {myCaptives.map((seat) => seatName(typeOf(seat)?.name ?? "", seat.label)).join(", ")}
                                {release ? ` — garanta até ${release}` : ""}.
                            </p>
                        )}
                        {focusedSeat && (
                            <div className={style.seatDetail}>
                                <strong>
                                    {seatName(focusedType?.name ?? "", focusedSeat.label)} · {placesText(focusedSeat.places)}
                                    {focusedPrice !== null && ` · ${formatBRL(focusedPrice)}`}
                                </strong>
                                <Pill kind={isPicked(focusedSeat.id) ? "ok" : selectable(focusedSeat) ? "info" : "off"}>
                                    {seatStatusText(focusedSeat)}
                                </Pill>
                            </div>
                        )}
                    </div>
                    <ul className={style.seatLegend} aria-label="Legenda">
                        <li><span className={`${style.swatch} ${style.seatFree}`} /> Livre</li>
                        <li><span className={`${style.swatch} ${style.seatPicked}`} /> Escolhido</li>
                        <li><span className={`${style.swatch} ${style.seatHeld}`} /> Reservado</li>
                        <li><span className={`${style.swatch} ${style.seatSold}`} /> Vendido</li>
                        <li><span className={`${style.swatch} ${style.seatOff}`} /> Indisponível</li>
                        {myCaptives.length > 0 && (
                            <li><span className={`${style.swatch} ${style.seatMine}`} /> Sua mesa cativa</li>
                        )}
                    </ul>
                    <div className={style.rowBetween}>
                        <span className={style.hint}>
                            {mine.length === 0
                                ? "Nenhum lugar escolhido neste mapa."
                                : mine.map((pick) => seatName(pick.typeName, pick.label)).join(", ")}
                            {max !== null && ` · ${picks.length} de ${max}`}
                        </span>
                        <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={onClose}>
                            Concluir
                        </button>
                    </div>
                    <span className={style.hint}>{SEAT_NOT_ENTRY}</span>
                </footer>
            </div>
        </div>
    );
}

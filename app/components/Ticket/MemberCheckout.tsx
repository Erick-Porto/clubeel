"use client";

/**
 * [v3] Checkout do SÓCIO logado (titular ou dependente): um ingresso para cada
 * pessoa do título que ele marcar, pelo preço de sócio. A lista vem de
 * `GET tickets/my-title?event_id=` — o site nunca vê o CPF; cada pessoa vai no
 * pedido pela `ref` opaca (o próprio sócio vai sem `ref`). O nome no ingresso é
 * o do cadastro do clube. `max_per_order` não vale para o sócio.
 *
 * [v4] Evento de vários dias: para cada pessoa, as diárias (uma por dia, com o
 * tipo daquele dia) ou o passaporte. Quem já tem ingresso num dia (`days_taken`)
 * não escolhe a diária dele; quem tem qualquer dia não escolhe o passaporte.
 * Se cruza com outra diária ou se o dia lotou, quem decide é a Lara no pedido.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleExclamation, faRotateRight, faUserPlus } from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/ticket.module.css";
import { Note } from "../UI/ui";
import { Loading } from "../Common/loading";
import SocialFlashBox from "../Social/SocialFlashBox";
import CouponField from "./CouponField";
import {
    createMemberOrder,
    fetchMyTitle,
    type CouponPreview,
    type MemberTicketItem,
    type MyTitle,
    type TicketEvent,
    type TicketFailure,
    type TicketType,
    type TitlePerson,
} from "../../../services/ticket-api";
import {
    COUPON_REASONS,
    EVENT_RELOAD_REASONS,
    couponPreviewDiscount,
    formatBRL,
    formatDayHours,
    groupTypes,
    isBuyable,
    isSilent,
    orderHref,
    priceFor,
    refusalFlash,
    typeLabel,
    type TicketFlash,
} from "../../../utils/ticket";

interface PersonPick {
    on: boolean;
    /** Evento de um dia: o tipo; vários dias: o tipo do passaporte. */
    type: number | null;
    passport: boolean;
    /** Vários dias: dia → tipo da diária escolhida. */
    days: Record<number, number>;
}

const EMPTY_PICK: PersonPick = { on: false, type: null, passport: false, days: {} };

/** Recusas em que a lista do título mudou: relê `my-title`. */
const TITLE_RELOAD_REASONS = new Set(["already_has_ticket", "invalid_holder", "holder_not_in_title"]);

interface MemberCheckoutProps {
    event: TicketEvent;
    onEventReload: () => Promise<void>;
    /** Atalho para a compra de não sócio (alguém de fora do título). */
    onGuestMode: () => void;
}

export default function MemberCheckout({ event, onEventReload, onGuestMode }: MemberCheckoutProps) {
    const router = useRouter();
    const [title, setTitle] = useState<MyTitle | null>(null);
    const [titleError, setTitleError] = useState<TicketFailure | null>(null);
    const [loading, setLoading] = useState(true);
    const [picks, setPicks] = useState<Record<string, PersonPick>>({});
    const [personErrors, setPersonErrors] = useState<Record<string, string>>({});
    const [coupon, setCoupon] = useState<CouponPreview | null>(null);
    const [couponError, setCouponError] = useState<string | null>(null);
    const [flash, setFlash] = useState<TicketFlash | null>(null);
    const [pending, setPending] = useState(false);
    const busy = useRef(false);
    const flashRef = useRef<HTMLDivElement>(null);

    const groups = useMemo(() => groupTypes(event), [event]);
    const buyable = (types: TicketType[]) => types.filter((type) => isBuyable(type, "member"));
    const singleTypes = buyable(groups.single);
    const passportTypes = buyable(groups.passport);

    const loadTitle = useCallback(async () => {
        const result = await fetchMyTitle(event.id);
        if (result.ok) {
            setTitle(result.data);
            setTitleError(null);
        } else if (!isSilent(result)) {
            setTitleError(result);
        }
        setLoading(false);
    }, [event.id]);

    useEffect(() => {
        loadTitle();
    }, [loadTitle]);

    const showFlash = (next: TicketFlash) => {
        setFlash(next);
        requestAnimationFrame(() => flashRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    };

    const pickOf = (ref: string) => picks[ref] ?? EMPTY_PICK;
    const updatePick = (ref: string, change: Partial<PersonPick>) => {
        setPicks((current) => ({ ...current, [ref]: { ...(current[ref] ?? EMPTY_PICK), ...change } }));
        setPersonErrors((current) => {
            const next = { ...current };
            delete next[ref];
            return next;
        });
    };

    const personBlocked = (person: TitlePerson) =>
        event.multi_day ? event.days.every((day) => person.days_taken.includes(day.id)) : person.has_ticket;

    // Itens do pedido e, em paralelo, de quem é cada um (para o `context.index` das recusas).
    const { items, owners, lines } = useMemo(() => {
        const items: MemberTicketItem[] = [];
        const owners: string[] = [];
        const lines: { key: string; name: string; label: string; price: number; discount: number }[] = [];
        const typeById = new Map(event.types.map((type) => [type.id, type]));
        const push = (person: TitlePerson, typeId: number) => {
            const type = typeById.get(typeId);
            if (!type) return;
            items.push(person.is_me ? { type_id: typeId } : { type_id: typeId, holder_ref: person.ref });
            owners.push(person.ref);
            const price = priceFor(type.lot, "member") ?? 0;
            lines.push({
                key: `${person.ref}-${typeId}`,
                name: person.name,
                label: typeLabel(type, event.days),
                price,
                discount: couponPreviewDiscount(coupon, typeId, price, "member"),
            });
        };
        for (const person of title?.people ?? []) {
            const pick = picks[person.ref];
            if (!pick?.on) continue;
            if (!event.multi_day || pick.passport) {
                if (pick.type !== null) push(person, pick.type);
            } else {
                for (const day of event.days) {
                    const typeId = pick.days[day.id];
                    if (typeId !== undefined) push(person, typeId);
                }
            }
        }
        return { items, owners, lines };
    }, [title, picks, event, coupon]);

    const total = lines.reduce((sum, line) => sum + line.price - line.discount, 0);

    const submit = async () => {
        if (busy.current || !title) return;
        // Cada pessoa marcada precisa de uma escolha.
        const missing: Record<string, string> = {};
        for (const person of title.people) {
            const pick = picks[person.ref];
            if (!pick?.on) continue;
            const chosen = !event.multi_day || pick.passport ? pick.type !== null : Object.keys(pick.days).length > 0;
            if (!chosen) missing[person.ref] = event.multi_day ? "Escolha os dias ou o passaporte." : "Escolha o tipo de ingresso.";
        }
        if (Object.keys(missing).length > 0) {
            setPersonErrors(missing);
            return;
        }
        if (items.length === 0) return;

        busy.current = true;
        setPending(true);
        setFlash(null);
        setCouponError(null);
        try {
            const result = await createMemberOrder(event.id, items, coupon?.code ?? null);
            if (result.ok) {
                router.push(orderHref(result.data.id, "member"));
                return;
            }
            if (isSilent(result)) return;

            const reason = result.reason ?? "";
            if (COUPON_REASONS.has(reason)) {
                setCouponError(refusalFlash(result).text || refusalFlash(result).title);
                return;
            }
            // Marca a pessoa do item recusado (índice do item no pedido) ou pelo CPF mascarado.
            const index = Number(result.context.index);
            const byIndex = Number.isInteger(index) ? owners[index] : undefined;
            const byCpf = title.people.find((person) => person.cpf && person.cpf === result.context.cpf)?.ref;
            const ref = byIndex ?? byCpf;
            if (ref) {
                const personFlash = refusalFlash(result, "", event.days);
                setPersonErrors({ [ref]: reason === "already_has_ticket" ? personFlash.title : personFlash.text || personFlash.title });
            }

            showFlash(refusalFlash(result, "Não foi possível criar o pedido", event.days));
            if (TITLE_RELOAD_REASONS.has(reason)) await loadTitle();
            if (EVENT_RELOAD_REASONS.has(reason)) await onEventReload();
        } finally {
            busy.current = false;
            setPending(false);
        }
    };

    if (loading) return <Loading />;

    if (titleError || !title) {
        const flashData = titleError ? refusalFlash(titleError, "Não conseguimos carregar as pessoas do seu título") : null;
        return (
            <Note tone="warn" icon={faCircleExclamation}>
                <strong>{flashData?.title}</strong>
                {flashData?.text && (
                    <>
                        <br />
                        {flashData.text}
                    </>
                )}{" "}
                {titleError?.reason !== "member_not_found" && (
                    <button type="button" className={ui.linkButton} onClick={() => loadTitle()}>
                        <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                    </button>
                )}
            </Note>
        );
    }

    const typeOptions = (types: TicketType[]) =>
        types.map((type) => (
            <option key={type.id} value={type.id}>
                {type.name} — {formatBRL(priceFor(type.lot, "member") ?? 0)}
            </option>
        ));

    return (
        <div className={style.stack}>
            <section className={ui.section} aria-labelledby="pessoas">
                <div className={ui.sectionHead}>
                    <h2 className={ui.sectionTitle} id="pessoas">
                        Para quem é o ingresso?
                    </h2>
                    <span className={ui.muted}>Título {title.title} · preço de sócio</span>
                </div>

                <div className={style.personList}>
                    {title.people.map((person) => {
                        const pick = pickOf(person.ref);
                        const blocked = personBlocked(person);
                        const error = personErrors[person.ref];
                        const passportBlocked = person.days_taken.length > 0;
                        return (
                            <article
                                key={person.ref}
                                className={`${style.person} ${pick.on ? style.personOn : ""} ${error ? style.personError : ""}`}
                            >
                                <div className={style.personHead}>
                                    <input
                                        type="checkbox"
                                        className={style.check}
                                        id={`pessoa-${person.ref}`}
                                        checked={pick.on}
                                        disabled={blocked || pending}
                                        onChange={(e) =>
                                            updatePick(person.ref, {
                                                on: e.target.checked,
                                                // Um tipo só: já vem escolhido.
                                                type:
                                                    pick.type ??
                                                    (!event.multi_day && singleTypes.length === 1 ? singleTypes[0].id : null),
                                            })
                                        }
                                    />
                                    <label htmlFor={`pessoa-${person.ref}`}>
                                        <span className={style.personName}>
                                            {person.name}
                                            {person.is_me ? " (você)" : ""}
                                        </span>
                                        <br />
                                        <span className={style.personMeta}>
                                            {person.titular ? "Titular" : "Dependente"} · CPF{" "}
                                            <span className={style.mono}>{person.cpf}</span>
                                        </span>
                                    </label>
                                </div>

                                {blocked && (
                                    <div className={style.personBody}>
                                        <span className={style.taken}>Já tem ingresso{event.multi_day ? " em todos os dias" : ""}</span>
                                    </div>
                                )}

                                {pick.on && !blocked && (
                                    <div className={style.personBody}>
                                        {!event.multi_day ? (
                                            <select
                                                aria-label={`Tipo de ingresso de ${person.name}`}
                                                value={pick.type ?? ""}
                                                onChange={(e) => updatePick(person.ref, { type: e.target.value ? Number(e.target.value) : null })}
                                                disabled={pending}
                                            >
                                                <option value="">Escolha o tipo</option>
                                                {typeOptions(singleTypes)}
                                            </select>
                                        ) : (
                                            <>
                                                {passportTypes.length > 0 && (
                                                    <div className={style.choiceRow} role="radiogroup" aria-label={`Diárias ou passaporte de ${person.name}`}>
                                                        <label>
                                                            <input
                                                                type="radio"
                                                                name={`modo-${person.ref}`}
                                                                checked={!pick.passport}
                                                                onChange={() => updatePick(person.ref, { passport: false, type: null })}
                                                                disabled={pending}
                                                            />
                                                            Diárias
                                                        </label>
                                                        <label>
                                                            <input
                                                                type="radio"
                                                                name={`modo-${person.ref}`}
                                                                checked={pick.passport}
                                                                onChange={() =>
                                                                    updatePick(person.ref, {
                                                                        passport: true,
                                                                        days: {},
                                                                        type: passportTypes.length === 1 ? passportTypes[0].id : null,
                                                                    })
                                                                }
                                                                disabled={pending || passportBlocked}
                                                            />
                                                            Passaporte (todos os dias)
                                                        </label>
                                                        {passportBlocked && <span className={style.taken}>Passaporte indisponível: já tem ingresso em um dia</span>}
                                                    </div>
                                                )}

                                                {pick.passport ? (
                                                    <select
                                                        aria-label={`Passaporte de ${person.name}`}
                                                        value={pick.type ?? ""}
                                                        onChange={(e) => updatePick(person.ref, { type: e.target.value ? Number(e.target.value) : null })}
                                                        disabled={pending}
                                                    >
                                                        <option value="">Escolha o passaporte</option>
                                                        {typeOptions(passportTypes)}
                                                    </select>
                                                ) : (
                                                    <div className={style.dayPick}>
                                                        {groups.days.map(({ day, types }) => {
                                                            const dayTypes = buyable(types);
                                                            const taken = person.days_taken.includes(day.id);
                                                            const chosen = pick.days[day.id];
                                                            const id = `dia-${person.ref}-${day.id}`;
                                                            return (
                                                                <Fragment key={day.id}>
                                                                    <label htmlFor={id}>
                                                                        <input
                                                                            type="checkbox"
                                                                            className={style.check}
                                                                            id={id}
                                                                            checked={chosen !== undefined}
                                                                            disabled={pending || taken || dayTypes.length === 0}
                                                                            onChange={(e) => {
                                                                                const days = { ...pick.days };
                                                                                if (e.target.checked) days[day.id] = dayTypes[0].id;
                                                                                else delete days[day.id];
                                                                                updatePick(person.ref, { days });
                                                                            }}
                                                                        />
                                                                        {day.label}
                                                                        <span className={style.dayHours}>{formatDayHours(day)}</span>
                                                                    </label>
                                                                    {taken ? (
                                                                        <span className={style.taken}>Já tem ingresso neste dia</span>
                                                                    ) : dayTypes.length === 0 ? (
                                                                        <span className={style.taken}>Sem ingresso à venda neste dia</span>
                                                                    ) : chosen !== undefined && dayTypes.length > 1 ? (
                                                                        <select
                                                                            aria-label={`Tipo da diária de ${day.label} para ${person.name}`}
                                                                            value={chosen}
                                                                            onChange={(e) =>
                                                                                updatePick(person.ref, { days: { ...pick.days, [day.id]: Number(e.target.value) } })
                                                                            }
                                                                            disabled={pending}
                                                                        >
                                                                            {typeOptions(dayTypes)}
                                                                        </select>
                                                                    ) : (
                                                                        <span className={style.hint}>
                                                                            {dayTypes[0].name} — {formatBRL(priceFor(dayTypes[0].lot, "member") ?? 0)}
                                                                        </span>
                                                                    )}
                                                                </Fragment>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {error && <span className={style.fieldError}>{error}</span>}
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>

                <p className={style.hint}>
                    Alguém de fora do seu título? Essa pessoa compra como não sócio — ou, se for sócia de outro título,
                    pelo login dela.{" "}
                    <button type="button" className={ui.linkButton} onClick={onGuestMode}>
                        <FontAwesomeIcon icon={faUserPlus} /> Comprar para quem não é do seu título
                    </button>
                </p>
            </section>

            <section className={ui.panel} aria-labelledby="cupom-resumo">
                <h2 className={ui.sectionTitle} id="cupom-resumo">
                    Resumo
                </h2>
                <CouponField
                    eventId={event.id}
                    kind="member"
                    applied={coupon}
                    onChange={(next) => {
                        setCoupon(next);
                        setCouponError(null);
                    }}
                    error={couponError}
                    disabled={pending}
                />
                {lines.length === 0 ? (
                    <p className={style.hint}>Marque as pessoas e escolha os ingressos.</p>
                ) : (
                    <>
                        <ul className={style.summary}>
                            {lines.map((line) => (
                                <li key={line.key} className={style.summaryLine}>
                                    <span>
                                        {line.name}
                                        <span className={ui.muted}> · {line.label}</span>
                                    </span>
                                    <span>
                                        {line.discount > 0 && <span className={style.strike}>{formatBRL(line.price)}</span>}
                                        {formatBRL(line.price - line.discount)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div className={style.summaryTotal}>
                            <span>Total{coupon ? " (prévia)" : ""}</span>
                            <span>{formatBRL(total)}</span>
                        </div>
                    </>
                )}
                <p className={style.hint}>
                    O valor final é o do pedido, calculado pelo clube. Os lugares ficam guardados por alguns minutos
                    enquanto você paga.
                </p>
            </section>

            <div ref={flashRef}>{flash && <SocialFlashBox flash={flash} onClose={() => setFlash(null)} />}</div>

            {items.length > 0 && (
                <div className={style.actionBar}>
                    <div className={style.actionTotal}>
                        <strong>{formatBRL(total)}</strong>
                        <span>
                            {items.length} ingresso{items.length === 1 ? "" : "s"} · o pagamento vem em seguida
                        </span>
                    </div>
                    <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={submit} disabled={pending}>
                        {pending ? "Reservando..." : "Reservar e pagar"}
                    </button>
                </div>
            )}
        </div>
    );
}

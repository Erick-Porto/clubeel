"use client";

/**
 * Checkout do NÃO SÓCIO (sem login e sem cadastro): os dados de quem compra e,
 * para cada ingresso, o tipo, o nome e o CPF de quem vai entrar — até
 * `max_per_order` ingressos, pelo preço de não sócio. O pedido é criado pela
 * rota do servidor do site, que guarda o token do pedido num cookie httpOnly;
 * depois segue para a página do pedido (contador, pagamento, confirmação).
 *
 * Validação aqui é só ajuda (a Lara confere tudo): dígitos do CPF e o mesmo CPF
 * em dois ingressos — [v4] permitido só em diárias de dias diferentes. CPF de
 * sócio no pedido: a Lara recusa (`holder_is_member`) e o sócio compra pelo
 * login dele.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faRightToBracket, faTrashCan, faUser } from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/ticket.module.css";
import { Note } from "../UI/ui";
import SocialFlashBox from "../Social/SocialFlashBox";
import CouponField from "./CouponField";
import {
    createGuestOrder,
    type CouponPreview,
    type GuestTicketItem,
    type TicketEvent,
} from "../../../services/ticket-api";
import {
    COUPON_REASONS,
    EVENT_RELOAD_REASONS,
    couponPreviewDiscount,
    cpfMatchesMasked,
    formatBRL,
    isBuyable,
    isMembersOnly,
    isValidCpf,
    maskCpf,
    onlyDigits,
    orderHref,
    priceFor,
    refusalFlash,
    typeLabel,
    type TicketFlash,
} from "../../../utils/ticket";

interface Row {
    key: number;
    typeId: number | null;
    name: string;
    cpf: string;
}

interface Buyer {
    cpf: string;
    name: string;
    email: string;
    phone: string;
}

/** (61) 99999-0000 — só máscara de digitação; vai à Lara só com os dígitos. */
function maskPhone(value: string): string {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    const split = digits.length === 11 ? 7 : 6;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface GuestCheckoutProps {
    event: TicketEvent;
    onEventReload: () => Promise<void>;
    /** Sócio logado que abriu o atalho: volta para a compra de sócio. */
    onMemberMode?: () => void;
}

export default function GuestCheckout({ event, onEventReload, onMemberMode }: GuestCheckoutProps) {
    const router = useRouter();
    const pathname = usePathname() ?? "";
    const nextKey = useRef(1);
    const [buyer, setBuyer] = useState<Buyer>({ cpf: "", name: "", email: "", phone: "" });
    const [rows, setRows] = useState<Row[]>([{ key: 0, typeId: null, name: "", cpf: "" }]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [coupon, setCoupon] = useState<CouponPreview | null>(null);
    const [couponError, setCouponError] = useState<string | null>(null);
    const [flash, setFlash] = useState<TicketFlash | null>(null);
    const [pending, setPending] = useState(false);
    const busy = useRef(false);
    const flashRef = useRef<HTMLDivElement>(null);

    const max = event.max_per_order;
    const typeById = useMemo(() => new Map(event.types.map((type) => [type.id, type])), [event.types]);
    const loginHref = `/login?callbackUrl=${encodeURIComponent(pathname)}`;
    const anyMembersOnly = event.types.some((type) => type.available && isMembersOnly(type.lot));
    // [v4] Só fala de passaporte se o evento tiver algum.
    const hasPassport = event.types.some((type) => type.validity === "passport");

    const showFlash = (next: TicketFlash) => {
        setFlash(next);
        requestAnimationFrame(() => flashRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    };

    const clearError = (...keys: string[]) =>
        setErrors((current) => {
            const next = { ...current };
            keys.forEach((key) => delete next[key]);
            return next;
        });

    const setBuyerField = (field: keyof Buyer, value: string) => {
        setBuyer((current) => ({ ...current, [field]: value }));
        clearError(`buyer.${field}`);
    };

    const setRow = (index: number, change: Partial<Row>) => {
        setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));
        clearError(`tickets.${index}.type_id`, `tickets.${index}.holder_name`, `tickets.${index}.holder_cpf`);
    };

    const addRow = () => {
        if (max !== null && rows.length >= max) return;
        setRows((current) => [...current, { key: nextKey.current++, typeId: null, name: "", cpf: "" }]);
    };

    const removeRow = (index: number) => {
        setRows((current) => current.filter((_, i) => i !== index));
        // Os erros são por posição: some com todos os dos ingressos.
        setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("tickets."))));
    };

    const lines = rows.map((row) => {
        const type = row.typeId !== null ? typeById.get(row.typeId) : undefined;
        const price = type ? priceFor(type.lot, "guest") ?? 0 : 0;
        return {
            row,
            label: type ? typeLabel(type, event.days) : null,
            price,
            discount: type ? couponPreviewDiscount(coupon, type.id, price, "guest") : 0,
        };
    });
    const total = lines.reduce((sum, line) => sum + line.price - line.discount, 0);

    const validate = (): Record<string, string> => {
        const found: Record<string, string> = {};
        if (!buyer.name.trim()) found["buyer.name"] = "Informe seu nome.";
        if (!isValidCpf(buyer.cpf)) found["buyer.cpf"] = "CPF inválido.";
        if (!EMAIL.test(buyer.email.trim())) found["buyer.email"] = "E-mail inválido.";
        if (onlyDigits(buyer.phone).length < 10) found["buyer.phone"] = "Telefone com DDD.";

        rows.forEach((row, index) => {
            if (row.typeId === null) found[`tickets.${index}.type_id`] = "Escolha o tipo de ingresso.";
            if (!row.name.trim()) found[`tickets.${index}.holder_name`] = "Informe o nome de quem vai usar.";
            if (!isValidCpf(row.cpf)) found[`tickets.${index}.holder_cpf`] = "CPF inválido.";
        });

        // Mesmo CPF em dois ingressos: só em diárias de dias diferentes.
        rows.forEach((row, index) => {
            const cpf = onlyDigits(row.cpf);
            if (cpf.length !== 11 || found[`tickets.${index}.holder_cpf`]) return;
            const type = row.typeId !== null ? typeById.get(row.typeId) : undefined;
            const clash = rows.slice(0, index).some((other) => {
                if (onlyDigits(other.cpf) !== cpf) return false;
                const otherType = other.typeId !== null ? typeById.get(other.typeId) : undefined;
                const bothDaily = type?.validity === "day" && otherType?.validity === "day";
                return !bothDaily || type?.day_id === otherType?.day_id;
            });
            if (clash) {
                found[`tickets.${index}.holder_cpf`] = event.multi_day
                    ? hasPassport
                        ? "Este CPF já está em outro ingresso do mesmo dia (ou num passaporte) deste pedido."
                        : "Este CPF já está em outra diária do mesmo dia deste pedido."
                    : "Um ingresso por CPF: este CPF já está em outro ingresso.";
            }
        });
        return found;
    };

    const submit = async () => {
        if (busy.current) return;
        const found = validate();
        setErrors(found);
        if (Object.keys(found).length > 0) {
            showFlash({ tone: "alert", title: "Confira os campos marcados", text: "" });
            return;
        }

        busy.current = true;
        setPending(true);
        setFlash(null);
        setCouponError(null);
        try {
            const tickets: GuestTicketItem[] = rows.map((row) => ({
                type_id: row.typeId as number,
                holder_name: row.name.trim(),
                holder_cpf: onlyDigits(row.cpf),
            }));
            const result = await createGuestOrder(
                event.id,
                { cpf: onlyDigits(buyer.cpf), name: buyer.name.trim(), email: buyer.email.trim(), phone: onlyDigits(buyer.phone) },
                tickets,
                coupon?.code ?? null
            );
            if (result.ok) {
                router.push(orderHref(result.data.id, "guest"));
                return;
            }

            const reason = result.reason ?? "";
            if (COUPON_REASONS.has(reason)) {
                setCouponError(refusalFlash(result).text || refusalFlash(result).title);
                return;
            }

            // Erros de campo do Laravel ("buyer.email", "tickets.0.holder_cpf").
            const fieldErrors: Record<string, string> = {};
            for (const [key, messages] of Object.entries(result.fieldErrors)) {
                if (messages[0]) fieldErrors[key] = messages[0];
            }
            // Recusa de um ingresso: `context.index` (+ `context.field`).
            const index = Number(result.context.index);
            if (Number.isInteger(index) && index >= 0 && index < rows.length) {
                const field =
                    typeof result.context.field === "string"
                        ? result.context.field
                        : reason === "holder_is_member" || reason === "already_has_ticket"
                          ? "holder_cpf"
                          : "type_id";
                fieldErrors[`tickets.${index}.${field}`] =
                    reason === "holder_is_member"
                        ? "Este CPF é de sócio: o sócio compra o próprio ingresso entrando com o login de sócio."
                        : refusalFlash(result).text || refusalFlash(result).title;
            }
            // `already_has_ticket` sem índice: destaca pelo CPF mascarado (`context.cpf`).
            if (reason === "already_has_ticket" && !Number.isInteger(index)) {
                rows.forEach((row, i) => {
                    if (cpfMatchesMasked(row.cpf, result.context.cpf)) {
                        fieldErrors[`tickets.${i}.holder_cpf`] = refusalFlash(result, "", event.days).title;
                    }
                });
            }
            setErrors(fieldErrors);
            showFlash(refusalFlash(result, "Não foi possível criar o pedido", event.days));
            if (EVENT_RELOAD_REASONS.has(reason)) await onEventReload();
        } finally {
            busy.current = false;
            setPending(false);
        }
    };

    const fieldClass = (key: string, full = false) =>
        `${full ? style.fieldFull : style.field} ${errors[key] ? style.fieldInvalid : ""}`;
    const fieldError = (key: string) => errors[key] && <span className={style.fieldError}>{errors[key]}</span>;

    return (
        <div className={style.stack}>
            {onMemberMode ? (
                <Note tone="info" icon={faUser}>
                    Você está comprando como <strong>não sócio</strong> (preço de não sócio), para quem não é do seu título.{" "}
                    <button type="button" className={ui.linkButton} onClick={onMemberMode}>
                        Voltar à compra de sócio
                    </button>
                </Note>
            ) : (
                <Note tone="info" icon={faRightToBracket}>
                    É sócio? <Link href={loginHref} className={ui.linkButton}>Entre com sua conta</Link> para comprar pelo
                    preço de sócio{anyMembersOnly ? " e ver os lotes só para sócios" : ""}.
                </Note>
            )}

            <section className={ui.panel} aria-labelledby="comprador">
                <h2 className={ui.sectionTitle} id="comprador">
                    Seus dados
                </h2>
                <p className={style.hint}>Para onde enviamos os ingressos e o link do pedido. Você não precisa ser um dos que vão usar.</p>
                <div className={style.fieldGrid}>
                    <div className={fieldClass("buyer.name", true)}>
                        <label htmlFor="comprador-nome">Nome completo</label>
                        <input id="comprador-nome" autoComplete="name" value={buyer.name} onChange={(e) => setBuyerField("name", e.target.value)} disabled={pending} />
                        {fieldError("buyer.name")}
                    </div>
                    <div className={fieldClass("buyer.cpf")}>
                        <label htmlFor="comprador-cpf">CPF</label>
                        <input
                            id="comprador-cpf"
                            inputMode="numeric"
                            className={style.mono}
                            placeholder="000.000.000-00"
                            value={buyer.cpf}
                            onChange={(e) => setBuyerField("cpf", maskCpf(e.target.value))}
                            disabled={pending}
                        />
                        {fieldError("buyer.cpf")}
                    </div>
                    <div className={fieldClass("buyer.phone")}>
                        <label htmlFor="comprador-telefone">Telefone</label>
                        <input
                            id="comprador-telefone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                            className={style.mono}
                            placeholder="(00) 00000-0000"
                            value={buyer.phone}
                            onChange={(e) => setBuyerField("phone", maskPhone(e.target.value))}
                            disabled={pending}
                        />
                        {fieldError("buyer.phone")}
                    </div>
                    <div className={fieldClass("buyer.email", true)}>
                        <label htmlFor="comprador-email">E-mail</label>
                        <input
                            id="comprador-email"
                            type="email"
                            autoComplete="email"
                            value={buyer.email}
                            onChange={(e) => setBuyerField("email", e.target.value)}
                            disabled={pending}
                        />
                        {fieldError("buyer.email")}
                    </div>
                </div>
            </section>

            <section className={ui.section} aria-labelledby="ingressos-pedido">
                <div className={ui.sectionHead}>
                    <h2 className={ui.sectionTitle} id="ingressos-pedido">
                        Ingressos
                    </h2>
                    <span className={ui.muted}>
                        Um por pessoa, com nome e CPF de quem vai entrar{max !== null ? ` · até ${max} por pedido` : ""}.
                    </span>
                </div>

                {rows.map((row, index) => {
                    const hasError = Object.keys(errors).some((key) => key.startsWith(`tickets.${index}.`));
                    return (
                        <div key={row.key} className={`${style.ticketRow} ${hasError ? style.ticketRowError : ""}`}>
                            <div className={style.ticketRowHead}>
                                <span className={style.ticketRowTitle}>Ingresso {index + 1}</span>
                                <div className={style.row}>
                                    <button
                                        type="button"
                                        className={ui.linkButton}
                                        onClick={() => setRow(index, { name: buyer.name, cpf: buyer.cpf })}
                                        disabled={pending || (!buyer.name && !buyer.cpf)}
                                    >
                                        É para mim
                                    </button>
                                    {rows.length > 1 && (
                                        <button
                                            type="button"
                                            className={ui.linkButton}
                                            onClick={() => removeRow(index)}
                                            disabled={pending}
                                            aria-label={`Remover ingresso ${index + 1}`}
                                        >
                                            <FontAwesomeIcon icon={faTrashCan} /> Remover
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className={style.fieldGrid}>
                                <div className={fieldClass(`tickets.${index}.type_id`, true)}>
                                    <label htmlFor={`tipo-${row.key}`}>Tipo</label>
                                    <select
                                        id={`tipo-${row.key}`}
                                        value={row.typeId ?? ""}
                                        onChange={(e) => setRow(index, { typeId: e.target.value ? Number(e.target.value) : null })}
                                        disabled={pending}
                                    >
                                        <option value="">Escolha o tipo</option>
                                        {event.types.map((type) => {
                                            const price = priceFor(type.lot, "guest");
                                            const buyable = isBuyable(type, "guest");
                                            const why = !type.available
                                                ? "indisponível"
                                                : isMembersOnly(type.lot)
                                                  ? "só para sócios"
                                                  : "";
                                            return (
                                                <option key={type.id} value={type.id} disabled={!buyable}>
                                                    {typeLabel(type, event.days)}
                                                    {buyable && price !== null ? ` — ${formatBRL(price)}` : why ? ` (${why})` : ""}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    {fieldError(`tickets.${index}.type_id`)}
                                </div>
                                <div className={fieldClass(`tickets.${index}.holder_name`)}>
                                    <label htmlFor={`nome-${row.key}`}>Nome de quem vai usar</label>
                                    <input id={`nome-${row.key}`} value={row.name} onChange={(e) => setRow(index, { name: e.target.value })} disabled={pending} />
                                    {fieldError(`tickets.${index}.holder_name`)}
                                </div>
                                <div className={fieldClass(`tickets.${index}.holder_cpf`)}>
                                    <label htmlFor={`cpf-${row.key}`}>CPF de quem vai usar</label>
                                    <input
                                        id={`cpf-${row.key}`}
                                        inputMode="numeric"
                                        className={style.mono}
                                        placeholder="000.000.000-00"
                                        value={row.cpf}
                                        onChange={(e) => setRow(index, { cpf: maskCpf(e.target.value) })}
                                        disabled={pending}
                                    />
                                    {fieldError(`tickets.${index}.holder_cpf`)}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {(max === null || rows.length < max) && (
                    <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={addRow} disabled={pending} style={{ alignSelf: "flex-start" }}>
                        <FontAwesomeIcon icon={faPlus} /> Mais um ingresso
                    </button>
                )}
            </section>

            <section className={ui.panel} aria-labelledby="resumo-nao-socio">
                <h2 className={ui.sectionTitle} id="resumo-nao-socio">
                    Resumo
                </h2>
                <CouponField
                    eventId={event.id}
                    kind="guest"
                    applied={coupon}
                    onChange={(next) => {
                        setCoupon(next);
                        setCouponError(null);
                    }}
                    error={couponError}
                    disabled={pending}
                />
                <ul className={style.summary}>
                    {lines.map(({ row, label, price, discount }, index) => (
                        <li key={row.key} className={style.summaryLine}>
                            <span>
                                {row.name.trim() || `Ingresso ${index + 1}`}
                                {label && <span className={ui.muted}> · {label}</span>}
                            </span>
                            <span>
                                {label ? (
                                    <>
                                        {discount > 0 && <span className={style.strike}>{formatBRL(price)}</span>}
                                        {formatBRL(price - discount)}
                                    </>
                                ) : (
                                    "—"
                                )}
                            </span>
                        </li>
                    ))}
                </ul>
                <div className={style.summaryTotal}>
                    <span>Total{coupon ? " (prévia)" : ""}</span>
                    <span>{formatBRL(total)}</span>
                </div>
                <p className={style.hint}>
                    O valor final é o do pedido, calculado pelo clube. Os lugares ficam guardados por alguns minutos
                    enquanto você paga. Enviamos os ingressos e o link do pedido para o seu e-mail.
                </p>
            </section>

            <div ref={flashRef}>{flash && <SocialFlashBox flash={flash} onClose={() => setFlash(null)} />}</div>

            <div className={style.actionBar}>
                <div className={style.actionTotal}>
                    <strong>{formatBRL(total)}</strong>
                    <span>
                        {rows.length} ingresso{rows.length === 1 ? "" : "s"} · o pagamento vem em seguida
                    </span>
                </div>
                <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={submit} disabled={pending}>
                    {pending ? "Reservando..." : "Reservar e pagar"}
                </button>
            </div>
        </div>
    );
}

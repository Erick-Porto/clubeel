"use client";

/**
 * "Meus ingressos" de quem comprou SEM ser sócio: CPF + e-mail da compra + um
 * código de 6 dígitos que a Lara manda para esse e-mail; depois, todos os
 * pedidos dessa pessoa. O código existe porque o QR é a entrada no evento:
 * saber CPF e e-mail não basta, a pessoa prova que lê o e-mail.
 *
 * - Pedir o código responde SEMPRE a mesma coisa (exista compra ou não): a
 *   tela mostra a mensagem da Lara e passa para o código, sem nunca dizer
 *   "CPF não encontrado".
 * - O acesso (2 horas) e os tokens dos pedidos ficam em cookies httpOnly, pelas
 *   rotas do servidor; 401 `access_expired` em qualquer ponto volta para o
 *   CPF + e-mail.
 * - O acesso é de QUEM COMPROU: quem só é titular de um ingresso não o acha
 *   aqui.
 *
 * Cada pedido abre a página de pedido que já existe (o servidor grava antes o
 * cookie daquele pedido).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faCalendarDays,
    faCreditCard,
    faEnvelopeCircleCheck,
    faFilePdf,
    faRightFromBracket,
    faRightToBracket,
} from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/ticket.module.css";
import { Loading } from "../Common/loading";
import SocialFlashBox from "../Social/SocialFlashBox";
import { Note, Pill } from "../UI/ui";
import HoldCountdown from "./HoldCountdown";
import { TicketCard, saveOrderPdf } from "./TicketOrderView";
import {
    fetchAccessOrders,
    leaveAccess,
    openAccessOrder,
    requestAccessCode,
    verifyAccessCode,
    type GuestAccessList,
    type TicketFailure,
    type TicketOrder,
} from "../../../services/ticket-api";
import {
    eventIsOver,
    formatBRL,
    formatWhen,
    isValidCpf,
    maskCpf,
    maskEmail,
    onlyDigits,
    orderCountText,
    orderTone,
    orderValueText,
    refusalFlash,
    type TicketFlash,
} from "../../../utils/ticket";

type Step = "checking" | "form" | "code" | "list";

/** Espera antes de oferecer "Reenviar código" (a Lara aceita até 5 por hora). */
const RESEND_AFTER_S = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXPIRED_FLASH: TicketFlash = {
    tone: "neutral",
    title: "Seu acesso venceu",
    text: "Informe o CPF e o e-mail da compra de novo.",
};

export default function GuestAccess() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("checking");
    const [cpf, setCpf] = useState("");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [fieldErrors, setFieldErrors] = useState<{ cpf?: string; email?: string }>({});
    const [codeMessage, setCodeMessage] = useState<string | null>(null);
    const [codeError, setCodeError] = useState<string | null>(null);
    const [codeExpired, setCodeExpired] = useState(false);
    const [resendAt, setResendAt] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [list, setList] = useState<GuestAccessList | null>(null);
    const [flash, setFlash] = useState<TicketFlash | null>(null);
    const [pending, setPending] = useState(false);
    const [busyOrder, setBusyOrder] = useState<number | null>(null);
    const busy = useRef(false);

    /** 401 `access_expired`: volta para o CPF + e-mail. */
    const expire = useCallback(() => {
        setList(null);
        setStep("form");
        setFlash(EXPIRED_FLASH);
    }, []);

    const loadList = useCallback(
        async (first = false) => {
            const result = await fetchAccessOrders();
            if (result.ok) {
                setList(result.data);
                setStep("list");
                setFlash(null);
            } else if (result.status === 401) {
                if (first) setStep("form");
                else expire();
            } else {
                setStep((current) => (current === "checking" ? "form" : current));
                setFlash(refusalFlash(result, "Não conseguimos carregar seus pedidos"));
            }
        },
        [expire]
    );

    // Já há acesso neste aparelho (cookie de até 2 horas)? Vai direto à lista.
    useEffect(() => {
        loadList(true);
    }, [loadList]);

    // Relógio do "Reenviar código".
    useEffect(() => {
        if (step !== "code") return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [step]);

    const run = async (task: () => Promise<void>) => {
        if (busy.current) return;
        busy.current = true;
        setPending(true);
        try {
            await task();
        } finally {
            busy.current = false;
            setPending(false);
        }
    };

    const sendCode = () =>
        run(async () => {
            const errors: { cpf?: string; email?: string } = {};
            if (!isValidCpf(cpf)) errors.cpf = "CPF inválido.";
            if (!EMAIL.test(email.trim())) errors.email = "E-mail inválido.";
            setFieldErrors(errors);
            if (errors.cpf || errors.email) return;

            setFlash(null);
            const result = await requestAccessCode(onlyDigits(cpf), email);
            if (result.ok) {
                setCodeMessage(result.data.message ?? "Se houver compra com esse CPF e e-mail, enviamos um código para o e-mail.");
                setCode("");
                setCodeError(null);
                setCodeExpired(false);
                setResendAt(Date.now() + RESEND_AFTER_S * 1000);
                setNow(Date.now());
                setStep("code");
                return;
            }
            showFailure(result, "Não foi possível enviar o código");
        });

    const showFailure = (result: TicketFailure, title: string) => {
        const next = {
            cpf: result.fieldErrors.cpf?.[0],
            email: result.fieldErrors.email?.[0],
        };
        if (next.cpf || next.email) setFieldErrors(next);
        else setFlash(refusalFlash(result, title));
    };

    const enter = () =>
        run(async () => {
            if (!/^\d{6}$/.test(code)) {
                setCodeError("O código tem 6 números.");
                return;
            }
            setCodeError(null);
            const result = await verifyAccessCode(onlyDigits(cpf), email, code);
            if (result.ok) {
                setCodeExpired(false);
                await loadList();
                return;
            }
            if (result.reason === "access_code_invalid") {
                const left = Number(result.context.attempts_left);
                setCodeError(
                    Number.isInteger(left)
                        ? `Código incorreto. Restam ${left} tentativa${left === 1 ? "" : "s"}.`
                        : "Código incorreto."
                );
            } else if (result.reason === "access_code_expired") {
                setCodeExpired(true);
                setCodeError("Este código não vale mais.");
            } else {
                setCodeError(refusalFlash(result, "Não foi possível conferir o código").text || result.error);
            }
        });

    const changeIdentity = () => {
        setStep("form");
        setCode("");
        setCodeError(null);
        setCodeExpired(false);
        setFlash(null);
    };

    const leave = () =>
        run(async () => {
            await leaveAccess();
            setList(null);
            setCode("");
            setStep("form");
            setFlash(null);
        });

    /** Grava o cookie do pedido e segue para a ação. */
    const withOrder = async (order: TicketOrder, action: () => Promise<void>) => {
        if (busyOrder !== null) return;
        setBusyOrder(order.id);
        try {
            const opened = await openAccessOrder(order.id);
            if (!opened.ok) {
                if (opened.status === 401) expire();
                else setFlash(refusalFlash(opened, "Não foi possível abrir o pedido"));
                return;
            }
            await action();
        } finally {
            setBusyOrder(null);
        }
    };

    const openOrder = (order: TicketOrder) =>
        withOrder(order, async () => {
            router.push(`/ingressos/pedido/${order.id}`);
        });

    const downloadPdf = (order: TicketOrder) =>
        withOrder(order, async () => {
            const result = await saveOrderPdf(order.id);
            if (!result.ok) toast.error(refusalFlash(result, "Não foi possível baixar o PDF").title);
        });

    const flashBox = flash && <SocialFlashBox flash={flash} onClose={() => setFlash(null)} />;

    if (step === "checking") return <Loading />;

    if (step === "form") {
        return (
            <div className={style.stack}>
                {flashBox}
                <form
                    className={`${ui.panel} ${style.narrowForm}`}
                    noValidate
                    onSubmit={(event) => {
                        event.preventDefault();
                        sendCode();
                    }}
                >
                    <p>Comprou sem ser sócio? Informe o CPF e o e-mail usados na compra.</p>
                    <div className={`${style.field} ${fieldErrors.cpf ? style.fieldInvalid : ""}`}>
                        <label htmlFor="acesso-cpf">CPF de quem comprou</label>
                        <input
                            id="acesso-cpf"
                            inputMode="numeric"
                            className={style.mono}
                            placeholder="000.000.000-00"
                            value={cpf}
                            onChange={(e) => {
                                setCpf(maskCpf(e.target.value));
                                setFieldErrors((current) => ({ ...current, cpf: undefined }));
                            }}
                            disabled={pending}
                        />
                        {fieldErrors.cpf && <span className={style.fieldError}>{fieldErrors.cpf}</span>}
                    </div>
                    <div className={`${style.field} ${fieldErrors.email ? style.fieldInvalid : ""}`}>
                        <label htmlFor="acesso-email">E-mail usado na compra</label>
                        <input
                            id="acesso-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setFieldErrors((current) => ({ ...current, email: undefined }));
                            }}
                            disabled={pending}
                        />
                        {fieldErrors.email && <span className={style.fieldError}>{fieldErrors.email}</span>}
                    </div>
                    <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`} disabled={pending}>
                        {pending ? "Enviando..." : "Enviar código"}
                    </button>
                    <p className={style.hint}>
                        Os ingressos ficam com quem fez a compra: se outra pessoa comprou para você, é com ela.
                    </p>
                </form>
                <Note tone="info" icon={faRightToBracket}>
                    É sócio? <Link href="/login?callbackUrl=%2Fingressos%2Fmeus" className={ui.linkButton}>Entre com sua conta</Link>{" "}
                    para ver seus ingressos. Procura um pedido só?{" "}
                    <Link href="/ingressos/perdi-o-link" className={ui.linkButton}>Peça o link de novo</Link>.
                </Note>
            </div>
        );
    }

    if (step === "code") {
        const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
        return (
            <div className={style.stack}>
                {flashBox}
                <form
                    className={`${ui.panel} ${style.narrowForm}`}
                    noValidate
                    onSubmit={(event) => {
                        event.preventDefault();
                        enter();
                    }}
                >
                    <Note tone="ok" icon={faEnvelopeCircleCheck}>
                        {codeMessage}
                    </Note>
                    <p>
                        Enviamos um código para <strong>{maskEmail(email)}</strong>. Ele vale por 10 minutos e uma vez só.
                    </p>
                    <div className={`${style.field} ${codeError ? style.fieldInvalid : ""}`}>
                        <label htmlFor="acesso-codigo">Código de 6 dígitos</label>
                        <input
                            id="acesso-codigo"
                            className={style.otp}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={code}
                            onChange={(e) => {
                                setCode(onlyDigits(e.target.value).slice(0, 6));
                                if (!codeExpired) setCodeError(null);
                            }}
                            disabled={pending}
                            autoFocus
                        />
                        {codeError && <span className={style.fieldError}>{codeError}</span>}
                    </div>
                    {codeExpired ? (
                        <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={sendCode} disabled={pending}>
                            Enviar novo código
                        </button>
                    ) : (
                        <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`} disabled={pending || code.length !== 6}>
                            {pending ? "Entrando..." : "Entrar"}
                        </button>
                    )}
                    <div className={style.row}>
                        {!codeExpired &&
                            (wait > 0 ? (
                                <span className={style.hint}>Reenviar código em {wait} s</span>
                            ) : (
                                <button type="button" className={ui.linkButton} onClick={sendCode} disabled={pending}>
                                    Reenviar código
                                </button>
                            ))}
                        <button type="button" className={ui.linkButton} onClick={changeIdentity} disabled={pending}>
                            Trocar CPF/e-mail
                        </button>
                    </div>
                    <p className={style.hint}>Não chegou? Confira a caixa de spam e se o e-mail é o mesmo da compra.</p>
                </form>
            </div>
        );
    }

    // ------------------------------------------------------------------ Lista
    const orders = list?.orders ?? [];
    const active = orders.filter((order) => order.status === "paid" && !eventIsOver(order.event));
    const toPay = orders.filter((order) => order.status === "pending_payment");
    const history = orders.filter((order) => !active.includes(order) && !toPay.includes(order));

    const orderHead = (order: TicketOrder) => (
        <div className={style.stack}>
            <div className={style.row}>
                <Pill kind={orderTone(order.status)}>{order.status_label}</Pill>
                <span className={`${style.hint} ${style.mono}`}>Pedido nº {order.id}</span>
            </div>
            <h3 className={style.typeName}>{order.event.title}</h3>
            {order.event.starts_at && (
                <span className={style.hint}>
                    <FontAwesomeIcon icon={faCalendarDays} />{" "}
                    <span className={style.mono}>{formatWhen(order.event.starts_at, order.event.ends_at, order.event.days)}</span>
                    {order.event.venue && ` · ${order.event.venue}`}
                </span>
            )}
        </div>
    );

    const openButton = (order: TicketOrder, label = "Ver pedido") => (
        <button
            type="button"
            className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`}
            onClick={() => openOrder(order)}
            disabled={busyOrder !== null}
        >
            {busyOrder === order.id ? "Abrindo..." : label} <FontAwesomeIcon icon={faArrowRight} />
        </button>
    );

    return (
        <div className={style.stack}>
            <div className={style.rowBetween}>
                <div>
                    <h2 className={ui.sectionTitle}>Olá{list?.buyer?.name ? `, ${list.buyer.name}` : ""}</h2>
                    {list?.buyer && (
                        <span className={style.hint}>
                            {list.buyer.cpf && (
                                <>
                                    CPF <span className={style.mono}>{list.buyer.cpf}</span>
                                </>
                            )}
                            {list.buyer.email && ` · ${list.buyer.email}`}
                        </span>
                    )}
                </div>
                <button type="button" className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`} onClick={leave} disabled={pending}>
                    <FontAwesomeIcon icon={faRightFromBracket} /> Sair
                </button>
            </div>

            {flashBox}

            {orders.length === 0 && (
                <Note tone="info" icon={faEnvelopeCircleCheck}>
                    <strong>Nenhum pedido encontrado para este CPF e e-mail.</strong> Confira se o e-mail é o mesmo da
                    compra.{" "}
                    <button type="button" className={ui.linkButton} onClick={leave} disabled={pending}>
                        Tentar de novo
                    </button>
                    <br />
                    Os ingressos ficam com quem fez a compra: se outra pessoa comprou para você, é com ela.
                </Note>
            )}

            {active.length > 0 && (
                <section className={ui.section} aria-labelledby="acesso-validos">
                    <h2 className={ui.sectionTitle} id="acesso-validos">
                        Seus ingressos
                    </h2>
                    {active.map((order) => (
                        <article key={order.id} className={ui.panel}>
                            {orderHead(order)}
                            <div className={style.ticketGrid}>
                                {order.tickets.map((ticket) => (
                                    <TicketCard key={ticket.id} ticket={ticket} order={order} />
                                ))}
                            </div>
                            <div className={style.row}>
                                <button
                                    type="button"
                                    className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`}
                                    onClick={() => downloadPdf(order)}
                                    disabled={busyOrder !== null}
                                >
                                    <FontAwesomeIcon icon={faFilePdf} /> Baixar PDF
                                </button>
                                {openButton(order)}
                            </div>
                        </article>
                    ))}
                </section>
            )}

            {toPay.length > 0 && (
                <section className={ui.section} aria-labelledby="acesso-pagar">
                    <h2 className={ui.sectionTitle} id="acesso-pagar">
                        Aguardando pagamento
                    </h2>
                    <div className={style.orderList}>
                        {toPay.map((order) => (
                            <article key={order.id} className={ui.panel}>
                                {orderHead(order)}
                                <span className={style.hint}>
                                    {orderCountText(order.tickets)} ·{" "}
                                    <strong className={style.mono}>{formatBRL(order.total)}</strong>
                                </span>
                                {order.hold_until && <HoldCountdown until={order.hold_until} onExpire={() => loadList()} />}
                                <button
                                    type="button"
                                    className={`${ui.btn} ${ui.btnPrimary}`}
                                    onClick={() => openOrder(order)}
                                    disabled={busyOrder !== null}
                                >
                                    <FontAwesomeIcon icon={faCreditCard} /> {busyOrder === order.id ? "Abrindo..." : "Pagar"}
                                </button>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {history.length > 0 && (
                <section className={ui.section} aria-labelledby="acesso-historico">
                    <h2 className={ui.sectionTitle} id="acesso-historico">
                        Histórico
                    </h2>
                    <div className={style.orderList}>
                        {history.map((order) => (
                            <article key={order.id} className={ui.panel}>
                                {orderHead(order)}
                                <div className={style.rowBetween}>
                                    <span className={style.mono}>{orderValueText(order)}</span>
                                    {openButton(order)}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

"use client";

/**
 * "Perdi o link" do não sócio: CPF + e-mail de quem comprou. A Lara responde
 * sempre a mesma coisa (exista pedido ou não) e manda o e-mail ela mesma; o
 * site só mostra a mensagem.
 */

import { useState } from "react";
import Link from "next/link";
import { faEnvelopeCircleCheck } from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../../styles/page.module.css";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/ticket.module.css";
import Header from "../../components/Common/header";
import Footer from "../../components/Common/footer";
import { TicketCover } from "../../components/UI/covers";
import { Note, PageHeader } from "../../components/UI/ui";
import { resendGuestLink } from "../../../services/ticket-api";
import { isValidCpf, maskCpf, onlyDigits } from "../../../utils/ticket";

const SENT = "Se houver pedido com esse CPF e e-mail, enviamos o link.";

export default function LostLinkPage() {
    const [cpf, setCpf] = useState("");
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);
    const [pending, setPending] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (pending) return;
        if (!isValidCpf(cpf)) {
            setError("CPF inválido.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError("E-mail inválido.");
            return;
        }
        setPending(true);
        setError(null);
        const result = await resendGuestLink(onlyDigits(cpf), email);
        setPending(false);
        if (result.ok) setSent(true);
        else setError(result.error);
    };

    return (
        <div className={globalStyle.page}>
            <Header />
            <TicketCover />
            <main className={`${globalStyle.main} ${ui.page}`}>
                <PageHeader
                    backHref="/ingressos"
                    title="Perdi o link do pedido"
                    lead="Comprou sem cadastro? Informe o CPF e o e-mail de quem comprou e reenviamos o link do pedido."
                />

                {sent ? (
                    <Note tone="ok" icon={faEnvelopeCircleCheck}>
                        {SENT} Confira também a caixa de spam.
                    </Note>
                ) : (
                    <form className={`${ui.panel} ${style.narrowForm}`} onSubmit={submit} noValidate>
                        <div className={`${style.field} ${error ? style.fieldInvalid : ""}`}>
                            <label htmlFor="link-cpf">CPF de quem comprou</label>
                            <input
                                id="link-cpf"
                                inputMode="numeric"
                                className={style.mono}
                                placeholder="000.000.000-00"
                                value={cpf}
                                onChange={(e) => {
                                    setCpf(maskCpf(e.target.value));
                                    setError(null);
                                }}
                            />
                        </div>
                        <div className={`${style.field} ${error ? style.fieldInvalid : ""}`}>
                            <label htmlFor="link-email">E-mail usado na compra</label>
                            <input
                                id="link-email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setError(null);
                                }}
                            />
                        </div>
                        {error && <span className={style.fieldError}>{error}</span>}
                        <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`} disabled={pending}>
                            {pending ? "Enviando..." : "Reenviar o link"}
                        </button>
                        <p className={style.hint}>
                            É sócio? Seus ingressos estão em <Link href="/ingressos/meus" className={ui.linkButton}>Meus ingressos</Link>.
                        </p>
                    </form>
                )}
            </main>
            <Footer />
        </div>
    );
}

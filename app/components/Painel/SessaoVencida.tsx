"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { comBase } from "../../../utils/base-path";
import style from "../../../styles/painel.module.css";

/**
 * A Lara respondeu 400/401 (token do sócio vencido — ele vence à meia-noite —
 * ou ausente). Não dá para só mandar para /login: o NextAuth ainda acha que há
 * sessão, e o /login devolve quem está "logado" para o callbackUrl — um laço
 * entre /login e /painel. Por isso sai primeiro e entra no login já com a volta
 * para o painel.
 */
export default function SessaoVencida() {
    useEffect(() => {
        const volta = encodeURIComponent(comBase("/painel"));
        signOut({ callbackUrl: comBase(`/login?callbackUrl=${volta}`) });
    }, []);

    return (
        <div className={style.aviso} role="status">
            <strong>Sua sessão venceu</strong>
            <p>Levando você ao login. Depois de entrar, você volta para o painel.</p>
        </div>
    );
}

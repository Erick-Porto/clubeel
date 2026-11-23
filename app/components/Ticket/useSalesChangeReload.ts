"use client";

import { useEffect } from "react";
import type { TicketEvent } from "../../../services/ticket-api";
import { nextSalesChange } from "../../../utils/ticket";

/** Folga depois do horário, para a Lara já responder com o tipo fechado. */
const GRACE_MS = 2_000;
/** O `setTimeout` não aceita mais que ~24 dias; acima disso, relê antes e reagenda. */
const MAX_WAIT_MS = 24 * 60 * 60 * 1000;

/**
 * [sessões] Relê o evento quando passa o `sales_ends_at` mais próximo (o fim da
 * sessão de uma diária, ou o fim das vendas do evento). As páginas do evento e
 * da compra são lidas no navegador (sem cache no servidor); quem deixa a tela
 * aberta veria o tipo "à venda" depois do fim da sessão. A Lara recusa do mesmo
 * jeito (`session_closed`); isto só mantém a tela em dia.
 */
export default function useSalesChangeReload(event: TicketEvent | null, reload: () => unknown) {
    useEffect(() => {
        if (!event) return;
        const at = nextSalesChange(event);
        if (at === null) return;
        const wait = Math.min(Math.max(0, at - Date.now()) + GRACE_MS, MAX_WAIT_MS);
        const timer = window.setTimeout(() => reload(), wait);
        return () => window.clearTimeout(timer);
    }, [event, reload]);
}

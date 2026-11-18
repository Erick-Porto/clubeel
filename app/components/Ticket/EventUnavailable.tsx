"use client";

import Link from "next/link";
import { faTicket } from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import ReplayNotice from "../Replay/ReplayNotice";

/**
 * Evento que a Lara não mostra mais (404 `event_not_found`): encerrado,
 * cancelado, de volta a rascunho ou inexistente. Quem chega aqui veio por link
 * antigo, cache ou compartilhamento — não é erro, então o aviso é neutro e
 * leva de volta à vitrine. O pedido de evento encerrado continua em "Meus
 * ingressos", que não depende desta rota.
 */
export default function EventUnavailable() {
    return (
        <ReplayNotice
            icon={faTicket}
            title="Este evento não está mais disponível"
            description="Veja os eventos à venda agora. Se você comprou ingresso para ele, o pedido continua em Meus ingressos."
            action={
                <Link href="/ingressos" className={`${ui.btn} ${ui.btnPrimary}`}>
                    Ver eventos
                </Link>
            }
        />
    );
}

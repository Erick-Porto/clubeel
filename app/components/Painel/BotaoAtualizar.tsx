"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateRight } from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";

/**
 * Busca tudo de novo no servidor (`router.refresh()` re-renderiza os Server
 * Components, que chamam a Lara com `no-store`). Só quando a pessoa pede:
 * o painel não se atualiza sozinho em laço (a Lara limita 120 chamadas/min).
 */
export default function BotaoAtualizar({ rotulo = "Atualizar" }: { rotulo?: string }) {
    const router = useRouter();
    const [atualizando, iniciar] = useTransition();

    return (
        <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary} ${ui.btnSm}`}
            onClick={() => iniciar(() => router.refresh())}
            disabled={atualizando}
            aria-busy={atualizando}
        >
            <FontAwesomeIcon icon={faRotateRight} spin={atualizando} /> {atualizando ? "Atualizando…" : rotulo}
        </button>
    );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Vendas: quando o período inclui hoje, busca de novo a cada 60 s — só com a
 * aba visível (`document.visibilityState`). Período todo no passado não se
 * atualiza sozinho. 60 s é o cache da Lara para períodos com hoje: mais rápido
 * que isso não muda número nenhum.
 */
export default function AutoAtualizar({ ativo }: { ativo: boolean }) {
    const router = useRouter();

    useEffect(() => {
        if (!ativo) return;
        const id = window.setInterval(() => {
            if (document.visibilityState === "visible") router.refresh();
        }, 60_000);
        return () => window.clearInterval(id);
    }, [ativo, router]);

    return null;
}

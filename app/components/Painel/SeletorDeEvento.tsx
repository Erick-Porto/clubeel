"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import style from "../../../styles/painel.module.css";
import { formatarData } from "../../../utils/painel";

interface Opcao {
    id: number;
    title: string;
    starts_at: string | null;
    status_label: string;
}

/**
 * Seletor de evento. A escolha vai para a URL (`?evento=12`): dá para
 * compartilhar e recarregar. A página do servidor lê o parâmetro e busca os
 * números; a troca mostra o esqueleto (Suspense com `key` do evento).
 */
export default function SeletorDeEvento({ eventos, selecionado }: { eventos: Opcao[]; selecionado: number | null }) {
    const router = useRouter();
    const [trocando, iniciar] = useTransition();
    const naLista = eventos.some((evento) => evento.id === selecionado);

    return (
        <label className={style.seletor}>
            <span className={style.rotulo}>Evento</span>
            <select
                value={naLista ? String(selecionado) : ""}
                disabled={trocando}
                onChange={(e) => {
                    const id = e.target.value;
                    if (id) iniciar(() => router.push(`/painel/ingressos?evento=${encodeURIComponent(id)}`));
                }}
            >
                {!naLista && (
                    <option value="" disabled>
                        Escolha um evento
                    </option>
                )}
                {eventos.map((evento) => (
                    <option key={evento.id} value={evento.id}>
                        {[evento.title, formatarData(evento.starts_at), evento.status_label].filter(Boolean).join(" · ")}
                    </option>
                ))}
            </select>
        </label>
    );
}

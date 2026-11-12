"use client";

/**
 * Estado de cliente do painel Vendas: a troca de filtro é uma navegação
 * (`router.push` com o filtro na URL) e o conteúdo precisa saber que ela está
 * em curso para mostrar o esqueleto. O "Atualizar" e a atualização automática
 * NÃO passam por aqui: nelas os números ficam na tela enquanto busca.
 *
 * `MemoriaDeVendas` guarda o último conteúdo que deu certo para que um 422
 * (filtro inválido) mostre a mensagem junto do filtro sem apagar os gráficos.
 * A memória é só da tela aberta (estado do React): nada vai para o
 * `localStorage` — são dados financeiros do clube.
 */

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import style from "../../../styles/painel.module.css";
import { EsqueletoDeVendas } from "./Esqueleto";

interface Contexto {
    pendente: boolean;
    navegar: (url: string) => void;
}

const ContextoVendas = createContext<Contexto>({ pendente: false, navegar: () => {} });

export function useVendas() {
    return useContext(ContextoVendas);
}

export function ProvedorDeVendas({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [pendente, iniciar] = useTransition();
    const navegar = (url: string) => iniciar(() => router.push(url));
    return <ContextoVendas.Provider value={{ pendente, navegar }}>{children}</ContextoVendas.Provider>;
}

interface MemoriaProps {
    /** Esta renderização deu certo: guarda para mostrar se o próximo filtro for inválido. */
    guardar: boolean;
    /** A Lara respondeu 422 ao filtro atual. */
    invalido: boolean;
    children: ReactNode;
}

export function MemoriaDeVendas({ guardar, invalido, children }: MemoriaProps) {
    const { pendente } = useVendas();
    const [ultimo, setUltimo] = useState<ReactNode>(null);

    useEffect(() => {
        if (guardar) setUltimo(children);
    }, [guardar, children]);

    if (pendente) return <EsqueletoDeVendas />;

    if (invalido) {
        if (!ultimo) return null;
        return (
            <div className={style.anterior}>
                <p className={style.anteriorAviso}>Os números abaixo são do filtro anterior.</p>
                <div aria-hidden="true" className={style.anteriorConteudo}>
                    {ultimo}
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

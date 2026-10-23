"use client";

/**
 * Capas dos módulos que têm abas. Ficam aqui para todas as telas do módulo
 * mostrarem as mesmas abas, na mesma ordem.
 */

import { faChampagneGlasses, faTrophy, faVideo } from "@fortawesome/free-solid-svg-icons";
import { ModuleCover } from "./ui";

export function ReplayCover() {
    return (
        <ModuleCover
            area="replay"
            icon={faVideo}
            title="Replay"
            lead="Lances gravados nas quadras, disponíveis por 7 dias."
            tabs={[
                { label: "Galeria", href: "/replay" },
                { label: "Meus vídeos", href: "/meus-videos" },
            ]}
        />
    );
}

export function SocialCover() {
    return (
        <ModuleCover
            area="social"
            icon={faChampagneGlasses}
            title="Espaços sociais"
            lead="Churrasqueiras e salões, reservados pelo dia inteiro."
            tabs={[
                { label: "Espaços", href: "/espacos-sociais" },
                { label: "Minhas reservas", href: "/espacos-sociais/reservas" },
            ]}
        />
    );
}

/**
 * Torneios. "Minhas inscrições" é do sócio; a lista é aberta a qualquer
 * visitante (quem não está logado cai no login ao tocar na aba).
 */
export function TournamentCover() {
    return (
        <ModuleCover
            area="torneios"
            icon={faTrophy}
            title="Torneios"
            lead="Inscrições, times, chaveamento e resultados dos torneios do clube."
            tabs={[
                { label: "Torneios", href: "/torneios" },
                { label: "Minhas inscrições", href: "/torneios/inscricoes" },
            ]}
        />
    );
}

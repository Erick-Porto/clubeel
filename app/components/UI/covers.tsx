"use client";

/**
 * Capas dos módulos que têm abas. Ficam aqui para todas as telas do módulo
 * mostrarem as mesmas abas, na mesma ordem.
 */

import { faChampagneGlasses, faTicket, faVideo } from "@fortawesome/free-solid-svg-icons";
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
 * Eventos: ingressos e torneios numa capa só (decisão de 2026-11-04 — o módulo
 * Ingressos virou "Eventos" e os torneios passaram a morar dentro dele). As
 * URLs continuam `/ingressos/...` e `/torneios/...`: o link que a Lara manda
 * por e-mail ao não sócio é `/ingressos/pedido/{id}?token=…`.
 *
 * A capa tem a cor de Eventos (chave `ingressos` do `Area`) em todas as abas;
 * os cartões e as telas do torneio seguem com a cor dos torneios.
 *
 * Vitrine, lista de torneios e "Meus ingressos" são abertos (sem login, "Meus
 * ingressos" é o do não sócio, por CPF + e-mail + código); "Minhas inscrições"
 * é do sócio (quem não está logado cai no login ao tocar na aba).
 */
export function EventsCover() {
    return (
        <ModuleCover
            area="ingressos"
            icon={faTicket}
            title="Eventos"
            lead="Ingressos dos eventos e torneios do clube."
            tabs={[
                { label: "Ingressos", href: "/ingressos" },
                { label: "Torneios", href: "/torneios" },
                { label: "Meus ingressos", href: "/ingressos/meus" },
                { label: "Minhas inscrições", href: "/torneios/inscricoes" },
            ]}
        />
    );
}

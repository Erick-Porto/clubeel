"use client";

/**
 * Página inicial para quem chega SEM sessão (a raiz `/` saiu do matcher do
 * middleware). Antes o visitante caía direto no login e as áreas abertas
 * (RePET e torneios) ficavam escondidas atrás de um cartão no fim do
 * formulário. Agora são quatro portas do mesmo tamanho: o sócio entra; RePET,
 * torneios e ingressos não precisam de conta.
 *
 * As fotos do clube (o mesmo carrossel do login) ficam fixas ao fundo, com um
 * véu na cor da tela para o texto ler bem nos dois temas.
 */

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faRightToBracket, faTicket, faTrophy, faUser, faVideo } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/public-home.module.css";
import Carousel from "./carousel";
import Footer from "./footer";
import { areaStyle, type Area } from "../UI/ui";
import { comBase } from "../../../utils/base-path";
import { moduloVisivel } from "../../../utils/modulos";

interface Door {
    href: string;
    area: Area;
    icon: IconDefinition;
    hint: string;
    title: string;
    lead: string;
    action: string;
}

const TODAS: Door[] = [
    {
        href: "/login",
        area: "inicio",
        icon: faUser,
        hint: "Sou sócio",
        title: "Entrar",
        lead: moduloVisivel("social") || moduloVisivel("torneios")
            ? "Reserve quadras e espaços sociais, acenda a luz da quadra e inscreva-se nos torneios."
            : "Reserve quadras, acenda a luz da quadra e veja os seus replays.",
        action: "Entrar ou criar conta",
    },
    {
        href: "/replay",
        area: "replay",
        icon: faVideo,
        hint: "Não precisa de conta",
        title: "RePET",
        lead: "Assista aos replays gravados nas quadras.",
        action: "Ver replays",
    },
    {
        href: "/torneios",
        area: "torneios",
        icon: faTrophy,
        hint: "Não precisa de conta",
        title: "Torneios",
        lead: "Categorias, chaveamento e resultados dos torneios do clube.",
        action: "Ver torneios",
    },
    {
        href: "/ingressos",
        area: "ingressos",
        icon: faTicket,
        hint: "Não precisa de conta",
        title: "Ingressos",
        lead: "Eventos do clube: compre sem cadastro. Sócio paga menos com a conta dele.",
        action: "Ver eventos",
    },
];

/** Sem as portas dos módulos ainda não liberados nesta instância (utils/modulos.ts). */
const DOORS = TODAS.filter((door) => moduloVisivel(door.area));

export default function PublicHome() {
    return (
        <div className={style.page}>
            <div className={style.backdrop} aria-hidden="true">
                <Carousel height={100} controllers={false} />
            </div>
            <div className={style.veil} aria-hidden="true" />

            <div className={style.content}>
                <header className={style.top}>
                    <Link href="/" className={style.logo} aria-label="Início">
                        <Image
                            src={comBase("/images/logo-cfcsn-horiz.png")}
                            alt="Clube dos Funcionários CSN"
                            width={220}
                            height={88}
                            priority
                            quality={100}
                            className={style.logoLight}
                        />
                        <Image
                            src={comBase("/images/logo-cfcsn-w-horiz.png")}
                            alt=""
                            width={220}
                            height={88}
                            priority
                            quality={100}
                            className={style.logoDark}
                        />
                    </Link>
                    <Link href="/login" className={style.enter}>
                        <FontAwesomeIcon icon={faRightToBracket} /> Entrar
                    </Link>
                </header>

                <main className={style.main}>
                    <section className={style.hero}>
                        <span className={style.kicker}>Clube dos Funcionários CSN</span>
                        <h1 className={style.title}>Bem-vindo!</h1>
                        <p className={style.lead}>O que você quer fazer hoje?</p>
                    </section>

                    <nav className={style.doors} style={{ "--portas": DOORS.length } as CSSProperties} aria-label="Áreas do site">
                        {DOORS.map((door) => (
                            <Link key={door.href} href={door.href} className={style.door} style={areaStyle(door.area)}>
                                <span className={style.doorIcon} aria-hidden="true">
                                    <FontAwesomeIcon icon={door.icon} />
                                </span>
                                <span className={style.doorText}>
                                    <span className={style.doorHint}>{door.hint}</span>
                                    <strong className={style.doorTitle}>{door.title}</strong>
                                    <span className={style.doorLead}>{door.lead}</span>
                                </span>
                                <span className={style.doorAction}>
                                    {door.action} <FontAwesomeIcon icon={faArrowRight} />
                                </span>
                            </Link>
                        ))}
                    </nav>
                </main>

                <Footer />
            </div>
        </div>
    );
}

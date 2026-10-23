"use client";

/**
 * Página inicial para quem chega SEM sessão (a raiz `/` saiu do matcher do
 * middleware). Antes o visitante caía direto no login e as áreas abertas
 * (RePET e torneios) ficavam escondidas atrás de um cartão no fim do
 * formulário. Agora são três portas do mesmo tamanho: o sócio entra; RePET e
 * torneios não precisam de conta.
 *
 * As fotos do clube (o mesmo carrossel do login) ficam fixas ao fundo, com um
 * véu na cor da tela para o texto ler bem nos dois temas.
 */

import Image from "next/image";
import Link from "next/link";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faRightToBracket, faTrophy, faUser, faVideo } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/public-home.module.css";
import Carousel from "./carousel";
import Footer from "./footer";
import { areaStyle, type Area } from "../UI/ui";
import { comBase } from "../../../utils/base-path";

interface Door {
    href: string;
    area: Area;
    icon: IconDefinition;
    hint: string;
    title: string;
    lead: string;
    action: string;
}

const DOORS: Door[] = [
    {
        href: "/login",
        area: "inicio",
        icon: faUser,
        hint: "Sou sócio",
        title: "Entrar",
        lead: "Reserve quadras e espaços sociais, acenda a luz da quadra e inscreva-se nos torneios.",
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
];

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

                    <nav className={style.doors} aria-label="Áreas do site">
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

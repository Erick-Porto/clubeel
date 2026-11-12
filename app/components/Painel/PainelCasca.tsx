/**
 * Casca do painel (dashboards do administrador): faixa na cor do módulo com
 * logo, "Painel", quem está vendo e a volta para o site; abaixo, as abas dos
 * painéis que a Lara mandou em `panels` (na ordem recebida, só as que o site
 * conhece). Separada da área do sócio: sem cabeçalho de módulos, sem barra
 * inferior, sem carrinho.
 *
 * Server Component (nada de hook): as páginas do painel buscam tudo no servidor.
 */

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import headerStyle from "../../../styles/header.module.css";
import style from "../../../styles/painel.module.css";
import { comBase } from "../../../utils/base-path";
import { PAINEIS_CONHECIDOS } from "../../../utils/painel";
import type { Acesso } from "../../../services/dashboard-api";

// Mesmo que `areaStyle("painel")` de ui.tsx — que é módulo de cliente e não
// pode ser chamado de um Server Component.
const COR_DO_MODULO = { "--c": "var(--a-painel-rgb)", "--ci": "var(--a-painel-ink-rgb)" } as CSSProperties;

interface PainelCascaProps {
    /** Sem acesso (403, sessão vencida…) a casca vem sem abas e sem nome. */
    acesso?: Acesso | null;
    /** `key` do painel aberto. */
    ativo?: string;
    children: ReactNode;
}

export default function PainelCasca({ acesso, ativo, children }: PainelCascaProps) {
    const paineis = (acesso?.panels ?? []).filter((painel) => PAINEIS_CONHECIDOS[painel.key]);
    const membro = acesso?.member;

    return (
        <div className={style.casca} style={COR_DO_MODULO}>
            <header className={style.faixa}>
                <div className={style.faixaMiolo}>
                    <Link href="/" aria-label="Voltar ao site" className={style.logo}>
                        <Image
                            src={comBase("/images/logo-cfcsn-horiz.png")}
                            alt="Clube dos Funcionários CSN"
                            width={90}
                            height={36}
                            className={headerStyle.logoLight}
                        />
                        <Image
                            src={comBase("/images/logo-cfcsn-w-horiz.png")}
                            alt=""
                            width={90}
                            height={36}
                            className={headerStyle.logoDark}
                        />
                    </Link>
                    <div className={style.faixaTitulo}>
                        <strong>Painel</strong>
                        {membro && (
                            <span>
                                {membro.name}
                                {membro.title && <> · Matrícula <span className={style.mono}>{membro.title}</span></>}
                            </span>
                        )}
                    </div>
                    <Link href="/" className={style.voltar}>
                        <FontAwesomeIcon icon={faArrowLeft} /> <span>Voltar ao site</span>
                    </Link>
                </div>

                {paineis.length > 0 && (
                    <nav className={style.abas} aria-label="Painéis">
                        {paineis.map((painel) => {
                            const conhecido = PAINEIS_CONHECIDOS[painel.key];
                            const atual = painel.key === ativo;
                            return (
                                <Link
                                    key={painel.key}
                                    href={conhecido.href}
                                    className={`${style.aba} ${atual ? style.abaAtiva : ""}`}
                                    aria-current={atual ? "page" : undefined}
                                >
                                    <FontAwesomeIcon icon={conhecido.icon} /> {painel.label}
                                </Link>
                            );
                        })}
                    </nav>
                )}
            </header>

            <main className={style.miolo}>{children}</main>
        </div>
    );
}

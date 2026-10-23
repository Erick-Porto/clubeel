"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import headerStyle from "../../../styles/header.module.css";
import style from "../../../styles/tournament.module.css";
import { areaStyle } from "../UI/ui";
import { comBase } from "../../../utils/base-path";

interface StaffShellProps {
    title: string;
    subtitle: string;
    /** Ação à direita da faixa (ex.: "Sair"). */
    action?: ReactNode;
    children: ReactNode;
}

/**
 * Casca das telas da EQUIPE do torneio (escolha do torneio e lançamento): só a
 * faixa na cor do módulo com logo, título e uma ação — sem o cabeçalho e a
 * barra inferior do sócio, para sobrar tela no celular na beira da quadra.
 * O logo volta para a página geral de torneios.
 */
export default function StaffShell({ title, subtitle, action, children }: StaffShellProps) {
    return (
        <div className={style.staffShell}>
            <header className={style.staffTop} style={areaStyle("torneios")}>
                <div className={style.staffTopInner}>
                    <Link href="/torneios" aria-label="Torneios">
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
                    <div className={style.staffTitle}>
                        <strong>{title}</strong>
                        <span>{subtitle}</span>
                    </div>
                    {action}
                </div>
            </header>

            <main className={style.staffMain}>{children}</main>
        </div>
    );
}

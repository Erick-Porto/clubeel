"use client";

import { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/replay.module.css";
import { sportImage } from "../../../utils/replay";

interface ReplaySportSectionProps {
    /** Nome do esporte — também decide a foto de fundo. */
    name: string;
    /** Linha de resumo: quadras, vídeos, quando foi o último. */
    meta: string;
    /** Rótulo do botão quando fechado ("Ver quadras", "Ver vídeos"...). */
    openLabel: string;
    isOpen: boolean;
    onToggle: () => void;
    /** Precisa ser único na página: liga o botão ao painel para leitores de tela. */
    panelId: string;
    children: ReactNode;
}

/**
 * Banda de um esporte, usada como primeiro nível tanto na galeria pública
 * quanto em "meus vídeos". Mora aqui para as duas telas não divergirem com o
 * tempo — é a mesma ideia nas duas, e quem entra por uma reconhece a outra.
 *
 * A foto é a da quadra do clube (`sportImage`); esporte sem foto cai no
 * degradê grena, sem buraco no layout.
 */
export default function ReplaySportSection({
    name,
    meta,
    openLabel,
    isOpen,
    onToggle,
    panelId,
    children,
}: ReplaySportSectionProps) {
    const image = sportImage(name);

    return (
        <section className={`${style.groupSection} ${isOpen ? style.groupSectionOpen : ""}`}>
            <button
                type="button"
                className={`${style.groupHeader} ${image ? "" : style.groupHeaderPlain}`}
                style={image ? { backgroundImage: `url(${image})` } : undefined}
                onClick={onToggle}
                aria-expanded={isOpen}
                aria-controls={panelId}
            >
                <span className={style.groupHeaderMain}>
                    <span className={style.groupName}>{name}</span>
                    <span className={style.groupMeta}>{meta}</span>
                </span>

                <span className={style.groupToggle}>
                    <span className={style.groupToggleText}>{isOpen ? "Fechar" : openLabel}</span>
                    <FontAwesomeIcon
                        icon={faChevronDown}
                        className={`${style.groupChevron} ${isOpen ? style.groupChevronOpen : ""}`}
                    />
                </span>
            </button>

            <div id={panelId} className={style.groupBody} hidden={!isOpen}>
                {children}
            </div>
        </section>
    );
}

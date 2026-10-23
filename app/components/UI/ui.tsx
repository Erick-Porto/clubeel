"use client";

/**
 * Peças da identidade v4 usadas pelas telas de sócio (equivalentes aos
 * componentes x-page-title, x-area-cover, x-pill, x-media e x-search-bar do
 * Lara). Estilos em styles/ui.module.css; regras em
 * docs/resumo-modulos/14-identidade-visual.md.
 */

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faArrowLeft, faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";

/* ------------------------------------------------------------------ Módulos */

/**
 * Módulos do app e a cor de cada um. A cor diz ONDE a pessoa está; ação é
 * sempre grená. Para um módulo novo: tokens --a-<chave>-rgb e
 * --a-<chave>-ink-rgb nos três blocos de globals.css e a chave aqui.
 */
export type Area = "inicio" | "quadras" | "social" | "replay" | "luz" | "perfil" | "compras" | "torneios";

/** Variáveis `--c`/`--ci` (canais do fundo e da tinta do módulo) para estilo inline. */
export function areaStyle(area: Area): CSSProperties {
    return {
        "--c": `var(--a-${area}-rgb)`,
        "--ci": `var(--a-${area}-ink-rgb)`,
    } as CSSProperties;
}

/* --------------------------------------------------------- Título da tela */

interface PageHeaderProps {
    title: ReactNode;
    lead?: ReactNode;
    kicker?: ReactNode;
    /** Destino da seta de voltar. Sem ele (e com `back`), volta no histórico. */
    backHref?: string;
    back?: boolean;
    backLabel?: string;
    actions?: ReactNode;
}

export function PageHeader({ title, lead, kicker, backHref, back, backLabel = "Voltar", actions }: PageHeaderProps) {
    const router = useRouter();
    return (
        <div className={ui.pageHeader}>
            {backHref ? (
                <Link href={backHref} className={ui.back} aria-label={backLabel} title={backLabel}>
                    <FontAwesomeIcon icon={faArrowLeft} />
                </Link>
            ) : back ? (
                <button type="button" className={ui.back} onClick={() => router.back()} aria-label={backLabel} title={backLabel}>
                    <FontAwesomeIcon icon={faArrowLeft} />
                </button>
            ) : null}
            <div className={ui.titleBlock}>
                {kicker && <span className={ui.kicker}>{kicker}</span>}
                <h1 className={ui.title}>{title}</h1>
                {lead && <p className={ui.lead}>{lead}</p>}
            </div>
            {actions && <div className={ui.actions}>{actions}</div>}
        </div>
    );
}

/* ------------------------------------------------------- Capa do módulo */

interface ModuleCoverProps {
    area: Area;
    icon: IconDefinition;
    title: string;
    lead?: string;
    tabs: { label: string; href: string }[];
}

/** Capa colorida do módulo com as abas do grupo. Só entra em módulo com abas. */
export function ModuleCover({ area, icon, title, lead, tabs }: ModuleCoverProps) {
    const pathname = usePathname() ?? "";
    // A aba ativa é a de caminho mais longo que casa com a URL atual.
    const active = tabs
        .filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href;

    return (
        <section className={ui.cover} style={areaStyle(area)}>
            <div className={ui.coverInner}>
                <div className={ui.coverHead}>
                    <span className={ui.glyph}>
                        <FontAwesomeIcon icon={icon} />
                    </span>
                    <div>
                        <h2 className={ui.coverTitle}>{title}</h2>
                        {lead && <p className={ui.coverLead}>{lead}</p>}
                    </div>
                </div>
                <nav className={ui.tabs} aria-label={`Seções de ${title}`}>
                    {tabs.map((tab) => (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`${ui.tab} ${active === tab.href ? ui.tabActive : ""}`}
                            aria-current={active === tab.href ? "page" : undefined}
                        >
                            {tab.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------- Selo */

export type PillKind = "ok" | "warn" | "danger" | "info" | "off";

const PILL_CLASS: Record<PillKind, string> = {
    ok: ui.pillOk,
    warn: ui.pillWarn,
    danger: ui.pillDanger,
    info: ui.pillInfo,
    off: ui.pillOff,
};

/** Selo de estado: sempre com texto (e ícone nos estados), nunca só cor. */
export function Pill({ kind, icon, children, title }: { kind: PillKind; icon?: IconDefinition; children: ReactNode; title?: string }) {
    return (
        <span className={`${ui.pill} ${PILL_CLASS[kind]}`} title={title}>
            {icon && <FontAwesomeIcon icon={icon} />}
            {children}
        </span>
    );
}

/* ------------------------------------------------------------------- Mídia */

interface MediaProps {
    /** Sem imagem, o substituto é o ícone (ou as iniciais) na cor do módulo. */
    src?: string | null;
    alt?: string;
    area: Area;
    icon?: IconDefinition;
    initials?: string;
    ratio?: "default" | "wide" | "video" | "short" | "sq";
    className?: string;
    children?: ReactNode;
}

const RATIO_CLASS = {
    default: "",
    wide: ui.mediaWide,
    video: ui.mediaVideo,
    short: ui.mediaShort,
    sq: ui.mediaSq,
};

export function Media({ src, alt, area, icon, initials, ratio = "default", className, children }: MediaProps) {
    const style: CSSProperties = { ...areaStyle(area) };
    if (src) style.backgroundImage = `url(${JSON.stringify(src)})`;
    return (
        <div
            className={`${ui.media} ${RATIO_CLASS[ratio]} ${className ?? ""}`}
            style={style}
            role={src ? "img" : undefined}
            aria-label={src ? alt : undefined}
        >
            {!src &&
                (initials ? (
                    <span className={ui.mediaInitials}>{initials}</span>
                ) : icon ? (
                    <FontAwesomeIcon icon={icon} className={ui.mediaIcon} />
                ) : null)}
            {children}
        </div>
    );
}

/** Etiqueta sobre a imagem. */
export function MediaTag({ children, side = "left", icon }: { children: ReactNode; side?: "left" | "right"; icon?: IconDefinition }) {
    return (
        <span className={`${ui.mediaTag} ${side === "right" ? ui.mediaTagRight : ""}`}>
            {icon && <FontAwesomeIcon icon={icon} />}
            {children}
        </span>
    );
}

/* ------------------------------------------------------------------- Busca */

interface SearchBarProps {
    id: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}

/**
 * Busca de lista que vem inteira (filtra na própria tela). Fica fora de
 * formulários que gravam algo: Enter aqui não envia nada.
 */
export function SearchBar({ id, value, onChange, placeholder }: SearchBarProps) {
    return (
        <label className={ui.search} htmlFor={id} role="search">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
                id={id}
                type="search"
                value={value}
                placeholder={placeholder}
                aria-label={placeholder}
                autoComplete="off"
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                }}
            />
            {value && (
                <button type="button" className={ui.searchClear} onClick={() => onChange("")} aria-label="Limpar busca">
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            )}
        </label>
    );
}

/** Compara ignorando maiúsculas e acentos ("salao" acha "Salão"). */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
    const normalize = (text: string) =>
        text
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase();
    const needle = normalize(query.trim());
    if (!needle) return true;
    return normalize(fields.filter(Boolean).join(" ")).includes(needle);
}

/* ------------------------------------------------------------------- Aviso */

export type NoteTone = "info" | "ok" | "warn" | "danger";

const NOTE_CLASS: Record<NoteTone, string> = {
    info: ui.noteInfo,
    ok: ui.noteOk,
    warn: ui.noteWarn,
    danger: ui.noteDanger,
};

export function Note({ tone, icon, children }: { tone: NoteTone; icon: IconDefinition; children: ReactNode }) {
    return (
        <div className={`${ui.note} ${NOTE_CLASS[tone]}`}>
            <FontAwesomeIcon icon={icon} />
            <div>{children}</div>
        </div>
    );
}

/** Iniciais para avatar ("Ana Ribeiro Costa" → "AC"). */
export function initialsOf(name?: string | null): string {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    const first = parts[0][0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
    return (first + last).toUpperCase();
}

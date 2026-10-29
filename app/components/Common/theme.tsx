"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleHalfStroke, faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/header.module.css";
import { THEME_STORAGE_KEY } from "./theme-script";

/**
 * Tema claro/escuro. Por padrão segue o sistema (prefers-color-scheme, nada
 * gravado). Quem fixa um tema pelo menu grava a escolha no navegador e ela vira
 * `data-theme` no <html>, que os tokens de globals.css respeitam.
 *
 * O script do layout raiz (THEME_SCRIPT, em theme-script.ts) aplica a escolha
 * antes da pintura, para a página não piscar no tema errado.
 */

export type ThemeChoice = "system" | "light" | "dark";

function readChoice(): ThemeChoice {
    try {
        const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
        return saved === "light" || saved === "dark" ? saved : "system";
    } catch {
        return "system";
    }
}

function applyChoice(choice: ThemeChoice) {
    const root = document.documentElement;
    try {
        if (choice === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
        else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
        // Navegador sem armazenamento (aba anônima, bloqueio): vale só nesta visita.
    }
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof faSun }[] = [
    { value: "system", label: "Sistema", icon: faCircleHalfStroke },
    { value: "light", label: "Claro", icon: faSun },
    { value: "dark", label: "Escuro", icon: faMoon },
];

/** Seletor de tema do menu do usuário. */
export function ThemeSwitch() {
    const [choice, setChoice] = useState<ThemeChoice>("system");

    useEffect(() => {
        setChoice(readChoice());
    }, []);

    const choose = (next: ThemeChoice) => {
        setChoice(next);
        applyChoice(next);
    };

    return (
        <div className={style.themeSwitch} role="radiogroup" aria-label="Tema">
            {OPTIONS.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={choice === option.value}
                    className={`${style.themeOption} ${choice === option.value ? style.themeOptionActive : ""}`}
                    onClick={() => choose(option.value)}
                >
                    <FontAwesomeIcon icon={option.icon} />
                    {option.label}
                </button>
            ))}
        </div>
    );
}

"use client";

import { useEffect, useRef, useState } from 'react';
import styles from '../../../styles/header.module.css';
import Link from 'next/link';
import Image from 'next/image';
import { signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faBagShopping,
    faCalendarCheck,
    faChampagneGlasses,
    faChevronDown,
    faHouse,
    faLightbulb,
    faRightFromBracket,
    faRightToBracket,
    faTableCellsLarge,
    faTicket,
    faTrophy,
    faUser,
    faVideo,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useCart } from '../../../context/CartContext';
import { ThemeSwitch } from './theme';
import { areaStyle, initialsOf } from '../UI/ui';
import { comBase } from '../../../utils/base-path';
import { moduloVisivel } from '../../../utils/modulos';

// As chaves são as mesmas do `Area` (cor de cada módulo, ui.tsx).
type ModuleKey = 'inicio' | 'social' | 'replay' | 'luz' | 'torneios' | 'ingressos' | 'perfil';

interface NavItem {
    key: ModuleKey;
    href: string;
    label: string;
    short: string;
    icon: IconDefinition;
}

/**
 * Módulos do app: no topo (desktop) todos, menos o perfil (que está no menu do
 * usuário). As quadras são a própria home.
 *
 * No celular a barra inferior ficou com três botões — Início, Menu e Perfil —
 * porque os módulos não cabiam mais lado a lado; "Menu" abre uma folha com a
 * grade dos módulos (decisão de navegação na entrada dos ingressos).
 */
const TODOS: NavItem[] = [
    { key: 'inicio', href: '/', label: 'Início', short: 'Início', icon: faHouse },
    { key: 'social', href: '/espacos-sociais', label: 'Espaços sociais', short: 'Espaços', icon: faChampagneGlasses },
    { key: 'replay', href: '/replay', label: 'Replay', short: 'Replay', icon: faVideo },
    { key: 'luz', href: '/luz', label: 'Luz da quadra', short: 'Luz', icon: faLightbulb },
    { key: 'torneios', href: '/torneios', label: 'Torneios', short: 'Torneios', icon: faTrophy },
    { key: 'ingressos', href: '/ingressos', label: 'Ingressos', short: 'Ingressos', icon: faTicket },
    { key: 'perfil', href: '/profile', label: 'Meu perfil', short: 'Perfil', icon: faUser },
];

/** Sem os módulos ainda não liberados nesta instância (utils/modulos.ts). */
const NAV = TODOS.filter((item) => moduloVisivel(item.key));

/** Os módulos da folha "Menu" do celular (Início e Perfil estão na própria barra). */
const SHEET = NAV.filter((item) => item.key !== 'inicio' && item.key !== 'perfil');

function moduleOf(pathname: string): ModuleKey | null {
    if (pathname === '/' || pathname.startsWith('/places') || pathname.startsWith('/place/') || pathname.startsWith('/checkout')) return 'inicio';
    if (pathname.startsWith('/espacos-sociais')) return 'social';
    if (pathname.startsWith('/replay') || pathname.startsWith('/meus-videos')) return 'replay';
    if (pathname.startsWith('/luz')) return 'luz';
    if (pathname.startsWith('/torneios')) return 'torneios';
    if (pathname.startsWith('/ingressos')) return 'ingressos';
    if (pathname.startsWith('/profile')) return 'perfil';
    return null;
}

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    // Folha de módulos da barra inferior (celular).
    const [sheetOpen, setSheetOpen] = useState(false);
    const { data: session } = useSession();
    const { cart } = useCart();
    const pathname = usePathname() ?? '';
    const menuRef = useRef<HTMLDivElement>(null);
    const current = moduleOf(pathname);

    useEffect(() => {
        if (!menuOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKey);
        };
    }, [menuOpen]);

    useEffect(() => {
        if (!sheetOpen) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setSheetOpen(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [sheetOpen]);

    // Fecha o menu e a folha ao trocar de página.
    useEffect(() => {
        setMenuOpen(false);
        setSheetOpen(false);
    }, [pathname]);

    const inSheet = SHEET.some((item) => item.key === current);
    const firstName = session?.user?.name?.split(' ')[0] ?? '';
    const cartCount = cart?.length ?? 0;

    return (
        <>
            <header className={styles.header}>
                <div className={styles.inner}>
                    <Link href="/" aria-label="Início" className={styles.logo}>
                        <Image
                            src={comBase("/images/logo-cfcsn-horiz.png")}
                            alt="Clube dos Funcionários CSN"
                            width={220}
                            height={88}
                            priority
                            quality={100}
                            className={styles.logoLight}
                        />
                        <Image
                            src={comBase("/images/logo-cfcsn-w-horiz.png")}
                            alt="Clube dos Funcionários CSN"
                            width={220}
                            height={88}
                            priority
                            quality={100}
                            className={styles.logoDark}
                        />
                    </Link>

                    <nav className={styles.desktopNav} aria-label="Módulos">
                        {NAV.filter((item) => item.key !== 'perfil').map((item) => (
                            <Link
                                key={item.key}
                                href={item.href}
                                className={`${styles.navLink} ${current === item.key ? styles.navLinkActive : ''}`}
                                aria-current={current === item.key ? 'page' : undefined}
                            >
                                <FontAwesomeIcon icon={item.icon} className={styles.navIcon} />
                                <span className={styles.navLong}>{item.label}</span>
                                <span className={styles.navShort}>{item.short}</span>
                            </Link>
                        ))}
                    </nav>

                    <div className={styles.actions}>
                        {/* O checkout com carrinho vazio volta para a home, então o atalho só aparece com itens. */}
                        {session?.user && cartCount > 0 && (
                            <Link href="/checkout" className={styles.iconButton} aria-label={`Carrinho: ${cartCount} ${cartCount === 1 ? 'horário' : 'horários'}`}>
                                <FontAwesomeIcon icon={faBagShopping} />
                                <span className={styles.badge}>{cartCount}</span>
                            </Link>
                        )}

                        {session?.user ? (
                            <div className={styles.userMenu} ref={menuRef}>
                                <button
                                    type="button"
                                    className={`${styles.userButton} ${current === 'perfil' ? styles.userButtonActive : ''}`}
                                    onClick={() => setMenuOpen((open) => !open)}
                                    aria-expanded={menuOpen}
                                    aria-haspopup="menu"
                                    aria-label="Menu do usuário"
                                >
                                    <span className={styles.avatar}>{initialsOf(session.user.name)}</span>
                                    <span className={styles.userName}>{firstName}</span>
                                    <FontAwesomeIcon
                                        icon={faChevronDown}
                                        className={`${styles.chevron} ${menuOpen ? styles.chevronOpen : ''}`}
                                    />
                                </button>

                                {menuOpen && (
                                    <div className={styles.menu} role="menu">
                                        <div className={styles.menuHead}>
                                            <strong>{session.user.name}</strong>
                                            {session.user.title && (
                                                <span>
                                                    Matrícula <span className={styles.mono}>{session.user.title}</span>
                                                </span>
                                            )}
                                        </div>
                                        <Link href="/profile" className={styles.menuItem} role="menuitem">
                                            <FontAwesomeIcon icon={faUser} /> Meu perfil
                                        </Link>
                                        <Link href="/profile?tab=schedules" className={styles.menuItem} role="menuitem">
                                            <FontAwesomeIcon icon={faCalendarCheck} /> Meus agendamentos
                                        </Link>
                                        <Link href="/meus-videos" className={styles.menuItem} role="menuitem">
                                            <FontAwesomeIcon icon={faVideo} /> Meus vídeos
                                        </Link>
                                        {moduloVisivel('social') && (
                                            <Link href="/espacos-sociais/reservas" className={styles.menuItem} role="menuitem">
                                                <FontAwesomeIcon icon={faChampagneGlasses} /> Minhas reservas sociais
                                            </Link>
                                        )}
                                        {moduloVisivel('torneios') && (
                                            <Link href="/torneios/inscricoes" className={styles.menuItem} role="menuitem">
                                                <FontAwesomeIcon icon={faTrophy} /> Minhas inscrições em torneios
                                            </Link>
                                        )}
                                        {moduloVisivel('ingressos') && (
                                            <Link href="/ingressos/meus" className={styles.menuItem} role="menuitem">
                                                <FontAwesomeIcon icon={faTicket} /> Meus ingressos
                                            </Link>
                                        )}
                                        <div className={styles.menuSection}>
                                            <span className={styles.menuLabel}>Tema</span>
                                            <ThemeSwitch />
                                        </div>
                                        <button
                                            type="button"
                                            className={`${styles.menuItem} ${styles.menuDanger}`}
                                            role="menuitem"
                                            onClick={() => signOut({ callbackUrl: comBase('/login') })}
                                        >
                                            <FontAwesomeIcon icon={faRightFromBracket} /> Sair
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Link href="/login" className={styles.loginButton}>
                                <FontAwesomeIcon icon={faRightToBracket} /> Entrar
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            {/* Barra inferior (só no celular): Início, Menu (folha com os módulos) e Perfil.
                `data-bottom-nav` reserva o espaço dela no body. */}
            {sheetOpen && <div className={styles.sheetVeil} onClick={() => setSheetOpen(false)} aria-hidden="true" />}
            {sheetOpen && (
                <div id="menu-modulos" className={styles.sheet} role="dialog" aria-modal="true" aria-label="Módulos">
                    <div className={styles.sheetHead}>
                        <span className={styles.sheetTitle}>Módulos</span>
                        <button type="button" className={styles.sheetClose} onClick={() => setSheetOpen(false)} aria-label="Fechar">
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>
                    <nav className={styles.sheetGrid} aria-label="Módulos">
                        {SHEET.map((item) => (
                            <Link
                                key={item.key}
                                href={item.href}
                                className={`${styles.sheetItem} ${current === item.key ? styles.sheetItemActive : ''}`}
                                aria-current={current === item.key ? 'page' : undefined}
                                style={areaStyle(item.key)}
                            >
                                <span className={styles.sheetIcon}>
                                    <FontAwesomeIcon icon={item.icon} />
                                </span>
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            )}
            <nav className={styles.bottomNav} aria-label="Navegação" data-bottom-nav>
                <Link
                    href="/"
                    className={`${styles.bottomItem} ${current === 'inicio' && !sheetOpen ? styles.bottomItemActive : ''}`}
                    aria-current={current === 'inicio' ? 'page' : undefined}
                >
                    <span className={styles.bottomIcon}>
                        <FontAwesomeIcon icon={faHouse} />
                    </span>
                    Início
                </Link>
                <button
                    type="button"
                    className={`${styles.bottomItem} ${sheetOpen || inSheet ? styles.bottomItemActive : ''}`}
                    onClick={() => setSheetOpen((open) => !open)}
                    aria-expanded={sheetOpen}
                    aria-controls="menu-modulos"
                >
                    <span className={styles.bottomIcon}>
                        <FontAwesomeIcon icon={sheetOpen ? faXmark : faTableCellsLarge} />
                    </span>
                    Menu
                </button>
                {session?.user ? (
                    <Link
                        href="/profile"
                        className={`${styles.bottomItem} ${current === 'perfil' && !sheetOpen ? styles.bottomItemActive : ''}`}
                        aria-current={current === 'perfil' ? 'page' : undefined}
                    >
                        <span className={styles.bottomIcon}>
                            <FontAwesomeIcon icon={faUser} />
                        </span>
                        Perfil
                    </Link>
                ) : (
                    <Link href="/login" className={styles.bottomItem}>
                        <span className={styles.bottomIcon}>
                            <FontAwesomeIcon icon={faRightToBracket} />
                        </span>
                        Entrar
                    </Link>
                )}
            </nav>
        </>
    );
}

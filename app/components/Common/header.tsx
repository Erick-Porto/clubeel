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
    faUser,
    faVideo,
} from '@fortawesome/free-solid-svg-icons';
import { useCart } from '../../../context/CartContext';
import { ThemeSwitch } from './theme';
import { initialsOf } from '../UI/ui';

type ModuleKey = 'inicio' | 'social' | 'replay' | 'luz' | 'perfil';

interface NavItem {
    key: ModuleKey;
    href: string;
    label: string;
    short: string;
    icon: IconDefinition;
}

/**
 * Módulos do app (decisão de navegação do rebrand v4): os mesmos no topo
 * (desktop) e na barra inferior (celular). As quadras são a própria home.
 */
const NAV: NavItem[] = [
    { key: 'inicio', href: '/', label: 'Início', short: 'Início', icon: faHouse },
    { key: 'social', href: '/espacos-sociais', label: 'Espaços sociais', short: 'Espaços', icon: faChampagneGlasses },
    { key: 'replay', href: '/replay', label: 'Replay', short: 'Replay', icon: faVideo },
    { key: 'luz', href: '/luz', label: 'Luz da quadra', short: 'Luz', icon: faLightbulb },
    { key: 'perfil', href: '/profile', label: 'Meu perfil', short: 'Perfil', icon: faUser },
];

function moduleOf(pathname: string): ModuleKey | null {
    if (pathname === '/' || pathname.startsWith('/places') || pathname.startsWith('/place/') || pathname.startsWith('/checkout')) return 'inicio';
    if (pathname.startsWith('/espacos-sociais')) return 'social';
    if (pathname.startsWith('/replay') || pathname.startsWith('/meus-videos')) return 'replay';
    if (pathname.startsWith('/luz')) return 'luz';
    if (pathname.startsWith('/profile')) return 'perfil';
    return null;
}

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
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

    // Fecha o menu ao trocar de página.
    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    const firstName = session?.user?.name?.split(' ')[0] ?? '';
    const cartCount = cart?.length ?? 0;

    return (
        <>
            <header className={styles.header}>
                <div className={styles.inner}>
                    <Link href="/" aria-label="Início" className={styles.logo}>
                        <Image
                            src="/images/logo-cfcsn-horiz.png"
                            alt="Clube dos Funcionários CSN"
                            width={220}
                            height={88}
                            priority
                            quality={100}
                            className={styles.logoLight}
                        />
                        <Image
                            src="/images/logo-cfcsn-w-horiz.png"
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
                                <FontAwesomeIcon icon={item.icon} />
                                {item.label}
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
                                        <Link href="/espacos-sociais/reservas" className={styles.menuItem} role="menuitem">
                                            <FontAwesomeIcon icon={faChampagneGlasses} /> Minhas reservas sociais
                                        </Link>
                                        <div className={styles.menuSection}>
                                            <span className={styles.menuLabel}>Tema</span>
                                            <ThemeSwitch />
                                        </div>
                                        <button
                                            type="button"
                                            className={`${styles.menuItem} ${styles.menuDanger}`}
                                            role="menuitem"
                                            onClick={() => signOut({ callbackUrl: '/login' })}
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

            {/* Barra inferior de módulos (só no celular). `data-bottom-nav` reserva o espaço dela no body. */}
            <nav className={styles.bottomNav} aria-label="Módulos" data-bottom-nav>
                {NAV.map((item) => (
                    <Link
                        key={item.key}
                        href={item.href}
                        className={`${styles.bottomItem} ${current === item.key ? styles.bottomItemActive : ''}`}
                        aria-current={current === item.key ? 'page' : undefined}
                    >
                        <span className={styles.bottomIcon}>
                            <FontAwesomeIcon icon={item.icon} />
                        </span>
                        {item.short}
                    </Link>
                ))}
            </nav>
        </>
    );
}

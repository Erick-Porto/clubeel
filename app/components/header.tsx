"use client";

import { useState, useRef, useEffect } from 'react';
import styles from '@/styles/header.module.css';
import Link from 'next/link';
import Image from 'next/image';
import { signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faUserCircle } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../hooks/useIsMobile';

export interface HeaderOption {
    text: string;
    id?: string;   
    page?: string; 
    to?: number;
}

interface ProfileOption {
    text: string;
    onClick: () => void;
    active: boolean;
}

interface HeaderProps {
    surgeIn: number;
    options: Array<HeaderOption> | null;
    onlyScroll: boolean;
    profileOptions?: Array<ProfileOption> | null;
    activeSection?: string; 
    onNavigate?: (id: string) => void;
}

export default function Header({ 
    options, 
    surgeIn, 
    onlyScroll, 
    profileOptions, 
    activeSection, 
    onNavigate 
}: HeaderProps) {
    
    const [scrollY, setScrollY] = useState(0);
    const [userOptions, setUserOptions] = useState(false);
    const { data: session } = useSession();
    const pathname = usePathname();
    const isMobile = useIsMobile();
    const profileMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            window.requestAnimationFrame(() => setScrollY(window.scrollY));
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setUserOptions(false);
            }
        };
        if (userOptions) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [userOptions]);

    const isHeaderActive = scrollY >= surgeIn - 5 || userOptions;

    return (
        <header className={`${styles.header} ${isHeaderActive ? styles.headerActive : ''}`}>
             <Link referrerPolicy='no-referrer' rel='noopener noreferrer' href={'/'} aria-label="Ir para Home" style={{zIndex: 10001}}>
                <div className={styles.headerLogo}>
                    <Image 
                        src="/images/logo-cfcsn-horiz.png" 
                        alt="Logo CFCSN" 
                        fill
                        style={{ objectFit: 'contain', objectPosition: 'left' }}
                        priority
                    />
                </div>
            </Link>

            {!isMobile && (
                <nav className={styles.desktopNav}>
                    <ul className={styles.navigateOptions}>
                        
                        {/* CORREÇÃO AQUI: '&& profileOptions' garante que não seja undefined */}
                        {options === null && profileOptions && (
                            profileOptions.map((opt, index) => (
                                <li key={index} className={opt.active ? styles.activePage : ''}>
                                    <button 
                                        className={styles.navButton}
                                        onClick={() => { opt.onClick(); setUserOptions(false); }}
                                        type="button"
                                    >
                                        {opt.text}
                                    </button>
                                </li>
                            ))
                        )}

                        {/* Menu Principal */}
                        {options && options.length > 0 && (
                            onlyScroll ? (
                                options.map((item, index) => {
                                    const isActive = activeSection === item.id;
                                    return (
                                        <li key={index} className={isActive ? styles.activePage : ""}>
                                            <button 
                                                className={styles.navButton}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (onNavigate && item.id) {
                                                        onNavigate(item.id);
                                                    } 
                                                }}
                                                type="button"
                                            >
                                                {item.text}
                                            </button>
                                        </li>
                                    );
                                })
                            ) : (
                                options.map((item, index) => (
                                    <li key={index}>
                                         <Link referrerPolicy='no-referrer' rel='noopener noreferrer' href={`/${item.page}`} className={styles.navLink}>
                                            {item.text}
                                        </Link>
                                    </li>
                                ))
                            )
                        )}
                    </ul>
                </nav>
            )}

            <div className={styles.profileOptions} ref={profileMenuRef}>
                {session?.user ? (
                    <button 
                        className={styles.profileButton} 
                        onClick={() => setUserOptions(!userOptions)}
                    >
                        {isMobile &&(<span>{session.user.name?.split(' ')[0].toLowerCase()}</span>)}
                        <FontAwesomeIcon icon={faUserCircle} style={{ fontSize: 22, color: '#555' }} />
                        
                        {!isMobile && (
                            <>
                                <span>{session.user.name?.split(' ')[0].toLowerCase()}</span>
                                <FontAwesomeIcon
                                    className={userOptions ? styles.optionsChevronActive : ''}
                                    icon={faChevronDown}
                                    style={{ fontSize: 12 }}
                                />
                            </>
                        )}
                    </button>
                ) : (
                     <Link referrerPolicy='no-referrer' rel='noopener noreferrer' href="/login" className={styles.profileButton}>
                        <span>Acessar</span>
                    </Link>
                )}

                <ul className={`${styles.userOptions} ${userOptions ? styles.userOptionsActive : ''}`}>
                    {pathname !== '/profile' && (
                        <li> <Link referrerPolicy='no-referrer' rel='noopener noreferrer' href={'/profile'} style={{ width: '100%' }}>Meu Perfil</Link></li>
                    )}
                    {pathname !== '/' && (
                        <li> <Link referrerPolicy='no-referrer' rel='noopener noreferrer' href={'/'} style={{ width: '100%' }}>Início</Link></li>
                    )}
                    <hr />
                    <li onClick={() => signOut({ callbackUrl: '/login' })} style={{ color: '#d32f2f' }}>
                        Sair
                    </li>
                </ul>
            </div>
        </header>
    );
}
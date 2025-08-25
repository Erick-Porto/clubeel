"use client";

import { useEffect, useState } from 'react';
import styles from '@/styles/header.module.css';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

interface Option {
    text: string;
    to: number;
    page: string;
}

interface HeaderProps {
    surgeIn: number;
    options: Array<Option>|null;
    onlyScroll: boolean;
}

export default function Header({ options, surgeIn, onlyScroll }: HeaderProps) {
    const [scrollY, setScrollY] = useState(0);
    const [UserOptions, setUserOptions] = useState(false);
    const { User } = useUser();
    const router = useRouter();

    const logout = () => {
        localStorage.clear(); // Clear all localStorage data
        router.push('/login');
    };

    useEffect(() => {
        const handleScroll = () => {
            setScrollY(window.scrollY);
        };

        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const isActive = (itemTo: number, index: number) => {
        const nextItemTo = options ? options[index + 1]?.to || Infinity : Infinity;
        return scrollY + 100 >= itemTo && scrollY + 100 < nextItemTo;
    };

    return (
        <header className={`${styles.header} ${scrollY >= surgeIn - 5 ? styles.headerActive : ''}`}>
            <Link href={'/'}>
                <div className={styles.headerLogo}></div>
                {/* <Image src={Logo} alt="Logo do Clube dos Funcionários" width={150} height={50} /> */}
            </Link>
            {options === null ? null : (
            <nav>
                <ul className={styles.navigateOptions}>
                    {onlyScroll ? (
                        options.map((item, index) => (
                            <li key={index} className={isActive(item.to, index) ? styles.activePage : ""}>
                                <span
                                    onClick={() => window.scrollTo({ top: item.to, behavior: 'smooth' })}
                                >
                                    {item.text}
                                </span>
                            </li>
                        ))
                    ) : options.map((item, index) => (
                        <li key={index}>
                            <Link href={`/${item.page}`}>
                                {item.text}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
            )}
            <div className={styles.profileOptions}>
                {
                    User ?
                        <p onClick={() => setUserOptions(!UserOptions)}>
                            Olá, <span>{User.name.split(' ')[0].toLowerCase()} </span>
                            <FontAwesomeIcon
                                className={`${UserOptions ? styles.optionsChevronActive : ''}`}
                                style={{fontSize: 12}}
                                icon={faChevronDown}
                            />
                        </p>
                        : <p>Please log in</p>
                }

                <ul className={
                    `${styles.userOptions} 
                    ${UserOptions ? styles.userOptionsActive : ''}`
                }>
                    <li>
                        <Link href={'/profile'}>
                            <span>meu perfil</span>
                        </Link>
                    </li>
                    <li>
                        <Link href={'/cart'}>
                            <span>meus agendamentos</span>
                        </Link>
                    </li>
                    <li
                        onClick={ ()=>logout() }
                    >
                        <span>
                            sair
                        </span>
                    </li>
                </ul>
            </div>
        </header>
    );
}
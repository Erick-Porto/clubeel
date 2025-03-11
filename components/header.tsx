"use client";

import { useEffect, useState } from 'react';
import styles from '@/styles/header.module.css';
import Logo from '@/images/logo-grena.png';
import Image from 'next/image';
import Link from 'next/link';


interface Option {
    text: string;
    to: number;
    page: string;
}

interface HeaderProps {
    surgeIn: number;
    options: Array<Option>;
}

export default function Header({ options, surgeIn }: HeaderProps) {
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            setScrollY(window.scrollY);
        };

        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    

    return (
        <header className={`${styles.header} ${scrollY >= surgeIn-5 ? styles.headerActive : ''}`}>
            <Image src={Logo} alt="Logo do Clube dos Funcionários" width={150} height={50} />
            <nav>
                <ul>
                {options.map((item, index) => (
                    <li key={index}>
                        <Link href={`${item.page}/?ref=${item.to}`}>
                            {item.text}
                        </Link>
                    </li>
                ))}
                </ul>
            </nav>
        </header>
    );
}
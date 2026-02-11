"use client"

import { useState, useEffect } from 'react'; // 1. Importar hooks
import styles from '@/styles/horizontal-nav-bar.module.css'

interface Option {
    text: string;
    to: number;
    page: string;
}

interface HNBProps{
    options: Array<Option>;
}

export default function HorizontalNavBar({options}:HNBProps){
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
    const isActive = (itemTo: number, index: number) => {
        const nextItemTo = options[index + 1]?.to || Infinity;
        return scrollY + 100 >= itemTo && scrollY + 100 < nextItemTo;
    };

    if (!Array.isArray(options)) {
        return null;
    }

    return(
        <nav className={styles.horizontalNavigation}>
            <ul className={styles.horizontalItemList}>
                {options.map((item, index) => (
                    <li key={index} className={`${styles.horizontalItem} ${isActive(item.to, index) ? styles.active : ''}`}>
                        <button
                            onClick={() => window.scrollTo({ top: item.to, behavior: 'smooth' })}
                        >
                            {item.text}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    )}
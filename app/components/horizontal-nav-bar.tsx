"use client"

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
    return(
        <nav className={styles.horizontalNavigation}>
            <ul className={styles.horizontalItemList}>
                {options.map((item, index) => (
                    <li key={index} className={styles.horizontalItem}>
                        <span
                            onClick={() => window.scrollTo({ top: item.to, behavior: 'smooth' })}
                        >
                            {item.text}
                        </span>
                    </li>
                ))}
            </ul>
        </nav>
    )}
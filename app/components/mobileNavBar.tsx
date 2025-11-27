import React from 'react';
import styles from '@/styles/mobile-nav-bar.module.css';

export interface MobileNavOptions {
    onNavigate: (sectionName: 'sociais' | 'mapa' | 'esportivas') => void;
    activeSection: 'sociais' | 'mapa' | 'esportivas';
}

const MobileNavBar: React.FC<MobileNavOptions> = ({ onNavigate, activeSection }) => {

    const getClassName = (sectionName: 'sociais' | 'mapa' | 'esportivas') => {
        return `${styles.mobileNavItem} ${activeSection === sectionName ? styles.active : ''}`;
    };

    return (
        <nav className={styles.mobileNavBar}>
            {/* 1. Áreas Sociais */}
            <button className={getClassName("sociais")} onClick={() => onNavigate('sociais')} aria-label="Social">
                <div className={styles.mobileNavIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                </div>
                <span className={styles.mobileNavLabel}>Social</span>
            </button>

            {/* 2. Mapa (Centro) */}
            <button className={getClassName("mapa")} onClick={() => onNavigate('mapa')} aria-label="Mapa">
                <div className={styles.mobileNavIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                </div>
                <span className={styles.mobileNavLabel}>Mapa</span>
            </button>

            {/* 3. Áreas Esportivas */}
            <button className={getClassName("esportivas")} onClick={() => onNavigate('esportivas')} aria-label="Esportes">
                <div className={styles.mobileNavIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                         <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                </div>
                <span className={styles.mobileNavLabel}>Esportes</span>
            </button>
        </nav>
    );
};

export default MobileNavBar;
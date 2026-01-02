'use client';

import { useState, useEffect } from 'react';

// CORREÇÃO: Aumentado para 1024px para incluir Tablets
const MOBILE_BREAKPOINT = 1024;

export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);

        return () => {
            window.removeEventListener('resize', checkScreenSize);
        };
    }, []);

    return isMobile;
};
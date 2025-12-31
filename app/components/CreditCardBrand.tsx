import React from 'react';

export const CreditCardBrand = ({ brand }: { brand: string }) => {
    // Normaliza para garantir que bata com o switch
    const normalizedBrand = brand.toUpperCase();

    switch (normalizedBrand) {
        case 'VISA':
            return (
                <svg viewBox="0 0 100 32" style={{ width: '100%', height: '100%' }}>
                    <g fill="none" fillRule="evenodd">
                        <path d="M38.86 19.34l3.52-20.94h10.98c0 0-4.04 22.37-4.22 23.36-.18.99-1.25 1.5-2.26 1.5H36.33c-.76 0-1.42-.48-1.68-1.18L28.82 2.59 23.77 19.34h15.09z" fill="#fff" opacity="0.9"/>
                        <path d="M68.52 11.2c.49-.07 3.32-.4 6.2-.4 3.19 0 5.46.28 7.37.95 1.63.57 3.01 1.48 4.09 2.7.97 1.1 1.62 2.47 1.93 4.07.72 3.65-1.19 8.04-4.8 11.33-2.6 2.37-6.23 3.42-10.79 3.42-3.13 0-5.83-.24-8.03-.7l1.1-5.32c2.04.5 9.07 2.07 10.99 1.05.8-.42 1.4-1.34 1.71-2.61.16-.62.22-1.21.19-1.74-.29.17-1.18.61-3.69.61-4.04 0-7.39-2.02-8.35-6.02-.91-3.8 1.12-6.73 2.08-7.34zM10.92 1.68L6.46 22.82H0L.05 22.5c.98-3.08 6.9-17.58 6.9-17.58.74-2.52 1.25-3.24 3.97-3.24z" fill="#fff" opacity="0.9"/>
                    </g>
                    {/* SVG simplificado em branco/transparente para contrastar bem em qualquer fundo */}
                    <text x="0" y="32" fontSize="32" fontWeight="bold" fill="white" style={{display: normalizedBrand === 'VISA' ? 'none' : 'block'}}>VISA</text>
                    <path fill="#fff" d="M23.746 12.066L15.652 31.424H8.435L13.687 5.602C14.075 4.12 15.345 3.178 16.85 3.178h9.854l-2.958 8.888zM41.68 31.424h6.765l4.228-25.822h-6.764L41.68 31.424zM96.793 12.353c-0.658-2.316-2.695-3.95-6.502-3.95c-5.748 0-9.825 2.898-9.855 7.02c-0.03 3.033 2.87 4.717 5.06 5.727c2.253 1.042 3.007 1.71 2.997 2.65c-0.02 1.433-1.83 2.084-3.524 2.084c-2.96 0-4.542-0.428-6.945-1.428l-0.975-4.322H70.07l1.096 10.27c2.56 1.127 7.275 2.06 12.155 2.086c11.455 0 18.892-5.32 18.95-13.565c0.03-4.52-2.85-7.94-9.08-10.745l-3.14-1.528c-0.088-0.035-0.165-0.07-0.252-0.103l-0.03-0.013c0 0 0.007 0.004 0.006 0.004c-1.28-0.613-2.072-1.025-2.062-1.954c0.01-0.672 0.778-1.36 2.47-1.36c2.074 0 3.733 0.353 5.733 1.206L96.793 12.353zM67.842 5.602l-2.583 13.52l-2.825-12.75c-0.48-1.565-1.782-2.91-3.666-3.615l-12.55-4.58l0.42 1.838c2.81 0.69 5.372 2.38 6.273 5.01l5.483 26.4h7.112l10.86-25.822H67.842z"/>
                </svg>
            );

        case 'MASTERCARD':
            return (
                <svg viewBox="0 0 100 60" style={{ width: '100%', height: '100%' }}>
                    <circle cx="34" cy="30" r="30" fill="#EB001B"/>
                    <circle cx="66" cy="30" r="30" fill="#F79E1B"/>
                    <path style={{transform: 'translateY(-9px)'}} d="M50 11.5a29.8 29.8 0 0 0-16 26.5 29.8 29.8 0 0 0 16 26.5 29.8 29.8 0 0 0 16-26.5A29.8 29.8 0 0 0 50 11.5z" fill="#FF5F00"/>
                </svg>
            );

        case 'ELO':
            return (
                <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                   <circle cx="50" cy="50" r="48" fill="white" />
                   <circle cx="50" cy="50" r="40" fill="black" />
                   <path d="M75 35h-15v-5h15v-5h-20v25h20v-5h-15v-5h15z" fill="white"/> {/* Simplificação visual */}
                   <path d="M30 65 L40 35 L50 65" stroke="red" strokeWidth="8" fill="none" />
                   <path d="M55 65 L65 35 L75 65" stroke="yellow" strokeWidth="8" fill="none" />
                   <path d="M25 65 L35 35 L45 65" stroke="blue" strokeWidth="8" fill="none" />
                   {/* Logo Elo Real é complexo, usando um path simplificado para exemplo */}
                   <g transform="translate(15, 25) scale(0.7)">
                     <circle cx="35" cy="35" r="30" fill="none" stroke="#ffcb05" strokeWidth="8"/>
                     <circle cx="65" cy="35" r="30" fill="none" stroke="#e81d2d" strokeWidth="8"/>
                     <circle cx="50" cy="65" r="30" fill="none" stroke="#00a4e0" strokeWidth="8"/>
                   </g>
                   <text x="50" y="55" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold">elo</text>
                </svg>
            );

        case 'AMEX':
            return (
                <svg viewBox="0 0 100 60" style={{ width: '100%', height: '100%' }}>
                     <rect width="100" height="60" rx="8" fill="#2E77BC" />
                     <path d="M20 40 L30 15 L40 40" stroke="white" strokeWidth="5" fill="none"/>
                     <text x="50" y="45" textAnchor="middle" fill="white" fontSize="30" fontWeight="bold" fontStyle="italic">AMEX</text>
                </svg>
            );

        default:
            return null; // Retorna nada se não identificar
    }
};
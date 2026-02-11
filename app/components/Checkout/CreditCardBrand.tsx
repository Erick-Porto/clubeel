import React from 'react';

export const CreditCardBrand = ({ brand }: { brand: string }) => {
    const normalizedBrand = brand.toUpperCase();

    switch (normalizedBrand) {
        case 'VISA':
            return (
                <svg 
      viewBox="0 0 100 32" 
      style={{ width: '100%', height: '100%' }} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        fill="#1A1F71" 
        d="M38.16 31.424h6.765l4.228-25.822H42.39L38.16 31.424zM93.273 12.353c-.658-2.316-2.695-3.95-6.502-3.95-5.748 0-9.825 2.898-9.855 7.02-.03 3.033 2.87 4.717 5.06 5.727 2.253 1.042 3.007 1.71 2.997 2.65-.02 1.433-1.83 2.084-3.524 2.084-2.96 0-4.542-.428-6.945-1.428l-.975-4.322H66.55l1.096 10.27c2.56 1.127 7.275 2.06 12.155 2.086 11.455 0 18.892-5.32 18.95-13.565.03-4.52-2.85-7.94-9.08-10.745l-3.14-1.528c-.088-.035-.165-.07-.252-.103l-.03-.013c-1.28-.613-2.072-1.025-2.062-1.954.01-.672.778-1.36 2.47-1.36 2.074 0 3.733.353 5.733 1.206l.911 4.28h6.872l-.001-4.28zM64.322 5.602l-2.583 13.52-2.825-12.75c-.48-1.565-1.782-2.91-3.666-3.615L42.7 1.487l.42 1.838c2.81.69 5.372 2.38 6.273 5.01l5.483 26.4h7.112l10.86-25.822H64.322zM20.226 12.066L12.132 31.424H4.915L10.167 5.602C10.555 4.12 11.825 3.178 13.33 3.178h9.854l-2.958 8.888z"
      />
      <path fill="#F7B600" d="M13.33 3.178L10.167 5.602l5.485 6.464h4.574l2.958-8.888z" />
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
                   <path d="M75 35h-15v-5h15v-5h-20v25h20v-5h-15v-5h15z" fill="white"/>
                   <path d="M30 65 L40 35 L50 65" stroke="red" strokeWidth="8" fill="none" />
                   <path d="M55 65 L65 35 L75 65" stroke="yellow" strokeWidth="8" fill="none" />
                   <path d="M25 65 L35 35 L45 65" stroke="blue" strokeWidth="8" fill="none" />
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
            return null;
    }
};
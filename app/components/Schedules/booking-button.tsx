import { ReactNode } from 'react';
import style from '../../../styles/booking-button.module.css';
import { toast } from 'react-toastify';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface BookingButtonProps {
    text: ReactNode;
    onClick?: () => void;
    itemsToValidate?: unknown[];
    redirectPath?: string;
    disabled?: boolean;
    icon?: IconDefinition;
    /** `primary` (grená) para a ação principal; `secondary` (contorno) para as demais. */
    variant?: 'primary' | 'secondary';
}

const BookingButton = ({ text, onClick, itemsToValidate, redirectPath, disabled = false, icon, variant = 'primary' }: BookingButtonProps) => {
    const className = `${style.bookingButton} ${variant === 'secondary' ? style.secondary : ''}`;
    const content = (
        <>
            {icon && <FontAwesomeIcon icon={icon} />}
            {text}
        </>
    );

    if (redirectPath) {
        if (disabled) {
            return (
                <button className={className} disabled type="button">
                    {content}
                </button>
            );
        }

        return (
             <Link referrerPolicy='no-referrer' rel='noopener noreferrer' href={redirectPath} className={className}>
                {content}
            </Link>
        );
    }

    const handleActionClick = (e: React.MouseEvent) => {
        e.preventDefault();

        if (disabled) return;

        if (itemsToValidate && itemsToValidate.length === 0) {
             toast.info('Selecione pelo menos um horário.');
             return;
        }

        if (onClick) onClick();
    }

    return (
        <button
            className={className}
            onClick={handleActionClick}
            disabled={disabled}
            type="button"
        >
            {content}
        </button>
    );
}

export default BookingButton;

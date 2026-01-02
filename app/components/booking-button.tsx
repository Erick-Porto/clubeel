import { ReactNode } from 'react';
import style from '@/styles/booking-button.module.css';
import { toast } from 'react-toastify';
import Link from 'next/link';

interface BookingButtonProps {
    text: ReactNode;
    onClick?: () => void;
    itemsToValidate?: unknown[];
    redirectPath?: string;
    disabled?: boolean;
}

const BookingButton = ({ text, onClick, itemsToValidate, redirectPath, disabled = false }: BookingButtonProps) => {
    
    if (redirectPath) {
        if (disabled) {
            return (
                <button className={style.bookingButton} disabled type="button">
                    {text}
                </button>
            );
        }

        return (
             <Link referrerPolicy='no-referrer' rel='noopener noreferrer' href={redirectPath} className={style.bookingButton}>
                {text}
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
            className={style.bookingButton} 
            onClick={handleActionClick}
            disabled={disabled}
            type="button"
        >
            {text}
        </button>
    );
}

export default BookingButton;
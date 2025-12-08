import { ReactNode } from 'react';
import style from '@/styles/booking-button.module.css';
import { toast } from 'react-toastify';
import Link from 'next/link'; // Importante

interface BookingButtonProps {
    text: ReactNode;
    onClick?: () => void; // Agora opcional
    itemsToValidate?: unknown[]; // Agora opcional
    redirectPath?: string;
    disabled?: boolean;
}

const BookingButton = ({ text, onClick, itemsToValidate, redirectPath, disabled = false }: BookingButtonProps) => {
    
    // Se tiver redirectPath, renderiza como LINK (mais seguro e rápido)
    if (redirectPath) {
        // Se estiver desabilitado, renderizamos um botão fake desabilitado ou link sem href
        if (disabled) {
            return (
                <button className={style.bookingButton} disabled type="button">
                    {text}
                </button>
            );
        }

        return (
            <Link href={redirectPath} className={style.bookingButton}>
                {text}
            </Link>
        );
    }

    // Caso contrário, renderiza como BOTÃO de ação
    const handleActionClick = (e: React.MouseEvent) => {
        e.preventDefault();
        
        if (disabled) return;

        // Validação de segurança para ações (ex: Adicionar)
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
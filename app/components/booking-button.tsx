import { ReactNode } from 'react';
import style from '@/styles/booking-button.module.css';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';

interface RedirectProps {
    redirect: boolean;
    pathname: string;
}

interface CartItem {
    hour: number;
    place: number;
}

const BookingButton = ({ redirect, text, toCart, onClick }: { redirect: RedirectProps, text: ReactNode, toCart: CartItem[], onClick: () => void }) => {
    const router = useRouter();

    function handlerCartConcat() {
        if (redirect.redirect) {
            router.push(`/${redirect.pathname}`); // Redireciona para a página de checkout
            return;
        }

        if (toCart.length === 0) {
            toast.error('Selecione um horário');
        } else {
            onClick(); // Chama a função passada para adicionar os horários ao contexto
        }
    }

    return (
        <button className={style.bookingButton} onClick={() => handlerCartConcat()}>
            {redirect.redirect ? "Finalizar reserva" : text} {/* Altera o texto dinamicamente */}
        </button>
    );
}

export default BookingButton;
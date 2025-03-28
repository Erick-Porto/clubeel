import { ReactNode } from 'react';
import style from '@/styles/booking-button.module.css';
import { toast, ToastContainer } from 'react-toastify';
import { useRouter } from 'next/navigation';
interface CartItem {
    hour: number;
    place: number;
}

const BookingButton = ({ text, toCart }: { text: ReactNode, toCart: CartItem }) => {
    const router = useRouter();

    function handlerCartConcat(){
        const toCartItems: CartItem[] = toCart
        if(toCartItems.length===0){
            toast.error('Selecione um horário');
        } else {
            const cart = localStorage.getItem('___cfcsn-cart');
            if(cart){
                const cartItems: CartItem[] = JSON.parse(cart);
    
                if(cartItems.length === 2){
                    toast.error('Você já possui 2 agendamentos não confirmados, por favor. Verifique e tente novamente');
                    return;
                }else {
                    let temp = JSON.stringify(cartItems).split(']')[0];
                    temp = temp +','+ JSON.stringify(toCart).split('[')[1];
                    localStorage.setItem('___cfcsn-cart', temp);
                    toast.success('Sucesso! Seu horário foi adicionado a tela Meus Agendamentos.');
                    setTimeout(()=>location.reload(), 1000);
                }
            } else {
                localStorage.setItem('___cfcsn-cart', JSON.stringify(toCart));
                toast.success('Sucesso! Seus horários foram adicionados a tela Meus Agendamentos.');
                setTimeout(()=>location.reload(), 1000);
            }
        }

    }


    return (<button className={style.bookingButton} onClick={()=>handlerCartConcat()}>{text}</button>)
}

export default BookingButton;
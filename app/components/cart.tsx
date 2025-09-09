"use client"

import { useEffect } from 'react';
import style from '@/styles/cart.module.css'
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarXmark, faCartShopping } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import Link from 'next/link';
import API_CONSUME from '@/services/api-consume';
import { useUser } from '@/context/UserContext';

const Cart = () => {
    const { cart, setCart, accessToken } = useUser();

    // utilitários para interpretar/formatar hour
    const hhmmssToSeconds = (hms: string) => {
        const parts = String(hms).split(':').map(p => parseInt(p, 10) || 0);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
        return parts[0] * 3600;
    };
    const secondsToHHMM = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    };

    function deleteItems() {
        try {
            setCart([]);
        } catch (e) {
            console.warn('Failed to clear cart', e);
        }
        toast.success('O carrinho foi limpo com sucesso!');
    }

    function removeItem(item: any) {
        setCart(prevCart => {
            const base = Array.isArray(prevCart) ? prevCart : [];
            const updatedCart = base.filter(i => !(i.start_schedule === item.start_schedule && Number(i.place_id) === Number(item.place_id)));
            return updatedCart;
        });
        toast.success('O item foi removido do carrinho com sucesso!');
    }

    return (
        <div className={style.cartContainer}>
            <h1 className={style.cartContainerTitle}>
                <FontAwesomeIcon icon={faCartShopping} />
                Agendamentos a pagar
            </h1>
            {Array.isArray(cart) && cart.length !== 0 ? (
            <>
                <div className={style.cartListContainer}>
                    {cart.map((item: any, index: number) => {
                        const startSec = hhmmssToSeconds(String(item.start_schedule).split(' ')[1] || '00:00');
                        const endSec =  hhmmssToSeconds(String(item.end_schedule).split(' ')[1] || '00:00');
                        const hourDisplay = `${secondsToHHMM(startSec)} - ${secondsToHHMM(endSec)}`
                        

                        return(
                            <div className={style.cartItem} key={index}>
                                <div>
                                    <Image alt={'a'} width={150} height={125} src={item.place_image || '/default-image.jpg'}/>
                                </div>
                                <div>
                                    <h3 className={style.cartTitle}> {item.place_name}</h3>
                                    <p>
                                        Horário: {hourDisplay}<br/>
                                        <Link className={style.cartLink} href={`/place/` + (item.place_name ? item.place_name.split(' ').join('-').toLowerCase() : '')}>
                                            Ver agendamento
                                        </Link>
                                    </p>
                                </div>
                                <div>
                                    <button
                                        className={style.cartRemoveButton}
                                        onClick={() => removeItem(item)}
                                    >
                                        <FontAwesomeIcon icon={faCalendarXmark} />
                                    </button>
                                </div>
                            </div>
                        )})}
                </div>
                <div className={style.cartOptions}>
                    <Link href={'/checkout'}><button className={style.cartButton}>Finalizar compra</button></Link>
                    <button className={style.cartButton} onClick={deleteItems}>Limpar carrinho</button>
                </div>
            </>
            ) : 
            (<div className={style.cartEmpty}>
                <h1>Você não possuí agendamentos em aberto.
                    <br/>
                    <Link href={"/"} className={style.cartLink}>Agende já!</Link>
                </h1>
            </div>)}
        </div>
    )
}
export default Cart;
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

    useEffect(() => {
        if (cart.length > 0) {
            const fetchPlaceDetails = async () => {
                const updatedCart = [];
                for (const item of cart) {
                    const response = await API_CONSUME('get', `place/${item.place}`, {
                        'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                        'Session': accessToken
                    }, null);

                    if (response && response.length >= 0) {
                        updatedCart.push({
                            ...item,
                            name: response[0].name,
                            image: response[0].image
                        });
                    }
                }
                setCart(updatedCart);
            };
            fetchPlaceDetails();
        }
    }, []);

    function deleteItems() {
        setCart([]); // Usa o método do contexto que já sincroniza com o localStorage
        toast.success('O carrinho foi limpo com sucesso!');
    }

    function removeItem(item: { hour: number; place: number}) {
        setCart(prevCart => {
            const updatedCart = prevCart.filter(i => !(i.hour === item.hour && i.place === item.place));
            if (typeof window !== 'undefined') {
                localStorage.setItem('___cfcsn-cart', JSON.stringify(updatedCart)); // Sincroniza com o localStorage
            }
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
            {cart.length !== 0 ? (
            <>
                <div className={style.cartListContainer}>
                    {cart.map((item, index) => {
                        const hour = `${item.hour}:00 - ${item.hour+1}:00`

                        return(
                            <div className={style.cartItem} key={index}>
                                <div>
                                    <Image alt={'a'} width={150} height={125} src={item.image || '/default-image.jpg'}/>
                                </div>
                                <div>
                                    <h3 className={style.cartTitle}> {item.name}</h3>
                                    <p>
                                        Horário: {hour}<br/>
                                        <Link className={style.cartLink} href={`/place/` + (item.name ? item.name.split(' ').join('-').toLowerCase() : '')}>
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
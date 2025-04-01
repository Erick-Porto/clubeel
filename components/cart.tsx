"use client"

import {useEffect, useState} from 'react';
import style from '@/styles/cart.module.css'
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarXmark, faCartShopping } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import Link from 'next/link';
const Cart = () => {
    const [cart, setCart] = useState<{ hour: string; place: string }[]>([])
    useEffect(() => {
        const storedCart = localStorage.getItem("___cfcsn-cart") 
            ? JSON.parse(localStorage.getItem("___cfcsn-cart") as string) 
            : null;
    
        if (storedCart) {
            const cartArray = Array.isArray(storedCart) ? storedCart : Object.values(storedCart);
            setCart(cartArray);
        }
    }, []);

    useEffect (()=>{
        let storedCart = localStorage.getItem("___cfcsn-cart")
        if(storedCart == '[]') localStorage.removeItem("___cfcsn-cart")
    },[cart])

    function deleteItems() {
        const storedCart = localStorage.getItem("___cfcsn-cart")
        if ( storedCart){
            setCart([]);
            localStorage.removeItem('___cfcsn-cart');
            toast.success('O carrinho foi limpo com sucesso!');
        }
    }

    function removeItem(item) {
        const updatedCart = cart.filter(i => i !== item);
        setCart(updatedCart);
        localStorage.setItem('___cfcsn-cart', JSON.stringify(updatedCart));
        toast.success('O item foi removido do carrinho com sucesso!');
    }

    return(
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
                                    <Image alt={'a'} width={150} height={125} src={'https://plus.unsplash.com/premium_photo-1664474619075-644dd191935f?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8aW1hZ2VtfGVufDB8fDB8fHww'}/>
                                </div>
                                <div>
                                    <h1 className={style.cartTitle}> Quadra {item.place}</h1>
                                    <p>
                                        Hour: {hour}
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
                    <button className={style.cartButton} onClick={()=> deleteItems()}>Limpar carrinho</button>
                </div>
            </>
            ) : 
            (<div className={style.cartEmpty}>
                <h1>Você não possuí agendamentos em aberto.
                    <br/>
                    <Link href={"/"}><span className={style.cartLink}>Agende já!</span></Link>
                </h1>
            </div>)}
        </div>
    )
}
export default Cart;
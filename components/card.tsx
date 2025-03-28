import style from "@/styles/card.module.css"
import { useState } from "react";

interface CardProps {
    cardNumber: string;
    name: string;
    cvc: string;
    valid: string;
    cardPosition: string;
}

const Card = ({ cardNumber, name, cvc, valid, cardPosition}: CardProps) => {

    return(
        <div className={style.cardContainer}>
            <div className={`${style.card} ${cardPosition === 'back' ? style.cardBackward : ''}`}>
                <div className={style.cardFront}>
                    <div className={style.cardNumber}>{cardNumber}</div>
                    <div className={style.cardName}>{name}</div>
                </div>
                <div className={style.cardBack}>
                    <div className={style.cardCVV}>CVC <br/>{cvc}</div>
                    <div className={style.cardValid}>VALIDADE <br/>{valid}</div>
                </div>
            </div>
        </div>
)}

export default Card;
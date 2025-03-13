'use client'

import { useEffect, useState, useRef } from 'react';
import Style from '@/styles/sportive-square.module.css';

const SportiveSquare = () => {
    const [items, setItems] = useState({});
    const containerRef = useRef(null);

    async function load_square(){
        try {
            const response = await fetch('http://192.168.100.81:8000/api/places/group/sport', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+ process.env.NEXT_PUBLIC_API_TOKEN,
                    'Session': localStorage.getItem('___cfcsn-access-token'),
                }                
            });
            const data = await response.json();
            console.log(data)
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch data');
            }

            setItems(data);
        } catch (err) {
            console.error(err.message);
        }
    }

    useEffect(() => {
        load_square();
    }, []);

    return (
        <div className={Style.carousel}>
            <div className={Style.squareContainer} ref={containerRef}>
                {items && items.data && items.data.map((item, index) => (
                    <div key={index} className={Style.square}>
                        <img src={item.image} alt={item.name} />
                        <div className={Style.squareContent}>
                            <h3>{item.name}</h3>
                            <p>{item.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default SportiveSquare;
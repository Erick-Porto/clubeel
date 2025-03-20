"use client"

import API_CONSUME from '@/services/api-consume';
import Style from '@/styles/sportive-square.module.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const SportiveSquare = () => {
    const [places, setPlaces] = useState([]);
    
    useEffect(() => {
        const fetchPlaces = async () => {
            try {
                const response = await API_CONSUME("GET", "places/group/sport", {
                    'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                    'Session': localStorage.getItem('___cfcsn-access-token')
                }, null);
                const placesArray = Object.values(response); // Converte o objeto para um array
                setPlaces(placesArray);
            } catch (error) {
                console.error("Error fetching places:", error);
            }
        };
    
        fetchPlaces();
    }, []);

    const formatPlaceName = (name: string) => {
        return name.split(' ').join('-').toLowerCase();
    };

    return (
        <div className={Style.squareContainer}>
            <div className={Style.carousel}>
                {places.map((place, index) => (
                    <div key={index} className={Style.square} style={{backgroundImage: `url(${place.image_vertical})`}}>
                        <div className={Style.squareInfo}>
                        <Link href={`/places/${formatPlaceName(place.name)}:${place.id}`} className={Style.squareInfo}>
                            <span className={Style.title}>{place.name}</span>
                        </Link>
                        </div>
                    </div>
                ))}
                {places.map((place, index) => (
                    <div key={index + places.length} className={Style.square} style={{backgroundImage: `url(${place.image_vertical})`}}>
                        <Link href={`/places/${formatPlaceName(place.name)}:${place.id}`} className={Style.squareInfo}>
                            <span className={Style.title}>{place.name}</span>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default SportiveSquare;
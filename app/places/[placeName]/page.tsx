"use client"
import globalStyle from "@/styles/page.module.css";
import style from "@/styles/places.module.css"
import Footer from '@/components/footer';
import Header from '@/components/header';
import { useParams } from 'next/navigation';
import { useEffect, useState } from "react";
import API_CONSUME from "@/services/api-consume";
import Link from "next/link";
import withAuth from "@/components/auth";

const PlacesPage = () => {
    const params = useParams();
    const placeName = params?.placeName as string | " ";
    const [places, setPlaces] = useState([]);
    const [group, setGroup] = useState([]);
    const placeId = placeName.split("%3A")[1]
    useEffect(() => {
        const fetchPlaces = async () => {
            try {
                const response = await API_CONSUME("GET", `places/${placeId}`, {
                    'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                    'Session': localStorage.getItem('___cfcsn-access-token')
                }, null);
                const placesArray = Object.values(response.places);
                setGroup (response.group);
                setPlaces(placesArray);
            } catch (error) {
                console.error("Error fetching places:", error);
            }
        };
    
        fetchPlaces();
    }, []);

    return (
        <div className={globalStyle.page}>
            <Header
                options={null}
                surgeIn={0}
                onlyScroll={false}
            />
            <section className={globalStyle.Section}>
                <div
                    className={style.placeBanner}
                    style={{backgroundImage: `url(${group.image_horizontal})`}}
                >
                    <div className={style.placeBannerCover}>
                        <h1>{group.name}</h1>
                    </div>
                </div>

                <div className={style.placeList}>
                    {places.map((item, index)=>(
                        <div key={index} className={style.placeCard}>
                            <div className={style.placeCardImage} style={{backgroundImage: `url()`}}></div>
                            <div className={style.placeCardInfo}>
                                <p>{item.name}</p>
                                <Link href={`/place/${item.name.split(' ').join('-').toLowerCase()}-${item.id}`}>RESERVAR</Link>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
            
            <Footer/>
        </div>
    );
};

export default withAuth(PlacesPage);
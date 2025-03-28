'use client'

import { useParams } from 'next/navigation';
import withAuth from "@/components/auth";
import Footer from '@/components/footer';
import Header from '@/components/header';
import globalStyle from "@/styles/page.module.css";
import style from "@/styles/places.module.css"
import Schedule from '@/components/schedule';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMedal } from '@fortawesome/free-solid-svg-icons';

const PlacePage = () => {
    
    const params = useParams();
    const placeName = params?.placeName as string | " ";

    const data = {
        "name": "Quadra ",
        "id": placeName.split("-")[placeName.split("-").length - 1],
        "image": "https://plus.unsplash.com/premium_photo-1664474619075-644dd191935f?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8aW1hZ2VtfGVufDB8fDB8fHww",
        "rules": ['Regras 1', 'Regras 2', 'Regras 3'],
        "schedule": []
    }

    return (
        <div className={globalStyle.page}>
            <Header
                options={null}
                surgeIn={0}
                onlyScroll={false}
            />
            <section className={globalStyle.Section} style={{padding: "10% 0"}}>
                <div className={style.placeContainer}>
                    <Image src={`${data.image}`} width={201} height={201} alt="Quadra" className={style.placeImage}></Image>
                    <h1 className={style.placeTitle}>
                        <FontAwesomeIcon icon={faMedal}></FontAwesomeIcon>
                        {data.name}{data.id}
                    </h1>
                    <ul className={style.placeRules}>
                        {data.rules.map((rule, index) => <li key={index}>{rule}</li>)}
                    </ul>
                </div>
                <Schedule reservations={data.schedule} place={parseInt(data.id)}/>
            </section>
            <Footer/>
        </div>
    )
}

export default withAuth(PlacePage);
'use client'

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import withAuth from "@/components/auth";
import Footer from '@/components/footer';
import Header from '@/components/header';
import globalStyle from "@/styles/page.module.css";
import style from "@/styles/places.module.css";
import Schedule from '@/components/schedule';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMedal } from '@fortawesome/free-solid-svg-icons';
import API_CONSUME from '@/services/api-consume';
import { useUser } from '@/context/UserContext';

const PlacePage = () => {
    const params = useParams();
    const searchParams = useSearchParams();
    const { accessToken } = useUser();
    const placeName = params?.placeName as string | " ";
    const placeID = parseInt(placeName.split("-")[placeName.split("-").length - 1])
    const [data, setData] = useState({
        name: "",
        id: "",
        image: "",
        rules: [],
        schedule: [],
        price: 0
    });

    // Função extraída para reutilização no timer
    const fetchData = async () => {
        const response = await API_CONSUME("GET", `place/${placeID}`, {
            'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
            'Session': accessToken
        }, null);

        let schedule_rules = response.schedule_rules;

        response.schedule_rules.forEach((rule: any) => {
            schedule_rules.push(rule);
        });

        setData({
            name: response.name || placeName,
            id: response.id || placeID,
            price: response.price || 0,
            image: response?.image || "",
            rules: response.schedule_rules,
            schedule: Array.isArray(response?.schedule)
                ? response.schedule : []
        });
    };

    useEffect(() => {
        fetchData();
    }, [placeName, placeID, accessToken]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchData();
        }, 30000);
        return () => clearInterval(interval);
    }, [placeID, accessToken]);

    const selectedDateString = searchParams.get('date');
    const selectedDate = selectedDateString ? new Date(selectedDateString) : null;
    return (
        <div className={globalStyle.page}>
            <Header
                options={null}
                surgeIn={0}
                onlyScroll={false}
            />
            <section className={globalStyle.Section} style={{ paddingTop: "100px", paddingBottom: "20px" }}>
            <div className={style.placeContainer}>
                <div className={style.placeTitle}>
                    <h1>
                        {data.name}  |  {selectedDate ? selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long'}) : 'Não selecionada'}
                    </h1>
                    <h3>Agende seu horário</h3>
                </div>
            </div>
                <Schedule
                    src={
                        data.image && typeof data.image === 'string' && data.image.trim() !== '' ? data.image : ""
                    }
                    price={data.price}
                    place={parseInt(data.id)}
                    rules={data.rules}
                />
            </section>
            <Footer />
        </div>
    );
};

export default withAuth(PlacePage);


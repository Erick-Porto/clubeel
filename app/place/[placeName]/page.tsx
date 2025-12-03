'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Schedule from '@/app/components/schedule';
import Footer from '@/components/footer';
import Header from '@/components/header';
import globalStyle from "@/styles/page.module.css";
import style from "@/styles/places.module.css";
import API_CONSUME from '@/services/api-consume';
import { useSession } from 'next-auth/react';
import { LoadingScreen } from '@/components/loading';

interface PlaceData {
    name: string;
    id: string;
    image: string;
    rules: any[];
    schedule: any[];
    price: number;
}

const PlacePage = () => {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { data: session, status } = useSession();
    
    const placeName = params?.placeName as string || "";
    const placeID = placeName.split("-").pop() || "";

    const [data, setData] = useState<PlaceData | null>(null);

    const fetchData = useCallback(async () => {
        if (status !== 'authenticated' || !session || !placeID) {
            return;
        }

        try {
            const response = await API_CONSUME("GET", `place/${placeID}`, {
                'Session': (session as any).accessToken
            }, null);

            setData({
                name: response.name || placeName.split("-").slice(0, -1).join(" "),
                id: response.id || placeID,
                price: Number(response.price) || 0, 
                image: response?.image || "",
                rules: response.schedule_rules || [],
                schedule: Array.isArray(response?.schedule) ? response.schedule : []
            });
        } catch (error) {
            console.error("Erro ao buscar dados do local:", error);
            router.push('/'); 
        }
    }, [placeID, placeName, session, status, router]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        const interval = setInterval(fetchData, 150000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const selectedDateString = searchParams.get('date');
    const dateParts = selectedDateString ? selectedDateString.split('-') : [];
    const selectedDate = dateParts.length === 3 
        ? new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2])) 
        : new Date();

    if (status === 'loading' || !data) {
        return <LoadingScreen />;
    }
    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={0} onlyScroll={false} />
            
            <div className={style.placeBanner} style={{ backgroundImage: `url(${data.image})`, height: '30vh', minHeight: '250px' }}>
                <div className={style.placeBannerCover}>
                    <h1 style={{fontSize: '2.5rem'}}>{data.name}</h1>
                </div>
            </div>

            <section className={globalStyle.Section} style={{paddingTop: '20px'}}>
                <div className={style.placeTitle} style={{ position: 'relative', top: 0, left: 0, transform: 'none', width: '100%', marginBottom: '40px', marginTop: '0' }}>
                    <h2 style={{ color: '#333', textAlign: 'center', fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Agendamento para <span style={{ color: 'var(--grena)', fontWeight: 'bold' }}>
                            {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long'})}
                        </span>
                    </h2>
                </div>
                
                {data.id && (
                    <Schedule
                        src={data.image || ""}
                        price={data.price} // Agora já é um número seguro
                        place_id={parseInt(data.id)}
                        rules={data.rules}
                    />
                )}
            </section>
            <Footer />
        </div>
    );
};

export default PlacePage;
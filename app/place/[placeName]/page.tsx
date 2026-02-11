'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Schedule from '@/app/components/Schedules/schedule';
import Footer from '@/components/Common/footer';
import Header from '@/components/Common/header';
import globalStyle from "@/styles/page.module.css";
import style from "@/styles/places.module.css";
import API_CONSUME from '@/services/api-consume';
import { useSession } from 'next-auth/react';
import { LoadingScreen } from '@/components/Common/loading';
import TutorialOverlay, { TutorialStep } from '@/app/components/Common/tutorial-overlay';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';

interface PlaceData {
    name: string;
    id: string;
    image: string;
    rules: unknown[]; 
    schedule: unknown[]; 
    price: number;
    placeGroupId?: number;
}

const PlacePage = () => {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { status } = useSession();
    
    const placeName = params?.placeName as string || "";
    const placeID = placeName.split("-").pop() || "";

    const [data, setData] = useState<PlaceData | null>(null);

const fetchData = useCallback(async () => {
        if (status !== 'authenticated' || !placeID) {
            return;
        }

        try {
            const response = await API_CONSUME("GET", `place/${placeID}`, {}, null);
            if (!response.ok || !response.data) {
                toast.warn(`Erro ao carregar local (${placeID}): ` + (response.message || "Erro desconhecido"));
                router.push('/');
                return;
            }
            const placeData = response.data;

            setData({
                name: placeData.name || placeName.split("-").slice(0, -1).join(" "),
                id: placeData.id || placeID,
                price: Number(placeData.price) || 0, 
                image: placeData.image || "",
                rules: placeData.schedule_rules || [],
                schedule: Array.isArray(placeData.schedule) ? placeData.schedule : [],
                placeGroupId: placeData.place_group_id,
            });

        } catch (error) {
            toast.error("Erro crítico na página: " + (error instanceof Error ? error.message : String(error)));
            router.push('/'); 
        }
    }, [placeID, placeName, status, router]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        const interval = setInterval(fetchData, 150000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const selectedDateString = searchParams?.get('date');
    const dateParts = selectedDateString ? selectedDateString.split('-') : [];
    const selectedDate = dateParts.length === 3 
        ? new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2])) 
        : new Date();

    if (status === 'loading' || !data) {
        return <LoadingScreen />;
    }

    const TUTORIAL_STEPS: TutorialStep[] = [
            {
                targetId: 'schedule-1',
                title: 'Selecione pelo menos um horário',
                description: (
                    <>
                        <p><FontAwesomeIcon icon={faChevronLeft} /> Use as setas para navegar por semanas.</p>
                        <p>Clique em uma data disponível para ver as quadras.</p>
                    </>
                ),
                offset: -150,
                mOffset: 150,
                waitForAction: true
            },
            {
                targetId: 'action-buttons-1',
                title: 'Adicione seus horários',
                description: (
                    <>
                        <p>Clique em adicionar para levar os horários que deseja ao carrinho.</p>
                    </>
                ),
                offset: -150,
                mOffset: 100,
                waitForAction: true
            },
            {
                targetId: 'expire-clock',
                title: 'Expirar',
                description: (
                    <>
                        <p>
                            Cada agendamento adicionado ao carrinho possui um tempo limite para ser finalizado.
                            Este relógio indica quanto tempo resta para você concluir a compra com base no seu agendamento mais próximo de expirar.
                            Após esse tempo, o agendamento será liberado para ser reservado novamente, por você ou outro usuário.
                        </p>
                    </>
                ),
                offset: -150,
                mOffset: 100,

            },
            {
                targetId: 'action-buttons-2',
                title: 'Vá ao checkout',
                description: (
                    <>
                        <p>Clique em finalizar para ir confirmar seus agendamentos.</p>
                    </>
                ),
                offset: -150,
                mOffset: 150,
                waitForAction: true
            }
        ]

    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={0} onlyScroll={false} />
            <TutorialOverlay steps={TUTORIAL_STEPS} pageKey="Quadra" />
            
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
                        price={data.price}
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
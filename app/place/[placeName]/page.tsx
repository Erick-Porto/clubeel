'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';
import Schedule from '../../components/Schedules/schedule';
import Footer from '../../components/Common/footer';
import Header from '../../components/Common/header';
import globalStyle from "../../../styles/page.module.css";
import ui from "../../../styles/ui.module.css";
import API_CONSUME from '../../../services/api-consume';
import { useSession } from 'next-auth/react';
import { LoadingScreen } from '../../components/Common/loading';
import TutorialOverlay, { TutorialStep } from '../../components/Common/tutorial-overlay';
import { PageHeader } from '../../components/UI/ui';
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

const PlaceContent = () => {
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
            <Header />
            <TutorialOverlay steps={TUTORIAL_STEPS} pageKey="Quadra" />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <PageHeader
                    back
                    kicker="Quadras"
                    title={data.name}
                    lead={<>Agendamento para <strong>{selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</strong>. Escolha horários seguidos.</>}
                />

                {data.id && (
                    <Schedule
                        src={data.image || ""}
                        price={data.price}
                        place_id={parseInt(data.id)}
                        rules={data.rules}
                    />
                )}
            </main>
            <Footer />
        </div>
    );
};

// `useSearchParams` exige Suspense para o build não quebrar no prerender.
const PlacePage = () => (
    <Suspense fallback={<LoadingScreen />}>
        <PlaceContent />
    </Suspense>
);

export default PlacePage;

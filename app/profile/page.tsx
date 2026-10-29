'use client'

import { useState, useEffect, Suspense } from "react";
import Footer from "../components/Common/footer";
import Banner from "../components/Profile/banner";
import { useSession } from "next-auth/react";
import { ProfileForm, PasswordForm } from "../components/Profile/profile-components";
import globalStyle from '../../styles/page.module.css';
import ui from '../../styles/ui.module.css';
import Appointments from "../components/Profile/appointments";
import SocialPendingPaymentBanner from "../components/Social/SocialPendingPaymentBanner";
import TournamentNoticeBanner from "../components/Tournament/TournamentNoticeBanner";
import { moduloVisivel } from "../../utils/modulos";
import Header from "../components/Common/header";
import { LoadingScreen } from "../components/Common/loading";
import { useCart } from "../../context/CartContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faUser, faKey, faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import API_CONSUME from "../../services/api-consume";
import { useSearchParams } from "next/navigation";
import { toast } from "react-toastify";

type ViewState = 'profile' | 'password' | 'schedules';

interface Schedule {
    id: number;
    start_schedule: string;
    place_id: number;
    [key: string]: unknown;
}

const ProfileContent = () => {
    const { cart, isLoading: isCartLoading } = useCart();
    const { data: session, status } = useSession();
    const [view, setView] = useState<ViewState>('profile');
    const [lastScheduleImage, setLastScheduleImage] = useState<string | undefined>(undefined);

    const searchParams = useSearchParams();

    useEffect(() => {
        const tab = searchParams?.get('tab');
        if (tab === 'schedules') {
            setView('schedules');
        }
    }, [searchParams]);

    useEffect(() => {
        if (!isCartLoading && cart && cart.length > 0) {
            setView('schedules');
        }
    }, [cart, isCartLoading]);

useEffect(() => {
        const fetchLastPlaceImage = async () => {
            if (status !== 'authenticated' || !session?.accessToken) {
                toast.error("Sessão inválida. Por favor, faça login novamente.");
                return;

            }
            try {
                const schedulesResponse = await API_CONSUME("GET", `schedule/member/${session.user.id}`);

                if (!schedulesResponse.ok || !schedulesResponse.data) {
                    return;
                }

                const schedulesData = schedulesResponse.data;
                const schedules: Schedule[] = Array.isArray(schedulesData.schedules)
                    ? schedulesData.schedules
                    : (schedulesData.schedules || []);

                if (schedules.length > 0) {
                    const sortedSchedules = schedules.sort((a: Schedule, b: Schedule) => {
                        return new Date(b.start_schedule).getTime() - new Date(a.start_schedule).getTime();
                    });

                    const latestSchedule = sortedSchedules[0];

                    if (latestSchedule && latestSchedule.place_id) {
                        const placeResponse = await API_CONSUME("GET", `place/${latestSchedule.place_id}`);

                        if (placeResponse.ok && placeResponse.data) {
                            const placeData = placeResponse.data;
                            const imageToUse = placeData.image || placeData.horizontal_image;

                            if (imageToUse) {
                                setLastScheduleImage(imageToUse);
                            }
                        }
                    }
                }
            } catch (error) {
                toast.error("Erro ao buscar imagem do último agendamento: " + (error instanceof Error ? error.message : String(error)));
            }
        };

        if (status !== 'loading') fetchLastPlaceImage();
    }, [session, status]);

    if (status === 'loading') return <LoadingScreen />;

    const menuItems: { id: ViewState; label: string; icon: IconDefinition; badge?: number }[] = [
        { id: 'schedules', label: 'Agendamentos', icon: faCalendarDays, badge: cart?.length },
        { id: 'profile', label: 'Meus dados', icon: faUser },
        { id: 'password', label: 'Segurança', icon: faKey },
    ];

    return (
        <div className={globalStyle.page}>
            <Header />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <Banner lastScheduleImage={lastScheduleImage} />

                <nav className={ui.seg} aria-label="Seções do perfil">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            className={`${ui.segItem} ${view === item.id ? ui.segActive : ''}`}
                            aria-pressed={view === item.id}
                            onClick={() => setView(item.id)}
                        >
                            <FontAwesomeIcon icon={item.icon} />
                            {item.label}
                            {item.badge ? <span className={ui.segCount}>{item.badge}</span> : null}
                        </button>
                    ))}
                </nav>

                {/* Reserva social a pagar (inclusive a aprovada no balcão): em qualquer aba. */}
                {moduloVisivel('social') && <SocialPendingPaymentBanner />}
                {/* Torneio: inscrição a pagar e convite de time recebido. */}
                {moduloVisivel('torneios') && <TournamentNoticeBanner />}
                {view === 'profile' && <ProfileForm />}
                {view === 'password' && <PasswordForm />}
                {view === 'schedules' && <Appointments />}
            </main>

            <Footer />
        </div>
    );
}

const ProfilePage = () => {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <ProfileContent />
        </Suspense>
    );
}

export default ProfilePage;

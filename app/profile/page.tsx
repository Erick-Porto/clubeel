'use client'

import { useState, useEffect, Suspense } from "react";
import Footer from "@/components/footer";
import Banner from "@/components/banner";
import { useSession } from "next-auth/react";
import { ProfileForm, PasswordForm } from "@/components/profile-components";
import style from '@/styles/profile.module.css';
import Appointments from "@/components/appointments";
import Header from "../components/header";
import { useCart } from "@/context/CartContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faUser, faKey, faCalendarAlt } from "@fortawesome/free-solid-svg-icons";
import API_CONSUME from "@/services/api-consume";
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
            if (status !== 'authenticated' || !session?.accessToken) return;

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

        fetchLastPlaceImage();
    }, [session, status]);

    const menuItems: { id: ViewState; label: string; icon: IconDefinition; badge?: number }[] = [
        { id: 'profile', label: 'Meus Dados', icon: faUser },
        { id: 'password', label: 'Segurança', icon: faKey },
        { id: 'schedules', label: 'Agendamentos', icon: faCalendarAlt, badge: cart?.length },
    ];

    return (
        <div className={style.profilePageContainer}>
            <Header options={null} surgeIn={-1} onlyScroll={true} />
            <Banner lastScheduleImage={lastScheduleImage} />

            <div className={style.profileContentWrapper}>
                <aside className={style.profileSidebar}>
                    <ul className={style.profileMenu}>
                        {menuItems.map(item => (
                            <li 
                                key={item.id}
                                className={`${style.menuItem} ${view === item.id ? style.menuItemActive : ''}`}
                                onClick={() => setView(item.id)}
                            >
                                <FontAwesomeIcon icon={item.icon} width={20} />
                                {item.label}
                                {item.badge ? (
                                    <span style={{
                                        background: view === item.id ? 'white' : 'var(--grena)', 
                                        color: view === item.id ? 'var(--grena)' : 'white',
                                        borderRadius:'50%', 
                                        width:20, height:20, 
                                        display:'flex', justifyContent:'center', alignItems:'center',
                                        fontSize:'0.7rem', marginLeft:'auto'
                                    }}>
                                        {item.badge}
                                    </span>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </aside>

                <main className={style.contentCard}>
                    {view === 'profile' && <ProfileForm />}
                    {view === 'password' && <PasswordForm />}
                    {view === 'schedules' && <Appointments />}
                </main>
            </div>

            <Footer />
        </div>
    );
}

const ProfilePage = () => {
    return (
        <Suspense fallback={<div className={style.profilePageContainer}>Carregando...</div>}>
            <ProfileContent />
        </Suspense>
    );
}

export default ProfilePage;
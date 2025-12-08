'use client'

import { useState, useEffect } from "react";
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

// Define strict types for the view state
type ViewState = 'profile' | 'password' | 'schedules';

// Define interface for Schedule data
interface Schedule {
    id: number;
    start_schedule: string;
    place_id: number;
    [key: string]: unknown; // Allow other properties from API
}

const ProfilePage = () => {
    const { cart, isLoading: isCartLoading } = useCart();
    const { data: session, status } = useSession();
    const [view, setView] = useState<ViewState>('profile');
    const [lastScheduleImage, setLastScheduleImage] = useState<string | undefined>(undefined);

    // Efeito para redirecionar para agendamentos se houver itens no carrinho
    useEffect(() => {
        if (!isCartLoading && cart && cart.length > 0) {
            setView('schedules');
        }
    }, [cart, isCartLoading]);

    // Efeito para buscar a imagem da quadra do agendamento mais recente
    useEffect(() => {
        const fetchLastPlaceImage = async () => {
            if (status !== 'authenticated' || !session?.accessToken) return;

            try {
                // 1. Busca todos os agendamentos
                const schedulesResponse = await API_CONSUME("GET", `schedule/member/${session.user.id}`, {
                    'Session': session.accessToken
                });

                const schedules: Schedule[] = Array.isArray(schedulesResponse.schedules) ? schedulesResponse.schedules : (schedulesResponse.schedules || []);
                if (schedules.length > 0) {
                    // 2. Ordena para pegar o mais recente (pela data de início)
                    // Convertemos para Date para garantir a ordenação correta (Decrescente: mais novo primeiro)
                    const sortedSchedules = schedules.sort((a: Schedule, b: Schedule) => {
                        return new Date(b.start_schedule).getTime() - new Date(a.start_schedule).getTime();
                    });

                    const latestSchedule = sortedSchedules[0];

                    if (latestSchedule && latestSchedule.place_id) {
                        // 3. Busca os detalhes da quadra desse agendamento
                        const placeResponse = await API_CONSUME("GET", `place/${latestSchedule.place_id}`, {
                            'Session': session.accessToken
                        }, null);

                        // 4. Define a imagem (priorizando horizontal_image, com fallback para image ou null)
                        // Verifica se horizontal_image existe, senão usa image
                        const imageToUse = placeResponse.image || placeResponse.horizontal_image;
                        if (imageToUse) {
                            setLastScheduleImage(imageToUse);
                        }
                    }
                }
            } catch (error) {
                console.error("Erro ao buscar imagem do último agendamento:", error);
            }
        };

        fetchLastPlaceImage();
    }, [session, status]);

    // Opções do Menu Lateral - typed correctly
    const menuItems: { id: ViewState; label: string; icon: IconDefinition; badge?: number }[] = [
        { id: 'profile', label: 'Meus Dados', icon: faUser },
        { id: 'password', label: 'Segurança', icon: faKey },
        { id: 'schedules', label: 'Agendamentos', icon: faCalendarAlt, badge: cart?.length },
    ];

    return (
        <div className={style.profilePageContainer}>
            <Header options={null} surgeIn={-1} onlyScroll={true} />

            {/* Passamos a imagem recuperada para o Banner */}
            <Banner lastScheduleImage={lastScheduleImage} />

            <div className={style.profileContentWrapper}>
                {/* SIDEBAR DE NAVEGAÇÃO */}
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

                {/* ÁREA DE CONTEÚDO */}
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

export default ProfilePage;
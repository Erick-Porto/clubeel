"use client"
import globalStyle from "@/styles/page.module.css";
import style from "@/styles/places.module.css"
import Footer from '@/components/Common/footer';
import Header from '@/components/Common/header';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from "react";
import API_CONSUME from "@/services/api-consume";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { LoadingScreen } from "@/components/Common/loading";
import TutorialOverlay, { TutorialStep } from "@/app/components/Common/tutorial-overlay";
import { toast } from "react-toastify";
import { useIsMobile } from "@/app/hooks/useIsMobile";

interface Rule {
    type: 'include' | 'exclude';
    start_date: string | null;
    end_date: string | null;
    start_time: string | null;
    end_time: string | null;
    weekdays: ({ name: string } | string)[] | null;
    maximum_antecedence: number;
    minimum_antecedence: number;
    status_id: number;
}

interface Place {
    id: string;
    name: string;
    image: string;
    available_slots: number;
    schedule_rules: Rule[];
}

interface Group {
    name: string;
    image_horizontal: string;
}

const getDaysDifference = (date1: Date, date2: Date) => {
    const oneDay = 24 * 60 * 60 * 1000;
    const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return Math.round((d1.getTime() - d2.getTime()) / oneDay);
}

const PlacesPage = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();

    const placeNameParam = params?.placeName as string || "";
    const placeId = placeNameParam.split('-').pop() || "";

    const [places, setPlaces] = useState<Place[]>([]);
    const [group, setGroup] = useState<Group | null>(null);
    const [limit, setLimit] = useState<number>(0);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [weekView, setWeekView] = useState<Date[]>([]);
    const [maxAntecedence, setMaxAntecedence] = useState(0);
    const [isAnimating, setIsAnimating] = useState<'next' | 'prev' | null>(null);
    const [dateDifference, setDateDifference] = useState(0);
    const isMobile = useIsMobile();
    useEffect(() => {
        if (status === 'loading') return;
    }, [status, router]);

    useEffect(() => {
        if (isMobile)
            setDateDifference(8);
        else
            setDateDifference(20);
    }, []);

const fetchPlaces = useCallback(async () => {
        if (status !== 'authenticated' || !session || !placeId) return;

        try {

            const response = await API_CONSUME("POST", `places/`, {}, {
                group_id: placeId,
                member_id: session.user.id,
                date: selectedDate.toISOString().split('T')[0]
            });

            if (!response.ok || !response.data) toast.error("Erro ao buscar locais: " + (response.message || "Erro desconhecido"));
            const apiData = response.data;
            
            const placesArray: Place[] = Object.values(apiData.places || {});
            setGroup(apiData.group);
            setPlaces(placesArray);
            setLimit(Math.min(apiData.limit.limit, apiData.limit.remaining));

            const currentRuleLimit = apiData.group.maximum_antecedence > apiData.group.minimum_antecedence ? apiData.group.maximum_antecedence : apiData.group.minimum_antecedence;

            setMaxAntecedence(currentRuleLimit);

        } catch (error) {
            toast.error("Erro ao buscar locais: " + (error instanceof Error ? error.message : String(error)));
            
        }
    }, [placeId, session, status]);

    useEffect(() => {
        fetchPlaces();
        const interval = setInterval(fetchPlaces, 30000);
        return () => clearInterval(interval);
    }, [fetchPlaces]);

    useEffect(() => {
    const newWeek: Date[] = [];
    const offset = Math.floor(dateDifference / 2);

    for (let i = -offset; i <= offset; i++) {
        const d = new Date(selectedDate);
        d.setDate(selectedDate.getDate() + i);
        newWeek.push(d);
    }
    setWeekView(newWeek);
}, [selectedDate, dateDifference]);

    const handleDateSelectionArrow = (direction: 'next' | 'prev') => {
        if (isAnimating) return;
        
        const today = new Date();
        const diff = getDaysDifference(selectedDate, today);

        if (direction === 'prev') {
            if (diff < dateDifference) {
                return;
            }
        }

        if (direction === 'next') {
            if (diff + dateDifference > maxAntecedence) return;
        }

        setIsAnimating(direction);

        setTimeout(() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(selectedDate.getDate() + (direction === 'next' ? dateDifference : -dateDifference));
            setSelectedDate(newDate);
            
            setIsAnimating(null);
        }, 500); 
    };

    if (status === 'loading' || !session) {
        return <LoadingScreen />;
    }

    const today = new Date();
    const daysFromToday = getDaysDifference(selectedDate, today);
    
    const canGoPrev = daysFromToday >= dateDifference; 
    const canGoNext = (daysFromToday + dateDifference) <= maxAntecedence;

    const TUTORIAL_STEPS: TutorialStep[] = [
        {
            targetId: 'date-selection',
            title: 'Selecione a Data',
            description: (
                <>
                    <p><FontAwesomeIcon icon={faChevronLeft} /> Use as setas para navegar por semanas.</p>
                    <p>Clique em uma data disponível para ver as quadras.</p>
                </>
            ),
            offset: -100,
            mOffset: -50
        },
        {
            targetId: 'place-card-0',
            title: 'Escolha uma Quadra',
            description: (
                <>
                    <p>Clique em uma quadra para ver os horários disponíveis.</p>
                </>
            ),
            offset: -90,
            mOffset: -160,
            targetClickableItem: 'schedule-button-0',
            waitForAction: true
        }
    ]

    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={0} onlyScroll={false} profileOptions={null} />
            <TutorialOverlay steps={TUTORIAL_STEPS} pageKey="Modalidade" />
            
            <section className={globalStyle.Section} style={{ paddingBottom: "60px" }}>
                
                <div className={style.placeBanner} style={{ backgroundImage: `url(${group?.image_horizontal || ''})` }}>
                    <div className={style.placeBannerCover}>
                        <h1>{group?.name || 'Carregando...'}</h1>
                    </div>
                </div>

                <div className={style.dateSelectionContainer} id="date-selection">
                    <button
                        className={style.dateSelectionArrow}
                        onClick={() => handleDateSelectionArrow("prev")}
                        disabled={!canGoPrev || !!isAnimating}
                        aria-label="Avançar data"
                    >
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    
                    <div className={style.dateSelectionContentView}>
                        <ul className={`${style.dateSelection} ${isAnimating ? style[isAnimating] : ''}`}>
                            {weekView.map((item, index) => {
                                const isSelected = selectedDate.toDateString() === item.toDateString();
                                const itemDiff = getDaysDifference(item, today);
                                const isDisabled = itemDiff < 0 || itemDiff > maxAntecedence;

                                return (
                                    <li
                                        key={index}
                                        className={`
                                            ${style.dateSelectionItem} 
                                            ${isSelected ? style.dateSelectedItem : ''}
                                            ${isDisabled ? style.dateItemDisabled : ''}
                                        `}
                                        onClick={() => !isDisabled && setSelectedDate(item)}
                                    >
                                        <span>{item.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                        <span>{item.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','')}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <button
                        className={style.dateSelectionArrow}
                        onClick={() => handleDateSelectionArrow("next")}
                        disabled={!canGoNext || !!isAnimating}
                        aria-label="Avançar data"
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                </div>

                <div className={style.placeList} id="place-list">
                    { places.length > 0 ? (
                    places.map((item, index) => {
                        const isAvailable = limit === 0 ? false : item.available_slots >= 1;
                        return (
                            <div key={item.id} id={`place-card-${index}`} className={`${style.placeCard} ${!isAvailable ? style.placeCardDisabled : ''}`}>
                                <div className={style.placeCardImageContainer}>
                                    <div 
                                        className={style.placeCardImage} 
                                        style={{ backgroundImage: `url(${item.image})` }} 
                                        role="img" 
                                        aria-label={`Imagem de ${item.name}`}
                                    />
                                    <span className={`${style.statusBadge} ${isAvailable ? style.available : style.unavailable}`}>
                                        {item.available_slots >= 1 ? `${item.available_slots > 1 ? item.available_slots + ' Disponíveis' : '1 Disponível'}` : item.available_slots === 0 ? 'Esgotado' : 'Indisponível'}
                                    </span>
                                </div>

                                <div className={style.placeCardInfo}>
                                    <h3 className={style.placeCardTitle}>{item.name}</h3>
                                    
                                    {isAvailable ? (
                                         <Link referrerPolicy='no-referrer' rel='noopener noreferrer' 
                                            id={`schedule-button-${index}`}
                                            className={`${style.placeAction} ${style.btnReserve}`}
                                            href={{
                                                pathname: `/place/${item.name.replace(/\s+/g, '-').toLowerCase()}-${item.id}`
                                            }}
                                        >
                                            Reservar Horário
                                        </Link>
                                    ) : (
                                        <div className={`${style.placeAction} ${style.disabledText}`}>
                                            {item.available_slots === 0 ? 'Horários esgotados' : 'Local indisponível'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                
                ) : (
                    <div className={style.noPlacesMessage}>
                        Nenhuma quadra disponível para a data selecionada.
                    </div>
                )}
                </div>
            </section>
            <Footer />
        </div>
    );
};

export default PlacesPage;
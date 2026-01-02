"use client"
import globalStyle from "@/styles/page.module.css";
import style from "@/styles/places.module.css"
import Footer from '@/components/footer';
import Header from '@/components/header';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from "react";
import API_CONSUME from "@/services/api-consume";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { LoadingScreen } from "@/components/loading";
import TutorialOverlay, { TutorialStep } from "@/app/components/tutorial-overlay";
import { toast } from "react-toastify";

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

const isPlaceAvailableOnDate = (place: Place, selectedDate: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!place.schedule_rules || place.schedule_rules.length === 0) return false;

    let isAllowed = false;
    let isBlocked = false;

    const selectedWeekday = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const diffDays = getDaysDifference(selectedDate, today);

    if (diffDays < 0) return false;

    for (const rule of place.schedule_rules) {
        if (rule.status_id !== null && Number(rule.status_id) !== 1) continue;

        const ruleStartDate = rule.start_date ? new Date(rule.start_date+ "T00:00:00") : null;
        const ruleEndDate = rule.end_date ? new Date(rule.end_date+ "T23:59:59") : null;
        
        if (ruleStartDate) ruleStartDate.setHours(0,0,0,0);
        if (ruleEndDate) ruleEndDate.setHours(23,59,59,999);

        const isDateInRange =
            (!ruleStartDate || selectedDate >= ruleStartDate) &&
            (!ruleEndDate || selectedDate <= ruleEndDate);

        if (!isDateInRange) continue; 

        if (rule.type === 'exclude') {
            if(rule.start_time || rule.end_time) {
                continue;
            }
            if (!rule.weekdays || rule.weekdays.length === 0) {
                isBlocked = true;
            } else {
                const ruleDays = rule.weekdays.map((d) => (typeof d === 'string' ? d : d.name).toLowerCase());
                if (ruleDays.includes(selectedWeekday)) 
                    isBlocked = true;
            }
        }
        
        else if (rule.type === 'include') {
            let ruleIsValid = true;

            if (rule.weekdays && rule.weekdays.length > 0) {
                const ruleDays = rule.weekdays.map((d) => (typeof d === 'string' ? d : d.name).toLowerCase());
                if (!ruleDays.includes(selectedWeekday)) 
                    ruleIsValid = false;
            }

            if (rule.maximum_antecedence !== null && rule.maximum_antecedence >= 0) {
                if (diffDays > rule.maximum_antecedence)
                    ruleIsValid = false;
            }

            if (rule.minimum_antecedence !== null && rule.minimum_antecedence >= 0) {
                if (diffDays < rule.minimum_antecedence) 
                    ruleIsValid = false;
            }

            if (ruleIsValid)
                isAllowed = true;
        }
    }
    return isAllowed && !isBlocked;
};


const PlacesPage = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();

    const placeNameParam = params?.placeName as string || "";
    const placeId = placeNameParam.split('-').pop() || "";

    const [places, setPlaces] = useState<Place[]>([]);
    const [group, setGroup] = useState<Group | null>(null);
    
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [weekView, setWeekView] = useState<Date[]>([]);
    const [maxAntecedence, setMaxAntecedence] = useState(0);
    const [isAnimating, setIsAnimating] = useState<'next' | 'prev' | null>(null);

    useEffect(() => {
        if (status === 'loading') return; 
    }, [status, router]);

const fetchPlaces = useCallback(async () => {
        if (status !== 'authenticated' || !session || !placeId) return;

        try {

            const response = await API_CONSUME("GET", `places/${placeId}`, {}, null);

            if (!response.ok || !response.data) {
                toast.error("Erro ao buscar locais: " + (response.message || "Erro desconhecido"));
                return;
            }

            const apiData = response.data;
            
            const placesArray: Place[] = Object.values(apiData.places || {});
            
            setGroup(apiData.group);
            setPlaces(placesArray);

            const newMaxAntecedence = placesArray.reduce((max, place) => {
                const placeMax = place.schedule_rules.reduce((ruleMax, rule) => {
                    if (rule.status_id !== 1) {
                        return ruleMax;
                    }
                    if (rule.maximum_antecedence === null && rule.minimum_antecedence === null) {
                        return ruleMax;
                    }

                    const maxAnt = rule.maximum_antecedence !== null ? rule.maximum_antecedence : 0;
                    const minAnt = rule.minimum_antecedence !== null ? rule.minimum_antecedence : 0;

                    const currentRuleLimit = maxAnt > minAnt ? maxAnt : minAnt;

                    return Math.max(ruleMax, currentRuleLimit);
                }, 0);
                return Math.max(max, placeMax);
            }, 0);

            setMaxAntecedence(newMaxAntecedence);

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
        for (let i = -10; i <= 10; i++) {
            const d = new Date(selectedDate);
            d.setDate(selectedDate.getDate() + i);
            newWeek.push(d);
        }
        setWeekView(newWeek);
    }, [selectedDate]);

    const handleDateSelectionArrow = (direction: 'next' | 'prev') => {
        if (isAnimating) return;
        
        const today = new Date();
        const diff = getDaysDifference(selectedDate, today);

        if (direction === 'prev') {
            if (diff < 7) {
                return;
            }
        }

        if (direction === 'next') {
            if (diff + 7 > maxAntecedence) return;
        }

        setIsAnimating(direction);

        setTimeout(() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
            setSelectedDate(newDate);
            
            setIsAnimating(null);
        }, 500); 
    };

    if (status === 'loading' || !session) {
        return <LoadingScreen />;
    }

    const today = new Date();
    const daysFromToday = getDaysDifference(selectedDate, today);
    
    const canGoPrev = daysFromToday >= 7; 
    const canGoNext = (daysFromToday + 7) <= maxAntecedence;

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
                        aria-label="Voltar 7 dias"
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
                        aria-label="Avançar 7 dias"
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                </div>

                <div className={style.placeList} id="place-list">
                    {places.map((item, index) => {
                        const isAvailable = isPlaceAvailableOnDate(item, selectedDate);

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
                                        {isAvailable ? 'Disponível' : 'Indisponível'}
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
                                            Não Disponível
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
            <Footer />
        </div>
    );
};

export default PlacesPage;
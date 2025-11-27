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

// --- INTERFACES ---
interface Rule {
    type: 'include' | 'exclude';
    start_date: string | null;
    end_date: string | null;
    weekdays: { name: string }[] | null;
    maximium_antecedence: number;
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

// --- FUNÇÃO AUXILIAR PARA CALCULAR DIFERENÇA DE DIAS ---
const getDaysDifference = (date1: Date, date2: Date) => {
    const oneDay = 24 * 60 * 60 * 1000;
    // Normaliza para meia-noite para evitar erros de horas
    const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return Math.round((d1.getTime() - d2.getTime()) / oneDay);
}

// --- LÓGICA DE DISPONIBILIDADE ---
const isPlaceAvailableOnDate = (place: Place, selectedDate: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let isAvailable = true;

    for (const rule of place.schedule_rules) {
        const ruleStartDate = rule.start_date ? new Date(rule.start_date) : null;
        const ruleEndDate = rule.end_date ? new Date(rule.end_date) : null;

        const isDateInRange =
            (!ruleStartDate || selectedDate >= ruleStartDate) &&
            (!ruleEndDate || selectedDate <= ruleEndDate);

        if (!isDateInRange) continue;

        const weekdays = rule.weekdays?.map(wd => wd.name.toLowerCase()) || [];
        const selectedWeekday = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        if (rule.type === 'exclude') {
            if (weekdays.length === 0 || weekdays.includes(selectedWeekday)) {
                isAvailable = false;
                break;
            }
        } else if (rule.type === 'include') {
            if (rule.maximium_antecedence >= 0) {
                // Verifica antecedência
                const diff = getDaysDifference(selectedDate, today);
                if (diff > rule.maximium_antecedence) {
                    isAvailable = false;
                    break;
                }
            }
            if (weekdays.length > 0 && !weekdays.includes(selectedWeekday)) {
                isAvailable = false;
                break;
            }
        }
    }
    return isAvailable;
};


const PlacesPage = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();

    const placeNameParam = params?.placeName as string || "";
    const placeId = placeNameParam.split('-').pop() || "";

    const [places, setPlaces] = useState<Place[]>([]);
    const [group, setGroup] = useState<Group | null>(null);
    
    // Estado principal agora é a DATA SELECIONADA
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
            const response = await API_CONSUME("GET", `places/${placeId}`, {
                'Session': (session as any).accessToken
            }, null);

            const placesArray: Place[] = Object.values(response.places || {});
            setGroup(response.group);
            setPlaces(placesArray);

            const newMaxAntecedence = placesArray.reduce((max, place) => {
                const placeMax = place.schedule_rules.reduce((ruleMax, rule) => {
                    const ant = rule.maximium_antecedence !== undefined ? rule.maximium_antecedence : 0;
                    return Math.max(ruleMax, ant);
                }, 0);
                return Math.max(max, placeMax);
            }, 0);
            
            setMaxAntecedence(newMaxAntecedence);

        } catch (error) {
            console.error("Error fetching places:", error);
        }
    }, [placeId, session, status]);

    useEffect(() => {
        fetchPlaces();
        const interval = setInterval(fetchPlaces, 30000);
        return () => clearInterval(interval);
    }, [fetchPlaces]);

    // Gera a View SEMPRE centrada na data selecionada
    useEffect(() => {
        const newWeek: Date[] = [];
        // Gera 21 dias (3 blocos de 7): 
        // -10 a -4 (Passado/Prev)
        // -3 a +3 (Visível/Center) -> selecionada é o índice 0 deste loop relativo
        // +4 a +10 (Futuro/Next)
        
        // O CSS mostra o "meio" (-33.33%), que corresponde aos índices 7 a 13 do array de 21 itens.
        // Se o loop vai de -10 a +10, o índice 10 é o zero (selectedDate).
        // Visualmente o centro da tela será a selectedDate.
        
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

        // Validações antes de animar
        if (direction === 'prev') {
             // Se voltar 7 dias cair no passado (antes de hoje), bloqueia
             // Ex: Estou no dia +3. Voltar 7 vai para -4. Bloqueia.
             // Mas se estou no dia +8. Voltar 7 vai para +1. Permite.
             // A lógica simples é: Se a data destino < hoje, não vai (ou vai p/ hoje).
             // Aqui vamos bloquear se o destino for inválido.
             if (diff < 7) { // Se estou a menos de 7 dias de hoje, voltar 7 cairia no passado.
                 // Opcional: Poderia ir para "Hoje" em vez de travar.
                 return;
             }
        }

        if (direction === 'next') {
            // Se avançar 7 dias ultrapassar a antecedência
            if (diff + 7 > maxAntecedence) return;
        }

        setIsAnimating(direction);

        setTimeout(() => {
            // Atualiza a data selecionada (o que regenera a view centrada nela)
            const newDate = new Date(selectedDate);
            newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
            setSelectedDate(newDate);
            
            setIsAnimating(null);
        }, 500); 
    };

    if (status === 'loading' || !session) {
        return <LoadingScreen />;
    }

    // Cálculos para habilitar/desabilitar setas
    const today = new Date();
    const daysFromToday = getDaysDifference(selectedDate, today);
    
    // Pode voltar se estiver a pelo menos 7 dias no futuro (para não cair no passado)
    // Ou ajustável: Pode voltar se não for hoje? (Se for hoje, disable)
    // No modelo de pulo de 7 dias:
    const canGoPrev = daysFromToday >= 7; 
    const canGoNext = (daysFromToday + 7) <= maxAntecedence;

    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={0} onlyScroll={false} profileOptions={null} />
            
            <section className={globalStyle.Section} style={{ paddingBottom: "60px" }}>
                
                <div className={style.placeBanner} style={{ backgroundImage: `url(${group?.image_horizontal || ''})` }}>
                    <div className={style.placeBannerCover}>
                        <h1>{group?.name || 'Carregando...'}</h1>
                    </div>
                </div>

                <div className={style.dateSelectionContainer}>
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
                                
                                // Bloqueio Individual: Passado ou Futuro > Antecedência
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

                <div className={style.placeList}>
                    {places.map((item) => {
                        const isAvailable = isPlaceAvailableOnDate(item, selectedDate);

                        return (
                            <div key={item.id} className={`${style.placeCard} ${!isAvailable ? style.placeCardDisabled : ''}`}>
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
                                        <Link
                                            className={`${style.placeAction} ${style.btnReserve}`}
                                            href={{
                                                pathname: `/place/${item.name.replace(/\s+/g, '-').toLowerCase()}-${item.id}`,
                                                query: { date: selectedDate.toISOString().split('T')[0] }
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
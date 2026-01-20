'use client'

import { useEffect, useState, useRef } from "react";
import style from "@/styles/page.module.css";
import Footer from "@/components/footer";
import Header, { HeaderOption } from "@/components/header";
// import MobileNavBar from "@/components/mobileNavBar";
import SportiveSquare from "@/components/sportive-square";
// import MapBanner from "@/components/map-banner";
import API_CONSUME from "@/services/api-consume";
import { useSession } from "next-auth/react";
import { useIsMobile } from "./hooks/useIsMobile";
import TutorialOverlay, { TutorialStep } from "@/components/tutorial-overlay";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandPointer } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import ItensGrid from "@/components/ItensGrid";
interface Point { x: number; y: number; }
interface Place {
    id: number;
    name: string; icon: string; image_vertical: string;
    image_horizontal: string; vertices: Point[]; category: string;
}

interface ApiPlaceData {
    id?: string | number;
    vertices: string | number[][];
    [key: string]: unknown;
}

const NAV_OPTIONS: HeaderOption[] = [
    // { text: "Mapa", id: "mapa" },
    // { text: "Esportes", id: "esportivas" },
    // { text: "Social", id: "sociais" }
];

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        targetId: 'map-section',
        title: 'Explore o Clube',
        description: ( <p><FontAwesomeIcon icon={faHandPointer} /> Use o zoom para navegar pelo mapa.</p> ),
        offset: -700,
        mOffset: -450
    },
    {
        targetId: 'hotspot-0',
        title: 'Encontre Disponibilidade',
        description: ( <p> Ícones piscantes indicam quadras disponíveis. Clique em um para ver o local.</p> ),
        offset: -50,
        mOffset: -30,
        waitForAction: true
    },
    {
        targetId: 'popup-places',
        title: 'Inicie a Reserva',
        description: 'Clique em "Ver Detalhes e Reservar" no popup da quadra para avançar para a próxima etapa.',
        offset: 150,
        mOffset: 5,
        targetClickableItem: 'reserve-button',
        waitForAction: true
    }
];

const Home = () => {
    const [activeSection, setActiveSection] = useState<'mapa' | 'esportivas' | 'sociais'>('mapa');
    const [places, setPlaces] = useState<Place[]>([]);
    const isClicking = useRef(false);
    
    const { data: session, status } = useSession();
    const isMobile = useIsMobile();

    const pageContainerRef = useRef<HTMLDivElement>(null);
    const mainContainerRef = useRef<HTMLDivElement>(null);
    // const mapRef = useRef<HTMLDivElement>(null);
    const sportsRef = useRef<HTMLDivElement>(null);
    // const socialRef = useRef<HTMLDivElement>(null);

useEffect(() => {
        const fetchPlaces = async () => {
            if (status !== 'authenticated' || !session?.accessToken) return;
            
            try {
                const response = await API_CONSUME("GET", "places/group");

                // 1. Verificação de segurança (Novo padrão)
                if (!response.ok || !response.data) {
                    toast.error("Erro ao buscar locais: " + response.message);
                    return;
                }

                const rawPlacesArray = Object.values(response.data) as ApiPlaceData[];
                
                const transformedPlaces = rawPlacesArray.map((apiPlace): Place => {
                    let parsedVertices: number[][] = [];
                    
                    if (typeof apiPlace.vertices === 'string') {
                        try { 
                            parsedVertices = JSON.parse(apiPlace.vertices) as number[][]; 
                        } catch {}
                    } else if (Array.isArray(apiPlace.vertices)) {
                        parsedVertices = apiPlace.vertices as number[][];
                    }
                    
                    return { 
                        ...(apiPlace as unknown as Place), 
                        id: Number(apiPlace.id), 
                        vertices: parsedVertices.map(v => ({ x: v[0], y: v[1] })) 
                    };
                });
                setPlaces(transformedPlaces);
            } catch (error) { 
                toast.error("Erro ao processar locais: " + (error instanceof Error ? error.message : String(error)));
            }
        };
        fetchPlaces();
    }, [session, status]);

    useEffect(() => {
        const container = isMobile ? mainContainerRef.current : pageContainerRef.current;
        const target = isMobile ? mainContainerRef.current : null; 

        if (!container) return;

        const options = {
            root: target, 
            threshold: 0.4
        };

        const observer = new IntersectionObserver((entries) => {
            if (isClicking.current) return;

            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    // if (id === 'mapa') setActiveSection('mapa');
                    if (id === 'esportes') setActiveSection('esportivas');
                    // if (id === 'social') setActiveSection('sociais');
                }
            });
        }, options);

        // if (mapRef.current) observer.observe(mapRef.current);
        if (sportsRef.current) observer.observe(sportsRef.current);
        // if (socialRef.current) observer.observe(socialRef.current);

        return () => observer.disconnect();
    }, [isMobile, places]);

    const handleNavigation = (id: string) => {
        isClicking.current = true;
        setActiveSection(id as 'mapa' | 'esportivas' | 'sociais');

        let targetRef = null;
        // if (id === 'mapa') targetRef = mapRef;
        if (id === 'esportivas') targetRef = sportsRef;
        // if (id === 'sociais') targetRef = socialRef;

        if (targetRef?.current) {
            targetRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'start'
            });
        }

        setTimeout(() => { isClicking.current = false; }, 1000);
    };

    if (status === "loading") return <div>Carregando...</div>;

    return (
        <div className={`${style.page} ${isMobile ? style.homePage : ''}`} ref={pageContainerRef}> 
            
            <TutorialOverlay steps={TUTORIAL_STEPS} pageKey="Página inicial" />

            <Header 
                options={NAV_OPTIONS} 
                surgeIn={0} 
                onlyScroll={true}
                activeSection={activeSection}
                onNavigate={handleNavigation}
            />

            <div className={style.main} ref={mainContainerRef}>
                
                {/* <section className={`${style.Section} ${style.sectionMap}`} ref={mapRef} id="mapa">
                    <div id="map-section" style={{width: '100%', height: '100%', display:'flex', flexDirection:'column', alignItems:'center'}}>
                         {!isMobile && <h1 className={style.sectionTitle}>Mapa do Clube</h1>}
                        <div className={style.contentWrapper}>
                            <MapBanner places={places.filter(p => p.vertices && p.vertices.length > 0).map(p => ({ ...p, id: String(p.id) }))} />
                        </div>
                    </div>
                </section>*/}
                
                <section style={isMobile ? {padding: '75px 0px 0px', scrollbarWidth: 'none', minHeight: '87dvh'} : {}} className={`${style.Section} ${style.sectionSports}`} ref={sportsRef} id="esportes">
                    <div className={style.contentWrapper}>
                        {!isMobile && <h1 className={style.sectionTitle}>Áreas Esportivas</h1>}
                        {
                            isMobile ?
                            (<ItensGrid data={places.filter(p => p.category === "esportiva")}/>):
                            (<SportiveSquare places={places.filter(p => p.category === "esportiva")}/>)
                        }
                    </div>
                </section>

                {/* <section className={`${style.Section} ${style.sectionSocial}`} ref={socialRef} id="social">
                    <div className={style.contentWrapper}>
                        <h1 className={style.sectionTitle}>Áreas Sociais</h1>
                        <SportiveSquare places={places.filter(p => p.category === "social")}/>
                        {places.filter(p => p.category === "social").length === 0 && (
                            <div style={{opacity: 0.5, marginTop: 20}}>Áreas sociais em breve</div>
                        )}
                    </div>
                </section> */}

                <div className={style.footerContainer}>
                    <Footer/>
                </div>

            </div>
            
            {/* {isMobile && (
                <MobileNavBar 
                    onNavigate={(id) => handleNavigation(id)} 
                    activeSection={activeSection} 
                />
            )} */}
        </div>
    );
}

export default Home;

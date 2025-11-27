'use client'

import { useEffect, useState, useRef } from "react";
import style from "@/styles/page.module.css";
import Footer from "@/components/footer";
import Header, { HeaderOption } from "@/components/header";
import MobileNavBar from "./components/mobileNavBar";
import SportiveSquare from "@/components/sportive-square";
import MapBanner from "@/components/map-banner";
import API_CONSUME from "@/services/api-consume";
import { useSession } from "next-auth/react";
import { useIsMobile } from "./hooks/useIsMobile";

interface Point { x: number; y: number; }
interface Place {
    id: string; name: string; icon: string; image_vertical: string;
    image_horizontal: string; vertices: Point[]; category: string;
}

const NAV_OPTIONS: HeaderOption[] = [
    { text: "Mapa", id: "mapa" },
    { text: "Esportes", id: "esportivas" },
    { text: "Social", id: "sociais" }
];

const Home = () => {
    const [activeSection, setActiveSection] = useState<'mapa' | 'esportivas' | 'sociais'>('mapa');
    const [places, setPlaces] = useState<Place[]>([]);
    const isClicking = useRef(false);
    
    const { data: session, status } = useSession();
    const isMobile = useIsMobile();

    const pageContainerRef = useRef<HTMLDivElement>(null);
    const mainContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const sportsRef = useRef<HTMLDivElement>(null);
    const socialRef = useRef<HTMLDivElement>(null);

    // 1. Fetch Data
    useEffect(() => {
        const fetchPlaces = async () => {
            if (status !== 'authenticated' || !session?.accessToken) return;
            try {
                const response = await API_CONSUME("GET", "places/group/", {
                    'Session': session.accessToken
                });
                const rawPlacesArray: any[] = Object.values(response || {});
                const transformedPlaces = rawPlacesArray.map((apiPlace): Place => {
                    let parsedVertices: any[] = [];
                    if (typeof apiPlace.vertices === 'string') {
                        try { parsedVertices = JSON.parse(apiPlace.vertices); } catch (e) {}
                    } else if (Array.isArray(apiPlace.vertices)) {
                        parsedVertices = apiPlace.vertices;
                    }
                    return { ...apiPlace, vertices: parsedVertices.map(v => ({ x: v[0], y: v[1] })) };
                });
                setPlaces(transformedPlaces);
            } catch (error) { console.error("Error fetching places:", error); }
        };
        fetchPlaces();
    }, [session, status]);

    // 2. Foco Inicial Mobile
    useEffect(() => {
        if (isMobile && mainContainerRef.current && places.length > 0) {
             setTimeout(() => {
                const width = window.innerWidth;
                mainContainerRef.current?.scrollTo({ left: width, behavior: 'auto' });
            }, 200);
        }
    }, [isMobile, places.length]);

    // 3. Scroll Spy
    useEffect(() => {
        const container = isMobile ? mainContainerRef.current : pageContainerRef.current;
        // Fallback para window no desktop se o ref não for o scroller direto
        const target = isMobile ? mainContainerRef.current : null; 

        // Observer Options
        const options = {
            root: target, // null = viewport (para desktop window scroll)
            threshold: 0.4
        };

        const observer = new IntersectionObserver((entries) => {
            if (isClicking.current) return;

            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    if (id === 'mapa') setActiveSection('mapa');
                    if (id === 'esportes') setActiveSection('esportivas');
                    if (id === 'social') setActiveSection('sociais');
                }
            });
        }, options);

        if (mapRef.current) observer.observe(mapRef.current);
        if (sportsRef.current) observer.observe(sportsRef.current);
        if (socialRef.current) observer.observe(socialRef.current);

        return () => observer.disconnect();
    }, [isMobile, places]);

    // 4. Navegação
    const handleNavigation = (id: string) => {
        isClicking.current = true;
        setActiveSection(id as any);

        let targetRef = null;
        if (id === 'mapa') targetRef = mapRef;
        if (id === 'esportivas') targetRef = sportsRef;
        if (id === 'sociais') targetRef = socialRef;

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
        // CORREÇÃO: Adicione a classe condicional .homePage aqui
        <div 
            className={`${style.page} ${isMobile ? style.homePage : ''}`} 
            ref={pageContainerRef}
        > 
            <Header 
                options={NAV_OPTIONS} 
                surgeIn={0} 
                onlyScroll={true}
                activeSection={activeSection}
                onNavigate={handleNavigation}
            />

            <div className={style.main} ref={mainContainerRef}>
                
                <section className={`${style.Section} ${style.sectionMap}`} ref={mapRef} id="mapa">
                    {!isMobile && <h1 className={style.sectionTitle}>Mapa do Clube</h1>}
                    <div className={style.contentWrapper}>
                        <MapBanner places={places.filter(p => p.vertices && p.vertices.length > 0)} />
                    </div>
                </section>
                
                <section className={`${style.Section} ${style.sectionSports}`} ref={sportsRef} id="esportes">
                    <div className={style.contentWrapper}>
                        <h1 className={style.sectionTitle}>Áreas Esportivas</h1>
                        <SportiveSquare places={places.filter(p => p.category === "esportiva")}/>
                    </div>
                </section>

                <section className={`${style.Section} ${style.sectionSocial}`} ref={socialRef} id="social">
                    <div className={style.contentWrapper}>
                        <h1 className={style.sectionTitle}>Áreas Sociais</h1>
                        <SportiveSquare places={places.filter(p => p.category === "social")}/>
                        {places.filter(p => p.category === "social").length === 0 && (
                            <div style={{opacity: 0.5, marginTop: 20}}>Áreas sociais em breve</div>
                        )}
                    </div>
                </section>

                <div className={style.footerContainer}>
                    <Footer/>
                </div>

            </div>
            
            {isMobile && (
                <MobileNavBar 
                    onNavigate={(id) => handleNavigation(id as any)} 
                    activeSection={activeSection} 
                />
            )}
        </div>
    );
}

export default Home;
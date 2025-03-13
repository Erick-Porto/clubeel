'use client'

import { useEffect, useState, useRef } from "react";
import styles from "@/styles/page.module.css";
import Footer from "@/components/footer";
import Carousel from "@/components/carousel";
import Header from "@/components/header";
import HorizontalNavBar from '@/components/horizontal-nav-bar';
import MapLocation from "@/components/location";
import withAuth from "@/components/auth"; // Corrected import path
import { redirect } from "next/dist/server/api-utils";
import { useRouter } from "next/navigation";
import SportiveSquare from "@/components/sportive-square";

interface NavOption {
  text: string;
  to: number;
  page: string;
}

let ip ="192.168.100.206"

const Home = () => {
  const [navOptions, setNavOptions] = useState<NavOption[]>([
    { text: "Localização", to: 0, page:""},
    { text: "Áreas Esportivas", to: 0, page:""},
    { text: "Áreas de Confraternização", to: 0, page:""}
  ]);
  const router = useRouter();
  const locationRef = useRef<HTMLDivElement>(null);
  const sportsAreasRef = useRef<HTMLDivElement>(null);
  const confraternizationAreasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateOffsets = () => {
      const locationOffset = locationRef.current?.offsetTop || 0;
      const sportsAreasOffset = sportsAreasRef.current?.offsetTop || 0;
      const confraternizationAreasOffset = confraternizationAreasRef.current?.offsetTop || 0;

      setNavOptions([
        { text: "Localização", to: locationOffset, page:`http://${ip}:3000` },
        { text: "Áreas Esportivas", to: sportsAreasOffset, page:`http://${ip}:3000` },
        { text: "Áreas de Confraternização", to: confraternizationAreasOffset, page:`http://${ip}:3000` }
      ]);
    };

    // Update offsets after the component has mounted
    setTimeout(updateOffsets, 100);

    // Update offsets on window resize
    window.addEventListener('resize', updateOffsets);
    return () => window.removeEventListener('resize', updateOffsets);
  }, []);

  return (
    <div className={styles.page}>
      <Header options={navOptions} surgeIn={navOptions[0].to}/>
      <Carousel controllers={true} height={95}/>
      <HorizontalNavBar options={navOptions}/>

      <div>
        <span onClick={()=>{
          localStorage.removeItem('___cfcsn-access-token');
          router.push('/login')
        }}>LOGOUT</span>
      </div>

      <section ref={locationRef}>
        <MapLocation />
      </section>
      <section id="sports-areas" ref={sportsAreasRef}>
        <SportiveSquare/>
      </section>
      <section id="confraternization-areas" ref={confraternizationAreasRef}>
        {/* Confraternization Areas content */}
      </section>
      <Footer/>
    </div>
  );
}

export default withAuth(Home);
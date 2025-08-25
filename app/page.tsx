'use client'

import { useEffect, useState, useRef } from "react";
import style from "@/styles/page.module.css";
import Footer from "@/components/footer";
import Carousel from "@/components/carousel";
import Header from "@/components/header";
import HorizontalNavBar from '@/components/horizontal-nav-bar';
import MapLocation from "@/components/location";
import withAuth from "@/components/auth";
import SportiveSquare from "@/components/sportive-square";

interface NavOption {
  text: string;
  to: number;
  page: string;
}

const Home = () => {
  const [navOptions, setNavOptions] = useState<NavOption[]>([
    { text: "Localização", to: 0, page:""},
    { text: "Áreas Esportivas", to: 0, page:""},
  ]);

  const locationRef = useRef<HTMLDivElement>(null);
  const sportsAreasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateOffsets = () => {
      const locationOffset = locationRef.current?.offsetTop || 0;
      const sportsAreasOffset = sportsAreasRef.current?.offsetTop || 0;
      setNavOptions([
        { text: "Localização", to: locationOffset, page:`` },
        { text: "Áreas Esportivas", to: sportsAreasOffset, page:`` },
      ]);
    };

    setTimeout(updateOffsets, 100);

    window.addEventListener('resize', updateOffsets);
    return () => {
      window.removeEventListener('resize', updateOffsets);
    };
  }, [navOptions]);

  return (
    <div className={style.page}>
      <Header options={navOptions} surgeIn={navOptions[0].to} onlyScroll={true}/>
      <Carousel controllers={true} height={95}/>
      <HorizontalNavBar options={navOptions}/>

      <section className={style.Section} ref={locationRef}>
        <MapLocation />
      </section>
      <section className={style.Section} id="sports-areas" ref={sportsAreasRef}>
        <SportiveSquare/>
      </section>
      <Footer/>
    </div>
  );
}

export default withAuth(Home);
'use client'

import { useEffect, useState, useRef } from "react";
import globalStyle from "@/styles/page.module.css";
import Footer from "@/components/footer";
import Header from "@/components/header";
import withAuth from "@/components/auth";

interface NavOption {
  text: string;
  to: number;
  page: string;
}

const Lease = () => {
  const [navOptions, setNavOptions] = useState<NavOption[]>([
    { text: "Localização", to: 0, page:"" },
    { text: "Áreas Esportivas", to: 0, page:"" },
    { text: "Áreas de Confraternização", to: 0, page:"" }
  ]);

  const locationRef = useRef<HTMLDivElement>(null);
  const sportsAreasRef = useRef<HTMLDivElement>(null);
  const confraternizationAreasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateOffsets = () => {
      const locationOffset = locationRef.current?.offsetTop || 0;
      const sportsAreasOffset = sportsAreasRef.current?.offsetTop || 0;
      const confraternizationAreasOffset = confraternizationAreasRef.current?.offsetTop || 0;

      setNavOptions([
        { text: "Localização", to: locationOffset, page:`http://${ip}:3000`},
        { text: "Áreas Esportivas", to: sportsAreasOffset, page:`http://${ip}:3000`},
        { text: "Áreas de Confraternização", to: confraternizationAreasOffset, page:`http://${ip}:3000`}
      ]);
    };

    // Update offsets after the component has mounted
    setTimeout(updateOffsets, 100);

    // Update offsets on window resize
    window.addEventListener('resize', updateOffsets);
    return () => window.removeEventListener('resize', updateOffsets);
  }, []);

  return (
    <div className={globalStyle.page}>
      <Header options={navOptions} surgeIn={0}/>
      <Footer/>
    </div>
  );
}

export default withAuth(Lease);
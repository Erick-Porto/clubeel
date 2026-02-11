import Image from "next/image";
import Logo from "@/images/logo-cfcsn-horiz.png"; 
import Style from "@/styles/loading.module.css";

interface LoadingProps {
    small?: boolean;
}

export const LoadingScreen = () => {
    return (
        <section className={Style.LoadingScreen}>
            <div className={Style.loadingLogo}>
                <Image 
                    src={Logo} 
                    alt="Logo Clube dos Funcionários" 
                    priority={true}
                    width={250} 
                    height={100}
                    quality={100}
                    style={{ objectFit: 'contain' }}
                />
            </div>
            <div className={Style.loading}></div>
        </section>
    );
};

export const Loading = ({ small = false }: LoadingProps) => {
    return(
        <div className={Style.loadingContainer}>
            <div className={`${Style.loading} ${small ? Style.small : ''}`}></div>
        </div>
    );
};
import Image from "next/image";
import Logo from "@/images/logo-grena.png"
import Style from "@/styles/loading.module.css";

const LoadingScreen = () => {
    return (
        <section className={Style.LoadingScreen}>
            <Image src={Logo} alt="Logo do Clube dos Funcionários"/>
            <div className={Style.loading}></div>
        </section>
)}

export default LoadingScreen;
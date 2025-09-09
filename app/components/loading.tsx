import Image from "next/image";
import Logo from "@/images/logo-cfcsn-horiz.png"
import Style from "@/styles/loading.module.css";

export const LoadingScreen = () => {
    return (
        <section className={Style.LoadingScreen}>
            <div className={Style.loadingLogo}></div>
            <div className={Style.loading}></div>
        </section>
    )
}

export const Loading = () => {
    return(
        <div className={Style.loading}></div>
    )
}
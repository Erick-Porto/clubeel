import LatestAppointments from "./latest-appointments";
import Cart from "./cart";
import { useCart } from "../../../context/CartContext";
import style from '../../../styles/appointments.module.css'
import { Loading } from "../Common/loading";
import Link from "next/link";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { faCalendarPlus, faChampagneGlasses } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import LightingStatusCard from "../Lighting/LightingStatusCard";
import ReplayNotice from "../Replay/ReplayNotice";
import { faBagShopping } from "@fortawesome/free-solid-svg-icons";
import { moduloVisivel } from "../../../utils/modulos";

const Appointments = () => {
    const { cart, isLoading } = useCart();
    const warning: React.ReactNode = (
        <span>
            Para cancelar um agendamento pago, fale com a secretaria pelo WhatsApp{" "}
            <Link
                href="https://wa.me/5524992510959?text=Olá,%20gostaria%20de%20cancelar%20meu%20agendamento%20de%20quadra."
                target="_blank"
                rel="noopener noreferrer"
                className={style.whatsLink}
            >
                <FontAwesomeIcon icon={faWhatsapp} /> (24) 9 9251-0959
            </Link>.
        </span>
    );

    return (
        <div className={style.appointmentsContainer}>
            <LightingStatusCard />
            <section className={style.appointmentsItem}>
                <h2 className={style.appointmentsTitle}>Agendamentos a finalizar</h2>
                {isLoading ? (
                    <div className={style.loadingContainer}>
                        <Loading />
                        <p>Carregando agendamentos pendentes...</p>
                    </div>
                ) : cart && cart.length > 0 ? (
                    <Cart />
                ) : (
                    <ReplayNotice
                        icon={faBagShopping}
                        title="Nada no carrinho"
                        description="Você não possui agendamentos pendentes de pagamento."
                    />
                )}
            </section>
            <section className={style.appointmentsItem}>
                <h2 className={style.appointmentsTitle}>Locais agendados</h2>
                <LatestAppointments appointmentStatus={1} initialLimit={4} tooltip={warning} />
            </section>
            <section className={style.appointmentsItem}>
                <h2 className={style.appointmentsTitle}>Agendamentos anteriores</h2>
                <LatestAppointments appointmentStatus={10} initialLimit={4} />
            </section>
            {/* Espaços sociais têm fluxo próprio (análise da secretaria, prazo de
                pagamento, lista de convidados): só um atalho para a tela deles. */}
            {moduloVisivel('social') && <section className={style.appointmentsItem}>
                <h2 className={style.appointmentsTitle}>Espaços sociais</h2>
                <p className={style.emptyMessage}>Churrasqueiras e salões têm acompanhamento próprio.</p>
                <div className={style.shortcuts}>
                    <Link href="/espacos-sociais/reservas" className={style.shortcutButton}>
                        <FontAwesomeIcon icon={faChampagneGlasses} /> Minhas reservas sociais
                    </Link>
                    <Link href="/espacos-sociais" className={style.shortcutButton}>
                        <FontAwesomeIcon icon={faCalendarPlus} /> Reservar um espaço
                    </Link>
                </div>
            </section>}
        </div>
    );
};

export default Appointments;

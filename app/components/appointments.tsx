import LatestAppointments from "@/components/latest-appointments";
import Cart from "@/components/cart";
import { useCart } from "@/context/CartContext";
import style from '@/styles/appointments.module.css'
import { Loading } from "./loading"; // Supondo que você tenha um componente de loading
import Link from "next/link";

const Appointments = () => {
    // 1. Obter também o estado de isLoading do contexto do carrinho
    const { cart, isLoading } = useCart();
    const warning: React.ReactNode = (
        <span>
            Para cancelar um agendamento, entre em contato com a secretaria através do whatsapp:<br/>
            <Link
                href="https://wa.me/5524992510959?text=Olá,%20gostaria%20de%20cancelar%20meu%20agendamento%20de%20quadra."
                target="_blank"
                rel="noopener noreferrer"
            > (24) 9 9251-0959</Link>.
        </span>
    );
        
    return (
        <div className={style.appointmentsContainer}>
            <div className={style.appointmentsItem}>
                <h1 className={style.appointmentsTitle}>Agendamentos a finalizar</h1>
                {/* 2. Adicionar lógica para os estados de carregamento e carrinho vazio */}
                {isLoading ? (
                    <div className={style.loadingContainer}>
                        <Loading /> 
                        <p>Carregando agendamentos pendentes...</p>
                    </div>
                ) : cart && cart.length > 0 ? (
                    <Cart />
                ) : (
                    <p className={style.emptyMessage}>Você não possui agendamentos pendentes de pagamento.</p>
                )}
            </div>
            <div className={style.appointmentsItem}>
                <h1 className={style.appointmentsTitle}>Locais Agendados</h1>
                <LatestAppointments appointmentStatus={1} initialLimit={4} tooltip={warning} />
            </div>
            <div className={style.appointmentsItem}>
                <h1 className={style.appointmentsTitle}>Agendamentos Anteriores</h1>
                <LatestAppointments appointmentStatus={10} initialLimit={4} />
            </div>
        </div>
    );
};

export default Appointments;
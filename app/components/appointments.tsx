import LatestAppointments from "@/components/latest-appointments";
import Cart from "@/components/cart";
import { useCart } from "@/context/CartContext";
import style from '@/styles/appointments.module.css'
import { Loading } from "./loading"; // Supondo que você tenha um componente de loading

const Appointments = () => {
    // 1. Obter também o estado de isLoading do contexto do carrinho
    const { cart, isLoading } = useCart();

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
                <LatestAppointments appointmentStatus={1} />
            </div>
            <div className={style.appointmentsItem}>
                <h1 className={style.appointmentsTitle}>Últimos Agendamentos</h1>
                <LatestAppointments appointmentStatus={10} />
            </div>
        </div>
    );
};

export default Appointments;
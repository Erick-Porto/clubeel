import Image from "next/image";
import style from "@/styles/banner.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faIdBadge } from "@fortawesome/free-solid-svg-icons";

// Interfaces
interface UserProps {
    name?: string | null;
    image?: string | null;
    title?: string | null; // Matrícula
}

interface BannerProps {
    user: UserProps | null;
    lastScheduleImage?: string;
}

const Banner = ({ user, lastScheduleImage }: BannerProps) => {
    if (!user) return null;

    // Imagem de Capa: Prioriza a do último agendamento, senão usa um padrão do clube
    const coverImage = lastScheduleImage || '/images/default-cover.jpg'; 
    
    // Avatar: Se não tiver, usa o placeholder
    const avatarImage = user.image || '/images/admin.jpg';

    return(
        <div className={style.bannerContainer}>
            {/* Capa de Fundo */}
            <div className={style.bannerImageWrapper}>
                <Image 
                    src={coverImage} 
                    alt="Capa do perfil"
                    fill
                    priority
                    className={style.bannerImage}
                />
                <div className={style.bannerOverlay}></div>
            </div>

            {/* Conteúdo do Perfil */}
            <div className={style.profileContent}>
                
                {/* Avatar + Botão de Edição */}
                <div className={style.avatarWrapper}>
                    <Image 
                        src={avatarImage} 
                        alt={`Foto de ${user.name}`}
                        width={150}
                        height={150}
                        className={style.avatarImage}
                    />
                    {/* Botão visual de editar (funcionalidade futura) */}
                    <div className={style.editAvatarButton} title="Alterar foto">
                        <FontAwesomeIcon icon={faCamera} style={{fontSize: '14px'}} />
                    </div>
                </div>

                {/* Informações de Texto */}
                <div className={style.userInfo}>
                    <h1 className={style.userName}>{user.name}</h1>
                    
                    {user.title && (
                        <div className={style.userTitle}>
                            <FontAwesomeIcon icon={faIdBadge} />
                            <span>Matrícula: </span>
                            <span className={style.badge}>{user.title}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Banner;
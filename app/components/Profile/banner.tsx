import Image from "next/image";
import style from "../../../styles/banner.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faIdBadge, faUser } from "@fortawesome/free-solid-svg-icons";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Media, initialsOf } from "../UI/ui";

interface BannerProps {
    lastScheduleImage?: string;
}

/**
 * Cabeçalho do perfil: capa (foto do último local agendado; sem ela, a cor do
 * módulo), avatar, nome e matrícula. Sem foto de perfil, o avatar mostra as
 * iniciais — nada de serviço externo de imagem.
 */
const Banner = ({ lastScheduleImage }: BannerProps) => {
    const { data: session } = useSession();
    const [avatarImage, setAvatarImage] = useState<string | null>(null);

    const user = session?.user;

    useEffect(() => {
        const fetchAvatarImage = async () => {
            if (!session?.user?.id || !session?.accessToken){
                    toast.error("Sessão inválida. Por favor, faça login novamente.");
                    return;
                }
            //signOut({ callbackUrl: '/login' });

            // Bug conhecido (docs/resumo-modulos/06-perfil-socio.md): as variáveis
            // abaixo não existem no navegador, então a foto nunca carrega por aqui.
            try {
                const response = await fetch(`${process.env.INTERNAL_LARA_API_URL}/api/image/${session.user.id}`, {
                    method: 'GET',
                    headers: {
                        'Session': session?.accessToken,
                        'Authorization': `Bearer ${process.env.INTERNAL_LARA_API_TOKEN}`,
                        'Accept': 'image/jpeg'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Erro ao carregar imagem: ${response.status}`);
                }

                const blob = await response.blob();

                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });

                setAvatarImage(base64);
            }
            catch {
                toast.error("Foto de perfil não encontrada.");
            }
        };

        if (session?.user?.id) {
            fetchAvatarImage();
        }
    }, [session?.user?.id, session?.accessToken]);

    if (!user) return null;

    const initials = initialsOf(user.name);

    return(
        <div className={style.bannerContainer}>
            <Media src={lastScheduleImage ?? null} area="perfil" ratio="short" alt="Capa do perfil" className={style.bannerImage} icon={faUser} />

            <div className={style.profileContent}>
                <div className={style.avatarWrapper}>
                    {avatarImage ? (
                        <Image
                            src={avatarImage}
                            alt={`Foto de ${user.name?.split(' ')[0]}`}
                            width={96}
                            height={96}
                            unoptimized
                            className={style.avatarImage}
                        />
                    ) : (
                        <span className={style.avatarInitials} aria-hidden>{initials}</span>
                    )}
                </div>

                <div className={style.userInfo}>
                    <h1 className={style.userName}>{user.name}</h1>
                    {user.title && (
                        <div className={style.userTitle}>
                            <FontAwesomeIcon icon={faIdBadge} />
                            <span>Matrícula</span>
                            <span className={style.badge}>{user.title}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Banner;

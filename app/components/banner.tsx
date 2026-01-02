import Image from "next/image";
import style from "@/styles/banner.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faIdBadge } from "@fortawesome/free-solid-svg-icons";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

interface BannerProps {
    lastScheduleImage?: string;
}

const Banner = ({ lastScheduleImage }: BannerProps) => {
    const { data: session } = useSession();
    const [avatarImage, setAvatarImage] = useState('/images/default-avatar.png');

    const user = session?.user;

    useEffect(() => {
        const fetchAvatarImage = async () => {
            if (!session?.user?.id || !session?.accessToken) return;

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
            catch (error) {
                toast.error("Erro ao buscar avatar: " + (error instanceof Error ? error.message : String(error)));
            }
        };

        if (session?.user?.id) {
            fetchAvatarImage();
        }
    }, [session?.user?.id, session?.accessToken]);

    if (!user) return null;

    const coverImage = lastScheduleImage || '/images/default-cover.jpg'; 

    return(
        <div className={style.bannerContainer}>
            <div className={style.bannerImageWrapper}>
                <Image 
                    src={coverImage} 
                    alt="Capa do perfil"
                    fill
                    priority={true}
                    quality={100}
                    className={style.bannerImage}
                />
                <div className={style.bannerOverlay}></div>
            </div>

            <div className={style.profileContent}>
                <div className={style.avatarWrapper}>
                    <Image 
                        src={avatarImage}
                        alt={`Foto de ${user.name?.split(' ')[0]}`}
                        width={150}
                        height={150}
                        unoptimized
                        className={style.avatarImage}
                    />
                </div>

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
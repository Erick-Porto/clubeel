import { useState, useEffect } from "react";
import style from "@/styles/profile.module.css";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTimes, faSpinner, faLock } from "@fortawesome/free-solid-svg-icons";
import { useSession } from "next-auth/react"; 
import API_CONSUME from "@/services/api-consume";
import CryptoJS from "crypto-js";

interface FormData {
    name: string;
    email: string;
    telephone: string;
    cpf: string;
    title: string;
}

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string) => Promise<void>;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [password, setPassword] = useState("");
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) return toast.error("Insira sua senha.");
        
        setIsConfirming(true);
        try {
            await onConfirm(password);
            setPassword("");
        } catch (error) {
            toast.error("Erro no modal: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsConfirming(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={style.modalOverlay} onClick={onClose}>
            <div className={style.modalContent} onClick={e => e.stopPropagation()}>
                <div style={{marginBottom: 15, color: 'var(--grena)'}}>
                    <FontAwesomeIcon icon={faLock} size="2x" />
                </div>
                <h2 className={style.modalTitle}>Confirme sua senha</h2>
                <p className={style.modalText}>Para salvar estas alterações, precisamos verificar que é você.</p>
                
                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap: 15}}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={style.formInput}
                        placeholder="Senha atual"
                        autoFocus
                    />
                    <div style={{display:'flex', gap: 10}}>
                        <button type="button" className={style.secondaryButton} onClick={onClose} style={{flex:1}}>
                            Cancelar
                        </button>
                        <button type="submit" className={style.primaryButton} disabled={isConfirming} style={{flex:1}}>
                            {isConfirming ? <FontAwesomeIcon icon={faSpinner} spin /> : "Confirmar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const ProfileForm = () => {
    const { data: session, update: updateSession } = useSession();
    const [isEditable, setIsEditable] = useState(false);
    const [modalState, setModalState] = useState(false);
    
    const [formData, setFormData] = useState<FormData>({
        name: "", email: "", telephone: "", cpf: "", title: ""
    });

    useEffect(() => {
        if (session?.user) {
            setFormData({
                name: session.user.name || "",
                email: session.user.email || "",
                telephone: session.user.telephone || "",
                cpf: session.user.cpf || "",
                title: session.user.title || "",
            });
        }
    }, [session?.user]); 

    const enableEdit = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsEditable(true);
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setModalState(true);
    };

    const handleUpdateProfile = async (currentPassword: string) => {
        if (!session?.accessToken) throw new Error("Sessão inválida.");

        try {
            const cpfClean = formData.cpf.replace(/\D/g, ''); 
            const encryptedPassword = CryptoJS.SHA256(currentPassword).toString();

            const loginResponse = await API_CONSUME("POST", "login", {}, {
                login: cpfClean,
                password: encryptedPassword
            });

            if (!loginResponse.ok) {
                throw new Error("Senha incorreta");
            }

            const updateResponse = await API_CONSUME("PUT", `member/update`, {}, {
                cpf: cpfClean,
                email: formData.email,
                telephone: formData.telephone
            });

            if (!updateResponse.ok) {
                throw new Error(updateResponse.message || "Erro ao atualizar dados.");
            }

            toast.success("Perfil atualizado com sucesso!");
            
            await updateSession({
                ...session,
                user: { ...session.user, email: formData.email, telephone: formData.telephone }
            });
            setModalState(false);
            setIsEditable(false);

        } catch (error: unknown) {
            toast.error("Erro update profile: " + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleCancelEdit = () => {
        setIsEditable(false);
        if (session?.user) {
            setFormData({
                name: session.user.name || "",
                email: session.user.email || "",
                telephone: session.user.telephone || "",
                cpf: session.user.cpf || "",
                title: session.user.title || "",
            });
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className={style.formContainer}>
            <h2 className={style.sectionTitle}>Dados Pessoais</h2>
            <form onSubmit={handleFormSubmit}>
                <div className={style.formGrid}>
                    <div className={`${style.formGroup} ${style.fullWidth}`}>
                        <label className={style.formLabel}>Nome Completo</label>
                        <input className={style.formInput} value={formData.name} disabled />
                    </div>
                    
                    <div className={style.formGroup}>
                        <label className={style.formLabel}>CPF</label>
                        <input className={style.formInput} value={formData.cpf} disabled />
                    </div>
                    
                    <div className={style.formGroup}>
                        <label className={style.formLabel}>Matrícula</label>
                        <input className={style.formInput} value={formData.title} disabled />
                    </div>

                    <div className={style.formGroup}>
                        <label className={style.formLabel}>Email</label>
                        <input 
                            className={style.formInput} 
                            name="email" 
                            type="email"
                            value={formData.email} 
                            onChange={handleChange} 
                            disabled={!isEditable} 
                            required
                        />
                    </div>

                    <div className={style.formGroup}>
                        <label className={style.formLabel}>Telefone</label>
                        <input 
                            className={style.formInput} 
                            name="telephone" 
                            value={formData.telephone} 
                            onChange={handleChange} 
                            disabled={!isEditable} 
                            required
                        />
                    </div>

                    <div className={style.actionButtons}>
                        {!isEditable ? (
                            <button 
                                type="button" 
                                className={style.primaryButton} 
                                onClick={enableEdit}
                            >
                                Editar Dados
                            </button>
                        ) : (
                            <>
                                <button type="submit" className={style.primaryButton}>Salvar</button>
                                <button type="button" className={style.secondaryButton} onClick={handleCancelEdit}>Cancelar</button>
                            </>
                        )}
                    </div>
                </div>
            </form>
            <Modal isOpen={modalState} onClose={() => setModalState(false)} onConfirm={handleUpdateProfile} />
        </div>
    );
}

export const PasswordForm = () => {
    const { data: session } = useSession();
    const [modalState, setModalState] = useState(false);
    const [passwords, setPasswords] = useState({ new1: "", new2: "" });
    const [rules, setRules] = useState({ length: false, uppercase: false, lowercase: false, number: false, special: false });
    
    const passwordsMatch = passwords.new1 !== "" && passwords.new1 === passwords.new2;
    const allRulesMet = Object.values(rules).every(Boolean);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setPasswords(prev => ({ ...prev, [e.target.name]: val }));

        if (e.target.name === 'new1') {
            setRules({
                length: val.length >= 8,
                uppercase: /[A-Z]/.test(val),
                lowercase: /[a-z]/.test(val),
                number: /[0-9]/.test(val),
                special: /[!@#$%¨&*\-_=+§£¢¬]/.test(val),
            });
        }
    };

const handleUpdate = async (currentPassword: string) => {
        if (!session?.accessToken) throw new Error("Sessão inválida.");
        
        try {
            const cpfClean = (session?.user?.cpf || "").replace(/\D/g, '');
            const encryptedCurrent = CryptoJS.SHA256(currentPassword).toString();
            
            // 1. Validação via Login
            const loginResponse = await API_CONSUME("POST", "login", {}, {
                login: cpfClean,
                password: encryptedCurrent,
            });

            if (!loginResponse.ok) {
                throw new Error("Senha atual incorreta.");
            }

            // 2. Update da Senha
            const updateResponse = await API_CONSUME("PUT", `change-password`, {}, { 
                cpf: cpfClean,
                new_password: CryptoJS.SHA256(passwords.new1).toString() 
            });

            if (!updateResponse.ok) {
                throw new Error(updateResponse.message || "Erro ao alterar senha.");
            }

            toast.success("Senha alterada!");
            setRules({
                length: false, uppercase: false, lowercase: false, number: false, special: false,
            });
            setModalState(false);
            setPasswords({ new1: "", new2: "" });

        } catch (error: unknown) {
            toast.error("Erro update password: " + (error instanceof Error ? error.message : String(error)));
        }
    };

    return (
        <div className={style.formContainer}>
            <h2 className={style.sectionTitle}>Alterar Senha</h2>
            
            <div className={style.passwordRulesContainer}>
                <ul className={style.rulesList}>
                    <li className={`${style.ruleBadge} ${rules.length ? style.ruleMet : ''}`}>
                        <FontAwesomeIcon icon={rules.length ? faCheck : faTimes} /> Min. 8 caracteres
                    </li>
                    <li className={`${style.ruleBadge} ${rules.uppercase ? style.ruleMet : ''}`}>
                        <FontAwesomeIcon icon={rules.uppercase ? faCheck : faTimes} /> Maiúscula
                    </li>
                    <li className={`${style.ruleBadge} ${rules.lowercase ? style.ruleMet : ''}`}>
                        <FontAwesomeIcon icon={rules.lowercase ? faCheck : faTimes} /> Minúscula
                    </li>
                    <li className={`${style.ruleBadge} ${rules.number ? style.ruleMet : ''}`}>
                        <FontAwesomeIcon icon={rules.number ? faCheck : faTimes} /> Número
                    </li>
                    <li className={`${style.ruleBadge} ${rules.special ? style.ruleMet : ''}`}>
                        <FontAwesomeIcon icon={rules.special ? faCheck : faTimes} /> Especial
                    </li>
                    <li className={`${style.ruleBadge} ${passwordsMatch ? style.ruleMet : ''}`}>
                        <FontAwesomeIcon icon={passwordsMatch ? faCheck : faTimes} /> Senhas iguais
                    </li>
                </ul>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setModalState(true); }}>
                <div className={style.formGrid}>
                    <div className={style.formGroup}>
                        <label className={style.formLabel}>Nova Senha</label>
                        <input 
                            type="password" 
                            className={style.formInput} 
                            name="new1" 
                            value={passwords.new1} 
                            onChange={handleChange} 
                        />
                    </div>
                    <div className={style.formGroup}>
                        <label className={style.formLabel}>Confirme a Nova Senha</label>
                        <input 
                            type="password" 
                            className={style.formInput} 
                            name="new2" 
                            value={passwords.new2} 
                            onChange={handleChange} 
                            disabled={!allRulesMet}
                        />
                    </div>
                    
                    <div className={style.actionButtons}>
                        <button 
                            type="submit" 
                            className={style.primaryButton} 
                            disabled={!allRulesMet || !passwordsMatch}
                        >
                            Atualizar Senha
                        </button>
                    </div>
                </div>
            </form>
            <Modal isOpen={modalState} onClose={() => setModalState(false)} onConfirm={handleUpdate} />
        </div>
    );
}
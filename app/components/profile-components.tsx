import { useState, useEffect } from "react";
import style from "@/styles/profile.module.css";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useUser } from '@/context/UserContext';

export const Modal = ({ modalState, setModalState }: { modalState: boolean; setModalState: React.Dispatch<React.SetStateAction<boolean>> }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setModalState(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [setModalState]);

    return (
        <>
            <div style={modalState ? { display: 'block' } : { display: 'none' }} className={style.confirmationFormContainer}>
            </div>
            <div style={modalState ? { display: 'block' } : { display: 'none' }} className={style.confirmationFormContent}>
                <h1 className={style.confirmationFormTitle}>Confirme sua senha</h1>
                <p className={style.confirmationFormText}>É necessário que confirme sua senha para alterar seus dados.</p>
                <form action="" className={style.confirmationForm}>
                    <input type="password" className={style.formItemInput} />
                    <input type="submit" value="Confirmar" className={style.formItemButton} />
                </form>
            </div>
        </>
    );
};

const sendData = async (
    event: React.FormEvent<HTMLFormElement>,
    formData: { [key: string]: string },
    setModalState: React.Dispatch<React.SetStateAction<boolean>>,
    isEditable: boolean
) => {
    event.preventDefault();
    if (!isEditable) {
        setModalState(true); // Open the modal only when the button text is "Salvar"
    }
};

export const ProfileForm = () => {
    const { User, setUser } = useUser();
    const [isEditable, setIsEditable] = useState(true);
    const [modalState, setModalState] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        telephone: "",
        cpf: "",
        title: "",
        barcode: "",
        password: "************"
    });

    useEffect(() => {
        if (User) {
            setFormData({
                name: User.name,
                email: User.email,
                telephone: User.telephone,
                cpf: User.cpf,
                title: User.title,
                barcode: User.barcode,
                password: "************"
            });
        }
    }, [User]);

    const handleToEdit = () => {
        setIsEditable(!isEditable);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    };

    return (
        <div className={style.formContainer}>
            <h1 className={style.formTitle}>Dados do perfil</h1>
            <form className={style.formContent} onSubmit={(e) => sendData(e, formData, setModalState, isEditable)}>
                <div className={style.formItem}>
                    <label className={style.formItemLabel} htmlFor="cpf">cpf</label>
                    <input className={style.formItemInput} type="cpf" id="cpf" name="cpf" value={formData.cpf} disabled />
                </div>
                <div className={style.formItem}>
                    <label className={style.formItemLabel} htmlFor="matricula">matricula</label>
                    <input className={style.formItemInput} type="matricula" id="matricula" name="matricula" value={formData.title} disabled />
                </div>
                <div className={style.formItem} style={{ gridRow: "2", gridColumn: "1 / 3" }}>
                    <label className={style.formItemLabel} htmlFor="name">nome</label>
                    <input className={style.formItemInput} type="text" id="name" name="name" value={formData.name} disabled />
                </div>
                <div className={style.formItem}>
                    <label className={style.formItemLabel} htmlFor="email">email</label>
                    <input className={style.formItemInput} type="email" id="email" name="email" onChange={handleChange} value={formData.email} disabled={isEditable} required />
                </div>
                <div className={style.formItem}>
                    <label className={style.formItemLabel} htmlFor="telefone">telefone</label>
                    <input className={style.formItemInput} type="text" id="telefone" name="telefone" onChange={handleChange} value={formData.telephone} disabled={isEditable} required />
                </div>
                <div className={style.formItem}>
                    {isEditable ? (
                        <></>
                    ) : (
                        <input type="button" className={isEditable ? style.formItemButton : style.cancelItemButton} onClick={handleToEdit} value={isEditable ? "atualizar dados" : "cancelar edição"} />
                    )}
                </div>
                <div className={style.formItem}>
                    {isEditable ? (
                        <input type="button" className={isEditable ? style.formItemButton : style.cancelItemButton} onClick={handleToEdit} value={isEditable ? "atualizar dados" : "cancelar edição"} />
                    ) : (
                        <input type="submit" className={style.formItemButton} disabled={isEditable} value={"salvar dados"} />
                    )}
                </div>
            </form>
            <Modal modalState={modalState} setModalState={setModalState} />
        </div>
    );
}

export const PasswordForm = () => {
    const [isEditable, setIsEditable] = useState({ state: false, message: "" });
    const [modalState, setModalState] = useState(false);
    const [passwordRules, setPasswordRules] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false,
        repeatable: false,
    });

    const [formData, setFormData] = useState({
        nova_senha_1: "",
        nova_senha_2: ""
    });

    const handleToEdit = (s: boolean, m: string) => setIsEditable({ state: s, message: m });
    

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        const unavailableChars = /[^a-zA-Z0-9!@#$%¨&*\-_=+§£¢¬(){}[\]]/.test(value);

        if (value.length > 0 && unavailableChars) {
            toast.error(`A senha não pode conter o caracter: ${value[value.length - 1]}`);
            event.target.value = value.slice(0, -1);
            setFormData((prevData) => ({ ...prevData, [name]: value }));
            return;
        } else {
            setFormData((prevData) => ({ ...prevData, [name]: value }));
        }

        if (name === "nova_senha_1") {
            const password = value;

            const hasUppercase = /[A-Z]/.test(password);
            const hasLowercase = /[a-z]/.test(password);
            const hasNumber = /[0-9]/.test(password);
            const hasSpecialChar = /[!@#$%¨&*\-_=+§£¢¬]/.test(password);
            const hasMinLength = password.length >= 8;

            setPasswordRules({
                uppercase: hasUppercase,
                lowercase: hasLowercase,
                number: hasNumber,
                special: hasSpecialChar,
                length: hasMinLength,
                repeatable: false,
            });
        }

        // Check if passwords match
        if (name === "nova_senha_2") {
            const repeatable = formData.nova_senha_1 === value;

            setPasswordRules({
                ...passwordRules,
                repeatable: repeatable,
            })
        }
    };

    return (
        <div className={style.formContainer}>
            <h1 className={style.formTitle}>Senha</h1>
            <form className={style.formContent}
            style={ isEditable.message === 'rules' ? {gridTemplate:'70px 1fr 70px / 1fr 1fr'} : { }}
            onSubmit={(e) => sendData(e, formData, setModalState, false)}>
                {isEditable.state === true && isEditable.message === "rules" ? (
                    <div className={`${style.formItem} ${style.formItemVisible}`} style={{ transition: 'all .3s ease-in-out', gridRow: "2 / 3", gridColumn: "1 / 3" }}>
                        <div className={style.formItemInput} id="password_rules" style={{ cursor: 'default', border: 'none' }}>
                            <ul className={style.passwordRules}>
                                <li style={{...(passwordRules.length ? { color: 'green' } : {})}}>
                                    <FontAwesomeIcon style={{ marginRight: '5px' }} icon={passwordRules.length ? faCheck : faXmark} />Oito ou mais caracteres
                                </li>
                                <li style={{...(passwordRules.uppercase ? { color: 'green' } : {})}}>
                                    <FontAwesomeIcon style={{ marginRight: '5px' }} icon={passwordRules.uppercase ? faCheck : faXmark} />Uma letra maiúscula
                                </li>
                                <li style={{...(passwordRules.lowercase ? { color: 'green' } : {})}}>
                                    <FontAwesomeIcon style={{ marginRight: '5px' }} icon={passwordRules.lowercase ? faCheck : faXmark} />Uma letra minúscula
                                </li>
                                <li style={{...(passwordRules.number ? { color: 'green' } : {})}}>
                                    <FontAwesomeIcon style={{ marginRight: '5px' }} icon={passwordRules.number ? faCheck : faXmark} />Um número
                                </li>
                                <li style={{...(passwordRules.special ? { color: 'green' } : {})}}>
                                    <FontAwesomeIcon style={{ marginRight: '5px' }} icon={passwordRules.special ? faCheck : faXmark} />Um caractere especial
                                </li>
                            </ul>
                        </div>
                    </div>
                ) : isEditable.state && isEditable.message === "repeat" ? (
                    <div className={`${style.formItem} ${style.formItemVisible}`} style={{ transition: 'all .3s ease-in-out', gridRowStart: 2, gridColumnStart: 1 }}>
                        <div className={style.formItemInput} id="password_rules" style={{ cursor: 'default', border: 'none' }}>
                            <ul className={style.passwordRules}>
                                <li style={{ flexWrap: 'nowrap', wordBreak: 'keep-all', whiteSpace: 'nowrap',
                                    ...(passwordRules.repeatable ? { color: 'green' } : {})
                                }}>
                                    <FontAwesomeIcon style={{ marginRight: '5px' }} icon={passwordRules.repeatable ? faCheck : faXmark} />As senhas devem coincidir
                                </li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <></>
                )}

                <div className={style.formItem}>
                    <label className={style.formItemLabel} htmlFor="nova_senha_1">nova senha</label>
                    <input
                        className={style.formItemInput}
                        onFocus={() => handleToEdit(true, "rules")}
                        onBlur={() => handleToEdit(false, "rules")}
                        type="password"
                        id="nova_senha_1"
                        name="nova_senha_1"
                        onChange={
                            handleChange
                        }
                        required
                    />
                </div>

                <div
                    className={style.formItem}
                >
                    <label className={style.formItemLabel} htmlFor="nova_senha_2">repita nova senha</label>
                    <input
                        className={style.formItemInput}
                        type="password"
                        onFocus={
                            () => handleToEdit(true, "repeat")
                        }
                        onBlur={
                            () => handleToEdit(false, "repeat")
                        }
                        disabled={
                            passwordRules.length &&
                            passwordRules.uppercase &&
                            passwordRules.lowercase &&
                            passwordRules.number &&
                            passwordRules.special ?
                            false : true
                        }
                        id="nova_senha_2"
                        name="nova_senha_2"
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className={`${style.formItem} ${passwordRules.repeatable ? style.slideDown : ''}`} style={{ gridColumnStart: 2, ...(passwordRules.repeatable ? { gridRowStart: 2 } : {}) }}>
                    <input
                        type="submit"
                        className={style.formItemButton}
                        value={"salvar senha"}
                    />
                </div>
            </form>
        </div>
    );
}

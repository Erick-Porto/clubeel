import styles from "../../../styles/footer.module.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebookSquare, faInstagramSquare, faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { faEnvelope, faPhone } from '@fortawesome/free-solid-svg-icons';
import Image from 'next/image';
import { comBase } from '../../../utils/base-path';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerBody}>
        <div className={styles.footerInfo}>
          <div className={styles.footerLogo}>
            <Image
              src={comBase("/images/logo-cfcsn-horiz.png")}
              alt="Clube dos Funcionários"
              width={220}
              height={88}
              quality={100}
              className={styles.logoLight}
            />
            <Image
              src={comBase("/images/logo-cfcsn-w-horiz.png")}
              alt="Clube dos Funcionários"
              width={220}
              height={88}
              quality={100}
              className={styles.logoDark}
            />
          </div>
          <div className={styles.contactInfo}>
            <p>
              <FontAwesomeIcon icon={faPhone} />
              <span>Telefone</span>
              <a rel="noopener noreferrer" href="tel:+552421022750" className={styles.mono}>(24) 2102-2750</a>
            </p>
            <p>
              <FontAwesomeIcon icon={faWhatsapp} />
              <span>WhatsApp</span>
              <a rel="noopener noreferrer" href="https://wa.me/5524992510959" target="_blank" className={styles.mono}>(24) 99251-0959</a>
            </p>
            <p>
              <FontAwesomeIcon icon={faEnvelope} />
              <span>E-mail</span>
              <a rel="noopener noreferrer" href="mailto:atendimento@clubedosfuncionarios.com.br">atendimento@clubedosfuncionarios.com.br</a>
            </p>
          </div>
        </div>

        <div className={styles.footerSocial}>
          <h2>Redes sociais</h2>
          <div className={styles.socialIcons}>
            <a target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/clubedosfuncionarios/" aria-label="Facebook">
              <FontAwesomeIcon icon={faFacebookSquare} />
            </a>
            <a target="_blank" rel="noopener noreferrer" href="https://www.instagram.com/clubedosfuncionarios/" aria-label="Instagram">
              <FontAwesomeIcon icon={faInstagramSquare} />
            </a>
          </div>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <p>
          Desenvolvido por <a rel="noopener noreferrer" href="https://linkedin.com/in/erick-porto" target="_blank">Erick Porto</a> e <a rel="noopener noreferrer" href="https://linkedin.com/in/gustavo-alves-81895321a" target="_blank">Gustavo Alves</a> · &copy; {currentYear} Clube dos Funcionários
        </p>
      </div>
    </footer>
  );
}

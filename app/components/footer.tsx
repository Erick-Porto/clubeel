import styles from "@/styles/footer.module.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebookSquare, faInstagramSquare, faLinkedin } from '@fortawesome/free-brands-svg-icons';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerBody}>
        <div className={styles.footerInfo}>
          <div className={styles.footerLogo}>
            <Image 
              src="/images/logo-cfcsn-w-horiz.png" 
              alt="Clube dos Funcionários" 
              fill
              style={{ objectFit: 'contain' }}
            />
          </div>
          <div className={styles.contactInfo}>
            <p>Telefone: <a href="tel:+552421022750">(24) 2102-2750</a></p>
            <p>Email: <a href="mailto:atendimento@clubedosfuncionarios.com.br">atendimento@clubedosfuncionarios.com.br</a></p>
          </div>
        </div>

        <div className={styles.footerSocial}>
          <h2>Redes Sociais</h2>
          <div className={styles.socialIcons}>
            <a target="_blank" href="https://www.facebook.com/clubedosfuncionarios/" aria-label="Facebook">
              <FontAwesomeIcon icon={faFacebookSquare} />
            </a>
            <a target="_blank" href="https://www.instagram.com/clubedosfuncionarios/" aria-label="Instagram">
              <FontAwesomeIcon icon={faInstagramSquare} />
            </a>
            <a target="_blank" href="https://www.linkedin.com/" aria-label="LinkedIn">
              <FontAwesomeIcon icon={faLinkedin} />
            </a>
          </div>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <p>
          Desenvolvido por <a href="https://linkedin.com/in/erick-porto" target="_blank">Erick Porto</a> e <a href="https://linkedin.com/in/gustavo-alves-81895321a" target="_blank">Gustavo Alves</a> | &copy; {currentYear} Clube dos Funcionários
        </p>
      </div>
    </footer>
  );
}
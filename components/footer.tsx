import styles from "@/styles/footer.module.css";
import Image from "next/image";
import logo from "@/images/logo-branca.png"; // Corrigido o caminho da imagem do logo
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebookSquare, faInstagramSquare, faLinkedin } from '@fortawesome/free-brands-svg-icons';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerBody}>
        <div className={styles.footerBodyItem}>
          <Image src={logo} alt="Logo do Clube dos Funcionarios" width={150} height={75} />
          <p>Telefone: <a href="tel:+552421022750"> (24) 2102-2750 </a></p>
          <p>Email: <a href="mailto:atendimento@clubedosfuncionarios.com.br"> atendimento@clubedosfuncionarios.com.br </a></p>
        </div>
        <div className={styles.footerBodyItem}>
          <h2>Redes Sociais</h2>
          <div className={styles.socialMedia}>
            <a target="_blank" href="https://www.facebook.com/clubedosfuncionarios/">
              <FontAwesomeIcon icon={faFacebookSquare} className="fa-fw" />
            </a>
            <a target="_blank" href="https://www.instagram.com/clubedosfuncionarios/">
              <FontAwesomeIcon icon={faInstagramSquare} className="fa-fw" />
            </a>
            <a target="_blank" href="https://www.linkedin.com/company/clube-dos-funcionarios/">
              <FontAwesomeIcon icon={faLinkedin} className="fa-fw" />
            </a>
          </div>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <p>
          Desenvolvido por <a target="_blank" href="https://www.linkedin.com/in/erick-porto">Erick Porto</a> e <a target="_blank" href="https://www.linkedin.com/in/gustavo-alves-81895321a/">Gustavo Alves</a> | &copy; 2025 Clube dos Funcionários
        </p>
      </div>
    </footer>
  );
}
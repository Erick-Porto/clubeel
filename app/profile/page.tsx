'use client'
import withAuth from "../components/auth";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { ProfileForm, PasswordForm, Modal } from "@/components/profile-components";
import globalStyle from '@/styles/page.module.css';

const ProfilePage = () => {
    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={-1} onlyScroll={false}/>
                <section className={globalStyle.Section} style={{ paddingBottom: "20px" }}>
                    <Modal />
                    <ProfileForm/>
                    <PasswordForm/>
                </section>
            <Footer/>
        </div>
    );
}

export default withAuth(ProfilePage);
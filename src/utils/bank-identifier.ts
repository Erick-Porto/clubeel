import styles from "@/styles/payment-selector.module.css";

interface BankResult {
    name: string;
    styleClass: string;
    scheme: string;
}

export const identifyBank = (cardNumber: string): BankResult => {
    const cleanNumber = cardNumber.replace(/\D/g, "");
    
    const result: BankResult = { name: "CFCSN", styleClass: "", scheme: "" };

    if (/^4/.test(cleanNumber)) result.scheme = "VISA";
    else if (/^5[1-5]/.test(cleanNumber)) result.scheme = "MASTERCARD";
    else if (/^3[47]/.test(cleanNumber)) result.scheme = "AMEX";
    else if (/^60/.test(cleanNumber)) result.scheme = "ELO";

    if (/^5(50209|48654|23473|36598)/.test(cleanNumber) || /^516292/.test(cleanNumber)) {
        result.name = "NUBANK";
        result.styleClass = styles.nubank;
    }
    else if (/^4(05918|06660)/.test(cleanNumber) || /^5(20034|54452)/.test(cleanNumber)) {
        result.name = "INTER";
        result.styleClass = styles.inter;
    }
    else if (/^4(02400|91630|60005)/.test(cleanNumber) || /^5(45582|54923)/.test(cleanNumber)) {
        result.name = "ITAÚ";
        result.styleClass = styles.itau;
    }
    else if (/^4(00282|06655)/.test(cleanNumber) || /^5(44731|22865)/.test(cleanNumber)) {
        result.name = "BRADESCO";
        result.styleClass = styles.bradesco;
    }
    else if (/^4(10480|22066)/.test(cleanNumber) || /^5(22841|42852)/.test(cleanNumber)) {
        result.name = "SANTANDER";
        result.styleClass = styles.santander;
    }
    else if (/^4(98401|98406)/.test(cleanNumber)) {
        result.name = "BB";
        result.styleClass = styles.bb;
    }
    else if (/^400686/.test(cleanNumber)) {
        result.name = "NEON";
        result.styleClass = styles.neon;
    }
    
    else if (result.scheme === "MASTERCARD" && cleanNumber.startsWith('5149')) {
        result.name = "BLACK";
        result.styleClass = styles.black;
    }

    return result;
};
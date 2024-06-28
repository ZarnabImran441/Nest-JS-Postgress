export class Format {
    public static isValidEmail(email: string): boolean {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
        return emailRegex.test(email);
    }
    public static isValidWebsite(website: string): boolean {
        const websiteRegex =
            /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i;
        return websiteRegex.test(website);
    }
    public static isValidNumber(value: string): boolean {
        return !!Number(value);
    }
}

import { getRequestConfig } from "next-intl/server";
import { IntlErrorCode } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale;

    // Ensure that a valid locale is used
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale;
    }

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default,
        onError(error) {
            if (error.code === IntlErrorCode.MISSING_MESSAGE) return; // quiet during demo
            console.error(error);
        },
        getMessageFallback({ key }) {
            const leaf = key.split('.').pop() ?? key;
            return leaf.replace(/^th/, '').replace(/([A-Z])/g, ' $1').trim();
        },
    };
});

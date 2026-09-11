"use client";

export function HospitalMap() {
    return (
        <div className="relative w-full h-[200px] mt-4 rounded-xl overflow-hidden border dark:border-white/10 shadow-inner">
            <iframe
                src="https://www.google.com/maps/embed?pb=!1m16!1m12!1m3!1d112349.52932357321!2d77.1009104!3d28.5284352!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!2m1!1shospital!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                width="100%"
                height="100%"
                style={{ border: 0, filter: "brightness(0.9) contrast(1.1) saturate(1.2)" }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="dark:invert-[90%] dark:hue-rotate-180 dark:brightness-75"
            ></iframe>
        </div>
    );
}

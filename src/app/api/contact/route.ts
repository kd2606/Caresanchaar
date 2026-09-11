import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        const { fullName, organization, role, email, location, enquiryType, message, consent } = body;

        // Basic validation
        if (!fullName || !email || !message || !enquiryType || !consent) {
            return NextResponse.json({ error: 'Missing required fields or consent' }, { status: 400 });
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }

        const enquiry = {
            fullName,
            organization: organization || '',
            role: role || '',
            email,
            location: location || '',
            enquiryType,
            message,
            consent,
            createdAt: FieldValue.serverTimestamp(),
            status: 'new'
        };

        // Prevent duplicate submissions by generating a deterministic hash or simply relying on Firestore auto ID 
        // if rate limiting is not strictly defined here, we will just store it.
        await adminDb()!.collection('contact_enquiries').add(enquiry);

        try {
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: Number(process.env.EMAIL_PORT) || 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: 'amitykrrish@gmail.com',
                subject: `New Enquiry from ${fullName}: ${enquiryType}`,
                text: `Name: ${fullName}\nEmail: ${email}\nOrganization: ${organization || 'N/A'}\nRole: ${role || 'N/A'}\nLocation: ${location || 'N/A'}\nEnquiry Type: ${enquiryType}\n\nMessage:\n${message}`,
            };

            await transporter.sendMail(mailOptions);
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
            // Non-blocking
        }

        return NextResponse.json({ success: true, message: 'Enquiry received successfully.' }, { status: 200 });

    } catch (error: any) {
        console.error('Contact API error:', error);
        return NextResponse.json({ error: 'Internal server error processing enquiry' }, { status: 500 });
    }
}

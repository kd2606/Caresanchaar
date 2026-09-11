'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ContactPage() {
    const [formData, setFormData] = useState({
        fullName: '',
        organization: '',
        role: '',
        email: '',
        location: '',
        enquiryType: '',
        message: '',
        consent: false
    });
    
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.fullName || !formData.email || !formData.message || !formData.enquiryType || !formData.consent) {
            setErrorMsg('Please fill in all required fields and consent to submit.');
            setStatus('error');
            return;
        }

        setStatus('loading');
        setErrorMsg('');

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to submit enquiry');
            }

            setStatus('success');
            setFormData({
                fullName: '',
                organization: '',
                role: '',
                email: '',
                location: '',
                enquiryType: '',
                message: '',
                consent: false
            });
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message || 'An error occurred. Please try again.');
        }
    };

    if (status === 'success') {
        return (
            <div className="container mx-auto max-w-2xl py-16 px-4 text-center">
                <div className="p-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h2 className="text-2xl font-bold text-green-800 dark:text-green-400 mb-4">Thank you. Your enquiry has been received.</h2>
                    <p className="text-green-700 dark:text-green-500">Our team will review it and respond through the contact details provided.</p>
                    <Button className="mt-8" onClick={() => setStatus('idle')} variant="outline">Submit Another Enquiry</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-2xl py-16 px-4">
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">Contact CareSanchaar</h1>
            <p className="text-muted-foreground mb-8">Reach out to our team regarding deployment, partnerships, or support.</p>
            
            <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 rounded-lg border border-border shadow-sm">
                
                {status === 'error' && (
                    <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
                        {errorMsg}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name *</Label>
                        <Input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} required disabled={status === 'loading'} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required disabled={status === 'loading'} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="organization">Organization</Label>
                        <Input id="organization" name="organization" value={formData.organization} onChange={handleChange} disabled={status === 'loading'} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">Role / Designation</Label>
                        <Input id="role" name="role" value={formData.role} onChange={handleChange} disabled={status === 'loading'} />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="location">State/District</Label>
                    <Input id="location" name="location" value={formData.location} onChange={handleChange} disabled={status === 'loading'} />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="enquiryType">Enquiry Type *</Label>
                    <Select value={formData.enquiryType} onValueChange={(v) => handleSelectChange('enquiryType', v)} disabled={status === 'loading'}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select enquiry type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="partnership">Partnership / Deployment</SelectItem>
                            <SelectItem value="technical_support">Technical Support</SelectItem>
                            <SelectItem value="feedback">Feedback</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea id="message" name="message" value={formData.message} onChange={handleChange} rows={5} required disabled={status === 'loading'} />
                </div>

                <div className="flex items-start space-x-3 pt-2">
                    <input 
                        type="checkbox" 
                        id="consent" 
                        name="consent" 
                        checked={formData.consent} 
                        onChange={handleChange} 
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        required
                        disabled={status === 'loading'}
                    />
                    <Label htmlFor="consent" className="text-sm font-normal text-muted-foreground leading-snug">
                        I consent to CareSanchaar processing my information to respond to this enquiry. *
                    </Label>
                </div>

                <Button type="submit" className="w-full" disabled={status === 'loading'}>
                    {status === 'loading' ? 'Submitting...' : 'Submit Enquiry'}
                </Button>
            </form>
        </div>
    );
}

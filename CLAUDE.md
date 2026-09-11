Copy and use the following prompt in your preferred AI coding assistant to recreate this exact application.

---

**Prompt:**

Build a comprehensive health diagnostic and tracking web application called **"PulseCheck AI"** using **Next.js 15 (App Router)**, **Tailwind CSS**, **ShadCN UI**, and **Firebase**. The application is specifically designed for rural health accessibility and must support **i18n (Internationalization)** for **English, Hindi, and Chhattisgarhi**.

### Technical Stack:
- **Frontend**: React 19, Next.js 15, Lucide Icons, Recharts for data visualization.
- **Backend**: Firebase (Authentication with Google and Phone/+91 provider, Firestore for data).
- **AI**: Google Genkit for Generative AI flows (using Gemini 2.5 Flash).
- **Styling**: Tailwind CSS with a professional ShadCN UI theme supporting Light and Dark modes.

### Core Features & Logic:

1. **Authentication & User Management**:
   - Support Google Sign-In and Phone Number verification (targeting India, +91).
   - Sync user profiles to a `users` collection in Firestore.
   - Allow users to manage "People" (family members) with properties: Name, Relationship.

2. **Personalized Health Dashboard**:
   - A "Personalized Health Overview" form capturing Age, Gender, and Lifestyle (Smoker, Sedentary, Active, High-Stress, Poor Diet).
   - Use an AI flow to analyze this data and return: Potential Health Threats (with descriptions), Health Recommendations, and OTC Medicine suggestions with Google Search links.

3. **AI Diagnostic Tools (Genkit Flows)**:
   - **Vision Scan**: Capture/upload facial photo. Analyze for signs of fatigue (dark circles, drooping eyelids, pale skin). Provide a detailed fatigue report and lifestyle/OTC suggestions.
   - **Cough Analysis**: Record 5 seconds of audio. Classify cough type (dry, wet, wheezing). Provide home remedies and OTC medicine suggestions.
   - **Skin Scan**: Capture/upload skin photo. Identify potential conditions (acne, eczema, moles, etc.) with confidence levels (High/Medium/Low). Provide home care and OTC suggestions.
   - **Mental Health Screen**: A multiple-choice questionnaire based on PHQ-4 questions. Analyze answers to provide a Wellness Score (0-100), Perceived Mood, and a compassionate summary with recommendations.

4. **Actionable Recommendations**:
   - For every medicine suggested by AI, include a "Find Online" button linking to a Google Search query.
   - For every clinic type suggested (e.g., "Urgent Care", "Dermatologist"), include a "Find" button linking to a Google Maps search query using the user's geolocation if available.

5. **Health Trends (Analytics)**:
   - Visualize stored reports for selected family members using charts:
     - Line chart for Mental Wellness Score over time.
     - Fatigue Trend (Yes/No instances).
     - Bar chart for Cough Type distribution.

6. **Medical Integrity & UX**:
   - Display a persistent **Medical Disclaimer** alert on every analysis report and in the footer.
   - All AI-generated suggestions must state they are for informational purposes only and not prescriptions.
   - Use a Sidebar for navigation and a Header with a Language Switcher and Theme Toggle.

7. **Localization**:
   - Implement full support for English (`en`), Hindi (`hi`), and Chhattisgarhi (`hne`) using `next-intl`. All UI strings must be translated.

---
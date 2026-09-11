import { checkSymptoms } from './src/ai/flows/symptom-checker';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    console.log("Testing Symptom Checker...");
    try {
        const result = await checkSymptoms({
            symptoms: 'severe headache, high fever, and body aches',
            duration: 'Acute (<3 days)',
            painScale: 8,
            fever: 'High (>100.4°F)'
        });
        console.log("Success! Result:");
        console.log(JSON.stringify(result, null, 2));
    } catch (err: any) {
        console.error("FAILED:");
        console.error(err);
        console.error(err.message);
    }
}

run();

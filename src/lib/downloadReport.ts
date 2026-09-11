// src/lib/downloadReport.ts

export function downloadReportAsText(title: string, results: any) {
    let text = `=======================================\n`;
    text += `       PULSECHECK AI - REPORT\n`;
    text += `=======================================\n`;
    text += `Date: ${new Date().toLocaleString()}\n`;
    text += `Scan Type: ${title}\n\n`;
    
    if (results.triagePriority) text += `[ TRIAGE PRIORITY ]\n${results.triagePriority}\n\n`;
    if (results.overallScore) text += `[ OVERALL SCORE ]\n${results.overallScore}\n\n`;
    if (results.wellnessScore) text += `[ WELLNESS SCORE ]\n${results.wellnessScore}\n\n`;
    
    const summary = results.simpleExplanation || results.overallAssessment || results.summary;
    if (summary) {
        text += `[ SUMMARY ]\n${summary}\n\n`;
    }
    
    if (results.precautions && results.precautions.length > 0) {
        text += `[ ACTIONABLE PRECAUTIONS ]\n`;
        results.precautions.forEach((p: string) => { text += `- ${p}\n`; });
        text += `\n`;
    }

    if (results.recommendations && results.recommendations.length > 0) {
        text += `[ RECOMMENDATIONS ]\n`;
        results.recommendations.forEach((r: string) => { text += `- ${r}\n`; });
        text += `\n`;
    }
    
    if (results.otcMedicines && results.otcMedicines.length > 0) {
        text += `[ SUGGESTED SUPPORTIVE CARE ]\n`;
        results.otcMedicines.forEach((m: any) => { 
            const name = typeof m === 'string' ? m : m.name;
            text += `- ${name}\n`; 
        });
        text += `\n`;
    }

    text += `=======================================\n`;
    text += `DISCLAIMER: This is an AI wellness triage tool.\n`;
    text += `Please consult a medical professional for accurate diagnosis.\n`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_Report.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

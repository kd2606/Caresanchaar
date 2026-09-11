const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', 'utf8');

const handleDataParsed = `
  const handleDataParsed = useCallback((data: ParsedIntakeData) => {
    if (data.name) setField('name', data.name);
    if (data.age_years) setField('age_years', String(data.age_years));
    if (data.gender) setField('gender', data.gender);
    if (data.symptoms) setField('symptoms', data.symptoms);
    if (data.temperature_f) setField('temperature_f', String(data.temperature_f));
    if (data.systolic_bp) setField('systolic_bp', String(data.systolic_bp));
    if (data.diastolic_bp) setField('diastolic_bp', String(data.diastolic_bp));
    if (data.risk_level) {
      setField('risk_level', data.risk_level);
      if (!actionTouched && DEFAULT_ACTION[data.risk_level]) {
        setField('recommended_action', DEFAULT_ACTION[data.risk_level]);
      }
    }
  }, [setField, actionTouched, DEFAULT_ACTION]);
`;

code = code.replace(
  /const resetForm = useCallback\(\(\): void => \{[\s\S]*?\}, \[\]\);/,
  `const resetForm = useCallback((): void => {
    setForm(createInitialState());
    setErrors({});
    setActionTouched(false);
    setStatus('idle');
    setMessage(null);
    setAiResult(null);
    setAiPendingOffline(false);
  }, []);\n${handleDataParsed}`
);

fs.writeFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', code);

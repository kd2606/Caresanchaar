const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', 'utf8');

code = code.replace(
  /<Field error=\{errors\.dob\} hint=\{age !== null \? t\('approximateAge', \{ age \}\) : undefined\} id="dob" label=\{t\('dob'\)\} required optionalLabel=\{t\('optional'\)\}>\s*<input[\s\S]*?id="dob"[\s\S]*?name="dob"[\s\S]*?type="date"[\s\S]*?\/>\s*<\/Field>/,
  `<Field error={errors.dob} hint={age !== null && form.age_years === '' ? t('approximateAge', { age }) : undefined} id="dob" label={t('dob')} optionalLabel={t('optional')}>
                <input
                  id="dob"
                  name="dob"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  className={\`\${INPUT_CLASS} [color-scheme:dark]\`}
                  value={form.dob}
                  disabled={isSaving}
                  aria-invalid={errors.dob !== undefined}
                  aria-describedby={errors.dob !== undefined ? 'dob-error' : age !== null && form.age_years === '' ? 'dob-hint' : undefined}
                  onChange={(event) => { setField('dob', event.target.value); if (event.target.value) setField('age_years', ''); }}
                />
              </Field>

              <Field error={errors.age_years} id="age_years" label="Age (Years)" optionalLabel={t('optional')}>
                <input
                  id="age_years"
                  name="age_years"
                  type="number"
                  min="0"
                  max="130"
                  placeholder="e.g. 45"
                  className={INPUT_CLASS}
                  value={form.age_years}
                  disabled={isSaving || form.dob !== ''}
                  aria-invalid={errors.age_years !== undefined}
                  onChange={(event) => setField('age_years', event.target.value)}
                />
              </Field>`
);

fs.writeFileSync('src/app/[locale]/dashboard/worker/intake/page.tsx', code);

import { saveSystemSettingsAction } from "@/app/actions/settings";
import { requireAdmin } from "@/lib/session";
import { getSystemSettings } from "@/lib/system-settings";
import { WEEKDAY_NAMES, formatScheduleTime } from "@/lib/schedule";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireAdmin();
  const [settings, params] = await Promise.all([getSystemSettings(), searchParams]);

  return <main className="page">
    <div className="page-heading">
      <div>
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>System configuration</h1>
        <p className="subtitle">Configure the timezone and regular work schedule used throughout the DTR system.</p>
      </div>
    </div>
    {params.success === "saved" && <div className="notice notice-success">System settings saved successfully.</div>}
    {params.error === "invalid-timezone" && <div className="notice notice-error">Enter a valid IANA timezone, such as Asia/Manila.</div>}
    {params.error === "invalid-settings" && <div className="notice notice-error">Choose at least one workday and a valid shift where the end is later than the start.</div>}
    <form action={saveSystemSettingsAction} className="grid settings-grid">
      <section className="card">
        <div className="card-header">
          <div><h2 className="card-title">Timezone</h2><p className="card-description">Used for work dates, schedule rules, and displayed attendance times.</p></div>
        </div>
        <div className="field">
          <label htmlFor="timeZone">IANA timezone</label>
          <input className="input" id="timeZone" name="timeZone" defaultValue={settings.timeZone} maxLength={100} placeholder="Asia/Manila" required />
          <span className="cell-secondary">Example: Asia/Manila, America/Los_Angeles, or Europe/London.</span>
        </div>
      </section>
      <section className="card">
        <div className="card-header">
          <div><h2 className="card-title">Work schedule</h2><p className="card-description">Late arrivals are based on the shift start; clock-out is blocked before the shift end.</p></div>
        </div>
        <fieldset className="settings-days">
          <legend>Scheduled workdays</legend>
          <div className="settings-day-options">
            {WEEKDAY_NAMES.map((name, day) => <label className="settings-day" key={name}>
              <input type="checkbox" name="workDays" value={day} defaultChecked={settings.workDays.includes(day)} />
              <span>{name}</span>
            </label>)}
          </div>
        </fieldset>
        <div className="settings-time-fields">
          <div className="field"><label htmlFor="shiftStart">Shift starts</label><input className="input" id="shiftStart" name="shiftStart" type="time" defaultValue={settings.shiftStart} required /></div>
          <div className="field"><label htmlFor="shiftEnd">Shift ends</label><input className="input" id="shiftEnd" name="shiftEnd" type="time" defaultValue={settings.shiftEnd} required /></div>
        </div>
        <p className="cell-secondary settings-preview">Current shift: {formatScheduleTime(settings.shiftStart)}–{formatScheduleTime(settings.shiftEnd)}.</p>
      </section>
      <section className="card">
        <div className="card-header">
          <div><h2 className="card-title">Break policy</h2><p className="card-description">Break time is deducted from worked hours.</p></div>
        </div>
        <div className="notice settings-policy"><strong>Actual recorded break duration</strong><br />Employees start and end their own breaks. The actual recorded duration is deducted; no fixed break duration is imposed.</div>
      </section>
      <div className="settings-save"><button className="button button-primary">Save configuration</button></div>
    </form>
  </main>;
}

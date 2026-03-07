import { useLectioStore } from '@/store'
import type { GeminiModel } from '@/types'

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen, settings, updateSettings } = useLectioStore()

  if (!settingsOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={(e) => e.target === e.currentTarget && setSettingsOpen(false)}
    >
      <div className="animate-modalIn relative max-h-[80vh] w-[380px] overflow-y-auto rounded-xl border border-[#1f1f1f] bg-[#0e0e0e] p-6 shadow-[0_32px_80px_rgba(0,0,0,.9)] [scrollbar-width:thin] [scrollbar-color:#222_transparent]">
        <button
          onClick={() => setSettingsOpen(false)}
          className="absolute right-4 top-4 text-[17px] leading-none text-[#444] hover:text-white"
        >
          ×
        </button>

        <div className="mb-0.5 text-[15px] font-medium text-text-primary">Ajustes</div>
        <div className="mb-5 font-mono text-[11px] text-[#2a2a2a]">configuración del lector y la IA</div>

        {/* Capture section */}
        <Section title="Captura">
          <SettingRow
            label="Pegar automáticamente en chat"
            desc="Envía la captura al chat sin confirmación"
          >
            <Toggle value={settings.autoSnap} onChange={(v) => updateSettings({ autoSnap: v })} />
          </SettingRow>
          <SettingRow label="Calidad de captura">
            <select
              value={settings.captureQuality}
              onChange={(e) => updateSettings({ captureQuality: parseInt(e.target.value) as 1 | 2 | 3 })}
              className="rounded-md border border-[#1f1f1f] bg-[#111] px-2 py-1 font-mono text-[11px] text-text-primary outline-none"
            >
              <option value={1}>Normal</option>
              <option value={2}>Alta</option>
              <option value={3}>Ultra</option>
            </select>
          </SettingRow>
        </Section>

        {/* AI section */}
        <Section title="IA">
          <SettingRow
            label="Enviar texto de la página"
            desc="Incluye el texto extraído como contexto"
          >
            <Toggle
              value={settings.sendPageText}
              onChange={(v) => updateSettings({ sendPageText: v })}
            />
          </SettingRow>
          <SettingRow label="Idioma de respuesta">
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value as any })}
              className="rounded-md border border-[#1f1f1f] bg-[#111] px-2 py-1 font-mono text-[11px] text-text-primary outline-none"
            >
              <option value="español">Español</option>
              <option value="inglés">Inglés</option>
              <option value="automático">Automático</option>
            </select>
          </SettingRow>
          <SettingRow label="Modelo Gemini" desc="Flash-Lite tiene más cuota gratuita (1000/día)">
            <select
              value={settings.geminiModel}
              onChange={(e) => updateSettings({ geminiModel: e.target.value as GeminiModel })}
              className="rounded-md border border-[#1f1f1f] bg-[#111] px-2 py-1 font-mono text-[11px] text-text-primary outline-none"
            >
              <option value="gemini-2.5-flash">2.5 Flash</option>
              <option value="gemini-2.5-flash-lite">2.5 Flash-Lite ★ free</option>
              <option value="gemini-2.5-pro">2.5 Pro</option>
              <option value="gemini-2.0-flash">2.0 Flash</option>
            </select>
          </SettingRow>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[.12em] text-[#2a2a2a]">{title}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

function SettingRow({
  label,
  desc,
  children,
}: {
  label: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[#1a1a1a] bg-[#111] px-3 py-2">
      <div>
        <div className="text-[12.5px] text-text-primary">{label}</div>
        {desc && <div className="mt-0.5 font-mono text-[11px] text-[#333]">{desc}</div>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative h-[15px] w-7 flex-shrink-0 rounded-full border-none transition-all ${
        value ? 'bg-white' : 'bg-[#1f1f1f]'
      }`}
    >
      <span
        className={`absolute top-0.5 h-[11px] w-[11px] rounded-full transition-all ${
          value ? 'left-[15px] bg-[#111]' : 'left-0.5 bg-[#3a3a3a]'
        }`}
      />
    </button>
  )
}

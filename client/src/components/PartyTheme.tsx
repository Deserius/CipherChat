import type { CSSProperties } from 'react';
import { PARTY_BACKGROUNDS, PARTY_FONTS, type RoomTheme } from '@shared/avatars';
import { getController } from '../services/roomController';

export function PartyThemeForm({
  value,
  onClose,
}: {
  value?: RoomTheme;
  onClose: () => void;
}) {
  const theme = value ?? {};

  function patch(p: Partial<RoomTheme>) {
    getController().setRoomTheme({ ...theme, ...p });
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-400">
        Party look is shared with everyone in this room for this session only. No cloud gallery.
      </p>
      <label className="text-xs uppercase tracking-wider text-slate-400">Room title</label>
      <input
        className="field mb-3 mt-1"
        maxLength={40}
        defaultValue={theme.title ?? ''}
        placeholder="Friday hangout"
        onBlur={(e) => patch({ title: e.target.value.trim() || undefined })}
      />
      <div className="mb-2 text-xs uppercase tracking-wider text-slate-400">Background</div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {PARTY_BACKGROUNDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`rounded-xl border px-2 py-3 text-xs ${
              (theme.background ?? 'void') === b.id ? 'border-cyan-glow text-white' : 'border-white/10 text-slate-400'
            }`}
            onClick={() => patch({ background: b.id })}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="mb-2 text-xs uppercase tracking-wider text-slate-400">Font</div>
      <div className="mb-3 flex gap-2">
        {PARTY_FONTS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`flex-1 rounded-xl border px-2 py-2 text-xs ${
              (theme.font ?? 'sans') === f.id ? 'border-cyan-glow text-white' : 'border-white/10 text-slate-400'
            }`}
            style={{ fontFamily: f.css }}
            onClick={() => patch({ font: f.id })}
          >
            {f.label}
          </button>
        ))}
      </div>
      <label className="text-xs uppercase tracking-wider text-slate-400">Accent</label>
      <input
        type="color"
        className="mt-1 h-10 w-full cursor-pointer rounded-xl bg-transparent"
        value={theme.accent ?? '#00e5ff'}
        onChange={(e) => patch({ accent: e.target.value })}
      />
      <button className="btn btn-ghost mt-4 w-full" type="button" onClick={onClose}>
        Done
      </button>
    </div>
  );
}

export function themeStyle(theme?: RoomTheme): CSSProperties {
  if (!theme) return {};
  const bg = PARTY_BACKGROUNDS.find((b) => b.id === theme.background);
  const font = PARTY_FONTS.find((f) => f.id === theme.font);
  const style: CSSProperties = {};
  if (bg && bg.id !== 'void') style.backgroundImage = bg.css;
  if (font) style.fontFamily = font.css;
  if (theme.accent) (style as Record<string, string>)['--cyan'] = theme.accent;
  return style;
}

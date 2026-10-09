import { AVATAR_PRESETS, avatarPreset } from '@shared/avatars';
import { initials, participantColor } from '../services/roomController';

export function AvatarMark({
  id,
  name,
  avatar,
  size = 36,
}: {
  id: string;
  name: string;
  avatar?: string;
  size?: number;
}) {
  const preset = avatar ? avatarPreset(avatar) : undefined;
  const style = { width: size, height: size, fontSize: Math.max(12, size * 0.42) };

  if (avatar && avatar.startsWith('data:image/')) {
    return (
      <img
        src={avatar}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={style}
      />
    );
  }

  if (preset) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          ...style,
          background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
        }}
        aria-hidden
      >
        <span className="leading-none">{preset.glyph}</span>
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-ink-950"
      style={{ ...style, background: participantColor(id) }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
        Avatar · this session only
      </div>
      <div className="flex flex-wrap gap-2">
        {AVATAR_PRESETS.map((a) => (
          <button
            key={a.id}
            type="button"
            title={a.label}
            aria-label={a.label}
            aria-pressed={value === a.id}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-lg ${
              value === a.id ? 'ring-2 ring-cyan-glow ring-offset-2 ring-offset-[#05070b]' : 'opacity-80 hover:opacity-100'
            }`}
            style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}
            onClick={() => onChange(value === a.id ? undefined : a.id)}
          >
            {a.glyph}
          </button>
        ))}
        <label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-dashed border-white/20 text-[10px] text-slate-400 hover:border-cyan-glow/50">
          Pic
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void fileToAvatar(f).then((d) => d && onChange(d));
            }}
          />
        </label>
      </div>
    </div>
  );
}

export async function fileToAvatar(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return undefined;
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const side = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width - side) / 2;
  const sy = (bmp.height - side) / 2;
  ctx.drawImage(bmp, sx, sy, side, side, 0, 0, 96, 96);
  bmp.close();
  const data = canvas.toDataURL('image/jpeg', 0.7);
  if (data.length > 12_000) {
    const smaller = canvas.toDataURL('image/jpeg', 0.45);
    return smaller.length > 12_000 ? undefined : smaller;
  }
  return data;
}

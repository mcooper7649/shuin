'use client';

import { useEffect, useRef, useState } from 'react';
import { mediaKind } from '@/lib/ipfs';

type Props = {
  file: File | null;
  onChange: (f: File | null) => void;
  accept?: string;
  label?: string;
  compact?: boolean;
};

export function MediaDrop({ file, onChange, accept = 'image/*,video/*,audio/*,.glb,.gltf', label, compact }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<string>();

  useEffect(() => {
    if (!file) return setPreview(undefined);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const kind = file ? mediaKind(file.type, file.name) : undefined;

  return (
    <div
      className="drop"
      style={compact ? { minHeight: 120 } : undefined}
      data-over={over}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onChange(f);
      }}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {!file && (
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: compact ? '1rem' : '1.25rem' }}>
            {label ?? 'Drop your work here'}
          </div>
          {!compact && <div className="hint">Image, video, audio or 3D model (.glb), up to 50 MB</div>}
        </div>
      )}
      {file && preview && (
        <div style={{ width: '100%' }} onClick={(e) => kind === 'audio' || kind === 'video' ? e.stopPropagation() : undefined}>
          {kind === 'image' && <img src={preview} alt="" style={{ margin: '0 auto' }} />}
          {kind === 'video' && <video src={preview} controls muted loop style={{ margin: '0 auto' }} />}
          {kind === 'audio' && <audio src={preview} controls />}
          {kind === 'model' && <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>3D model ready</div>}
          <div className="hint mono" style={{ marginTop: 8 }}>
            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
          </div>
          <button
            type="button"
            className="btn btn-ghost drop-remove"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              if (input.current) input.current.value = '';
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

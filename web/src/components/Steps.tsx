export type StepState = 'idle' | 'active' | 'done' | 'error';

export function Steps({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ol className="steps">
      {steps.map((s) => (
        <li key={s.label} data-state={s.state}>
          <span className="dot" />
          {s.label}
        </li>
      ))}
    </ol>
  );
}

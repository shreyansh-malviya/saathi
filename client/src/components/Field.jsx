// Labelled input with an inline error message from the server's `fields`.
export default function Field({ label, error, hint, children }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

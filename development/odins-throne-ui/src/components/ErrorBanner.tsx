interface Props {
  message: string | null;
}

export function ErrorBanner({ message }: Props) {
  if (!message) return null;
  return (
    <div className={`error-banner visible`} role="alert" aria-live="assertive">
      {"\u26A0"} {message}
    </div>
  );
}

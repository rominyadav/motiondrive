"use client";

type GoogleAuthButtonProps = {
  label?: string;
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function GoogleAuthButton({
  label = "Continue with Google",
  loadingLabel = "Connecting to Google...",
  loading = false,
  disabled = false,
  onClick,
}: GoogleAuthButtonProps) {
  return (
    <button onClick={onClick} className="btn-oauth" type="button" disabled={disabled || loading}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.15.8-.6 1.48-1.28 1.93v2.26h2.07c1.61-1.48 2.54-3.66 2.54-6.22z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.07-2.26C11.32 14.36 10.24 14.63 9 14.63c-2.35 0-4.34-1.58-5.05-3.71H1.8v2.33C3.28 16.19 6 18 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.95 10.92A5.4 5.4 0 0 1 3.6 9c0-.66.12-1.31.35-1.92V4.75H1.8A8.99 8.99 0 0 0 0 9c0 1.76.5 3.39 1.8 4.75l2.15-2.83z"
        />
        <path
          fill="#EA4335"
          d="M9 3.37c1.32 0 2.5.45 3.4 1.3l2.58-2.58C13.43.8 11.43 0 9 0 6 0 3.28 1.81 1.8 4.75l2.15 2.83C4.66 4.95 6.65 3.37 9 3.37z"
        />
      </svg>
      {loading ? loadingLabel : label}
    </button>
  );
}

import LoginForm from '@/components/LoginForm';

/**
 * The `/login` route. On success it navigates home rather than rendering
 * anything of its own — the edit layer lives on the portfolio, so the
 * portfolio is where a successful sign-in belongs.
 */
export default function LoginPage() {
  return <LoginForm redirectTo="/" />;
}

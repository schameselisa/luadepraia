import logoBlue from '@/assets/lua-de-praia-logo-blue.png';
import { useRouter } from '@/store/Router';

export function Logo({
  className = '',
  imgClassName = 'h-8 w-auto md:h-9',
}: {
  className?: string;
  imgClassName?: string;
}) {
  const { navigate } = useRouter();
  return (
    <button
      onClick={() => navigate({ name: 'home' })}
      className={`flex items-center transition ${className}`}
      aria-label="Lua de Praia — início"
    >
      <img
        src={logoBlue}
        alt="Lua de Praia"
        className={imgClassName}
      />
    </button>
  );
}

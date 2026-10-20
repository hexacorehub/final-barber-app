import Link from "next/link";
import { buttonStyles } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="font-display text-3xl font-semibold">Página não encontrada</h1>
      <Link href="/inicio" className={buttonStyles.primary}>
        Voltar ao início
      </Link>
    </div>
  );
}

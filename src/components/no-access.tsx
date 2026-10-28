import { Lock } from "lucide-react";

/** Shown instead of a screen the person's role does not cover. The server never sends the data. */
export function NoAccess({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-chip px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-white">
        <Lock size={22} aria-hidden="true" />
      </span>
      <p className="font-display text-xl font-semibold">Fora do seu acesso</p>
      <p className="max-w-md text-sm text-ink-soft">Seu acesso não inclui {what}. Se precisar disso para o seu trabalho, peça para o dono liberar em Equipe e acessos.</p>
    </div>
  );
}

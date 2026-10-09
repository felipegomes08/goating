import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ConfigJogo = {
  numTimes: number;
  formato: "unico" | "rachao";
  tempos: number;
  minutosTempo: number;
  /** 0 = sem limite de gols */
  golsLimite: number;
  contagem: "por_jogo" | "por_dia";
};

const PREDEFINIDO = {
  unico: { tempos: 2, minutosTempo: 30, golsLimite: 0 },
  rachao: { tempos: 1, minutosTempo: 10, golsLimite: 2 },
} as const;

export const CONFIG_PADRAO: ConfigJogo = {
  numTimes: 2,
  formato: "unico",
  ...PREDEFINIDO.unico,
  contagem: "por_jogo",
};

/** Colunas de `matches` correspondentes. */
export function configParaPelada(config: ConfigJogo) {
  return {
    num_times: config.numTimes,
    tempos: config.tempos,
    minutos_tempo: config.minutosTempo,
    gols_limite: config.golsLimite > 0 ? config.golsLimite : null,
    contagem_vitoria: config.contagem,
  };
}

/** O caminho de volta: monta o formulário a partir de uma pelada já criada. */
export function peladaParaConfig(pelada: {
  num_times: number;
  tempos: number;
  minutos_tempo: number;
  gols_limite: number | null;
  contagem_vitoria: string;
}): ConfigJogo {
  const golsLimite = pelada.gols_limite ?? 0;
  return {
    numTimes: pelada.num_times,
    // o formato não é gravado: 3+ times ou limite de gols só existem no rachão
    formato: pelada.num_times > 2 || golsLimite > 0 ? "rachao" : "unico",
    tempos: pelada.tempos,
    minutosTempo: pelada.minutos_tempo,
    golsLimite,
    contagem: pelada.contagem_vitoria === "por_dia" ? "por_dia" : "por_jogo",
  };
}

export function ConfigJogoCampos({
  valor,
  onMudar,
}: {
  valor: ConfigJogo;
  onMudar: (config: ConfigJogo) => void;
}) {
  const mudar = (parte: Partial<ConfigJogo>) => onMudar({ ...valor, ...parte });
  const variosJogos = valor.numTimes > 2 || valor.formato === "rachao";

  function mudarTimes(numTimes: number) {
    // com 3+ times não existe "jogo único": passa pro rachão sozinho
    if (numTimes > 2 && valor.formato === "unico")
      mudar({ numTimes, formato: "rachao", ...PREDEFINIDO.rachao });
    else mudar({ numTimes });
  }

  return (
    <div className="space-y-4">
      <Passo rotulo="Quantos times" valor={valor.numTimes} min={2} max={6} onMudar={mudarTimes} />

      <div>
        <Label>Formato</Label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(
            [
              {
                id: "unico",
                titulo: "Jogo único",
                texto: "Dois times, um jogo só, com tempo cheio.",
              },
              { id: "rachao", titulo: "Rachão", texto: "Vários jogos curtos. Quem ganha fica." },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={valor.formato === f.id}
              onClick={() => mudar({ formato: f.id, ...PREDEFINIDO[f.id] })}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors",
                valor.formato === f.id ? "border-mint bg-mint-soft" : "border-border bg-card",
              )}
            >
              <p className="text-sm font-bold text-foreground">{f.titulo}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{f.texto}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border rounded-2xl border border-border bg-card px-3">
        <Linha rotulo="Tempos por jogo">
          <Contador valor={valor.tempos} min={1} max={4} onMudar={(tempos) => mudar({ tempos })} />
        </Linha>
        <Linha rotulo="Minutos por tempo">
          <Contador
            valor={valor.minutosTempo}
            min={1}
            max={90}
            onMudar={(minutosTempo) => mudar({ minutosTempo })}
          />
        </Linha>
        <Linha
          rotulo="Acaba com quantos gols"
          ajuda={valor.golsLimite === 0 ? "Sem limite: só acaba no tempo" : undefined}
        >
          <Contador
            valor={valor.golsLimite}
            min={0}
            max={20}
            texto={valor.golsLimite === 0 ? "—" : undefined}
            onMudar={(golsLimite) => mudar({ golsLimite })}
          />
        </Linha>
      </div>

      {variosJogos && (
        <div>
          <Label>Vitória de cada jogador</Label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(
              [
                {
                  id: "por_jogo",
                  titulo: "Por jogo",
                  texto: "Cada jogo ganho no dia vale uma vitória.",
                },
                {
                  id: "por_dia",
                  titulo: "Pelo dia",
                  texto: "Só o time que mais ganhou no dia leva uma vitória.",
                },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={valor.contagem === c.id}
                onClick={() => mudar({ contagem: c.id })}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-colors",
                  valor.contagem === c.id ? "border-mint bg-mint-soft" : "border-border bg-card",
                )}
              >
                <p className="text-sm font-bold text-foreground">{c.titulo}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{c.texto}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Passo(props: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  onMudar: (n: number) => void;
}) {
  return (
    <div>
      <Label>{props.rotulo}</Label>
      <div className="mt-1 flex items-center justify-between rounded-xl border border-input bg-card px-3 py-2">
        <BotaoPasso
          rotulo={`Menos: ${props.rotulo}`}
          desligado={props.valor <= props.min}
          onClick={() => props.onMudar(props.valor - 1)}
        >
          <Minus className="size-4" />
        </BotaoPasso>
        <span className="text-lg font-extrabold">{props.valor}</span>
        <BotaoPasso
          rotulo={`Mais: ${props.rotulo}`}
          desligado={props.valor >= props.max}
          onClick={() => props.onMudar(props.valor + 1)}
        >
          <Plus className="size-4" />
        </BotaoPasso>
      </div>
    </div>
  );
}

function Linha({
  rotulo,
  ajuda,
  children,
}: {
  rotulo: string;
  ajuda?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div>
        <p className="text-sm text-foreground">{rotulo}</p>
        {ajuda && <p className="text-[11px] text-muted-foreground">{ajuda}</p>}
      </div>
      {children}
    </div>
  );
}

function Contador(props: {
  valor: number;
  min: number;
  max: number;
  texto?: string | undefined;
  onMudar: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <BotaoPasso
        rotulo="Menos"
        desligado={props.valor <= props.min}
        onClick={() => props.onMudar(props.valor - 1)}
      >
        <Minus className="size-3.5" />
      </BotaoPasso>
      <span className="w-7 text-center text-sm font-extrabold tabular-nums">
        {props.texto ?? props.valor}
      </span>
      <BotaoPasso
        rotulo="Mais"
        desligado={props.valor >= props.max}
        onClick={() => props.onMudar(props.valor + 1)}
      >
        <Plus className="size-3.5" />
      </BotaoPasso>
    </div>
  );
}

function BotaoPasso(props: {
  rotulo: string;
  desligado: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={props.rotulo}
      disabled={props.desligado}
      onClick={props.onClick}
      className="flex size-8 items-center justify-center rounded-lg bg-secondary disabled:opacity-40"
    >
      {props.children}
    </button>
  );
}

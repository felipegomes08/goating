import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type MunicipioIBGE = {
  id: number;
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
};

type CidadeOpcao = { label: string };

/** Busca a lista oficial de municípios do Brasil na API pública do IBGE. */
async function buscarMunicipiosIBGE(): Promise<CidadeOpcao[]> {
  const resposta = await fetch(
    "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
  );
  if (!resposta.ok) throw new Error("Não deu pra carregar a lista de cidades do IBGE.");
  const dados = (await resposta.json()) as MunicipioIBGE[];
  const vistos = new Set<string>();
  const lista: CidadeOpcao[] = [];
  for (const m of dados) {
    const uf = m.microrregiao?.mesorregiao?.UF?.sigla;
    const label = uf ? `${m.nome} - ${uf}` : m.nome;
    if (vistos.has(label)) continue;
    vistos.add(label);
    lista.push({ label });
  }
  return lista.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/**
 * Seletor de cidade com autocomplete, alimentado pela lista oficial de
 * municípios do IBGE. Garante que `cidade` grava sempre no mesmo formato
 * ("Nome - UF"), evitando que variação de digitação quebre o filtro do feed.
 */
export function CidadeCombobox({
  value,
  onChange,
  placeholder = "Selecione sua cidade",
}: {
  value: string | null;
  onChange: (cidade: string) => void;
  placeholder?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");

  const municipios = useQuery({
    queryKey: ["ibge-municipios"],
    queryFn: buscarMunicipiosIBGE,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const resultados = useMemo(() => {
    const lista = municipios.data ?? [];
    const t = termo.trim().toLowerCase();
    if (!t) return lista.slice(0, 30);
    return lista.filter((c) => c.label.toLowerCase().includes(t)).slice(0, 30);
  }, [municipios.data, termo]);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          {municipios.isLoading ? (
            <Loader2 className="ml-2 size-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={termo}
            onValueChange={setTermo}
            placeholder="Digite o nome da cidade..."
          />
          <CommandList>
            {municipios.isError ? (
              <CommandEmpty>Não deu pra carregar as cidades. Tenta de novo.</CommandEmpty>
            ) : resultados.length === 0 ? (
              <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
            ) : (
              <CommandGroup>
                {resultados.map((c) => (
                  <CommandItem
                    key={c.label}
                    value={c.label}
                    onSelect={() => {
                      onChange(c.label);
                      setAberto(false);
                      setTermo("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === c.label ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {c.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

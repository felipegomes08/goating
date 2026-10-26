import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { digitosDoCelular, formatarCelular, problemaDoCelular } from "@/lib/celular";

/**
 * Campo de celular com máscara "(11) 98765-4321". Recebe e devolve só os dígitos. Opcional:
 * vazio vale; o aviso de erro só aparece depois que a pessoa sai do campo ou termina de digitar.
 */
export function CampoCelular({
  value,
  onChange,
}: {
  value: string;
  onChange: (digitos: string) => void;
}) {
  const [saiu, setSaiu] = useState(false);
  const problema = value.length === 11 || saiu ? problemaDoCelular(value) : null;
  return (
    <div className="space-y-1.5">
      <Label htmlFor="celular">
        Celular <span className="font-normal text-muted-foreground">(opcional)</span>
      </Label>
      <Input
        id="celular"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="(11) 98765-4321"
        value={formatarCelular(value)}
        onChange={(e) => {
          const digitos = digitosDoCelular(e.target.value);
          // apagar o "-" ou o ")" da máscara apaga o dígito de antes, senão o campo trava
          const apagouSoMascara =
            digitos === value && e.target.value.length < formatarCelular(value).length;
          onChange(apagouSoMascara ? digitos.slice(0, -1) : digitos);
        }}
        onBlur={() => setSaiu(true)}
        aria-invalid={!!problema}
      />
      <p
        className={
          problema ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"
        }
      >
        {problema ?? "Só o Goating vê. Não aparece no seu perfil."}
      </p>
    </div>
  );
}

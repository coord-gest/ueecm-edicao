import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HandCoins, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PainelLayout } from "@/components/PainelLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatBRL, listarVaquinhas } from "@/lib/vaquinhas";

export const Route = createFileRoute("/vaquinhas")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vaquinhas Digitais | UEECM" },
      {
        name: "description",
        content:
          "Campanhas de arrecadação da comunidade escolar para ajudar famílias, projetos e alunos.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: VaquinhasList,
});

function VaquinhasList() {
  const { data, isLoading } = useQuery({ queryKey: ["vaquinhas"], queryFn: () => listarVaquinhas(false) });

  return (
    <PainelLayout>
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <HandCoins className="h-6 w-6 text-primary" /> Vaquinhas Digitais
          </h1>
          <p className="text-sm text-muted-foreground">
            Contribua para causas da nossa escola e comunidade.
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
          </div>
        ) : !data || data.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma vaquinha ativa no momento.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((v) => {
              const pct = Math.min(100, Math.round((v.arrecadado_centavos / v.meta_centavos) * 100));
              return (
                <Link key={v.id} to="/vaquinhas/$id" params={{ id: v.id }} className="block">
                  <Card className="h-full transition hover:border-primary hover:shadow-md">
                    {v.foto_url && (
                      <img
                        src={v.foto_url}
                        alt={v.titulo}
                        loading="lazy"
                        className="h-40 w-full rounded-t-md object-cover"
                      />
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-tight">{v.titulo}</CardTitle>
                        {v.destaque && <Badge>Destaque</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">Beneficiário: {v.beneficiario}</p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="line-clamp-2 text-sm text-muted-foreground">{v.descricao}</p>
                      <Progress value={pct} />
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">{formatBRL(v.arrecadado_centavos)}</span>
                        <span className="text-muted-foreground">
                          de {formatBRL(v.meta_centavos)} · {pct}%
                        </span>
                      </div>
                      <Badge variant={v.status === "ativa" ? "default" : "secondary"} className="capitalize">
                        {v.status}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PainelLayout>
  );
}
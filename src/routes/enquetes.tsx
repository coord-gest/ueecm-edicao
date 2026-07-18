import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Vote } from "lucide-react";
import { listEnquetesPublicas, type Enquete } from "@/lib/enquetes.functions";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/enquetes")({
  head: () => ({
    meta: [
      { title: "Enquetes & Pesquisas | UEECM" },
      { name: "description", content: "Participe das enquetes e pesquisas da UEECM." },
    ],
  }),
  loader: async () => await listEnquetesPublicas(),
  component: EnquetesPage,
  errorComponent: () => <div className="p-8">Erro ao carregar enquetes.</div>,
  notFoundComponent: () => <div className="p-8">Não encontrada.</div>,
});

function EnquetesPage() {
  const initial = Route.useLoaderData();
  const { data: enquetes = initial } = useQuery({
    queryKey: ["enquetes-publicas"],
    queryFn: () => listEnquetesPublicas(),
    initialData: initial,
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Vote className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Enquetes & Pesquisas</h1>
          </div>
          <p className="text-muted-foreground">
            Sua opinião importa. Participe das enquetes ativas da nossa comunidade escolar.
          </p>
        </header>

        {enquetes.length === 0 ? (
          <div className="text-center py-16 border rounded-xl bg-muted/30">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma enquete ativa no momento.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {(enquetes as Enquete[]).map((e: Enquete) => {
              const encerrada = e.encerra_em && new Date(e.encerra_em) < new Date();
              return (
                <Link
                  key={e.id}
                  to="/enquetes/$id"
                  params={{ id: e.id }}
                  className="group block p-6 rounded-xl border bg-card hover:border-primary hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {e.titulo}
                      </h2>
                      {e.descricao && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {e.descricao}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="secondary">
                          {e.tipo === "unica" ? "Escolha única" : "Múltipla escolha"}
                        </Badge>
                        {e.publico !== "todos" && (
                          <Badge variant="outline">
                            {e.publico === "autenticados" ? "Autenticados" : "Equipe"}
                          </Badge>
                        )}
                        {encerrada && <Badge variant="destructive">Encerrada</Badge>}
                        {e.encerra_em && !encerrada && (
                          <Badge variant="outline">
                            Até {new Date(e.encerra_em).toLocaleDateString("pt-BR")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

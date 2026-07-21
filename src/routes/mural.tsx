import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Loader2, Plus, MessageCircle, Pin, Trash2, School, User as UserIcon, GraduationCap } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listarMuralFeed, criarMuralPost, alternarReacaoMural, listarMuralComentarios, comentarMural, excluirMuralPost,
  MURAL_CATEGORIAS, MURAL_REACOES, type MuralCategoria, type MuralReacaoTipo, type MuralFeedItem,
} from "@/lib/mural.functions";

export const Route = createFileRoute("/mural")({
  head: () => ({
    meta: [
      { title: "Mural da Comunidade — Conecta UEECM" },
      { name: "description", content: "Compartilhe conquistas, dúvidas e ofertas de ajuda. Fortaleça a comunidade escolar." },
      { property: "og:title", content: "Mural da Comunidade — Conecta UEECM" },
      { property: "og:description", content: "Feed da comunidade escolar: conquistas, bastidores, dúvidas e ajuda mútua." },
    ],
  }),
  component: MuralPage,
});

function MuralPage() {
  const listar = useServerFn(listarMuralFeed);
  const [categoria, setCategoria] = useState<MuralCategoria | "todos">("todos");
  const [openNovo, setOpenNovo] = useState(false);

  const feedQ = useQuery({
    queryKey: ["mural-feed", categoria],
    queryFn: () => listar({ data: { limite: 40, categoria: categoria === "todos" ? null : categoria } }),
    staleTime: 30_000,
  });

  return (
    <div className="container mx-auto max-w-3xl p-4 md:p-6 space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="rounded-[5px] bg-primary/10 p-2 text-primary"><Users className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Mural da Comunidade</h1>
            <p className="text-sm text-muted-foreground">Conquistas, ofertas de ajuda, bastidores e conversas entre famílias e escola.</p>
          </div>
        </div>
        <Dialog open={openNovo} onOpenChange={setOpenNovo}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Novo post</Button>
          </DialogTrigger>
          <NovoPostDialog onDone={() => setOpenNovo(false)} />
        </Dialog>
      </header>

      <Tabs value={categoria} onValueChange={(v) => setCategoria(v as MuralCategoria | "todos")}>
        <TabsList className="w-full flex flex-wrap h-auto">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          {MURAL_CATEGORIAS.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>{c.emoji} {c.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {feedQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (feedQ.data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum post nesta categoria ainda. Que tal ser o primeiro?</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {feedQ.data?.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}

function papelBadge(papel: string) {
  if (papel === "escola") return { icon: School, label: "Escola", cls: "bg-primary/10 text-primary" };
  if (papel === "professor") return { icon: GraduationCap, label: "Professor(a)", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" };
  return { icon: UserIcon, label: "Família", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" };
}

function PostCard({ post }: { post: MuralFeedItem }) {
  const qc = useQueryClient();
  const reagirFn = useServerFn(alternarReacaoMural);
  const excluirFn = useServerFn(excluirMuralPost);
  const [openComentarios, setOpenComentarios] = useState(false);

  const catInfo = MURAL_CATEGORIAS.find((c) => c.id === post.categoria);
  const pb = papelBadge(post.autor_papel);
  const PIcon = pb.icon;

  const reagirM = useMutation({
    mutationFn: (tipo: MuralReacaoTipo) => reagirFn({ data: { postId: post.id, tipo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mural-feed"] }),
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const excluirM = useMutation({
    mutationFn: () => excluirFn({ data: { postId: post.id } }),
    onSuccess: () => { toast.success("Post excluído"); qc.invalidateQueries({ queryKey: ["mural-feed"] }); },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <Card className={post.fixado ? "border-primary/50 bg-primary/5" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{post.autor_nome}</span>
              <Badge className={`gap-1 ${pb.cls}`} variant="outline"><PIcon className="h-3 w-3" /> {pb.label}</Badge>
              {post.fixado && <Badge variant="outline" className="gap-1"><Pin className="h-3 w-3" /> Fixado</Badge>}
              {!post.aprovado && <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">Aguardando aprovação</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {catInfo?.emoji} {catInfo?.label} • {new Date(post.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm("Excluir este post?")) excluirM.mutate(); }} aria-label="Excluir">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <CardTitle className="text-lg pt-2">{post.titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm whitespace-pre-wrap">{post.conteudo}</p>
        {post.imagem_url && (
          <img src={post.imagem_url} alt="" className="rounded-[5px] max-h-96 w-full object-cover" loading="lazy" />
        )}
        <div className="flex items-center gap-1 flex-wrap pt-2 border-t">
          {MURAL_REACOES.map((r) => {
            const active = post.minhas_reacoes.includes(r.tipo);
            return (
              <Button
                key={r.tipo}
                variant={active ? "default" : "outline"}
                size="sm"
                className="gap-1 h-8"
                onClick={() => reagirM.mutate(r.tipo)}
                disabled={reagirM.isPending}
                aria-label={r.label}
              >
                <span>{r.emoji}</span>
                <span className="text-xs">{r.label}</span>
              </Button>
            );
          })}
          <Button variant="ghost" size="sm" className="gap-1 h-8 ml-auto" onClick={() => setOpenComentarios((v) => !v)}>
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs">{post.total_comentarios} • {post.total_reacoes} reações</span>
          </Button>
        </div>
        {openComentarios && <ComentariosBloco postId={post.id} />}
      </CardContent>
    </Card>
  );
}

function ComentariosBloco({ postId }: { postId: string }) {
  const listarFn = useServerFn(listarMuralComentarios);
  const comentarFn = useServerFn(comentarMural);
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const q = useQuery({ queryKey: ["mural-coment", postId], queryFn: () => listarFn({ data: { postId } }), staleTime: 15_000 });
  const m = useMutation({
    mutationFn: () => comentarFn({ data: { postId, conteudo: texto } }),
    onSuccess: () => { setTexto(""); qc.invalidateQueries({ queryKey: ["mural-coment", postId] }); qc.invalidateQueries({ queryKey: ["mural-feed"] }); },
    onError: (e: unknown) => toast.error((e as Error).message),
  });
  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {q.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (q.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">Seja o primeiro a comentar.</p>
      ) : (
        <ul className="space-y-2">
          {q.data?.map((c) => (
            <li key={c.id} className="rounded-[5px] bg-muted/40 p-2">
              <div className="text-xs font-medium">{c.autor_nome}</div>
              <div className="text-sm whitespace-pre-wrap">{c.conteudo}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(c.created_at).toLocaleString("pt-BR")}</div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva um comentário respeitoso…" maxLength={1000} />
        <Button size="sm" onClick={() => m.mutate()} disabled={!texto.trim() || m.isPending}>Enviar</Button>
      </div>
    </div>
  );
}

function NovoPostDialog({ onDone }: { onDone: () => void }) {
  const criarFn = useServerFn(criarMuralPost);
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<MuralCategoria>("conquista");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [imagem, setImagem] = useState("");

  const m = useMutation({
    mutationFn: () => criarFn({ data: { categoria, titulo, conteudo, imagem_url: imagem || null } }),
    onSuccess: () => {
      toast.success("Post enviado! Se você é família, aguarde a aprovação da escola.");
      qc.invalidateQueries({ queryKey: ["mural-feed"] });
      setTitulo(""); setConteudo(""); setImagem("");
      onDone();
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Novo post no Mural</DialogTitle>
        <CardDescription>Compartilhe algo positivo. Posts de famílias passam por moderação da escola.</CardDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium">Categoria</label>
          <Select value={categoria} onValueChange={(v) => setCategoria(v as MuralCategoria)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MURAL_CATEGORIAS.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium">Título</label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Meu filho terminou o livro do bimestre!" maxLength={140} />
        </div>
        <div>
          <label className="text-xs font-medium">Conteúdo</label>
          <Textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Conte com detalhes, com respeito." rows={5} maxLength={4000} />
          <p className="text-[10px] text-muted-foreground mt-1">{conteudo.length}/4000</p>
        </div>
        <div>
          <label className="text-xs font-medium">Imagem (URL, opcional)</label>
          <Input value={imagem} onChange={(e) => setImagem(e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button onClick={() => m.mutate()} disabled={m.isPending || titulo.trim().length < 3 || conteudo.trim().length < 5}>
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
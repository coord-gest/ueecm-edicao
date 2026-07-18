/**
 * Servidor: listagens públicas para a galeria de Momentos.
 * Convenção de pastas: UEECM/Momentos/<ANO>/<EVENTO>/<fotos>.
 *
 * Estas funções não exigem autenticação — são consumidas pela
 * página pública /momentos. Como usam o Drive da escola pela gateway
 * (conta única), nenhum segredo é exposto ao cliente.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type MomentoAno = { name: string; folderId: string };
export type MomentoEvento = {
  name: string;
  folderId: string;
  cover?: { fileId: string; thumbnail?: string } | null;
  count: number;
};
export type MomentoFoto = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  width?: number;
  height?: number;
};

const AnoZ = z
  .string()
  .min(1)
  .max(20)
  .regex(/^[\w\-. áéíóúÁÉÍÓÚâÊÎÔÛçÇ]+$/);
const EventoZ = z.string().min(1).max(120);

async function loadHelpers() {
  const mod = await import("@/lib/google-drive.server");
  return mod;
}

/** Lista os anos disponíveis (subpastas diretas de UEECM/Momentos). */
export const listMomentosAnos = createServerFn({ method: "GET" }).handler(async () => {
  const { isDriveConfigured, ensureUEECMTree, listChildren } = await loadHelpers();
  if (!isDriveConfigured()) return { anos: [] as MomentoAno[], connected: false as const };
  try {
    const { momentosId } = await ensureUEECMTree();
    const folders = await listChildren(momentosId, { onlyFolders: true });
    // Ordena numericamente decrescente quando os nomes começam por ano.
    const anos = folders
      .map((f) => ({ name: f.name, folderId: f.id }))
      .sort((a, b) => b.name.localeCompare(a.name, "pt-BR", { numeric: true }));
    return { anos, connected: true as const };
  } catch (e) {
    return { anos: [] as MomentoAno[], connected: false as const, error: (e as Error).message };
  }
});

/** Lista eventos de um ano (subpastas). */
export const listMomentosEventos = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ ano: AnoZ }).parse(raw))
  .handler(async ({ data }): Promise<{ eventos: MomentoEvento[] }> => {
    const { isDriveConfigured, ensureUEECMTree, listChildren, findFolder } = await loadHelpers();
    if (!isDriveConfigured()) return { eventos: [] };
    const { momentosId } = await ensureUEECMTree();
    const anoId = await findFolder(data.ano, momentosId);
    if (!anoId) return { eventos: [] };
    const folders = await listChildren(anoId, { onlyFolders: true });
    // Para cada evento, pega a primeira imagem como capa.
    const eventos = await Promise.all(
      folders.map(async (f) => {
        const imgs = await listChildren(f.id, { onlyImages: true, pageSize: 1 });
        const first = imgs[0];
        return {
          name: f.name,
          folderId: f.id,
          count: imgs.length,
          cover: first ? { fileId: first.id, thumbnail: first.thumbnailLink } : null,
        } satisfies MomentoEvento;
      }),
    );
    return { eventos: eventos.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) };
  });

/** Lista as fotos de um evento específico. */
export const listMomentosFotos = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ ano: AnoZ, evento: EventoZ }).parse(raw))
  .handler(async ({ data }): Promise<{ fotos: MomentoFoto[] }> => {
    const { isDriveConfigured, ensureUEECMTree, listChildren, findFolder } = await loadHelpers();
    if (!isDriveConfigured()) return { fotos: [] };
    const { momentosId } = await ensureUEECMTree();
    const anoId = await findFolder(data.ano, momentosId);
    if (!anoId) return { fotos: [] };
    const evId = await findFolder(data.evento, anoId);
    if (!evId) return { fotos: [] };
    const imgs = await listChildren(evId, { onlyImages: true, pageSize: 500 });
    return {
      fotos: imgs.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        width: f.imageMediaMetadata?.width,
        height: f.imageMediaMetadata?.height,
      })),
    };
  });

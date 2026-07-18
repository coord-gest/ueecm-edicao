import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Zap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FcmErrorDialogProps {
  open: boolean;
  reason: string;
  onClose: () => void;
  onRetry: () => void;
  isLoading?: boolean;
}

export function FcmErrorDialog({
  open,
  reason,
  onClose,
  onRetry,
  isLoading = false,
}: FcmErrorDialogProps) {
  const [showTechnical, setShowTechnical] = useState(false);

  // Identifica o tipo de erro
  const isInAppBrowserError = /navegadores internos|Instagram|Facebook|TikTok|WhatsApp/i.test(
    reason,
  );
  const isStorageError = /storage.error|storage|cookies|indexeddb|anônima|terceiros/i.test(reason);
  const isPermissionError = /permiss|denied|negada/i.test(reason);
  const isPreviewError = /preview|iframe/i.test(reason);
  const isAndroidError = /android|configurações|armazenamento/i.test(reason);

  let title = "Não foi possível ativar notificações";
  let suggestion = "";

  if (isInAppBrowserError) {
    title = "Abra no navegador do sistema";
    suggestion =
      "Navegadores internos de apps (Instagram, Facebook, TikTok, WhatsApp) bloqueiam notificações. Toque no menu (⋮) e escolha 'Abrir no Chrome/Safari', ou instale o app da escola.";
  } else if (isStorageError) {
    title = "Problema de armazenamento do navegador";
    suggestion =
      "O navegador não conseguiu salvar o token FCM. Isso costuma acontecer em janela anônima, com cookies de terceiros bloqueados, ou em navegadores internos de apps. Tente no Chrome/Safari normal ou instale o app (PWA/APK).";
  } else if (isPermissionError) {
    title = "Permissão bloqueada";
    suggestion =
      "Você negou a permissão de notificações. Verifique as configurações do seu navegador ou app.";
  } else if (isPreviewError) {
    title = "Preview não suportado";
    suggestion =
      "Notificações não funcionam em previews. Abra o site em https://conectaueecm.com ou instale o app.";
  }

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                Erro ao obter token FCM
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-3">
          {/* Sugestão Principal */}
          <Alert>
            <Zap className="size-4" />
            <AlertDescription className="text-sm">{suggestion}</AlertDescription>
          </Alert>

          {/* Mensagem de Erro (oculta por padrão) */}
          {showTechnical && (
            <Alert>
              <AlertDescription className="text-xs font-mono break-words">
                {reason}
              </AlertDescription>
            </Alert>
          )}

          {/* Passos Específicos por Tipo de Erro */}
          <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
            {isStorageError && (
              <div className="space-y-1">
                <p className="font-semibold">Solução rápida:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                  <li>Abra DevTools (F12)</li>
                  <li>Vá para "Application" → "Storage"</li>
                  <li>Clique em "Clear site data"</li>
                  <li>Recarregue a página</li>
                </ol>
              </div>
            )}

            {isPermissionError && (
              <div className="space-y-1">
                <p className="font-semibold">Solução rápida:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                  <li>Clique no cadeado 🔒 na barra de endereço</li>
                  <li>Vá para "Permissões" → "Notificações"</li>
                  <li>Selecione "Permitir"</li>
                  <li>Tente novamente</li>
                </ol>
              </div>
            )}

            {isAndroidError && (
              <div className="space-y-1">
                <p className="font-semibold">Para Android:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                  <li>Abra Configurações → Apps</li>
                  <li>Procure "U.E. Evaristo"</li>
                  <li>Armazenamento → "Limpar dados"</li>
                  <li>Reabra o app e tente</li>
                </ol>
              </div>
            )}

            {isPreviewError && (
              <div className="space-y-1">
                <p className="font-semibold">Próximos passos:</p>
                <p className="text-xs text-muted-foreground">
                  Abra o site em:
                  <br />
                  • https://conectaueecm.com
                  <br />• Ou instale como PWA/APK
                </p>
              </div>
            )}
          </div>

          {/* Botão para Mostrar Erro Técnico */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setShowTechnical(!showTechnical)}
          >
            {showTechnical ? "Ocultar" : "Mostrar"} detalhes técnicos
          </Button>
        </div>

        {/* Ações */}
        <div className="flex gap-2 justify-end">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={onRetry} disabled={isLoading || isPreviewError} className="gap-2">
              {isLoading && <RefreshCw className="size-4 animate-spin" />}
              {isPreviewError
                ? "Não Disponível"
                : isLoading
                  ? "Processando..."
                  : "Tentar Novamente"}
            </Button>
          </AlertDialogAction>
        </div>

        {/* Link para Diagnóstico */}
        <div className="pt-2 border-t space-y-1">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="w-full text-xs h-auto py-1"
            onClick={() => {
              window.location.href = "/diagnosticar-notificacoes";
            }}
          >
            <Zap className="size-3 mr-1" />
            Rodar diagnóstico detalhado
          </Button>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="w-full text-xs text-muted-foreground h-auto py-1"
            onClick={() =>
              window.open("/docs/TROUBLESHOOTING-FCM.md", "_blank", "width=800,height=600")
            }
          >
            <BookOpen className="size-3 mr-1" />
            Ver guia completo de troubleshooting
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

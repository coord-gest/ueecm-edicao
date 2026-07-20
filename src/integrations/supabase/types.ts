export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_access_logs: {
        Row: {
          area: string | null
          created_at: string
          id: string
          outcome: string
          required_roles: string[]
          roles: string[]
          route: string
          user_agent: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          id?: string
          outcome: string
          required_roles?: string[]
          roles?: string[]
          route: string
          user_agent?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          area?: string | null
          created_at?: string
          id?: string
          outcome?: string
          required_roles?: string[]
          roles?: string[]
          route?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agendamentos: {
        Row: {
          alvo_cargo: string | null
          created_at: string
          fim_at: string
          id: string
          inicio_at: string
          lembrete_1h_enviado_em: string | null
          lembrete_24h_enviado_em: string | null
          motivo: string
          observacoes_staff: string | null
          profissional_id: string | null
          protocolo: string
          solicitante_contato: string | null
          solicitante_nome: string
          solicitante_relacao: string
          solicitante_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          alvo_cargo?: string | null
          created_at?: string
          fim_at: string
          id?: string
          inicio_at: string
          lembrete_1h_enviado_em?: string | null
          lembrete_24h_enviado_em?: string | null
          motivo: string
          observacoes_staff?: string | null
          profissional_id?: string | null
          protocolo?: string
          solicitante_contato?: string | null
          solicitante_nome: string
          solicitante_relacao: string
          solicitante_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          alvo_cargo?: string | null
          created_at?: string
          fim_at?: string
          id?: string
          inicio_at?: string
          lembrete_1h_enviado_em?: string | null
          lembrete_24h_enviado_em?: string | null
          motivo?: string
          observacoes_staff?: string | null
          profissional_id?: string | null
          protocolo?: string
          solicitante_contato?: string | null
          solicitante_nome?: string
          solicitante_relacao?: string
          solicitante_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais_publicos"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          alert_id: string | null
          created_at: string
          details: Json
          id: string
          result: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          alert_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          result?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          alert_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_audit_logs_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_burst_schedules: {
        Row: {
          active: boolean
          alert_id: string
          cancelled_at: string | null
          created_at: string
          created_by: string
          id: string
          interval_minutes: number
          last_run_at: string | null
          next_run_at: string
          repeat_count: number
          sent_count: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          alert_id: string
          cancelled_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          interval_minutes: number
          last_run_at?: string | null
          next_run_at: string
          repeat_count: number
          sent_count?: number
          starts_at: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          alert_id?: string
          cancelled_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          interval_minutes?: number
          last_run_at?: string | null
          next_run_at?: string
          repeat_count?: number
          sent_count?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_burst_schedules_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          daily_end_time: string | null
          daily_start_time: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          link_label: string | null
          link_url: string | null
          message: string
          push_sent_at: string | null
          starts_at: string | null
          updated_at: string
          variant: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          daily_end_time?: string | null
          daily_start_time?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          link_label?: string | null
          link_url?: string | null
          message: string
          push_sent_at?: string | null
          starts_at?: string | null
          updated_at?: string
          variant?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          daily_end_time?: string | null
          daily_start_time?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          link_label?: string | null
          link_url?: string | null
          message?: string
          push_sent_at?: string | null
          starts_at?: string | null
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      aluno_responsavel: {
        Row: {
          aluno_id: string
          created_at: string
          id: string
          parentesco: string | null
          principal: boolean
          responsavel_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          id?: string
          parentesco?: string | null
          principal?: boolean
          responsavel_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          id?: string
          parentesco?: string | null
          principal?: boolean
          responsavel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aluno_responsavel_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_responsavel_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "aluno_responsavel_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos: {
        Row: {
          ativo: boolean
          created_at: string
          data_nascimento: string | null
          id: string
          matricula: string
          nome_completo: string
          observacoes: string | null
          turma_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_nascimento?: string | null
          id?: string
          matricula: string
          nome_completo: string
          observacoes?: string | null
          turma_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_nascimento?: string | null
          id?: string
          matricula?: string
          nome_completo?: string
          observacoes?: string | null
          turma_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alunos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "alunos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas_escolares"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos_destaque: {
        Row: {
          aluno_id: string
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          disciplina_id: string | null
          exibir_foto: boolean
          foto_url: string | null
          id: string
          indicado_por: string | null
          mes: string
          motivo: string
          motivo_rejeicao: string | null
          posicao: number
          status: Database["public"]["Enums"]["aluno_destaque_status"]
          turma_id: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          disciplina_id?: string | null
          exibir_foto?: boolean
          foto_url?: string | null
          id?: string
          indicado_por?: string | null
          mes: string
          motivo: string
          motivo_rejeicao?: string | null
          posicao: number
          status?: Database["public"]["Enums"]["aluno_destaque_status"]
          turma_id: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          disciplina_id?: string | null
          exibir_foto?: boolean
          foto_url?: string | null
          id?: string
          indicado_por?: string | null
          mes?: string
          motivo?: string
          motivo_rejeicao?: string | null
          posicao?: number
          status?: Database["public"]["Enums"]["aluno_destaque_status"]
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alunos_destaque_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_destaque_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "alunos_destaque_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["disciplina_id"]
          },
          {
            foreignKeyName: "alunos_destaque_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_destaque_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "alunos_destaque_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas_escolares"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos_destaque_historico: {
        Row: {
          acao: string
          after: Json | null
          autor_id: string | null
          before: Json | null
          created_at: string
          destaque_id: string
          id: string
          observacao: string | null
        }
        Insert: {
          acao: string
          after?: Json | null
          autor_id?: string | null
          before?: Json | null
          created_at?: string
          destaque_id: string
          id?: string
          observacao?: string | null
        }
        Update: {
          acao?: string
          after?: Json | null
          autor_id?: string | null
          before?: Json | null
          created_at?: string
          destaque_id?: string
          id?: string
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alunos_destaque_historico_destaque_id_fkey"
            columns: ["destaque_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_destaque_historico_destaque_id_fkey"
            columns: ["destaque_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          path: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_apk_releases: {
        Row: {
          created_at: string
          created_by: string | null
          file_path: string
          file_size: number
          id: string
          is_current: boolean
          notes: string | null
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_path: string
          file_size?: number
          id?: string
          is_current?: boolean
          notes?: string | null
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_path?: string
          file_size?: number
          id?: string
          is_current?: boolean
          notes?: string | null
          version?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      arquivo_preenchimentos: {
        Row: {
          atualizado_por: string | null
          bimestre: number
          created_at: string
          criado_por: string
          dados: Json
          id: string
          template_id: string
          titulo: string
          turma_id: string
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          bimestre: number
          created_at?: string
          criado_por: string
          dados?: Json
          id?: string
          template_id: string
          titulo: string
          turma_id: string
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          bimestre?: number
          created_at?: string
          criado_por?: string
          dados?: Json
          id?: string
          template_id?: string
          titulo?: string
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arquivo_preenchimentos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "arquivo_preenchimentos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas_escolares"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          record_id: string | null
          table_name: string
          updated_at: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name: string
          updated_at?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      autorizacao_respostas: {
        Row: {
          aluno_id: string
          assinado_em: string
          assinatura_nome: string
          autorizacao_id: string
          autorizado: boolean
          id: string
          ip_address: string | null
          observacao: string | null
          respondido_por: string
          user_agent: string | null
        }
        Insert: {
          aluno_id: string
          assinado_em?: string
          assinatura_nome: string
          autorizacao_id: string
          autorizado: boolean
          id?: string
          ip_address?: string | null
          observacao?: string | null
          respondido_por: string
          user_agent?: string | null
        }
        Update: {
          aluno_id?: string
          assinado_em?: string
          assinatura_nome?: string
          autorizacao_id?: string
          autorizado?: boolean
          id?: string
          ip_address?: string | null
          observacao?: string | null
          respondido_por?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autorizacao_respostas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autorizacao_respostas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "autorizacao_respostas_autorizacao_id_fkey"
            columns: ["autorizacao_id"]
            isOneToOne: false
            referencedRelation: "autorizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      autorizacoes: {
        Row: {
          aluno_ids: string[]
          ativo: boolean
          created_at: string
          criado_por: string | null
          data_evento: string | null
          descricao: string
          id: string
          prazo_resposta: string | null
          titulo: string
          turma_ids: string[]
          updated_at: string
        }
        Insert: {
          aluno_ids?: string[]
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          data_evento?: string | null
          descricao: string
          id?: string
          prazo_resposta?: string | null
          titulo: string
          turma_ids?: string[]
          updated_at?: string
        }
        Update: {
          aluno_ids?: string[]
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          data_evento?: string | null
          descricao?: string
          id?: string
          prazo_resposta?: string | null
          titulo?: string
          turma_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      chat_alunos_mensagens: {
        Row: {
          anexo_url: string | null
          autor_tipo: string
          autor_user_id: string
          conteudo: string
          created_at: string
          id: string
          lida_em: string | null
          thread_id: string
        }
        Insert: {
          anexo_url?: string | null
          autor_tipo: string
          autor_user_id: string
          conteudo: string
          created_at?: string
          id?: string
          lida_em?: string | null
          thread_id: string
        }
        Update: {
          anexo_url?: string | null
          autor_tipo?: string
          autor_user_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          lida_em?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_alunos_mensagens_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_alunos_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_alunos_threads: {
        Row: {
          aluno_id: string
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          professor_user_id: string
          responsavel_user_id: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          professor_user_id: string
          responsavel_user_id: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          professor_user_id?: string
          responsavel_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_alunos_threads_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_alunos_threads_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          session_id: string
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicado_leituras: {
        Row: {
          comunicado_id: string
          id: string
          lido_em: string
          usuario_id: string
        }
        Insert: {
          comunicado_id: string
          id?: string
          lido_em?: string
          usuario_id: string
        }
        Update: {
          comunicado_id?: string
          id?: string
          lido_em?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicado_leituras_comunicado_id_fkey"
            columns: ["comunicado_id"]
            isOneToOne: false
            referencedRelation: "comunicados"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicado_templates: {
        Row: {
          autor_id: string
          created_at: string
          id: string
          mensagem: string
          nome: string
          publico: boolean
          titulo: string
          updated_at: string
        }
        Insert: {
          autor_id: string
          created_at?: string
          id?: string
          mensagem: string
          nome: string
          publico?: boolean
          titulo: string
          updated_at?: string
        }
        Update: {
          autor_id?: string
          created_at?: string
          id?: string
          mensagem?: string
          nome?: string
          publico?: boolean
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      comunicados: {
        Row: {
          agendado_para: string | null
          aluno_id: string | null
          anexos: Json
          autor_id: string
          created_at: string
          id: string
          lembrete_apos_horas: number | null
          lembrete_enviado: boolean
          mensagem: string
          push_enfileirado: boolean
          tipo: string
          titulo: string
          turma_id: string | null
        }
        Insert: {
          agendado_para?: string | null
          aluno_id?: string | null
          anexos?: Json
          autor_id: string
          created_at?: string
          id?: string
          lembrete_apos_horas?: number | null
          lembrete_enviado?: boolean
          mensagem: string
          push_enfileirado?: boolean
          tipo: string
          titulo: string
          turma_id?: string | null
        }
        Update: {
          agendado_para?: string | null
          aluno_id?: string | null
          anexos?: Json
          autor_id?: string
          created_at?: string
          id?: string
          lembrete_apos_horas?: number | null
          lembrete_enviado?: boolean
          mensagem?: string
          push_enfileirado?: boolean
          tipo?: string
          titulo?: string
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comunicados_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicados_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "comunicados_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "comunicados_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas_escolares"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_tema: {
        Row: {
          ativo: boolean
          id: number
          intensidade: number
          tema: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          id?: number
          intensidade?: number
          tema?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          id?: number
          intensidade?: number
          tema?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      data_subject_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          descricao: string
          id: string
          protocolo: string
          resolved_at: string | null
          resolved_by: string | null
          solicitante_cpf: string | null
          solicitante_email: string
          solicitante_nome: string
          solicitante_telefone: string | null
          status: Database["public"]["Enums"]["dsr_status"]
          tipo: Database["public"]["Enums"]["dsr_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          descricao: string
          id?: string
          protocolo?: string
          resolved_at?: string | null
          resolved_by?: string | null
          solicitante_cpf?: string | null
          solicitante_email: string
          solicitante_nome: string
          solicitante_telefone?: string | null
          status?: Database["public"]["Enums"]["dsr_status"]
          tipo: Database["public"]["Enums"]["dsr_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          descricao?: string
          id?: string
          protocolo?: string
          resolved_at?: string | null
          resolved_by?: string | null
          solicitante_cpf?: string | null
          solicitante_email?: string
          solicitante_nome?: string
          solicitante_telefone?: string | null
          status?: Database["public"]["Enums"]["dsr_status"]
          tipo?: Database["public"]["Enums"]["dsr_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      developer_faq: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      developer_profile: {
        Row: {
          cargo: string
          contato: string
          created_at: string
          descricao: string
          fallback_message: string
          id: string
          instituicao: string
          localizacao: string
          nome: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          cargo?: string
          contato?: string
          created_at?: string
          descricao?: string
          fallback_message?: string
          id?: string
          instituicao?: string
          localizacao?: string
          nome?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          cargo?: string
          contato?: string
          created_at?: string
          descricao?: string
          fallback_message?: string
          id?: string
          instituicao?: string
          localizacao?: string
          nome?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      disciplinas: {
        Row: {
          ativo: boolean
          categoria: string | null
          codigo: string | null
          cor: string | null
          created_at: string
          descricao: string | null
          destaque: boolean
          id: string
          nome: string
          ordem: number
          professor: string | null
          resumo: string | null
          slug: string | null
          turma: string | null
          turno: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          codigo?: string | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          nome: string
          ordem?: number
          professor?: string | null
          resumo?: string | null
          slug?: string | null
          turma?: string | null
          turno?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          codigo?: string | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          nome?: string
          ordem?: number
          professor?: string | null
          resumo?: string | null
          slug?: string | null
          turma?: string | null
          turno?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      enquete_opcoes: {
        Row: {
          created_at: string
          enquete_id: string
          id: string
          ordem: number
          texto: string
        }
        Insert: {
          created_at?: string
          enquete_id: string
          id?: string
          ordem?: number
          texto: string
        }
        Update: {
          created_at?: string
          enquete_id?: string
          id?: string
          ordem?: number
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquete_opcoes_enquete_id_fkey"
            columns: ["enquete_id"]
            isOneToOne: false
            referencedRelation: "enquetes"
            referencedColumns: ["id"]
          },
        ]
      }
      enquete_respostas: {
        Row: {
          created_at: string
          enquete_id: string
          id: string
          ip_hash: string | null
          opcao_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          enquete_id: string
          id?: string
          ip_hash?: string | null
          opcao_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          enquete_id?: string
          id?: string
          ip_hash?: string | null
          opcao_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enquete_respostas_enquete_id_fkey"
            columns: ["enquete_id"]
            isOneToOne: false
            referencedRelation: "enquetes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquete_respostas_opcao_id_fkey"
            columns: ["opcao_id"]
            isOneToOne: false
            referencedRelation: "enquete_opcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquete_respostas_opcao_id_fkey"
            columns: ["opcao_id"]
            isOneToOne: false
            referencedRelation: "enquete_resultados"
            referencedColumns: ["opcao_id"]
          },
        ]
      }
      enquetes: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          descricao: string | null
          encerra_em: string | null
          id: string
          mostrar_resultados_antes: boolean
          permite_anonimo: boolean
          publico: Database["public"]["Enums"]["enquete_publico"]
          tipo: Database["public"]["Enums"]["enquete_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          encerra_em?: string | null
          id?: string
          mostrar_resultados_antes?: boolean
          permite_anonimo?: boolean
          publico?: Database["public"]["Enums"]["enquete_publico"]
          tipo?: Database["public"]["Enums"]["enquete_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          encerra_em?: string | null
          id?: string
          mostrar_resultados_antes?: boolean
          permite_anonimo?: boolean
          publico?: Database["public"]["Enums"]["enquete_publico"]
          tipo?: Database["public"]["Enums"]["enquete_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          ativo: boolean
          categoria: string | null
          cor: string | null
          created_at: string
          data: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          destaque: boolean
          disciplina: string | null
          horario: string | null
          id: string
          local: string | null
          professor: string | null
          slug: string | null
          tipo: string | null
          titulo: string
          turma: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          cor?: string | null
          created_at?: string
          data?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          destaque?: boolean
          disciplina?: string | null
          horario?: string | null
          id?: string
          local?: string | null
          professor?: string | null
          slug?: string | null
          tipo?: string | null
          titulo: string
          turma?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          cor?: string | null
          created_at?: string
          data?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          destaque?: boolean
          disciplina?: string | null
          horario?: string | null
          id?: string
          local?: string | null
          professor?: string | null
          slug?: string | null
          tipo?: string | null
          titulo?: string
          turma?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      eventos_patrocinio: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      familias_depoimentos: {
        Row: {
          autor_idade: number | null
          autor_nome: string | null
          created_at: string
          email_contato: string | null
          id: string
          ip_hash: string | null
          mensagem: string
          moderado_em: string | null
          moderado_por: string | null
          motivo_rejeicao: string | null
          status: Database["public"]["Enums"]["familia_dep_status"]
          submitted_by: string | null
          tipo: Database["public"]["Enums"]["familia_dep_tipo"]
          turma_ano: string | null
          updated_at: string
          vinculo: Database["public"]["Enums"]["familia_dep_vinculo"]
        }
        Insert: {
          autor_idade?: number | null
          autor_nome?: string | null
          created_at?: string
          email_contato?: string | null
          id?: string
          ip_hash?: string | null
          mensagem: string
          moderado_em?: string | null
          moderado_por?: string | null
          motivo_rejeicao?: string | null
          status?: Database["public"]["Enums"]["familia_dep_status"]
          submitted_by?: string | null
          tipo?: Database["public"]["Enums"]["familia_dep_tipo"]
          turma_ano?: string | null
          updated_at?: string
          vinculo?: Database["public"]["Enums"]["familia_dep_vinculo"]
        }
        Update: {
          autor_idade?: number | null
          autor_nome?: string | null
          created_at?: string
          email_contato?: string | null
          id?: string
          ip_hash?: string | null
          mensagem?: string
          moderado_em?: string | null
          moderado_por?: string | null
          motivo_rejeicao?: string | null
          status?: Database["public"]["Enums"]["familia_dep_status"]
          submitted_by?: string | null
          tipo?: Database["public"]["Enums"]["familia_dep_tipo"]
          turma_ano?: string | null
          updated_at?: string
          vinculo?: Database["public"]["Enums"]["familia_dep_vinculo"]
        }
        Relationships: []
      }
      fcm_diagnostics: {
        Row: {
          cookies_enabled: boolean | null
          created_at: string
          error_code: string | null
          error_message: string | null
          extra: Json
          fcm_config_ok: boolean | null
          id: string
          indexeddb_ok: boolean | null
          is_iframe: boolean | null
          is_in_app_browser: boolean | null
          is_preview: boolean | null
          is_standalone: boolean | null
          notification_permission: string | null
          phase: string
          platform: string
          service_worker_registered: boolean | null
          service_worker_script: string | null
          service_worker_supported: boolean | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          cookies_enabled?: boolean | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          extra?: Json
          fcm_config_ok?: boolean | null
          id?: string
          indexeddb_ok?: boolean | null
          is_iframe?: boolean | null
          is_in_app_browser?: boolean | null
          is_preview?: boolean | null
          is_standalone?: boolean | null
          notification_permission?: string | null
          phase?: string
          platform?: string
          service_worker_registered?: boolean | null
          service_worker_script?: string | null
          service_worker_supported?: boolean | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          cookies_enabled?: boolean | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          extra?: Json
          fcm_config_ok?: boolean | null
          id?: string
          indexeddb_ok?: boolean | null
          is_iframe?: boolean | null
          is_in_app_browser?: boolean | null
          is_preview?: boolean | null
          is_standalone?: boolean | null
          notification_permission?: string | null
          phase?: string
          platform?: string
          service_worker_registered?: boolean | null
          service_worker_script?: string | null
          service_worker_supported?: boolean | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fcm_dispatch_logs: {
        Row: {
          created_at: string
          duration_ms: number
          error_sample: string | null
          errors_count: number
          id: string
          meta: Json
          ok: boolean
          pruned: number
          queue_processed: number
          sent: number
          tokens_total: number
          trigger_source: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          error_sample?: string | null
          errors_count?: number
          id?: string
          meta?: Json
          ok?: boolean
          pruned?: number
          queue_processed?: number
          sent?: number
          tokens_total?: number
          trigger_source?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          error_sample?: string | null
          errors_count?: number
          id?: string
          meta?: Json
          ok?: boolean
          pruned?: number
          queue_processed?: number
          sent?: number
          tokens_total?: number
          trigger_source?: string
        }
        Relationships: []
      }
      fcm_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      frequencia: {
        Row: {
          aluno_id: string
          created_at: string
          data: string
          id: string
          justificativa: string | null
          presente: boolean
          registrado_por: string | null
        }
        Insert: {
          aluno_id: string
          created_at?: string
          data: string
          id?: string
          justificativa?: string | null
          presente?: boolean
          registrado_por?: string | null
        }
        Update: {
          aluno_id?: string
          created_at?: string
          data?: string
          id?: string
          justificativa?: string | null
          presente?: boolean
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frequencia_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      galeria_fotos: {
        Row: {
          altura: number | null
          created_at: string
          criado_por: string | null
          galeria_id: string
          id: string
          largura: number | null
          legenda: string | null
          ordem: number
          storage_path: string | null
          tamanho_bytes: number | null
          updated_at: string
          url: string
        }
        Insert: {
          altura?: number | null
          created_at?: string
          criado_por?: string | null
          galeria_id: string
          id?: string
          largura?: number | null
          legenda?: string | null
          ordem?: number
          storage_path?: string | null
          tamanho_bytes?: number | null
          updated_at?: string
          url: string
        }
        Update: {
          altura?: number | null
          created_at?: string
          criado_por?: string | null
          galeria_id?: string
          id?: string
          largura?: number | null
          legenda?: string | null
          ordem?: number
          storage_path?: string | null
          tamanho_bytes?: number | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "galeria_fotos_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "galerias_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      galerias_eventos: {
        Row: {
          capa_url: string | null
          created_at: string
          criado_por: string | null
          data_evento: string | null
          descricao: string | null
          evento_id: string | null
          id: string
          publicado: boolean
          titulo: string
          updated_at: string
        }
        Insert: {
          capa_url?: string | null
          created_at?: string
          criado_por?: string | null
          data_evento?: string | null
          descricao?: string | null
          evento_id?: string | null
          id?: string
          publicado?: boolean
          titulo: string
          updated_at?: string
        }
        Update: {
          capa_url?: string | null
          created_at?: string
          criado_por?: string | null
          data_evento?: string | null
          descricao?: string | null
          evento_id?: string | null
          id?: string
          publicado?: boolean
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "galerias_eventos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      groq_usage: {
        Row: {
          completion_tokens: number
          created_at: string
          duration_ms: number | null
          error_code: string | null
          id: string
          model: string
          prompt_tokens: number
          session_id: string | null
          status: string
          total_tokens: number
        }
        Insert: {
          completion_tokens?: number
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          model: string
          prompt_tokens?: number
          session_id?: string | null
          status?: string
          total_tokens?: number
        }
        Update: {
          completion_tokens?: number
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          model?: string
          prompt_tokens?: number
          session_id?: string | null
          status?: string
          total_tokens?: number
        }
        Relationships: []
      }
      horarios: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          descricao: string | null
          dia_semana: number | null
          disciplina: string | null
          disciplina_id: string | null
          hora_fim: string | null
          hora_inicio: string | null
          horario: string | null
          horas: string | null
          horas_fim: string | null
          id: string
          local: string | null
          ordem: number
          professor: string | null
          tipo: string | null
          titulo: string | null
          turma: string | null
          turma_id: string | null
          turno: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          dia_semana?: number | null
          disciplina?: string | null
          disciplina_id?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          horario?: string | null
          horas?: string | null
          horas_fim?: string | null
          id?: string
          local?: string | null
          ordem?: number
          professor?: string | null
          tipo?: string | null
          titulo?: string | null
          turma?: string | null
          turma_id?: string | null
          turno?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          dia_semana?: number | null
          disciplina?: string | null
          disciplina_id?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          horario?: string | null
          horas?: string | null
          horas_fim?: string | null
          id?: string
          local?: string | null
          ordem?: number
          professor?: string | null
          tipo?: string | null
          titulo?: string | null
          turma?: string | null
          turma_id?: string | null
          turno?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      justificativas_faltas: {
        Row: {
          aluno_id: string
          arquivo_url: string | null
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          motivo: string
          respondido_em: string | null
          respondido_por: string | null
          resposta_observacao: string | null
          solicitante_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          arquivo_url?: string | null
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          motivo: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_observacao?: string | null
          solicitante_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          arquivo_url?: string | null
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          motivo?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_observacao?: string | null
          solicitante_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "justificativas_faltas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "justificativas_faltas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      mensagens_coordenacao: {
        Row: {
          aluno_id: string | null
          assunto: string
          created_at: string
          id: string
          lida_em: string | null
          mensagem: string
          remetente_id: string
          remetente_nome: string
          remetente_tipo: string
          thread_id: string
        }
        Insert: {
          aluno_id?: string | null
          assunto: string
          created_at?: string
          id?: string
          lida_em?: string | null
          mensagem: string
          remetente_id: string
          remetente_nome: string
          remetente_tipo: string
          thread_id?: string
        }
        Update: {
          aluno_id?: string | null
          assunto?: string
          created_at?: string
          id?: string
          lida_em?: string | null
          mensagem?: string
          remetente_id?: string
          remetente_nome?: string
          remetente_tipo?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_coordenacao_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_coordenacao_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      notas: {
        Row: {
          aluno_id: string
          bimestre: number
          created_at: string
          disciplina: string
          id: string
          lancado_por: string | null
          observacao: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          aluno_id: string
          bimestre: number
          created_at?: string
          disciplina: string
          id?: string
          lancado_por?: string | null
          observacao?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          aluno_id?: string
          bimestre?: number
          created_at?: string
          disciplina?: string
          id?: string
          lancado_por?: string | null
          observacao?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      notes: {
        Row: {
          conteudo: string
          cor: string
          created_at: string
          fixado: boolean
          icone_tamanho: number
          icone_url: string | null
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conteudo?: string
          cor?: string
          created_at?: string
          fixado?: boolean
          icone_tamanho?: number
          icone_url?: string | null
          id?: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conteudo?: string
          cor?: string
          created_at?: string
          fixado?: boolean
          icone_tamanho?: number
          icone_url?: string | null
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notificacoes_inapp: {
        Row: {
          arquivada: boolean
          created_at: string
          icone: string | null
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          metadata: Json
          read_at: string | null
          tipo: Database["public"]["Enums"]["notificacao_tipo"]
          titulo: string
          user_id: string
        }
        Insert: {
          arquivada?: boolean
          created_at?: string
          icone?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          metadata?: Json
          read_at?: string | null
          tipo?: Database["public"]["Enums"]["notificacao_tipo"]
          titulo: string
          user_id: string
        }
        Update: {
          arquivada?: boolean
          created_at?: string
          icone?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          metadata?: Json
          read_at?: string | null
          tipo?: Database["public"]["Enums"]["notificacao_tipo"]
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      parental_consents: {
        Row: {
          aluno_id: string | null
          consented_at: string
          created_at: string
          guardian_cpf: string | null
          guardian_email: string
          guardian_name: string
          guardian_phone: string | null
          id: string
          ip_address: string | null
          minor_dob: string
          minor_name: string
          protocolo: string | null
          term_version: string
          user_agent: string | null
        }
        Insert: {
          aluno_id?: string | null
          consented_at?: string
          created_at?: string
          guardian_cpf?: string | null
          guardian_email: string
          guardian_name: string
          guardian_phone?: string | null
          id?: string
          ip_address?: string | null
          minor_dob: string
          minor_name: string
          protocolo?: string | null
          term_version: string
          user_agent?: string | null
        }
        Update: {
          aluno_id?: string | null
          consented_at?: string
          created_at?: string
          guardian_cpf?: string | null
          guardian_email?: string
          guardian_name?: string
          guardian_phone?: string | null
          id?: string
          ip_address?: string | null
          minor_dob?: string
          minor_name?: string
          protocolo?: string | null
          term_version?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parental_consents_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos_destaque_publicos"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      patrocinadores: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          evento_id: string
          id: string
          link_url: string | null
          logo_url: string | null
          nome: string
          ordem: number
          tipo_apoio: string | null
          updated_at: string
          valor: number | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          evento_id: string
          id?: string
          link_url?: string | null
          logo_url?: string | null
          nome: string
          ordem?: number
          tipo_apoio?: string | null
          updated_at?: string
          valor?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          evento_id?: string
          id?: string
          link_url?: string | null
          logo_url?: string | null
          nome?: string
          ordem?: number
          tipo_apoio?: string | null
          updated_at?: string
          valor?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patrocinadores_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_patrocinio"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_metrics: {
        Row: {
          created_at: string
          duration_ms: number
          id: number
          kind: string
          metadata: Json | null
          name: string
          route: string | null
          session_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms: number
          id?: number
          kind: string
          metadata?: Json | null
          name: string
          route?: string | null
          session_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number
          id?: number
          kind?: string
          metadata?: Json | null
          name?: string
          route?: string | null
          session_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      post_comentarios: {
        Row: {
          autor_avatar: string | null
          autor_email: string | null
          autor_idade: number | null
          autor_nome: string
          autor_sexo: string | null
          conteudo: string
          created_at: string
          id: string
          moderado_em: string | null
          moderado_por: string | null
          post_id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          autor_avatar?: string | null
          autor_email?: string | null
          autor_idade?: number | null
          autor_nome: string
          autor_sexo?: string | null
          conteudo: string
          created_at?: string
          id?: string
          moderado_em?: string | null
          moderado_por?: string | null
          post_id: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          autor_avatar?: string | null
          autor_email?: string | null
          autor_idade?: number | null
          autor_nome?: string
          autor_sexo?: string | null
          conteudo?: string
          created_at?: string
          id?: string
          moderado_em?: string | null
          moderado_por?: string | null
          post_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_comentarios_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          autor: string
          autor_id: string | null
          autor_nome: string | null
          categoria: string | null
          conteudo: string | null
          created_at: string
          data: string
          destaque: boolean
          disciplina: string | null
          embedding: string | null
          embedding_updated_at: string | null
          excerpt: string | null
          geral: boolean
          id: string
          imagem: string | null
          imagem_url: string | null
          motivo_rejeicao: string | null
          ordem: number
          published_at: string | null
          resumo: string
          slug: string | null
          status: Database["public"]["Enums"]["post_status"]
          tags: string[]
          titulo: string
          turma: string | null
          updated_at: string
          views: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          autor?: string
          autor_id?: string | null
          autor_nome?: string | null
          categoria?: string | null
          conteudo?: string | null
          created_at?: string
          data?: string
          destaque?: boolean
          disciplina?: string | null
          embedding?: string | null
          embedding_updated_at?: string | null
          excerpt?: string | null
          geral?: boolean
          id?: string
          imagem?: string | null
          imagem_url?: string | null
          motivo_rejeicao?: string | null
          ordem?: number
          published_at?: string | null
          resumo?: string
          slug?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[]
          titulo: string
          turma?: string | null
          updated_at?: string
          views?: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          autor?: string
          autor_id?: string | null
          autor_nome?: string | null
          categoria?: string | null
          conteudo?: string | null
          created_at?: string
          data?: string
          destaque?: boolean
          disciplina?: string | null
          embedding?: string | null
          embedding_updated_at?: string | null
          excerpt?: string | null
          geral?: boolean
          id?: string
          imagem?: string | null
          imagem_url?: string | null
          motivo_rejeicao?: string | null
          ordem?: number
          published_at?: string | null
          resumo?: string
          slug?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[]
          titulo?: string
          turma?: string | null
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          bio: string | null
          cargo: string | null
          created_at: string
          display_name: string
          email: string | null
          full_name: string | null
          id: string
          matricula: string | null
          notifications_cleared_at: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          bio?: string | null
          cargo?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          full_name?: string | null
          id: string
          matricula?: string | null
          notifications_cleared_at?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          bio?: string | null
          cargo?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          full_name?: string | null
          id?: string
          matricula?: string | null
          notifications_cleared_at?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profissionais: {
        Row: {
          ano_ingresso: number | null
          anos_experiencia: number | null
          ativo: boolean
          bio: string | null
          cargo: string
          cargo_descricao: string | null
          created_at: string
          created_by: string | null
          destaque: boolean
          disciplinas: string[]
          email: string | null
          especializacoes: string[] | null
          formacao: string | null
          foto_url: string | null
          id: string
          lattes_url: string | null
          linkedin_url: string | null
          nome: string
          ordem: number
          site_url: string | null
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ano_ingresso?: number | null
          anos_experiencia?: number | null
          ativo?: boolean
          bio?: string | null
          cargo: string
          cargo_descricao?: string | null
          created_at?: string
          created_by?: string | null
          destaque?: boolean
          disciplinas?: string[]
          email?: string | null
          especializacoes?: string[] | null
          formacao?: string | null
          foto_url?: string | null
          id?: string
          lattes_url?: string | null
          linkedin_url?: string | null
          nome: string
          ordem?: number
          site_url?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ano_ingresso?: number | null
          anos_experiencia?: number | null
          ativo?: boolean
          bio?: string | null
          cargo?: string
          cargo_descricao?: string | null
          created_at?: string
          created_by?: string | null
          destaque?: boolean
          disciplinas?: string[]
          email?: string | null
          especializacoes?: string[] | null
          formacao?: string | null
          foto_url?: string | null
          id?: string
          lattes_url?: string | null
          linkedin_url?: string | null
          nome?: string
          ordem?: number
          site_url?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      push_notifications_queue: {
        Row: {
          attempts: number
          body: string
          created_at: string
          id: string
          last_error: string | null
          processed_at: string | null
          source: string | null
          source_id: string | null
          status: string
          title: string
          url: string | null
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          source?: string | null
          source_id?: string | null
          status?: string
          title: string
          url?: string | null
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          source?: string | null
          source_id?: string | null
          status?: string
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          id: number
          key: string
        }
        Insert: {
          created_at?: string
          id?: number
          key: string
        }
        Update: {
          created_at?: string
          id?: number
          key?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          concluido: boolean
          created_at: string
          data_hora: string
          id: string
          notificado: boolean
          prioridade: string
          texto: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          data_hora: string
          id?: string
          notificado?: boolean
          prioridade?: string
          texto: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          data_hora?: string
          id?: string
          notificado?: boolean
          prioridade?: string
          texto?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      responsaveis: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      system_errors: {
        Row: {
          actor_id: string | null
          context: Json | null
          created_at: string
          id: string
          message: string
          request_path: string | null
          severity: string
          source: string
          stack: string | null
        }
        Insert: {
          actor_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          request_path?: string | null
          severity?: string
          source: string
          stack?: string | null
        }
        Update: {
          actor_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          request_path?: string | null
          severity?: string
          source?: string
          stack?: string | null
        }
        Relationships: []
      }
      turma_sync_logs: {
        Row: {
          created_at: string
          detalhes: Json
          disciplinas_relacionadas: number
          id: string
          turmas_com_erro: number
          turmas_criadas: number
          turmas_puladas: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detalhes?: Json
          disciplinas_relacionadas?: number
          id?: string
          turmas_com_erro?: number
          turmas_criadas?: number
          turmas_puladas?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detalhes?: Json
          disciplinas_relacionadas?: number
          id?: string
          turmas_com_erro?: number
          turmas_criadas?: number
          turmas_puladas?: number
          user_id?: string | null
        }
        Relationships: []
      }
      turmas: {
        Row: {
          ano: number | null
          ativo: boolean
          created_at: string
          descricao: string | null
          destaque: boolean
          id: string
          nome: string
          ordem: number
          professor: string | null
          serie: string | null
          slug: string | null
          turno: string | null
          updated_at: string
        }
        Insert: {
          ano?: number | null
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          nome: string
          ordem?: number
          professor?: string | null
          serie?: string | null
          slug?: string | null
          turno?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number | null
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          nome?: string
          ordem?: number
          professor?: string | null
          serie?: string | null
          slug?: string | null
          turno?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      turmas_escolares: {
        Row: {
          ano_letivo: number
          ano_serie: string
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          professor_responsavel_id: string | null
          turno: string
          updated_at: string
        }
        Insert: {
          ano_letivo?: number
          ano_serie: string
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          professor_responsavel_id?: string | null
          turno: string
          updated_at?: string
        }
        Update: {
          ano_letivo?: number
          ano_serie?: string
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          professor_responsavel_id?: string | null
          turno?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      alunos_destaque_publicos: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          disciplina_cor: string | null
          disciplina_id: string | null
          disciplina_nome: string | null
          exibir_foto: boolean | null
          foto_url: string | null
          id: string | null
          mes: string | null
          motivo: string | null
          posicao: number | null
          turma_ano_serie: string | null
          turma_id: string | null
          turma_nome: string | null
        }
        Relationships: []
      }
      arquivo_preench_exclusoes: {
        Row: {
          dados_removidos: Json | null
          excluido_em: string | null
          excluido_por_email: string | null
          excluido_por_nome: string | null
          excluido_por_user_id: string | null
          log_id: string | null
          preenchimento_id: string | null
        }
        Relationships: []
      }
      configuracoes_tema_public: {
        Row: {
          ativo: boolean | null
          id: number | null
          intensidade: number | null
          tema: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          id?: number | null
          intensidade?: number | null
          tema?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          id?: number | null
          intensidade?: number | null
          tema?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      enquete_resultados: {
        Row: {
          enquete_id: string | null
          opcao_id: string | null
          ordem: number | null
          texto: string | null
          votos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enquete_opcoes_enquete_id_fkey"
            columns: ["enquete_id"]
            isOneToOne: false
            referencedRelation: "enquetes"
            referencedColumns: ["id"]
          },
        ]
      }
      familias_depoimentos_publicos: {
        Row: {
          autor_idade: number | null
          autor_nome: string | null
          created_at: string | null
          id: string | null
          mensagem: string | null
          tipo: Database["public"]["Enums"]["familia_dep_tipo"] | null
          turma_ano: string | null
          vinculo: Database["public"]["Enums"]["familia_dep_vinculo"] | null
        }
        Insert: {
          autor_idade?: number | null
          autor_nome?: string | null
          created_at?: string | null
          id?: string | null
          mensagem?: string | null
          tipo?: Database["public"]["Enums"]["familia_dep_tipo"] | null
          turma_ano?: string | null
          vinculo?: Database["public"]["Enums"]["familia_dep_vinculo"] | null
        }
        Update: {
          autor_idade?: number | null
          autor_nome?: string | null
          created_at?: string | null
          id?: string | null
          mensagem?: string | null
          tipo?: Database["public"]["Enums"]["familia_dep_tipo"] | null
          turma_ano?: string | null
          vinculo?: Database["public"]["Enums"]["familia_dep_vinculo"] | null
        }
        Relationships: []
      }
      patrocinadores_public: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          evento_id: string | null
          id: string | null
          link_url: string | null
          logo_url: string | null
          nome: string | null
          ordem: number | null
          tipo_apoio: string | null
          updated_at: string | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          evento_id?: string | null
          id?: string | null
          link_url?: string | null
          logo_url?: string | null
          nome?: string | null
          ordem?: number | null
          tipo_apoio?: string | null
          updated_at?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          evento_id?: string | null
          id?: string | null
          link_url?: string | null
          logo_url?: string | null
          nome?: string | null
          ordem?: number | null
          tipo_apoio?: string | null
          updated_at?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patrocinadores_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_patrocinio"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comentarios_publicos: {
        Row: {
          autor_avatar: string | null
          autor_nome: string | null
          conteudo: string | null
          created_at: string | null
          id: string | null
          post_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          autor_avatar?: string | null
          autor_nome?: string | null
          conteudo?: string | null
          created_at?: string | null
          id?: string | null
          post_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          autor_avatar?: string | null
          autor_nome?: string | null
          conteudo?: string | null
          created_at?: string | null
          id?: string | null
          post_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_comentarios_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cargo: string | null
          display_name: string | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cargo?: string | null
          display_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cargo?: string | null
          display_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profissionais_publico: {
        Row: {
          ano_ingresso: number | null
          anos_experiencia: number | null
          bio: string | null
          cargo: string | null
          cargo_descricao: string | null
          destaque: boolean | null
          disciplinas: string[] | null
          formacao: string | null
          foto_url: string | null
          id: string | null
          lattes_url: string | null
          linkedin_url: string | null
          nome: string | null
          ordem: number | null
          site_url: string | null
        }
        Insert: {
          ano_ingresso?: number | null
          anos_experiencia?: number | null
          bio?: string | null
          cargo?: string | null
          cargo_descricao?: string | null
          destaque?: boolean | null
          disciplinas?: string[] | null
          formacao?: string | null
          foto_url?: string | null
          id?: string | null
          lattes_url?: string | null
          linkedin_url?: string | null
          nome?: string | null
          ordem?: number | null
          site_url?: string | null
        }
        Update: {
          ano_ingresso?: number | null
          anos_experiencia?: number | null
          bio?: string | null
          cargo?: string | null
          cargo_descricao?: string | null
          destaque?: boolean | null
          disciplinas?: string[] | null
          formacao?: string | null
          foto_url?: string | null
          id?: string | null
          lattes_url?: string | null
          linkedin_url?: string | null
          nome?: string | null
          ordem?: number | null
          site_url?: string | null
        }
        Relationships: []
      }
      profissionais_publicos: {
        Row: {
          ano_ingresso: number | null
          anos_experiencia: number | null
          ativo: boolean | null
          bio: string | null
          cargo: string | null
          cargo_descricao: string | null
          created_at: string | null
          destaque: boolean | null
          disciplinas: string[] | null
          formacao: string | null
          foto_url: string | null
          id: string | null
          lattes_url: string | null
          linkedin_url: string | null
          nome: string | null
          ordem: number | null
          site_url: string | null
          updated_at: string | null
        }
        Insert: {
          ano_ingresso?: number | null
          anos_experiencia?: number | null
          ativo?: boolean | null
          bio?: string | null
          cargo?: string | null
          cargo_descricao?: string | null
          created_at?: string | null
          destaque?: boolean | null
          disciplinas?: string[] | null
          formacao?: string | null
          foto_url?: string | null
          id?: string | null
          lattes_url?: string | null
          linkedin_url?: string | null
          nome?: string | null
          ordem?: number | null
          site_url?: string | null
          updated_at?: string | null
        }
        Update: {
          ano_ingresso?: number | null
          anos_experiencia?: number | null
          ativo?: boolean | null
          bio?: string | null
          cargo?: string | null
          cargo_descricao?: string | null
          created_at?: string | null
          destaque?: boolean | null
          disciplinas?: string[] | null
          formacao?: string | null
          foto_url?: string | null
          id?: string | null
          lattes_url?: string | null
          linkedin_url?: string | null
          nome?: string | null
          ordem?: number | null
          site_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_list_profissionais: {
        Args: never
        Returns: {
          ano_ingresso: number | null
          anos_experiencia: number | null
          ativo: boolean
          bio: string | null
          cargo: string
          cargo_descricao: string | null
          created_at: string
          created_by: string | null
          destaque: boolean
          disciplinas: string[]
          email: string | null
          especializacoes: string[] | null
          formacao: string | null
          foto_url: string | null
          id: string
          lattes_url: string | null
          linkedin_url: string | null
          nome: string
          ordem: number
          site_url: string | null
          telefone: string | null
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profissionais"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      can_delete_arquivo_preenchimento: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_manage_patrocinadores: {
        Args: { _user_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: { _key: string; _max_requests: number; _window_seconds: number }
        Returns: boolean
      }
      cleanup_admin_access_logs: { Args: never; Returns: undefined }
      cleanup_analytics_events: { Args: never; Returns: undefined }
      cleanup_audit_logs: { Args: never; Returns: undefined }
      cleanup_fcm_diagnostics: { Args: never; Returns: undefined }
      cleanup_fcm_dispatch_logs: { Args: never; Returns: undefined }
      cleanup_performance_metrics: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      cleanup_system_errors: { Args: never; Returns: undefined }
      criar_agendamento: {
        Args: {
          p_alvo_cargo?: string
          p_fim_at: string
          p_inicio_at: string
          p_motivo: string
          p_profissional_id?: string
          p_solicitante_contato: string
          p_solicitante_nome: string
          p_solicitante_relacao: string
        }
        Returns: string
      }
      enqueue_due_alert_pushes: { Args: never; Returns: number }
      gerar_protocolo_agendamento: { Args: never; Returns: string }
      gerar_protocolo_dsr: { Args: never; Returns: string }
      get_comentarios_aprovados: {
        Args: { _post_id: string }
        Returns: {
          autor_avatar: string
          autor_nome: string
          conteudo: string
          created_at: string
          id: string
          post_id: string
          status: string
          user_id: string
        }[]
      }
      increment_post_views: { Args: { _post_id: string }; Returns: undefined }
      is_professor_da_turma: {
        Args: { _turma_id: string; _user_id: string }
        Returns: boolean
      }
      is_professor_do_aluno: {
        Args: { _aluno_id: string; _user_id: string }
        Returns: boolean
      }
      is_professor_or_staff: { Args: { _user_id: string }; Returns: boolean }
      is_responsavel_do_aluno: {
        Args: { _aluno_id: string; _user_id: string }
        Returns: boolean
      }
      is_school_admin: { Args: { _user_id: string }; Returns: boolean }
      log_alert_action: {
        Args: {
          _action: string
          _alert_id: string
          _details: Json
          _result: string
        }
        Returns: string
      }
      match_posts: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          autor_nome: string
          categoria: string
          conteudo: string
          excerpt: string
          id: string
          published_at: string
          resumo: string
          similarity: number
          slug: string
          titulo: string
        }[]
      }
      metrics_percentiles: {
        Args: { _hours?: number; _kind?: string }
        Returns: {
          avg_ms: number
          error_rate: number
          kind: string
          max_ms: number
          name: string
          p50: number
          p95: number
          p99: number
          samples: number
        }[]
      }
      normalize_turma_name: { Args: { input: string }; Returns: string }
      process_alert_burst_tick: {
        Args: never
        Returns: {
          enqueued: number
          processed: number
        }[]
      }
      rl_key: { Args: { _scope: string; _subject: string }; Returns: string }
      trigger_dispatch_push: { Args: never; Returns: undefined }
      tv_aniversariantes_hoje: {
        Args: never
        Returns: {
          primeiro_nome: string
          turma_nome: string
        }[]
      }
      tv_aniversariantes_mes: {
        Args: never
        Returns: {
          dia: number
          primeiro_nome: string
          turma_nome: string
        }[]
      }
      unsubscribe_push: { Args: { p_endpoint: string }; Returns: undefined }
    }
    Enums: {
      aluno_destaque_status: "indicado" | "aprovado" | "rejeitado"
      app_role:
        | "desenvolvedor"
        | "admin"
        | "professor"
        | "aluno"
        | "diretor"
        | "coordenador"
        | "secretario"
        | "developer"
        | "director"
        | "coordinator"
        | "teacher"
        | "student"
        | "family"
        | "social_media"
      dsr_status: "pendente" | "em_analise" | "concluida" | "rejeitada"
      dsr_type:
        | "acesso"
        | "correcao"
        | "exclusao"
        | "portabilidade"
        | "oposicao"
        | "anonimizacao"
        | "informacao"
      enquete_publico: "todos" | "autenticados" | "staff"
      enquete_tipo: "unica" | "multipla"
      familia_dep_status: "pendente" | "aprovado" | "rejeitado"
      familia_dep_tipo: "comentario" | "sugestao" | "elogio"
      familia_dep_vinculo:
        | "mae"
        | "pai"
        | "responsavel"
        | "aluno"
        | "professor"
        | "ex_aluno"
        | "comunidade"
      notificacao_tipo:
        | "comunicado"
        | "alerta"
        | "agendamento"
        | "nota"
        | "frequencia"
        | "comentario"
        | "evento"
        | "sistema"
      post_status: "rascunho" | "em_revisao" | "publicado" | "rejeitado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      aluno_destaque_status: ["indicado", "aprovado", "rejeitado"],
      app_role: [
        "desenvolvedor",
        "admin",
        "professor",
        "aluno",
        "diretor",
        "coordenador",
        "secretario",
        "developer",
        "director",
        "coordinator",
        "teacher",
        "student",
        "family",
        "social_media",
      ],
      dsr_status: ["pendente", "em_analise", "concluida", "rejeitada"],
      dsr_type: [
        "acesso",
        "correcao",
        "exclusao",
        "portabilidade",
        "oposicao",
        "anonimizacao",
        "informacao",
      ],
      enquete_publico: ["todos", "autenticados", "staff"],
      enquete_tipo: ["unica", "multipla"],
      familia_dep_status: ["pendente", "aprovado", "rejeitado"],
      familia_dep_tipo: ["comentario", "sugestao", "elogio"],
      familia_dep_vinculo: [
        "mae",
        "pai",
        "responsavel",
        "aluno",
        "professor",
        "ex_aluno",
        "comunidade",
      ],
      notificacao_tipo: [
        "comunicado",
        "alerta",
        "agendamento",
        "nota",
        "frequencia",
        "comentario",
        "evento",
        "sistema",
      ],
      post_status: ["rascunho", "em_revisao", "publicado", "rejeitado"],
    },
  },
} as const

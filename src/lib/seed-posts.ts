// Seed profissional de posts fictícios para demonstração.
// Marcador "Seed Demo" no campo `autor` permite remoção em lote.

export const SEED_AUTHOR_TAG = "Seed Demo";

type SeedPost = {
  titulo: string;
  resumo: string;
  conteudo: string;
  imagem: string;
  autor: string;
  turma: string | null;
  disciplina: string | null;
  destaque: boolean;
  geral: boolean;
  diasAtras: number;
};

export const SEED_POSTS: SeedPost[] = [
  {
    titulo: "Abertura do Ano Letivo 2026: boas-vindas à comunidade escolar",
    resumo:
      "Celebramos o início de mais um ciclo com novidades pedagógicas, projetos interdisciplinares e fortalecimento do vínculo entre família e escola.",
    conteudo: `<h2>Um novo ciclo começa</h2>
<p>É com imensa alegria que a <strong>U.E. Evaristo Campelo de Matos</strong> dá as boas-vindas a estudantes, famílias e equipe pedagógica para o ano letivo de 2026. Este será um ano marcado por <em>inovação, acolhimento e excelência acadêmica</em>.</p>
<h3>Principais novidades</h3>
<ul>
  <li>Novo laboratório de informática equipado com 30 estações de trabalho.</li>
  <li>Programa de leitura intensiva nas séries iniciais.</li>
  <li>Ampliação das atividades esportivas no contraturno.</li>
  <li>Parcerias com universidades para projetos de iniciação científica.</li>
</ul>
<blockquote>“Educar é semear com sabedoria e colher com paciência.” — Augusto Cury</blockquote>
<p>Contamos com a presença e o engajamento de todos. Juntos, faremos de 2026 um ano inesquecível.</p>`,
    imagem: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&q=80",
    autor: `${SEED_AUTHOR_TAG} — Direção`,
    turma: null,
    disciplina: null,
    destaque: true,
    geral: true,
    diasAtras: 1,
  },
  {
    titulo: "Feira de Ciências 2026: inscrições abertas para projetos",
    resumo:
      "Estudantes do Fundamental II e Ensino Médio podem submeter propostas de projetos científicos até 30 de junho. Premiação para os três melhores trabalhos.",
    conteudo: `<h2>Faça ciência com a gente</h2>
<p>A tradicional <strong>Feira de Ciências</strong> da escola está de volta! Este ano, o tema central é <em>“Sustentabilidade e Tecnologias para o Futuro”</em>.</p>
<h3>Categorias</h3>
<ol>
  <li>Ciências Naturais e Meio Ambiente</li>
  <li>Robótica e Computação</li>
  <li>Saúde e Bem-estar</li>
  <li>Tecnologias Sociais</li>
</ol>
<h3>Como participar</h3>
<p>As inscrições devem ser feitas com o professor orientador até <strong>30 de junho</strong>. Cada projeto pode contar com até 4 integrantes.</p>
<p>Os três melhores trabalhos receberão medalhas, certificados e kits de robótica educacional.</p>`,
    imagem: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1200&q=80",
    autor: `${SEED_AUTHOR_TAG} — Coordenação`,
    turma: null,
    disciplina: "Ciências",
    destaque: true,
    geral: false,
    diasAtras: 3,
  },
  {
    titulo: "Reunião de pais e mestres do 1º bimestre",
    resumo:
      "Convocamos os responsáveis para a reunião pedagógica nos dias 14 e 15 de junho, com horários específicos por turma.",
    conteudo: `<h2>Acompanhamento pedagógico</h2>
<p>A participação das famílias é fundamental no processo educativo. Por isso, convidamos todos os responsáveis para a <strong>Reunião de Pais e Mestres</strong> do primeiro bimestre.</p>
<h3>Datas e horários</h3>
<ul>
  <li><strong>14 de junho</strong> — Educação Infantil e Ensino Fundamental I (8h às 11h)</li>
  <li><strong>14 de junho</strong> — Ensino Fundamental II (14h às 17h)</li>
  <li><strong>15 de junho</strong> — Ensino Médio (19h às 21h)</li>
</ul>
<p>Serão entregues os boletins parciais e discutidas as estratégias de apoio individualizado para cada estudante.</p>`,
    imagem: "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=1200&q=80",
    autor: `${SEED_AUTHOR_TAG} — Secretaria`,
    turma: null,
    disciplina: null,
    destaque: false,
    geral: true,
    diasAtras: 5,
  },
  {
    titulo: "Olimpíada Brasileira de Matemática: nossos estudantes na final",
    resumo:
      "Sete estudantes do Ensino Fundamental e Médio foram classificados para a fase final da OBMEP. Conheça os destaques.",
    conteudo: `<h2>Excelência em Matemática</h2>
<p>Temos o orgulho de anunciar que <strong>sete estudantes</strong> da nossa escola foram classificados para a fase final da <em>Olimpíada Brasileira de Matemática das Escolas Públicas (OBMEP)</em>.</p>
<h3>Classificados</h3>
<ul>
  <li>Ana Beatriz Lima — 9º ano</li>
  <li>Carlos Eduardo Santos — 9º ano</li>
  <li>Júlia Mendes — 1ª série EM</li>
  <li>Pedro Henrique Costa — 1ª série EM</li>
  <li>Larissa Oliveira — 2ª série EM</li>
  <li>Rafael Souza — 3ª série EM</li>
  <li>Mariana Alves — 3ª série EM</li>
</ul>
<p>A fase final acontecerá em outubro. Parabéns aos estudantes e ao professor <strong>Marcos Vinícius</strong> pela dedicação!</p>`,
    imagem: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200&q=80",
    autor: `${SEED_AUTHOR_TAG} — Coordenação`,
    turma: null,
    disciplina: "Matemática",
    destaque: true,
    geral: false,
    diasAtras: 7,
  },
  {
    titulo: "Projeto de leitura: 1.000 livros em 6 meses",
    resumo:
      "A biblioteca escolar superou a meta semestral graças ao engajamento das turmas do Fundamental I.",
    conteudo: `<h2>Lendo, aprendemos a voar</h2>
<p>O projeto <strong>“Leitores do Amanhã”</strong> ultrapassou a marca de <em>1.000 livros emprestados</em> em apenas seis meses. O resultado mostra o impacto positivo da rotina diária de leitura nas turmas do Fundamental I.</p>
<h3>Top 3 turmas leitoras</h3>
<ol>
  <li><strong>4º ano A</strong> — 187 livros</li>
  <li><strong>5º ano B</strong> — 162 livros</li>
  <li><strong>3º ano A</strong> — 154 livros</li>
</ol>
<p>Como recompensa, as turmas vencedoras ganharão uma manhã especial com contação de histórias e oficinas literárias.</p>`,
    imagem: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&q=80",
    autor: `${SEED_AUTHOR_TAG} — Biblioteca`,
    turma: "4º ano A",
    disciplina: "Português",
    destaque: false,
    geral: false,
    diasAtras: 10,
  },
  {
    titulo: "Semana Cultural Afro-Brasileira: programação completa",
    resumo:
      "De 17 a 21 de novembro, oficinas, apresentações e mostras valorizando a cultura afro-brasileira e indígena.",
    conteudo: `<h2>Diversidade como princípio</h2>
<p>A <strong>Semana Cultural Afro-Brasileira</strong> reúne apresentações artísticas, oficinas e debates sobre a contribuição dos povos africanos e indígenas para a formação da identidade nacional.</p>
<h3>Programação</h3>
<ul>
  <li><strong>Segunda</strong> — Abertura com apresentação de capoeira</li>
  <li><strong>Terça</strong> — Oficina de trançado e turbantes</li>
  <li><strong>Quarta</strong> — Roda de conversa com escritores afro-brasileiros</li>
  <li><strong>Quinta</strong> — Festival de comidas típicas</li>
  <li><strong>Sexta</strong> — Mostra de dança e encerramento</li>
</ul>
<blockquote>“A diversidade é a riqueza da humanidade.” — Nelson Mandela</blockquote>`,
    imagem: "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=1200&q=80",
    autor: `${SEED_AUTHOR_TAG} — Coordenação Cultural`,
    turma: null,
    disciplina: "História",
    destaque: false,
    geral: true,
    diasAtras: 14,
  },
  {
    titulo: "Novo laboratório de robótica é inaugurado",
    resumo:
      "Espaço conta com 12 kits LEGO Mindstorms, impressora 3D e bancadas de eletrônica para projetos do contraturno.",
    conteudo: `<h2>Tecnologia ao alcance de todos</h2>
<p>Foi inaugurado nesta semana o novo <strong>Laboratório de Robótica e Tecnologia</strong> da escola. O espaço, fruto de uma parceria com a Secretaria de Educação, está equipado com:</p>
<ul>
  <li>12 kits LEGO Mindstorms EV3</li>
  <li>Uma impressora 3D Ender 3 V2</li>
  <li>Bancadas de eletrônica com Arduino e Raspberry Pi</li>
  <li>Computadores de alto desempenho</li>
</ul>
<p>As atividades começam em julho e serão ofertadas no contraturno para estudantes do <strong>6º ano em diante</strong>.</p>
<p>Inscrições com o professor <strong>Lucas Ferreira</strong> ou na secretaria.</p>`,
    imagem: "https://images.unsplash.com/photo-1581090700227-1e37b190418e?w=1200&q=80",
    autor: `${SEED_AUTHOR_TAG} — Direção`,
    turma: null,
    disciplina: "Tecnologia",
    destaque: true,
    geral: false,
    diasAtras: 18,
  },
  {
    titulo: "Campanha do agasalho 2026 arrecada mais de 500 peças",
    resumo:
      "Iniciativa solidária mobilizou estudantes, famílias e equipe escolar. Doações serão entregues a duas instituições parceiras.",
    conteudo: `<h2>Solidariedade que aquece</h2>
<p>A <strong>Campanha do Agasalho 2026</strong> da nossa escola encerrou com mais de <em>500 peças arrecadadas</em>, entre roupas, calçados, cobertores e itens infantis.</p>
<h3>Destinação</h3>
<p>As doações serão entregues a duas instituições parceiras:</p>
<ul>
  <li><strong>Casa de Acolhimento São Vicente</strong></li>
  <li><strong>Associação Comunitária Bairro Novo</strong></li>
</ul>
<p>Agradecemos imensamente a cada família, estudante e colaborador que abraçou a causa. <em>Educar também é praticar empatia.</em></p>`,
    imagem: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200&q=80",
    autor: `${SEED_AUTHOR_TAG} — Pastoral`,
    turma: null,
    disciplina: null,
    destaque: false,
    geral: true,
    diasAtras: 22,
  },
];

// Base de citações/opiniões exibidas no card "Opinião" da home.
// Rotação: uma entrada por hora marcada, das 07:00 às 17:00 (11 slots),
// avançando também por dia — assim toda a lista é percorrida ao longo do tempo.

export type OpinionKind = "citacao" | "opiniao";

export interface OpinionEntry {
  text: string;
  author: string;
  role: string;
  initials: string;
  type: OpinionKind;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");

const q = (author: string, role: string, text: string): OpinionEntry => ({
  text,
  author,
  role,
  initials: initials(author),
  type: "citacao",
});

const o = (author: string, role: string, text: string): OpinionEntry => ({
  text,
  author,
  role,
  initials: initials(author),
  type: "opiniao",
});

export const OPINIONS: OpinionEntry[] = [
  // Editorial da escola (opiniões)
  o(
    "Direção Escolar",
    "Editorial",
    "A educação é a ferramenta mais poderosa para transformar a comunidade — e ela começa dentro da nossa escola.",
  ),
  o(
    "Direção Escolar",
    "Editorial",
    "Cada aluno que atravessa nossos portões carrega uma história — e nosso papel é ajudá-lo a escrever o próximo capítulo.",
  ),
  o(
    "Coordenação Pedagógica",
    "Editorial",
    "Ensinar é acender uma centelha; o resto é responsabilidade compartilhada entre escola, família e comunidade.",
  ),
  o(
    "Conselho Escolar",
    "Editorial",
    "Uma escola forte se mede pelos vínculos que constrói, não apenas pelas notas que registra.",
  ),

  // Albert Einstein
  q("Albert Einstein", "Físico", "A imaginação é mais importante que o conhecimento."),
  q(
    "Albert Einstein",
    "Físico",
    "Não devemos deixar de fazer perguntas. A curiosidade tem sua própria razão de existir.",
  ),
  q(
    "Albert Einstein",
    "Físico",
    "A vida é como andar de bicicleta: para manter o equilíbrio, é preciso continuar em movimento.",
  ),
  q(
    "Albert Einstein",
    "Físico",
    "A educação é aquilo que resta depois que esquecemos tudo o que aprendemos na escola.",
  ),
  q("Albert Einstein", "Físico", "A ciência sem religião é manca; a religião sem ciência é cega."),
  q(
    "Albert Einstein",
    "Físico",
    "Nenhum problema pode ser resolvido a partir do mesmo nível de consciência que o criou.",
  ),
  q(
    "Oliver Wendell Holmes",
    "Escritor e Médico",
    "A mente que se abre a uma nova ideia jamais voltará ao seu tamanho original.",
  ),
  q(
    "Rita Mae Brown",
    "Escritora",
    "Insanidade é fazer sempre a mesma coisa e esperar resultados diferentes.",
  ),
  q("Albert Einstein", "Físico", "Só uma vida vivida para os outros vale a pena ser vivida."),
  q(
    "Albert Einstein",
    "Físico",
    "Aprenda com o ontem, viva o hoje, tenha esperança no amanhã. O importante é não parar de questionar.",
  ),
  q(
    "Albert Einstein",
    "Físico",
    "A verdadeira medida da inteligência não é o conhecimento, mas a imaginação.",
  ),
  q(
    "Albert Einstein",
    "Físico",
    "Grandes espíritos sempre encontraram violenta oposição de mentes medíocres.",
  ),
  q(
    "Albert Einstein",
    "Físico",
    "Se você não consegue explicar algo de forma simples, é porque não entendeu bem o suficiente.",
  ),

  // Isaac Newton
  q(
    "Isaac Newton",
    "Físico e Matemático",
    "Se vi mais longe, foi por estar sobre os ombros de gigantes.",
  ),
  q(
    "Isaac Newton",
    "Físico e Matemático",
    "O que sabemos é uma gota; o que ignoramos é um oceano.",
  ),
  q(
    "Isaac Newton",
    "Físico e Matemático",
    "A natureza se satisfaz com a simplicidade e não aprecia a pompa de causas supérfluas.",
  ),
  q(
    "Isaac Newton",
    "Físico e Matemático",
    "A verdade é sempre encontrada na simplicidade, e não na multiplicidade e confusão das coisas.",
  ),
  q(
    "Isaac Newton",
    "Físico e Matemático",
    "A gravidade explica os movimentos dos planetas, mas não pode explicar quem coloca os planetas em movimento.",
  ),
  q(
    "Isaac Newton",
    "Físico e Matemático",
    "Platão é meu amigo, Aristóteles é meu amigo, mas minha maior amiga é a verdade.",
  ),
  q(
    "Isaac Newton",
    "Físico e Matemático",
    "Toda ação tem uma reação de igual intensidade e sentido oposto — inclusive na vida.",
  ),
  q(
    "Isaac Newton",
    "Físico e Matemático",
    "Se eu tenho descoberto algo de valor, devo isso muito mais à atenção paciente do que a qualquer outro talento.",
  ),

  // Charles Darwin
  q(
    "Leon C. Megginson",
    "Professor de Administração",
    "Não é o mais forte que sobrevive, nem o mais inteligente, mas o que melhor se adapta às mudanças. (paráfrase de Darwin)",
  ),
  q(
    "Charles Darwin",
    "Naturalista",
    "A ignorância gera confiança com mais frequência do que o conhecimento.",
  ),
  q(
    "Charles Darwin",
    "Naturalista",
    "Um homem que ousa desperdiçar uma hora de sua vida não descobriu o valor da vida.",
  ),
  q("Charles Darwin", "Naturalista", "Amamos aquilo a que dedicamos nosso tempo."),
  q(
    "Charles Darwin",
    "Naturalista",
    "O amor a todas as criaturas vivas é o mais nobre atributo do homem.",
  ),
  q(
    "Charles Darwin",
    "Naturalista",
    "Nas longas eras, o mundo se ilumina para aqueles que observam com paciência.",
  ),
  q(
    "Charles Darwin",
    "Naturalista",
    "A ciência consiste em organizar os fatos de modo que se possam tirar leis gerais deles.",
  ),
  q("Charles Darwin", "Naturalista", "Não há absolutamente nenhum limite para o progresso humano."),

  // Marie Curie
  q(
    "Marie Curie",
    "Cientista",
    "Nada na vida deve ser temido, somente compreendido. Agora é hora de compreender mais para temer menos.",
  ),
  q("Marie Curie", "Cientista", "Sou daquelas que pensam que a ciência tem uma grande beleza."),
  q(
    "Marie Curie",
    "Cientista",
    "Seja menos curioso sobre as pessoas e mais curioso sobre as ideias.",
  ),
  q(
    "Marie Curie",
    "Cientista",
    "Nunca se percebe o que já foi feito; só se pode ver o que ainda precisa ser feito.",
  ),
  q(
    "Marie Curie",
    "Cientista",
    "Não se pode esperar construir um mundo melhor sem melhorar os indivíduos.",
  ),
  q(
    "Marie Curie",
    "Cientista",
    "A vida não é fácil para nenhum de nós. Mas é preciso ter perseverança e, sobretudo, confiança em si mesmo.",
  ),
  q(
    "Marie Curie",
    "Cientista",
    "Tenho a convicção de que a ciência tem grande beleza e valor educativo.",
  ),
  q(
    "Marie Curie",
    "Cientista",
    "Um cientista, em seu laboratório, não é apenas um técnico: é também uma criança diante dos fenômenos naturais.",
  ),

  // Galileu Galilei
  q("Galileu Galilei", "Astrônomo", "E, no entanto, ela se move."),
  q(
    "Galileu Galilei",
    "Astrônomo",
    "Não se pode ensinar nada a um homem; só se pode ajudá-lo a descobrir dentro de si mesmo.",
  ),
  q(
    "Galileu Galilei",
    "Astrônomo",
    "A matemática é o alfabeto com o qual Deus escreveu o universo.",
  ),
  q("Galileu Galilei", "Astrônomo", "A dúvida é a mãe da descoberta."),
  q("Galileu Galilei", "Astrônomo", "Meça o que é mensurável, e torne mensurável o que não é."),
  q("Galileu Galilei", "Astrônomo", "A paixão é a essência de toda descoberta científica."),
  q(
    "Galileu Galilei",
    "Astrônomo",
    "Todas as verdades são fáceis de entender uma vez descobertas; o difícil é descobri-las.",
  ),
  q(
    "Galileu Galilei",
    "Astrônomo",
    "O sol, com todos aqueles planetas girando ao seu redor, ainda pode amadurecer um cacho de uvas como se não tivesse mais nada no universo para fazer.",
  ),

  // Nikola Tesla
  q(
    "Nikola Tesla",
    "Inventor",
    "O presente é deles; o futuro, pelo qual realmente trabalhei, é meu.",
  ),
  q(
    "Nikola Tesla",
    "Inventor",
    "Se você quer descobrir os segredos do universo, pense em termos de energia, frequência e vibração.",
  ),
  q(
    "Nikola Tesla",
    "Inventor",
    "Não me importo que tenham roubado minha ideia. Importo-me que eles não tenham ideias próprias.",
  ),
  q(
    "Nikola Tesla",
    "Inventor",
    "A vida é e sempre será uma equação incapaz de ser resolvida, mas contém certos fatores conhecidos.",
  ),
  q(
    "Nikola Tesla",
    "Inventor",
    "Os cientistas de hoje pensam profundamente em vez de pensar com clareza. É preciso estar são para pensar com clareza.",
  ),
  q(
    "Nikola Tesla",
    "Inventor",
    "Nossas virtudes e nossos defeitos são inseparáveis, como a força e a matéria.",
  ),
  q("Nikola Tesla", "Inventor", "A recompensa que se recebe pelo esforço é o próprio esforço."),
  q("Nikola Tesla", "Inventor", "O que uma pessoa pode fazer, outra pode fazer também."),

  // Sócrates
  q("Sócrates", "Filósofo", "Só sei que nada sei."),
  q("Sócrates", "Filósofo", "Uma vida não examinada não vale a pena ser vivida."),
  q("Sócrates", "Filósofo", "Conhece-te a ti mesmo."),
  q("Sócrates", "Filósofo", "A sabedoria começa no assombro."),
  q(
    "Sócrates",
    "Filósofo",
    "Não é vivendo, mas vivendo bem, que devemos considerar o mais importante.",
  ),
  q("Sócrates", "Filósofo", "Falar bem é um dever, mas viver bem é uma virtude."),
  q("Sócrates", "Filósofo", "Os que são difíceis de agradar não são amigos por muito tempo."),
  q(
    "Plutarco",
    "Filósofo e Historiador",
    "A educação é o acender de uma chama, não o encher de um vaso.",
  ),
  q("Sócrates", "Filósofo", "Prefiro morrer defendendo minhas convicções a viver renegando-as."),
  q(
    "Sócrates",
    "Filósofo",
    "Empregue seu tempo em melhorar-se pelos escritos dos outros, para que consiga facilmente aquilo pelo qual outros trabalharam arduamente.",
  ),

  // Platão
  q("Platão", "Filósofo", "O início é a parte mais importante do trabalho."),
  q("Platão", "Filósofo", "A necessidade é a mãe da invenção."),
  q("Platão", "Filósofo", "Ser é ser percebido — e ser lembrado é uma segunda forma de existir."),
  q(
    "Platão",
    "Filósofo",
    "A música é uma lei moral: dá alma ao universo, asas ao pensamento, voo à imaginação.",
  ),
  q(
    "Platão",
    "Filósofo",
    "Homens sábios falam porque têm algo a dizer; tolos, porque têm que dizer algo.",
  ),
  q("Platão", "Filósofo", "Coragem é saber o que não temer."),
  q("Platão", "Filósofo", "A ignorância, raiz e caule de todos os males."),
  q("Platão", "Filósofo", "A justiça, em sua essência, é dar a cada um o que lhe é devido."),
  q(
    "Platão",
    "Filósofo",
    "Bons são aqueles que se contentam apenas em sonhar aquilo que os maus realizam.",
  ),
  q("Platão", "Filósofo", "A educação é o caminho para transformar uma alma."),

  // Aristóteles
  q(
    "Will Durant",
    "Historiador",
    "Somos aquilo que fazemos repetidamente. Excelência, então, não é um ato, mas um hábito. (síntese sobre Aristóteles)",
  ),
  q(
    "Aristóteles",
    "Filósofo",
    "A marca de uma mente educada é ser capaz de considerar uma ideia sem aceitá-la.",
  ),
  q("Aristóteles", "Filósofo", "As raízes da educação são amargas, mas o fruto é doce."),
  q("Aristóteles", "Filósofo", "Educar a mente sem educar o coração não é educação."),
  q("Aristóteles", "Filósofo", "Conhecer a si mesmo é o começo de toda sabedoria."),
  q("Aristóteles", "Filósofo", "O homem é, por natureza, um animal político."),
  q("Aristóteles", "Filósofo", "A esperança é o sonho do homem acordado."),
  q("Aristóteles", "Filósofo", "A felicidade depende de nós mesmos."),
  q("Aristóteles", "Filósofo", "O sábio não diz tudo o que pensa, mas pensa tudo o que diz."),
  q("Aristóteles", "Filósofo", "Amigos são uma alma que habita dois corpos."),

  // Confúcio
  q("Confúcio", "Filósofo", "Não importa quão devagar você vá, desde que não pare."),
  q("Confúcio", "Filósofo", "Aquele que move uma montanha começa carregando pequenas pedras."),
  q("Confúcio", "Filósofo", "Aprender sem pensar é inútil; pensar sem aprender é perigoso."),
  q("Confúcio", "Filósofo", "A vida é realmente simples, mas insistimos em torná-la complicada."),
  q(
    "Confúcio",
    "Filósofo",
    "Quando é óbvio que as metas não podem ser atingidas, não ajuste as metas, ajuste os passos de ação.",
  ),
  q(
    "Confúcio",
    "Filósofo",
    "Aquele que aprende, mas não pensa, está perdido. Aquele que pensa, mas não aprende, está em grande perigo.",
  ),
  q("Confúcio", "Filósofo", "Onde quer que você vá, vá com todo o seu coração."),
  q("Confúcio", "Filósofo", "Antes de embarcar em uma jornada de vingança, cave duas covas."),
  q("Confúcio", "Filósofo", "Ouço e esqueço. Vejo e me lembro. Faço e compreendo."),
  q("Confúcio", "Filósofo", "O silêncio é um amigo verdadeiro que nunca trai."),

  // Lao Tzu
  q("Lao Tzu", "Filósofo", "Uma jornada de mil milhas começa com um único passo."),
  q("Lao Tzu", "Filósofo", "Conhecer os outros é sabedoria; conhecer a si mesmo é iluminação."),
  q("Lao Tzu", "Filósofo", "Quando eu me solto do que eu sou, torno-me o que poderia ser."),
  q("Lao Tzu", "Filósofo", "A natureza não tem pressa, mas tudo se realiza."),
  q("Lao Tzu", "Filósofo", "Cuide dos seus pensamentos, pois eles se tornarão palavras."),
  q("Lao Tzu", "Filósofo", "Aquele que sabe não fala; aquele que fala não sabe."),
  q("Lao Tzu", "Filósofo", "O bom viajante não tem planos fixos e não está preocupado em chegar."),
  q("Lao Tzu", "Filósofo", "Quando estou em paz comigo mesmo, encontro paz com o mundo."),
  q("Lao Tzu", "Filósofo", "A brandura vence a rigidez, e a fraqueza vence a força."),
  q("Lao Tzu", "Filósofo", "Aquele que vence a si mesmo é o mais poderoso dos guerreiros."),

  // René Descartes
  q("René Descartes", "Filósofo", "Penso, logo existo."),
  q(
    "René Descartes",
    "Filósofo",
    "Duvidar de tudo ou crer em tudo são duas soluções igualmente cômodas, que nos dispensam de refletir.",
  ),
  q(
    "René Descartes",
    "Filósofo",
    "A leitura de todos os bons livros é como uma conversa com os mais ilustres homens dos séculos passados.",
  ),
  q("René Descartes", "Filósofo", "Não basta ter um bom espírito, o principal é aplicá-lo bem."),
  q(
    "René Descartes",
    "Filósofo",
    "Cada problema que resolvi tornou-se uma regra que serviu depois para resolver outros problemas.",
  ),
  q("René Descartes", "Filósofo", "A dúvida é o princípio da sabedoria."),
  q("René Descartes", "Filósofo", "O bom senso é a coisa mais bem distribuída do mundo."),
  q(
    "René Descartes",
    "Filósofo",
    "Para investigar a verdade, é preciso duvidar, tanto quanto possível, de todas as coisas.",
  ),
  q(
    "René Descartes",
    "Filósofo",
    "Divide cada dificuldade em tantas partes quantas forem possíveis e necessárias para resolvê-las.",
  ),
  q("René Descartes", "Filósofo", "Vencer-se a si mesmo é a maior das vitórias."),

  // Friedrich Nietzsche
  q(
    "Friedrich Nietzsche",
    "Filósofo",
    "Aquele que tem um porquê para viver pode suportar quase qualquer como.",
  ),
  q("Friedrich Nietzsche", "Filósofo", "O que não me mata, me fortalece."),
  q("Friedrich Nietzsche", "Filósofo", "Sem música, a vida seria um erro."),
  q("Friedrich Nietzsche", "Filósofo", "Torna-te aquilo que és."),
  q(
    "Friedrich Nietzsche",
    "Filósofo",
    "Quem luta contra monstros deve cuidar para não se tornar um deles.",
  ),
  q(
    "Friedrich Nietzsche",
    "Filósofo",
    "Há mais razão em teu corpo do que em tua melhor sabedoria.",
  ),
  q(
    "Friedrich Nietzsche",
    "Filósofo",
    "Não são as certezas, mas as dúvidas que nos fazem crescer.",
  ),
  q(
    "Friedrich Nietzsche",
    "Filósofo",
    "É preciso ter caos dentro de si para dar à luz uma estrela dançarina.",
  ),
  q("Friedrich Nietzsche", "Filósofo", "Toda verdade profunda ama a máscara."),
  q("Friedrich Nietzsche", "Filósofo", "Não existem fatos, apenas interpretações."),
  q(
    "Friedrich Nietzsche",
    "Filósofo",
    "O homem é uma corda estendida entre o animal e o super-homem — uma corda sobre um abismo.",
  ),

  // Reforço com outros pensadores clássicos
  q(
    "Immanuel Kant",
    "Filósofo",
    "Age de tal modo que a máxima de tua ação possa valer como princípio de uma legislação universal.",
  ),
  q(
    "Immanuel Kant",
    "Filósofo",
    "A ciência é conhecimento organizado. A sabedoria é vida organizada.",
  ),
  q(
    "Immanuel Kant",
    "Filósofo",
    "Ilumina-te: tem a coragem de fazer uso do teu próprio entendimento.",
  ),
  q(
    "Evelyn Beatrice Hall",
    "Biógrafa de Voltaire",
    "Não concordo com uma palavra do que dizes, mas defenderei até a morte o teu direito de dizê-lo. (síntese do pensamento de Voltaire)",
  ),
  q(
    "Voltaire",
    "Filósofo",
    "O trabalho afasta de nós três grandes males: o tédio, o vício e a necessidade.",
  ),
  q("Voltaire", "Filósofo", "Julgue um homem por suas perguntas, e não por suas respostas."),
  q(
    "Jean-Jacques Rousseau",
    "Filósofo",
    "O homem nasce livre, e por toda parte encontra-se agarrado a ferros.",
  ),
  q("Jean-Jacques Rousseau", "Filósofo", "A paciência é amarga, mas seus frutos são doces."),
  q("John Locke", "Filósofo", "O que preocupa o homem não é a morte, mas a ideia da morte."),
  q(
    "John Locke",
    "Filósofo",
    "A leitura fornece à mente materiais para o conhecimento; é o pensamento que faz nosso o que lemos.",
  ),
  q("David Hume", "Filósofo", "A razão é, e deve ser, escrava das paixões."),
  q("David Hume", "Filósofo", "O costume é o grande guia da vida humana."),
  q(
    "Sêneca",
    "Filósofo",
    "Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.",
  ),
  q("Sêneca", "Filósofo", "Enquanto esperamos pela vida, a vida passa."),
  q(
    "Sêneca",
    "Filósofo",
    "Todo lugar é um bom lugar para o homem sábio, pois a alma virtuosa está em casa em qualquer parte do universo.",
  ),
  q(
    "Marco Aurélio",
    "Filósofo",
    "Você tem poder sobre a sua mente — não sobre os eventos externos. Perceba isso e você encontrará força.",
  ),
  q(
    "Marco Aurélio",
    "Filósofo",
    "A felicidade da sua vida depende da qualidade dos seus pensamentos.",
  ),
  q(
    "Marco Aurélio",
    "Filósofo",
    "Reserva-te o direito de pensar; até mesmo pensar errado é melhor do que não pensar.",
  ),
  q(
    "Epicteto",
    "Filósofo",
    "Não são as coisas que perturbam os homens, mas a opinião que eles têm delas.",
  ),
  q("Epicteto", "Filósofo", "Só o homem instruído é livre."),
  q("Heráclito", "Filósofo", "Nada é permanente, exceto a mudança."),
  q("Heráclito", "Filósofo", "Ninguém entra no mesmo rio duas vezes."),
  q("Pitágoras", "Filósofo e Matemático", "Educai as crianças e não será preciso punir os homens."),
  q("Pitágoras", "Filósofo e Matemático", "O silêncio é o primeiro degrau da sabedoria."),
  q("Diógenes", "Filósofo", "A base de todo Estado é a educação dos seus jovens."),
  q("Epicuro", "Filósofo", "Não estrague o que você tem desejando o que não tem."),

  // Renascimento e modernos
  q("Leonardo da Vinci", "Artista e Cientista", "A simplicidade é o último grau da sofisticação."),
  q(
    "Leonardo da Vinci",
    "Artista e Cientista",
    "Aprender é a única coisa de que a mente nunca se cansa, nunca tem medo e nunca se arrepende.",
  ),
  q("Leonardo da Vinci", "Artista e Cientista", "Quem pouco pensa, muito erra."),
  q(
    "Leonardo da Vinci",
    "Artista e Cientista",
    "Os obstáculos não me dobram. Toda resistência é vencida por firme determinação.",
  ),
  q(
    "Michelangelo",
    "Artista",
    "O maior perigo para a maioria de nós não está em estabelecer nossa meta muito alta e falhar; mas em estabelecê-la muito baixa e alcançá-la.",
  ),
  q(
    "Nicolau Copérnico",
    "Astrônomo",
    "Saber que sabemos o que sabemos, e saber que não sabemos o que não sabemos: isso é o conhecimento verdadeiro.",
  ),
  q(
    "Johannes Kepler",
    "Astrônomo",
    "A verdade é filha do tempo, e não me envergonho de ser sua parteira.",
  ),
  q(
    "Blaise Pascal",
    "Filósofo e Matemático",
    "O coração tem razões que a própria razão desconhece.",
  ),
  q(
    "Blaise Pascal",
    "Filósofo e Matemático",
    "Toda a infelicidade dos homens vem de uma única coisa: não saberem ficar em repouso, num quarto.",
  ),
  q(
    "Baruch Espinoza",
    "Filósofo",
    "A paz não é a ausência de guerra, é uma virtude, um estado de espírito, uma disposição para a benevolência, a confiança, a justiça.",
  ),
  q("Baruch Espinoza", "Filósofo", "Não rir, não lamentar, não detestar, mas compreender."),
  q(
    "Arthur Schopenhauer",
    "Filósofo",
    "O talento acerta um alvo que ninguém mais pode acertar; o gênio acerta um alvo que ninguém mais pode ver.",
  ),
  q(
    "Søren Kierkegaard",
    "Filósofo",
    "A vida só pode ser compreendida olhando-se para trás, mas só pode ser vivida olhando-se para frente.",
  ),
  q(
    "John Stuart Mill",
    "Filósofo",
    "É melhor ser um ser humano insatisfeito do que um porco satisfeito.",
  ),
  q(
    "Karl Popper",
    "Filósofo",
    "Nossa ignorância é infinita e desanimadora, e cada solução de um problema científico levanta novos problemas ainda não resolvidos.",
  ),
  q(
    "Bertrand Russell",
    "Filósofo",
    "O problema com o mundo é que os estúpidos são cheios de certezas, enquanto os inteligentes são cheios de dúvidas.",
  ),
  q("Bertrand Russell", "Filósofo", "A ciência é o que sabemos; a filosofia é o que não sabemos."),
  q(
    "Ludwig Wittgenstein",
    "Filósofo",
    "Os limites da minha linguagem são os limites do meu mundo.",
  ),
  q("Jean-Paul Sartre", "Filósofo", "O homem está condenado a ser livre."),
  q("Simone de Beauvoir", "Filósofa", "Não se nasce mulher, torna-se mulher."),
  q(
    "Simone de Beauvoir",
    "Filósofa",
    "A vida se ocupa ao mesmo tempo em perpetuar-se e em ultrapassar-se; se ela apenas se conserva, viver é apenas não morrer.",
  ),
  q("Hannah Arendt", "Filósofa", "Ninguém tem o direito de obedecer."),
  q("Michel Foucault", "Filósofo", "Onde há poder, há resistência."),
  q(
    "Albert Camus",
    "Filósofo",
    "No meio do inverno, aprendi por fim que havia em mim um verão invencível.",
  ),
  q(
    "Albert Camus",
    "Filósofo",
    "A verdadeira generosidade para com o futuro consiste em dar tudo ao presente.",
  ),
  q("Carl Sagan", "Astrônomo", "Em algum lugar, algo incrível está esperando para ser conhecido."),
  q(
    "Carl Sagan",
    "Astrônomo",
    "A ciência é mais do que um corpo de conhecimento; é uma maneira de pensar.",
  ),
  q("Stephen Hawking", "Físico", "A inteligência é a capacidade de se adaptar às mudanças."),
  q(
    "Stephen Hawking",
    "Físico",
    "Não importa quão difícil a vida possa parecer, sempre há algo que você pode fazer e ter sucesso.",
  ),
  q(
    "Richard Feynman",
    "Físico",
    "Estudo minha ignorância — é a única coisa que estou seguro de possuir.",
  ),
  q("Richard Feynman", "Físico", "Se não posso construí-lo, não o compreendo."),
  q(
    "Alan Turing",
    "Matemático",
    "Às vezes são as pessoas de quem ninguém espera nada que fazem coisas que ninguém consegue imaginar.",
  ),
  q("Ada Lovelace", "Matemática", "A imaginação é a faculdade descobridora, por excelência."),
  q(
    "Nelson Mandela",
    "Estadista",
    "A educação é a arma mais poderosa que você pode usar para mudar o mundo.",
  ),
  q("Nelson Mandela", "Estadista", "Parece sempre impossível, até que seja feito."),
  q(
    "Mahatma Gandhi",
    "Líder pacifista",
    "Se pudéssemos mudar a nós mesmos, as tendências no mundo também mudariam.",
  ),
  q(
    "Mahatma Gandhi",
    "Líder pacifista",
    "Viva como se você fosse morrer amanhã. Aprenda como se você fosse viver para sempre.",
  ),
  q(
    "Martin Luther King Jr.",
    "Ativista",
    "A injustiça em qualquer lugar é uma ameaça à justiça em todo lugar.",
  ),
  q(
    "Martin Luther King Jr.",
    "Ativista",
    "A verdadeira medida de um homem não é onde ele se encontra em momentos de conforto, mas onde ele se encontra em tempos de desafio.",
  ),
  q(
    "Paulo Freire",
    "Educador",
    "Ensinar não é transferir conhecimento, mas criar as possibilidades para a sua própria produção ou a sua construção.",
  ),
  q("Paulo Freire", "Educador", "Não há saber mais ou saber menos: há saberes diferentes."),
  q(
    "Paulo Freire",
    "Educador",
    "A educação não transforma o mundo. A educação muda as pessoas. Pessoas transformam o mundo.",
  ),
  q(
    "Paulo Freire",
    "Educador",
    "Se a educação sozinha não transforma a sociedade, sem ela tampouco a sociedade muda.",
  ),
  q(
    "Anísio Teixeira",
    "Educador",
    "Só existirá democracia no Brasil no dia em que se montar no país a máquina que prepara as democracias: a escola pública.",
  ),
  q("Rubem Alves", "Educador", "Ensinar é um exercício de imortalidade."),
  q(
    "Rubem Alves",
    "Educador",
    "Escolas que são gaiolas existem para que os pássaros desaprendam a arte do voo.",
  ),
  q("Cora Coralina", "Escritora", "Feliz aquele que transfere o que sabe e aprende o que ensina."),
  q("Cora Coralina", "Escritora", "O que vale na vida não é o ponto de partida e sim a caminhada."),
  q("Machado de Assis", "Escritor", "Ninguém guarda ódio onde não guardou amor."),
  q("Machado de Assis", "Escritor", "A imaginação foi a companheira de toda a minha existência."),
  q("Clarice Lispector", "Escritora", "Quem não se arrisca, não experimenta o gosto das vitórias."),
  q("Clarice Lispector", "Escritora", "Liberdade é pouco. O que eu desejo ainda não tem nome."),
  q("Fernando Pessoa", "Poeta", "Tudo vale a pena se a alma não é pequena."),
  q("Fernando Pessoa", "Poeta", "Primeiro estranha-se, depois entranha-se."),
  q(
    "Guimarães Rosa",
    "Escritor",
    "O correr da vida embrulha tudo — a vida é assim: esquenta e esfria, aperta e daí afrouxa, sossega e depois desinquieta.",
  ),
  q(
    "Mário Quintana",
    "Poeta",
    "Se as coisas são inatingíveis... ora! Não é motivo para não querê-las. Que tristes os caminhos se não fora a mágica presença das estrelas!",
  ),
  q(
    "Carlos Drummond de Andrade",
    "Poeta",
    "O tempo é a melhor invenção do esquecimento, mas ele é ineficaz.",
  ),

  // Fecho editorial
  o(
    "Direção Escolar",
    "Editorial",
    "Aprender é abrir uma janela — e cada aula é a chance de deixar entrar um pouco mais de mundo.",
  ),
  o(
    "Coordenação Pedagógica",
    "Editorial",
    "Reconhecer o esforço do estudante é tão importante quanto celebrar seu resultado.",
  ),
];

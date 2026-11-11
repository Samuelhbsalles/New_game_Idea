# Bíblia do Jogo de Criaturas (título provisório)

Por João Figueiredo e Samuel · Criado em 29 de outubro de 2026 · Atualizado em 30 de outubro de 2026

## Visão geral

Um jogo social online de coleção de criaturas, ambientado numa cidade grande, em que o jogador captura criaturas reais e fantasiosas e as coloca para trabalhar em comércios compartilhados com outros jogadores. As criaturas produzem produtos vendáveis, que o jogador vende para financiar sua vida na cidade.

## Pilares

- **Coleção:** capturar espécies e variantes, completar o álbum.
- **Criaturas que trabalham:** cada criatura rende mais em certos comércios, o que dá motivo para ter várias.
- **Social:** mapa online compartilhado, vagas disputadas, mercado, lojinhas e visitas.
- **Progressão por cidades:** cidades melhores trazem criaturas melhores, mas custo de vida maior.

**Inspirações:** Pokémon (coleção e captura), Habbo (convívio social e status), Stardew Valley (rotina relaxante e progresso visível).

**Princípio de design:** recompensas frequentes, metas sempre visíveis, nenhuma punição forte por ficar ausente.

## Direção visual e plataforma (decidido)

- **Estilo visual:** pixel art 2D.
- **Câmera:** vista de cima (top-down), no estilo Stardew Valley.
- **Plataforma:** começa como página web (navegador), com expansão futura para celular, seguindo o modelo do Habbo Hotel.

## Mundo

O jogo acontece numa sequência de cidades, começando por uma cidade inicial (nome ainda a definir). Cada cidade é dividida em bairros que funcionam como biomas, incluindo áreas rurais na periferia.

### Cidades (proposta inicial)

| Cidade | Criaturas | Apartamento | Custo de vida |
|---|---|---|---|
| 1. Cidade inicial | Comuns, reais (coelho, pombo, gato) | Barato | Baixo |
| 2. Cidade média | Melhores, algumas fantasiosas simples | Médio | Médio |
| 3. Metrópole | Raras e fantasiosas | Caro | Alto |
| 4. Capital (fim de jogo) | Lendárias e de evento | Muito caro | Muito alto |

### Bairros-bioma (ideias)

- **Centro:** rua principal, praças, comércios e lojas dos jogadores.
- **Parque:** criaturas de planta, insetos e pássaros.
- **Telhados e arranha-céus:** criaturas voadoras.
- **Metrô e esgoto:** criaturas noturnas e de sombra.
- **Porto e orla:** criaturas aquáticas.
- **Zona industrial:** criaturas de metal, eletricidade e fogo.
- **Bairro antigo:** criaturas místicas.
- **Periferia rural:** hortas e sítios, criaturas de fazenda.

Horário e clima mudam quais criaturas aparecem em cada bairro.

## Criaturas

O jogo mistura animais reais e criaturas fantasiosas. Cada criatura tem uma produção base e afinidades que multiplicam sua produção em certos comércios. **As criaturas não batalham entre si (decidido).**

### Atributos

- **Produção base:** quanto gera por hora em qualquer comércio.
- **Afinidade:** multiplicador em tipos específicos de comércio.
- **Energia:** gasta trabalhando, recuperada descansando ou comendo.
- **Comida preferida:** recupera mais energia e pode dar bônus.
- **Raridade e variantes:** cores ou padrões raros, que podem produzir mais.
- **Nível:** a criatura melhora conforme trabalha.

### Exemplos de afinidade (valores a balancear)

| Criatura | Produção base | Afinidade | Na padaria |
|---|---|---|---|
| Coelho | X pães/hora | Nenhuma (generalista, a mais básica) | X |
| Macaco | X pães/hora | Padaria 4x | 4X |
| Dragãozinho de fogo | Acima de X | Padaria e fábrica 3x | Alto |
| Golem de pedra | Acima de X | Construtora 4x, padaria 0,5x | Baixo |

Nenhuma criatura é boa em tudo. A qualidade média das criaturas sobe a cada cidade.

### Lista inicial de criaturas (em aberto)

A lista de 15 a 20 criaturas da primeira cidade ainda precisa ser pensada.

### Cruzamento e herança (em aberto)

O funcionamento do cruzamento e da herança de características ainda precisa ser trabalhado: o que é herdado, o que é aleatório e como surgem filhotes raros.

## Captura

Cada espécie exige um item específico (isca ou ferramenta) para ser capturada, o que cria uma cadeia: novas criaturas abrem caminho para as próximas.

### Como se captura (decidido)

- **Animais comuns:** apenas isca.
- **Lendários:** exigem também uma batalha ou minijogo de captura. O formato ainda será definido, e deve combinar com o tom relaxante do jogo.

### Tipos de item

- **Isca comum:** encontrada nos bairros, para criaturas básicas.
- **Isca de expedição:** materiais trazidos por criaturas em expedições.
- **Isca de evento:** só existe durante temporadas.
- **Ferramenta permanente:** libera um grupo inteiro (ex.: vara de pesca para criaturas aquáticas).

### Exemplo de cadeia

1. Migalhas de pão no parque capturam um pombo.
2. O pombo volta de expedições com tampinhas brilhantes.
3. Tampinhas brilhantes atraem um corvo dos telhados.
4. O corvo traz fios de cobre da zona industrial.
5. Fios de cobre viram isca para uma criatura elétrica rara.

### Regras

- Cadeias de 2 a 4 passos por criatura.
- Sempre mais de um jeito de obter um item (expedição, mercado, evento).
- Comuns: isca garante a captura. Raras: isca atrai, mas a captura tem chance de falhar.
- Lendárias: isca mais batalha ou minijogo.
- O álbum mostra a silhueta e uma pista de cada espécie não capturada.

## Empregos

O jogador leva a criatura a um comércio no mapa, coloca numa vaga livre e ela produz com o tempo. Não há cadeia de matéria-prima entre comércios nesta versão.

### Comércios da primeira cidade (decidido)

- Café
- Mercado
- Fábrica
- Padaria
- Hotel
- Construtora
- Loja de roupas
- Farmácia para animais
- Casas de cuidado para NPCs mais velhos

Ideias para cidades futuras: entregas, oficina, ferraria, horta comunitária, aquário, academia, laboratório de poções.

### Vagas compartilhadas (decidido)

- Cada comércio tem **6 vagas** no início, usadas por todos os jogadores do servidor.
- Quem chega primeiro ocupa a vaga.
- Uma vaga por jogador em cada comércio.
- **Turno de 4 horas.** Ao fim, a criatura volta para casa cansada, com o que produziu, e a vaga é liberada.
- A produção é coletada quando o jogador entra no jogo.

Números iniciais, sujeitos a ajuste no balanceamento.

### Contra a dominação dos mais ativos (proposta)

- Várias unidades do mesmo comércio pela cidade (padaria do centro, do porto etc.).
- Bônus para comércios menos movimentados.
- Limite de criaturas trabalhando ao mesmo tempo, que cresce com o progresso.
- Fila ou aviso quando uma vaga abre.
- Vagas reservadas para novatos em alguns comércios iniciais.

### Recompensa (decidido)

O emprego paga em **produto vendável** (pães, café, roupas etc.), não em moeda direta. O jogador vende os produtos para obter moeda, com pequena chance de um item especial do comércio. Ainda é preciso definir onde o produto é vendido: para NPCs a preço fixo, no mercado entre jogadores, ou ambos.

## Energia e alimentação

Criaturas se cansam trabalhando e o jogador precisa alimentá-las. Esse é o principal ralo de moeda do jogo.

- **Cansaço:** trabalhar gasta energia; criaturas fortes e raras gastam mais.
- **Fim do turno:** após 4 horas, a criatura volta para casa cansada.
- **Sem energia:** a criatura para de produzir e volta para casa.
- **Descanso:** recupera energia no apartamento; móveis melhores aceleram.
- **Comida:** recupera energia mais rápido e pode dar bônus temporário de produção.
- **Comida preferida:** cada espécie tem a sua, que rende mais.
- **Custo:** comida fica mais cara nas cidades avançadas.

**Regra de ouro:** criatura cansada ou com fome só para de trabalhar. Nunca morre, foge ou adoece.

## Apartamento e progressão

Cada jogador tem um apartamento, que é sua casa, vitrine e lugar de descanso das criaturas. Mudar para uma cidade melhor é a principal meta de longo prazo.

- **Apartamento:** decorável e ampliável (de quitinete a cobertura).
- **Ampliar:** aumenta vagas de descanso e o limite de criaturas trabalhando.
- **Mudar de cidade:** exige juntar dinheiro para um apartamento mais caro.
- **Troca de cidade:** criaturas melhores e comércios que pagam mais, mas comida e custos maiores.
- **Proposta:** o jogador pode manter o apartamento antigo e circular entre cidades, para as cidades iniciais não ficarem vazias.

## Loops de jogo

Três loops encaixados: cada um gera recursos para o próximo, e nenhum fica isolado.

**Loop de minutos:** andar por um bairro, encontrar criaturas, usar a isca certa e capturar. Variantes raras aparecem com chance pequena.

**Loop de sessão (10 a 20 minutos):**

1. Entrar e coletar o que as criaturas produziram e o que voltou das expedições.
2. Alimentar as cansadas e mandar as descansadas para os comércios.
3. Vender os produtos e conferir missões diárias.
4. Explorar um bairro e capturar.
5. Passear pelo centro, visitar lojas e espaços de outros jogadores.
6. Colocar itens à venda e sair, com um timer marcando o motivo de voltar.

**Loop de longo prazo:** completar o álbum, ampliar o apartamento, juntar dinheiro para mudar de cidade, buscar variantes raras, ganhar reputação, participar de temporadas.

**Primeira hora (onboarding):** criatura inicial, duas ou três capturas fáceis, primeira criatura trabalhando na padaria, primeira página do álbum completa, primeira visita ao centro com outros jogadores.

## Economia

A moeda do jogo vem de várias fontes ligadas a atividades diferentes, e sai por ralos que evitam inflação.

### Fontes de moeda (escolhidas)

- Venda dos produtos fabricados pelas criaturas nos comércios.
- Missões diárias e semanais.
- Bônus de login em sequência.
- Expedições de algumas horas.
- Criação e cruzamento de filhotes raros para vender (emoção estilo cassino, só com moeda do jogo).
- Completar páginas do álbum.
- Bônus de primeira captura de cada espécie.
- Mercado entre jogadores.
- Loja própria estilo classificados, sempre online.
- Visitas e avaliações do espaço.

### Ralos de moeda

- Comida das criaturas.
- Aluguel ou compra de apartamento e ampliações.
- Taxa do mercado.
- Iscas e itens de captura.
- Móveis e decoração.

### Cuidados

- Visitas e avaliações: uma por pessoa por dia, teto diário e contas novas valendo menos, contra contas falsas.
- Muita renda passiva gera inflação: os ralos precisam crescer junto com as cidades.
- Com poucas vagas por comércio (6), a produção total fica limitada, o que ajuda a controlar a inflação.

## Social

O mapa é online: ao sair de casa o jogador vê outros jogadores andando pela cidade e disputando vagas nos comércios.

- **Comércios como vitrine:** dentro da padaria todos veem as criaturas trabalhando, com nível e raridade.
- **Mercado:** compra e venda de criaturas, itens, produtos e móveis entre jogadores.
- **Loja própria:** cada jogador mantém uma lojinha que vende mesmo com ele offline.
- **Visitas:** jogadores visitam e avaliam apartamentos e lojas uns dos outros.
- **Status:** criaturas raras, apartamentos caros e lojas bem avaliadas são formas de se exibir.

## Monetização

**Proposta:** jogo gratuito, com receita vinda de status e identidade, nunca de poder.

- **Duas moedas:** uma ganha jogando (para quase tudo) e uma premium comprada com dinheiro real (cosméticos e conveniência).
- **Cosméticos:** roupas do avatar, skins e acessórios para criaturas, móveis e temas de apartamento.
- **Passe de temporada:** trilha gratuita e trilha paga com itens exclusivos a cada 2 ou 3 meses.
- **Assinatura VIP:** apartamento maior, mais slots de criaturas, item mensal, destaque no chat.
- **Conveniência leve:** armazenamento extra, acelerar eclosão, com moderação.

### Evitar

- Loot box paga, inclusive cruzamento pago com dinheiro real.
- Vender criaturas mais fortes.
- Moeda do jogo convertível em dinheiro real.

## Decisões

### Decididas

| Tema | Decisão |
|---|---|
| Estilo visual e câmera | Pixel art 2D, câmera de cima estilo Stardew Valley |
| Plataforma | Página web primeiro, celular no futuro, seguindo a ideia do Habbo Hotel |
| Captura | Só isca para animais comuns; lendários exigem batalha ou minijogo |
| Batalha entre criaturas | Não |
| Pagamento dos empregos | Produto vendável |
| Vagas e turno | 6 vagas por comércio; turno de 4 horas; depois a criatura volta para casa cansada |
| Comércios iniciais | Café, Mercado, Fábrica, Padaria, Hotel, Construtora, Loja de roupas, Farmácia para animais, Casas de cuidado para NPCs mais velhos |

### Em aberto

- Nome do jogo e da cidade inicial.
- Cruzamento e herança de características.
- Lista inicial de 15 a 20 criaturas.
- Formato do desafio de captura dos lendários (batalha ou minijogo).
- Onde os produtos são vendidos (NPC, mercado entre jogadores ou ambos).
- Tempo de descanso da criatura após o turno.
- Balanceamento com números da primeira cidade: definir quanto cada criatura produz por turno, preço dos produtos, custo de iscas e comida, e custo do apartamento, para que a progressão não seja rápida nem lenta demais. Pode esperar o protótipo.

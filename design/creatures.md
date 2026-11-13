# CREATURES.md: regras de design e lista inicial de criaturas

Referência para o Claude Code. Complementa o `GAME_BIBLE.md` (a bíblia manda em caso de conflito).
Todos os números (produção, multiplicadores, chances) são **propostas iniciais para balancear**, não valores finais.
Guardar os dados em arquivo de configuração (`creatures.json`), nunca fixos no código.

## Regras de design: como manter o estranho útil

1. **Função real no trabalho.** Cada criatura faz no comércio algo que o animal faz na vida real (castor constrói, abelha faz mel, lontra lava na água). O jogador deve entender a afinidade só de ver o animal.
2. **Água combina com água.** Animais aquáticos rendem em comércios ligados a água, tintura, luz ou energia (lontra, polvo, água-viva, enguia).
3. **Toda criatura tem uma fraqueza.** Ao menos um comércio com multiplicador abaixo de 1. Nenhuma criatura é boa em tudo (regra da bíblia).
4. **Estranho não é só enfeite.** Criatura rara ou estranha precisa de afinidade clara, senão ninguém vai querer usá-la.
5. **Raridade não é poder demais.** Mesmo épicas têm fraqueza. Raridade vale por produção, status e coleção, não por dominar tudo. Não há batalha entre criaturas.
6. **Condições de aparição.** Raridade vem de bairro, horário e clima (dados em config), com pistas vagas no álbum para as raras.
7. **Cobertura de comércios.** Todo comércio da primeira cidade deve ter criaturas boas nele. Se um comércio ficar sem opção, adicionar criaturas.
8. **Fantasiosos ficam para depois.** Na primeira cidade só animais reais. Criaturas fantasiosas entram na cidade média ou na metrópole, seguindo a mesma lógica (uma função ligada a um comércio).
9. **Comércios futuros de água.** Lavanderia, aquário e spa são boas adições para cidades seguintes, para as criaturas aquáticas brilharem.

## Níveis de raridade (proposta)

| Raridade | Chance aprox. | Captura |
|---|---|---|
| Comum | ~60% | Isca garante |
| Incomum | ~25% | Isca específica, garante |
| Raro | ~10% | Isca atrai, pode falhar; isca de expedição |
| Épico | ~4% | Isca rara, pode falhar; condição de horário/clima |
| Lendário | ~1% | Isca especial + batalha ou minijogo (formato em aberto); não há lendários na primeira cidade |

## Campos de cada criatura (para o `creatures.json`)

`id`, `nome`, `raridade`, `bairro`, `condicao` (horário/clima), `producao_base`, `afinidades` (comércio: multiplicador), `fraqueza` (comércio: multiplicador), `custo_energia`, `comida_preferida` (a definir), `isca` (a definir), `motivo` (por que faz sentido).

## Lista inicial (27 criaturas)

Comércios: Café, Mercado, Fábrica, Padaria, Hotel, Construtora, Loja de roupas, Farmácia (para animais), Casa de idosos.

### Comuns

| Criatura | Bairro / condição | Afinidade | Fraqueza | Motivo |
|---|---|---|---|---|
| Coelho | Parque | Nenhuma (generalista) | Nenhuma, mas produção baixa | Referência de comparação |
| Pomba | Praças | Mercado 2x | Fábrica 0,7x | Vai e vem com pacotes |
| Gato | Ruas | Café 3x | Construtora 0,5x | Atrai clientes no café |
| Cachorro | Ruas e parque | Casa de idosos 3x | Café 0,7x | Companhia |
| Abelha | Parque | Padaria 3x, Café 2x | Construtora 0,5x | Mel |
| Galinha | Periferia rural | Padaria 3x | Hotel 0,7x | Ovos |
| Ovelha | Periferia rural | Loja de roupas 4x | Fábrica 0,6x | Lã |
| Esquilo | Parque | Mercado 3x | Casa de idosos 0,7x | Guarda e organiza estoque |

### Incomuns

| Criatura | Bairro / condição | Afinidade | Fraqueza | Motivo |
|---|---|---|---|---|
| Castor | Lago | Construtora 4x | Loja de roupas 0,5x | Constrói diques |
| Capivara | Lago do parque | Hotel 3x (spa), Casa de idosos 2x | Fábrica 0,5x | Calma na água, acalma os outros |
| Pelicano | Orla | Mercado 3x | Farmácia 0,6x | Carrega peixe na bolsa do bico |
| Pinguim | Orla, tempo frio | Café 3x | Fábrica 0,6x | Bebidas e sorvetes gelados |
| Toupeira | Metrô | Construtora 4x | Loja de roupas 0,5x | Cava túneis |
| Tatu | Periferia rural | Construtora 3x | Café 0,6x | Escava, couraça |
| Preguiça | Parque, copa das árvores | Casa de idosos 4x | Fábrica 0,5x | Calma, mas lenta |
| Vaga-lume | Parque, à noite | Hotel 3x | Construtora 0,6x | Ilumina corredores |

### Raros

| Criatura | Bairro / condição | Afinidade | Fraqueza | Motivo |
|---|---|---|---|---|
| Lontra | Rio e orla | Loja de roupas 3x | Fábrica 0,6x | Brinca na água, lava e enxágua tecidos |
| Polvo | Porto | Loja de roupas 4x, Fábrica 3x | Casa de idosos 0,6x | Tinta para tingir, oito braços |
| Estrela-do-mar | Orla, maré baixa | Farmácia 4x | Mercado 0,5x | Regenera partes do corpo |
| Água-viva | Porto, à noite | Hotel 3x | Padaria 0,5x | Brilha como luz do ambiente |
| Peixe-palhaço | Porto | Hotel 3x | Construtora 0,5x | Recepcionista na "anêmona" |
| Camaleão | Telhados e jardins | Loja de roupas 3x | Café 0,6x | Cores e padrões |
| Bicho-da-seda | Periferia rural | Loja de roupas 5x | Fábrica 0,5x | Seda |
| Axolote | Lago, noite chuvosa | Farmácia 4x | Padaria 0,4x | Regenera, ótimo para cuidar de animais |

### Épicos

| Criatura | Bairro / condição | Afinidade | Fraqueza | Motivo |
|---|---|---|---|---|
| Enguia elétrica | Rio, tempestade | Fábrica 5x | Hotel 0,5x; gasta muita energia | Gera eletricidade |
| Pangolim | Esgoto, noite | Construtora 4x | Loja de roupas 0,5x | Cava e é blindado |
| Tartaruga-marinha | Orla, evento de maré | Casa de idosos 5x | Mercado 0,5x | Longa vida e paciência |

## Cobertura por comércio

- Café: gato, abelha, pinguim.
- Mercado: pomba, esquilo, pelicano.
- Fábrica: polvo, enguia elétrica.
- Padaria: abelha, galinha.
- Hotel: capivara, vaga-lume, água-viva, peixe-palhaço.
- Construtora: castor, toupeira, tatu, pangolim.
- Loja de roupas: ovelha, lontra, polvo, camaleão, bicho-da-seda.
- Farmácia para animais: estrela-do-mar, axolote.
- Casa de idosos: cachorro, capivara, preguiça, tartaruga-marinha.

Pontos fracos de cobertura: **Fábrica** e **Padaria** têm poucas opções boas. Se o balanceamento mostrar isso, adicionar criaturas para eles antes de ampliar o resto.

## Tarefas sugeridas para o Claude Code

1. Gerar `creatures.json` a partir desta lista, com os campos acima e valores placeholder para `producao_base`, `custo_energia`, `comida_preferida` e `isca`.
2. Validar que cada criatura tem pelo menos uma afinidade e uma fraqueza.
3. Mostrar um relatório de cobertura por comércio (quantas criaturas boas em cada um).
4. Criar o sistema de aparição por raridade, bairro, horário e clima lendo o JSON.
5. Não gerar arte ainda. Começar pelos sprites das criaturas de Padaria (coelho, abelha, galinha, macaco opcional) para testar o jogo cedo.

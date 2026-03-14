# ⚡ Energia e Eletricidade

> **Eletricidade nao e luxo — e o que separa sobreviver de viver. Iluminacao, comunicacao, ferramentas medicas, purificacao de agua: tudo depende de energia.**

---

## Introducao

Quando a rede eletrica cai, a maioria das pessoas percebe em minutos o quanto a civilizacao moderna depende de energia. Sem eletricidade, nao ha refrigeracao (comida estraga em horas), comunicacao (celulares morrem em horas), bombeamento de agua (torneiras secam), iluminacao (noites se tornam absolutamente escuras) e muitos equipamentos medicos param de funcionar.

A boa noticia e que gerar e armazenar energia em escala pequena e totalmente viavel com conhecimentos basicos. Este guia cobre desde o entendimento fundamental de eletricidade ate a construcao de sistemas solares, uso de geradores, fabricacao de baterias improvisadas, protecao contra pulso eletromagnetico (EMP) e micro-hidreletricas.

Voce nao precisa ser engenheiro eletricista. Precisa entender os principios, respeitar os riscos e seguir as orientacoes praticas deste guia. A eletricidade e extremamente util — mas tambem mata se mal manejada.

---

## Fundamentos de Eletricidade

### Conceitos Essenciais

| Conceito | Analogia (agua em cano) | Unidade | Significado Pratico |
|----------|------------------------|---------|-------------------|
| **Tensao (Voltagem)** | Pressao da agua | Volt (V) | "Forca" que empurra a eletricidade |
| **Corrente** | Fluxo de agua | Ampere (A) | Quantidade de eletricidade fluindo |
| **Resistencia** | Diametro do cano | Ohm (Ω) | Oposicao ao fluxo |
| **Potencia** | Trabalho realizado | Watt (W) | Capacidade de fazer trabalho |
| **Energia** | Total de agua que passou | Watt-hora (Wh) | Potencia × tempo |

### Formulas Fundamentais — MEMORIZE

```
Lei de Ohm:         V = I × R     (Tensao = Corrente × Resistencia)
Potencia:           P = V × I     (Potencia = Tensao × Corrente)
Energia:            E = P × t     (Energia = Potencia × tempo em horas)
```

**Exemplo pratico:**
- Lampada LED de 12V consome 0,5A
- Potencia: 12 × 0,5 = 6W
- Em 5 horas consome: 6 × 5 = 30 Wh
- Bateria de 100Ah em 12V = 1200 Wh → alimenta essa lampada por 200 horas (teorico)

### Corrente Continua (DC) vs. Corrente Alternada (AC)

| Caracteristica | DC (Continua) | AC (Alternada) |
|---------------|---------------|----------------|
| Fluxo | Constante, uma direcao | Alterna direcao (60 Hz no Brasil) |
| Fontes | Baterias, paineis solares, dinamos | Geradores, rede eletrica |
| Uso tipico | Eletronicos, LED, radios, carregar celular | Eletrodomesticos, motores grandes |
| Tensao comum | 3V, 5V, 12V, 24V, 48V | 127V ou 220V (Brasil) |
| Perigo | Menor em tensoes baixas (<50V) | MUITO perigosa em tensoes domesticas |

⚠️ **ALERTA DE SEGURANCA:**
- **12V DC:** Seguro ao toque (exceto curto-circuito que gera calor/fogo)
- **127V/220V AC:** POTENCIALMENTE LETAL. Corrente de apenas 0,1A atravessando o coracao MATA
- NUNCA trabalhe em circuitos AC energizados
- NUNCA toque em fios desencapados sem verificar se estao desenergizados
- Agua + eletricidade = MORTE. Mantenha tudo seco

---

## Energia Solar

### Por que Solar e a Melhor Opcao para Sobrevivencia

1. **Sem combustivel** — funciona enquanto houver sol
2. **Sem pecas moveis** — quase zero manutencao
3. **Silencioso** — nao revela sua posicao
4. **Escalavel** — de um painel de 10W a um sistema completo
5. **Longa duracao** — paineis duram 25-30 anos com degradacao minima (~0,5%/ano)

### Componentes de um Sistema Solar

```
[Painel Solar] → [Controlador de Carga] → [Bateria] → [Carga DC]
                                                    ↓
                                              [Inversor] → [Carga AC]
```

**1. Painel Solar:**
- Gera eletricidade DC a partir da luz solar
- Potencia tipica: 10W (portatil) a 400W+ (residencial)
- Tensao de saida: tipicamente 18-22V (para carregar baterias de 12V)

**2. Controlador de Carga:**
- Regula a tensao/corrente do painel para a bateria
- Evita sobrecarga (destroi a bateria) e descarga excessiva
- Tipos: PWM (mais simples/barato) e MPPT (30% mais eficiente)
- ⚠️ NUNCA conecte painel diretamente na bateria sem controlador (exceto paineis pequenos de 5W ou menos com bateria grande)

**3. Bateria:**
- Armazena energia para uso quando nao ha sol (noite, dias nublados)
- Tipos: chumbo-acido (carro), AGM, gel, litio (LiFePO4)
- Capacidade em Ah (Ampere-hora): quanto maior, mais reserva

**4. Inversor (opcional):**
- Converte DC (12V/24V) em AC (127V ou 220V)
- Necessario para equipamentos AC (eletrodomesticos)
- Tipos: onda senoidal pura (melhor, mais caro) e onda senoidal modificada (serve para maioria dos usos)

### Dimensionamento Pratico

**Passo 1: Liste seus equipamentos e consumo**

| Equipamento | Potencia (W) | Horas/dia | Consumo diario (Wh) |
|------------|-------------|-----------|---------------------|
| Iluminacao LED (3 lampadas) | 15W total | 5h | 75 |
| Radio transceptor | 5W (media) | 2h | 10 |
| Carregar celular | 10W | 2h | 20 |
| Ventilador pequeno | 25W | 4h | 100 |
| Geladeira eficiente 12V | 50W | 8h (ciclo) | 400 |
| **TOTAL** | | | **605 Wh/dia** |

**Passo 2: Dimensione a bateria**
```
Capacidade necessaria = Consumo diario ÷ Tensao × Dias de autonomia ÷ Profundidade de descarga
```

Para 605 Wh/dia, 12V, 2 dias de autonomia, descarga maxima de 50% (chumbo-acido):
```
605 × 2 ÷ 12 ÷ 0,5 = 201 Ah
```
**Resultado:** Bateria de 200Ah (12V) ou maior

**Passo 3: Dimensione o painel**
```
Potencia do painel = Consumo diario ÷ Horas de sol pleno × 1,3 (perdas)
```

Para 605 Wh/dia com 5 horas de sol pleno (media Brasil):
```
605 ÷ 5 × 1,3 = 157W
```
**Resultado:** Painel(is) de 160-200W total

**Passo 4: Controlador de carga**
```
Corrente do controlador = Potencia do painel ÷ Tensao da bateria × 1,25 (margem)
```

Para 200W, 12V:
```
200 ÷ 12 × 1,25 = 20,8A → Controlador de 20A ou 30A
```

### Instalacao Basica

1. **Posicione o painel:**
   - Voltado para o NORTE (no hemisferio sul — Brasil)
   - Inclinacao = latitude do local + 10° (ex: Sao Paulo 23° → incline a 33°)
   - Sem sombra das 9h as 15h (sombra parcial reduz drasticamente a producao)
   - Fixe firmemente (vento pode arrancar)

2. **Conecte painel → controlador:**
   - Use fio adequado (2,5mm² para ate 20A, 4mm² para ate 30A)
   - Conecte o controlador na bateria PRIMEIRO, depois o painel no controlador (ordem importa!)
   - Respeite polaridade: + com + , - com - (invertido danifica equipamento)

3. **Conecte controlador → bateria:**
   - Fio curto e grosso (4mm² ou mais)
   - Fusiveis: coloque um fusivel entre bateria e controlador (valor = corrente maxima do controlador × 1,25)

4. **Conecte cargas:**
   - Saida de carga do controlador → seus equipamentos DC
   - Se usar inversor: conecte direto na bateria (com fusivel) → equipamentos AC no inversor

### Painel Solar Improvisado

⚠️ **Desempenho muito inferior a paineis comerciais, mas funciona para emergencias:**

**Celulas retiradas de calculadoras/lanternas solares:**
- Desmonte e conecte em serie (+ de uma no - da proxima) para somar tensao
- 4 celulas de calculadora ≈ 2V, corrente minima — serve para carregar uma pilha AAA lentamente

**Diodos de LED como celulas solares (sim, funciona!):**
- LEDs transparentes geram uma pequena tensao quando expostos a luz
- Conecte 20-30 LEDs em serie → 5-10V
- Corrente extremamente baixa — serve para projetos de emergencia minima

---

## Baterias

### Tipos de Bateria e Comparacao

| Tipo | Tensao/celula | Ciclos | Descarga max | Peso | Custo | Manutencao |
|------|-------------|--------|-------------|------|-------|-----------|
| Chumbo-acido (carro) | 2,1V | 200-300 | 50% | Alto | Baixo | Media |
| AGM (selada) | 2,1V | 400-600 | 50% | Alto | Medio | Baixa |
| Gel | 2,1V | 500-800 | 50% | Alto | Medio | Baixa |
| LiFePO4 (litio ferro) | 3,2V | 2000-5000 | 80-90% | Baixo | Alto | Nenhuma |
| Ni-MH (pilhas) | 1,2V | 500-1000 | 100% | Medio | Baixo | Baixa |
| Li-ion (celular/laptop) | 3,7V | 300-500 | 100% | Baixo | Medio | Nenhuma |

### Bateria de Carro como Fonte de Energia

Uma bateria de carro de 60Ah a 12V contem 720 Wh de energia (usavel: ~360 Wh a 50% descarga):

**O que alimenta (aproximadamente):**
- 20 lampadas LED de 3W por 6 horas = 360 Wh
- Radio HT por 30+ horas de recepcao
- Carregar 20+ celulares
- Bomba de agua 12V por 3-4 horas
- Ventilador 12V por 15 horas

**Cuidados:**
- Recarregue antes de descer abaixo de 50% (bateria de carro nao e "deep cycle" — descarga profunda mata rapidamente)
- Ventile a area (baterias chumbo-acido liberam hidrogenio — explosivo)
- Terminais limpos (limpe com bicarbonato de sodio + agua se houver corrosao)
- Nao deixe ferramentas sobre a bateria (curto-circuito = faiscas + explosao)

### Recondicionamento de Baterias Chumbo-Acido

Se uma bateria nao aceita carga:

1. **Verifique nivel de eletrólito:** Se baixo, complete com agua DESTILADA (nao mineral, nao da torneira). A agua deve cobrir as placas por 1cm
2. **Sulfatacao:** Cristais brancos nos terminais/placas. Tente:
   - Carga lenta (1-2A) por 24-48 horas
   - Adicione 1 colher de cha de sal de Epsom (sulfato de magnesio) dissolvido em agua quente por celula — pode dissolver sulfatacao leve
3. **Celula morta:** Se uma celula nao borbulha durante carga enquanto as outras sim, essa celula morreu. A bateria pode funcionar com capacidade reduzida (10V em vez de 12V)

### Bateria Improvisada (Pilha de Volta)

Para pequenas necessidades (alimentar LED, relogio, circuitos minimos):

**Material por celula:**
- Disco de cobre (moeda, fio de cobre achatado)
- Disco de zinco (galvanizado: prego, arruela, chapa)
- Papelao ou pano embebido em solucao acida (vinagre, suco de limao, agua com sal)

**Construcao:**
1. Empilhe: cobre → papelao molhado → zinco → cobre → papelao → zinco...
2. Cada "sanduiche" gera ~0,7-1V
3. Para 3V: empilhe 4-5 celulas
4. Conecte fio no cobre da base (positivo) e no zinco do topo (negativo)

**Limitacoes:** Corrente extremamente baixa (milliamperes). Dura horas. Util para emergencia absoluta.

---

## Geradores a Combustao

### Tipos e Comparacao

| Tipo | Potencia Tipica | Combustivel | Consumo | Ruido | Notas |
|------|----------------|-------------|---------|-------|-------|
| Gasolina portatil | 1-10 kW | Gasolina | 0,5-3 L/h | Alto | Mais comum, barato |
| Diesel | 5-50+ kW | Diesel | 0,3-2 L/h | Muito alto | Mais eficiente, combustivel mais estavel |
| Inverter (gasolina) | 1-4 kW | Gasolina | 0,3-1 L/h | Baixo | Eletricidade limpa, silencioso, caro |
| GLP/Gas natural | 2-20 kW | Gas | Variavel | Medio | Combustivel mais limpo |
| Multifuel/Flex | 2-10 kW | Varios | Variavel | Medio | Versatilidade de combustivel |

### Operacao Segura de Geradores

⚠️ **PERIGOS MORTAIS DOS GERADORES:**

1. **MONOXIDO DE CARBONO (CO):** Gas INODORO e INVISIVEL. MATA em minutos em espaco fechado
   - NUNCA opere gerador dentro de casa, garagem, porao ou qualquer espaco fechado
   - Minimo 6 metros de distancia de portas e janelas
   - Ventilacao TOTAL obrigatoria
   - Se sentir dor de cabeca, tontura, nausea proximo ao gerador → SAIA IMEDIATAMENTE

2. **ELETROCUSSAO:**
   - NUNCA conecte gerador diretamente na rede eletrica da casa (backfeeding) — mata eletricistas trabalhando na rede
   - Use TRANSFER SWITCH ou conecte equipamentos diretamente ao gerador
   - Mantenha seco. Nao opere na chuva sem cobertura adequada

3. **INCENDIO:**
   - Desligue e espere esfriar antes de reabastecer
   - Armazene combustivel a distancia do gerador (minimo 3 metros)
   - Tenha extintor de incendio proximo

### Manutencao Basica

| Item | Frequencia | Procedimento |
|------|-----------|-------------|
| Oleo do motor | A cada 50-100 horas | Verificar nivel. Trocar conforme manual (tipicamente SAE 10W-30) |
| Filtro de ar | A cada 100 horas | Limpar ou substituir. Sujo = perda de potencia e consumo |
| Vela de ignicao | A cada 200 horas | Limpar eletrodo. Substituir se gasto |
| Filtro de combustivel | A cada 200 horas | Substituir ou limpar |
| Combustivel | Estoque rotativo | Gasolina: validade 3-6 meses. Com estabilizador: 12-24 meses |
| Carga de teste | Mensal | Ligue por 30 min sob carga — evita deterioracao |

### Combustivel: Armazenamento e Conservacao

**Gasolina:**
- Validade: 3-6 meses sem tratamento
- Com estabilizador (Sta-Bil ou similar): 12-24 meses
- Armazene em recipientes metalicos aprovados (galoes vermelhos homologados)
- Local fresco, ventilado, longe de fontes de calor/faiscas
- ⚠️ Vapores de gasolina sao EXTREMAMENTE inflamaveis e mais pesados que o ar (acumulam no chao)

**Diesel:**
- Mais estavel: 6-12 meses sem tratamento
- Problema: proliferacao de fungos/bacterias no diesel armazenado (adicione biocida)
- Menos volatil que gasolina (mais seguro para armazenar)

**Etanol/Alcool:**
- Mistura com gasolina brasileira ja contem 27% etanol
- Absorve umidade (degrada mais rapido)
- Menor poder calorifico que gasolina pura

---

## Micro-Hidreletrica

### Quando e Viavel

Voce precisa de:
- Curso d'agua CONSTANTE (rio, riacho, canal)
- DESNIVEL (queda d'agua) — quanto mais, melhor
- VAZAO adequada — quanto mais agua, mais potencia

### Calculo de Potencia Disponivel

```
Potencia (Watts) = 9,81 × Vazao (L/s) × Desnivel (m) × Eficiencia
```

**Eficiencia tipica:** 50-70% para sistemas improvisados

**Exemplo:**
- Riacho com vazao de 10 litros/segundo
- Desnivel de 3 metros (cano/canal redirecionando agua)
- Eficiencia de 50%
```
P = 9,81 × 10 × 3 × 0,5 = 147 Watts
```
**147W continuos, 24 horas por dia = 3.528 Wh/dia!** Muito mais que a maioria dos sistemas solares portateis.

### Como Medir Vazao

1. Encontre um ponto onde o riacho passa por estreitamento
2. Coloque um balde de volume conhecido (ex: 10 litros) sob o fluxo
3. Cronometre quanto tempo leva para encher
4. Vazao = Volume / Tempo
   - 10L em 5 segundos = 2 L/s
   - 10L em 1 segundo = 10 L/s

### Como Medir Desnivel

1. Use mangueira transparente cheia de agua (nivel de agua nas duas pontas = mesma altura)
2. Ou use prumo e trena entre o ponto de captacao e o ponto de geracao
3. Ou use smartphone com app de altimetro (se funcional)

### Turbina Improvisada

**Roda d'agua simples:**
1. Construa uma roda com pas usando madeira, plastico ou metal
2. Diametro: depende do desnivel disponivel
3. Monte em eixo apoiado em mancais (rolamentos de maquina, tubo de metal com graxa)
4. Conecte o eixo a um motor DC como gerador (motor de impressora, motor de esteira, alternador de carro)

**Turbina Pelton improvisada (para alto desnivel, baixa vazao):**
1. Corte colheres de metal ou conchas e fixe na borda de um disco (roda)
2. Direcione um jato de agua de alta pressao (cano estreito vindo de altura) para as "colheres"
3. O jato gira a roda que gira o gerador
4. Funciona melhor com desnivel > 5 metros

**Alternador de carro como gerador:**
- Gera 12-14V DC quando girado a 1500+ RPM
- Precisa de excitacao (campo magnetico): conecte 12V nos terminais de campo inicialmente
- Saida tipica: 50-100A (600-1400W) em velocidade adequada
- Use polia e correia para adaptar velocidade de rotacao da turbina

---

## Energia Eolica (Vento)

### Viabilidade

- Necessita de vento CONSTANTE (minimo 4 m/s de media)
- Areas costeiras, topos de morros, campos abertos
- Complementar a solar (vento a noite quando nao ha sol)

### Aerogerador Improvisado

**Material:**
- Motor DC de esteira, impressora ou motor de ima permanente
- Pas: tubo de PVC cortado, madeira esculpida, aluminio
- Mastro: tubo de metal, poste, arvore

**Construcao basica:**
1. Motor DC como gerador (maioria dos motores DC geram eletricidade quando girados)
2. 3-4 pas de 30-60 cm montadas em disco/cubo no eixo do motor
3. Leme direcional (chapa de metal/madeira atras) para alinhar com o vento
4. Monte no ponto mais alto disponivel (vento aumenta com altura)
5. Conecte ao controlador de carga e bateria (mesmo do solar)

**Potencia tipica:** 20-100W em ventos de 5-8 m/s (improvisado)

---

## Protecao contra EMP (Pulso Eletromagnetico)

### O que e EMP

Pulso eletromagnetico e uma rajada de energia eletromagnetica que pode:
- Destruir eletronicos nao protegidos
- Queimar circuitos integrados, microchips, transistores
- Nao afeta humanos diretamente

**Fontes de EMP:**
- Detonacao nuclear em altitude (HEMP — a ameaca mais ampla)
- Armas de EMP direcionadas
- Tempestade solar severa (Evento Carrington)
- Raios (EMP localizado natural)

### Gaiola de Faraday

Compartimento metalico fechado que bloqueia campos eletromagneticos:

**Construcao simples:**

**Opcao 1 — Lata de metal com tampa:**
1. Lata de lixo metalica com tampa ajustada
2. Forre o INTERIOR com papelao ou espuma (o equipamento NAO pode tocar o metal)
3. Coloque equipamentos eletronicos dentro
4. Feche a tampa — garanta bom contato metalico entre tampa e corpo
5. Cole fita de aluminio na juncao tampa-corpo se necessario

**Opcao 2 — Caixa de metal (munição, ferramentas):**
1. Qualquer caixa metalica com tampa
2. Isolamento interno (papelao, plastico bolha)
3. Equipamento dentro, tampa fechada

**Opcao 3 — Folha de aluminio:**
1. Envolva o equipamento em pano/plastico (isolamento)
2. Envolva TUDO em 3+ camadas de folha de aluminio, sem buracos
3. Envolva novamente em pano
4. Envolva em mais 3 camadas de aluminio
5. Menos eficaz que caixa metalica, mas funciona razoavelmente

**O que guardar em Faraday:**
- [ ] Radio reserva (HT, ondas curtas)
- [ ] Lanterna LED com baterias
- [ ] Carregador solar pequeno
- [ ] Pen drive com documentos/informacoes
- [ ] Multimetro
- [ ] Cabos de carga USB
- [ ] Pilhas/baterias reserva
- [ ] Qualquer eletronico que voce quer preservar

⚠️ **Teste sua gaiola:** Coloque um radio FM ou celular dentro, feche, e tente sintonizar uma estacao de radio FM / fazer uma ligacao. Se o sinal cair significativamente ou desaparecer, a gaiola esta funcionando.

---

## Instalacao Eletrica Basica

### Ferramentas Necessarias

| Ferramenta | Uso |
|-----------|-----|
| Multimetro | Medir tensao, corrente, resistencia, continuidade |
| Alicate de corte | Cortar fios |
| Alicate universal | Segurar, dobrar, cortar |
| Alicate decapador | Desencapar fios |
| Chaves de fenda | Fixar terminais |
| Fita isolante | Isolar conexoes |
| Fusiveis | Protecao contra curto-circuito |

### Dimensionamento de Fios

| Corrente (A) | Secao do fio (mm²) | Uso tipico |
|-------------|--------------------|----|
| Ate 5A | 0,75 - 1,0 | LED, sensores, eletronicos |
| 5-10A | 1,5 | Iluminacao, carregar celular |
| 10-16A | 2,5 | Tomadas, equipamentos medios |
| 16-25A | 4,0 | Geladeira, ferramentas |
| 25-32A | 6,0 | Chuveiro, maquinas |
| 32-50A | 10,0 | Entrada geral, geradores |

⚠️ **Fio subdimensionado AQUECE e causa INCENDIO.** Na duvida, use fio mais grosso.

### Conexoes Seguras

1. **Desencape** 1-2 cm do fio
2. **Torca os filamentos** (se fio multifilar) no sentido horario
3. **Conecte:**
   - **Torca + fita:** Torca os fios juntos (min. 5 voltas), cubra com fita isolante (3 camadas)
   - **Conectores de emenda:** Prensavel ou rosca (muito mais seguro)
   - **Soldagem:** Melhor conexao — derreta estanho na juncao
4. **NUNCA deixe cobre exposto** — fita isolante em TODA juncao

### Protecao do Circuito

**Fusiveis:**
- Fio fino que derrete quando a corrente excede o limite, desligando o circuito
- Sempre instale entre a fonte de energia e a carga
- Valor do fusivel = corrente maxima esperada × 1,25
- Ex: carga de 10A → fusivel de 12,5A ou 15A

**Disjuntores:**
- Mesmo principio do fusivel, mas reutilizavel (reseta apos desarmar)
- Preferivel quando disponivel

**Fusivel improvisado:**
- Pedaco de fio de cobre FINO (0,1-0,3mm) como fusivel
- Derrete com corrente excessiva, protegendo o circuito
- Fio de la de aco (palha de aco) funciona como fusivel improvisado

---

## Iluminacao de Emergencia

### Comparacao de Fontes de Luz

| Fonte | Eficiencia (lumens/W) | Duracao | Seguranca | Notas |
|-------|----------------------|---------|-----------|-------|
| LED 12V | 80-150 | Depende da bateria | Alta | MELHOR opcao geral |
| Vela | 0,3 | 4-8 horas | Media (fogo) | Sempre disponivel |
| Lamparina a oleo | 0,5-1 | Depende do oleo | Media (fogo) | Qualquer oleo/gordura |
| Lanterna a pilha | 20-100 | 2-50 horas | Alta | Limitada por pilhas |
| Tocha/facho | 0,1-0,3 | 30-60 min | Baixa (fogo) | Emergencia apenas |

### Lampada LED de 12V (Monte a Sua)

**Material:**
- Fita de LED 12V (tira adesiva com LEDs SMD) — encontrada em lojas de eletrica ou retirada de equipamentos
- Fio de 1mm²
- Interruptor simples
- Bateria 12V

**Montagem:**
1. Corte a fita LED no comprimento desejado (corte apenas nas marcas indicadas — geralmente a cada 3 LEDs)
2. Solde fios nos terminais + e -
3. Conecte interruptor no fio positivo
4. Conecte a bateria 12V

**Consumo:** Fita LED tipica consome 4-8W por metro. Um pedaco de 30cm ilumina um comodo pequeno com ~2W.

### Lamparina Improvisada

1. Recipiente nao inflamavel (lata, vidro, ceramica)
2. Pavio: barbante de algodao, mecha de pano, cadarco
3. Combustivel: qualquer oleo vegetal, gordura animal derretida, querosene, diesel
4. Mergulhe o pavio no oleo, deixe 1cm exposto
5. Acenda a ponta exposta

⚠️ Mantenha longe de materiais inflamaveis. Supervisione. Use base estavel.

---

## Alternador de Bicicleta

### Geracao de Energia Pedalando

Um alternador/dinamo de bicicleta ou motor DC acoplado a uma bicicleta pode gerar 50-100W:

1. Apoie a bicicleta em suporte fixo (roda traseira elevada)
2. Conecte um dinamo de bicicleta ou motor DC na roda traseira (contato por atrito ou correia)
3. Conecte a saida do dinamo a um controlador de carga e bateria
4. Pedale por 1 hora a ritmo moderado = 50-100 Wh (carrega um celular 3-5 vezes)

**Motor DC como gerador:** A maioria dos motores DC funciona como gerador quando girados mecanicamente. Motores de impressora, parafusadeira e esteira funcionam bem.

---

## Checklist Rapido

- [ ] Painel solar dimensionado para necessidades minimas do grupo
- [ ] Controlador de carga instalado entre painel e bateria
- [ ] Bateria(s) carregada(s) e em boas condicoes
- [ ] Fios adequados para cada circuito (nao subdimensionados)
- [ ] Fusiveis em todos os circuitos
- [ ] Equipamentos reserva em gaiola de Faraday
- [ ] Combustivel armazenado com seguranca (se usar gerador)
- [ ] Multimetro disponivel e funcional
- [ ] Fita isolante, fios, conectores em estoque
- [ ] Iluminacao LED de 12V instalada no abrigo
- [ ] Fonte de recarga para radios e eletronicos portateis
- [ ] Conhecimento basico de seguranca eletrica compartilhado com o grupo
- [ ] Gerador testado mensalmente (se disponivel)
- [ ] Bateria de carro reserva carregada e mantida
- [ ] Avaliacao de potencial hidrico/eolico do local realizada

---

## Referencias e Notas

- Manual de instalacoes eletricas residenciais — ABNT NBR 5410
- "The Battery Book" — guia completo sobre tecnologias de baterias
- "Solar Electricity Handbook" — Michael Boxwell
- Tabela de dimensionamento de fios: baseada em norma brasileira ABNT
- Formulas hidraulicas: baseadas em principios de engenharia hidraulica
- Especificacoes de EMP: baseadas em relatórios EMP Commission (EUA) e estudos de efeitos Carrington
- Eficiencia de equipamentos: valores tipicos de mercado
- ⚠️ Eletricidade MATA. Respeite as tensoes, use protecao e nunca trabalhe em circuitos energizados
- Em caso de duvida, use tensoes baixas (12V DC) — seguro ao toque e suficiente para maioria das necessidades de sobrevivencia
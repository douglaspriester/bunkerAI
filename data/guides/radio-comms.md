# 📻 Comunicacao por Radio

> **Em uma crise, informacao e a segunda necessidade mais vital depois da agua. Quem tem radio, tem olhos e ouvidos alem do horizonte.**

---

## Introducao

Em cenarios de colapso — desastres naturais, pandemias, conflitos ou falha generalizada de infraestrutura — os sistemas modernos de comunicacao (internet, telefonia celular, TV) serao os primeiros a cair. Torres de celular dependem de energia eletrica e backhaul de fibra optica. Sem manutencao, a maioria falha em 4 a 72 horas apos um apagao generalizado.

O radio, por outro lado, e a tecnologia de comunicacao mais resiliente ja inventada. Funciona sem internet, sem infraestrutura centralizada, sem satelites. Um transceptor simples alimentado por bateria ou painel solar pode conectar voce a outras pessoas a dezenas, centenas ou ate milhares de quilometros de distancia. Radioamadores foram essenciais em praticamente todos os grandes desastres dos ultimos 100 anos — do terremoto de 1985 no Mexico ao furacao Katrina, ao terremoto de 2010 no Haiti.

Este guia cobre tudo que voce precisa para se comunicar por radio em emergencia: desde os principios basicos ate frequencias especificas, procedimentos de chamada, codigos de emergencia e construcao de antenas improvisadas. Memorize as frequencias criticas. Pratique os procedimentos. Em uma emergencia real, nao havera tempo para aprender.

---

## Fundamentos de Radio

### Como Funciona a Radiocomunicacao

O radio transmite informacao atraves de ondas eletromagneticas. Essas ondas viajam pelo ar (e pelo vacuo) na velocidade da luz. A informacao (voz, dados, codigo Morse) e codificada na onda por modulacao.

**Conceitos essenciais:**

| Termo | Significado |
|-------|------------|
| Frequencia | Numero de ciclos por segundo (medido em Hz, kHz, MHz) |
| Comprimento de onda | Distancia fisica de um ciclo completo (em metros) |
| Amplitude | "Forca" do sinal |
| Modulacao AM | Varia a amplitude — mais sensivel a ruido, mas alcance maior |
| Modulacao FM | Varia a frequencia — audio mais limpo, alcance menor |
| SSB (Single Side Band) | Variante eficiente de AM — usa metade da largura de banda, maior alcance por watt |
| Potencia (Watts) | Forca de transmissao — mais watts = mais alcance (mas nao linearmente) |
| Ganho de antena (dBi) | Eficiencia da antena em concentrar o sinal em uma direcao |

### Formula Basica: Frequencia ↔ Comprimento de Onda

```
Comprimento de onda (metros) = 300 / Frequencia (MHz)
```

Exemplos:
- 7 MHz → 300/7 = 42,8 metros
- 145 MHz → 300/145 = 2,07 metros
- 446 MHz → 300/446 = 0,67 metros

**Por que isso importa?** O comprimento de onda determina o tamanho ideal da antena. Uma antena de 1/4 de onda para 145 MHz tem ~52 cm. Para 7 MHz, tem ~10,7 metros.

### Propagacao de Ondas de Radio

As ondas de radio se comportam diferentemente conforme a frequencia:

**Onda terrestre (Ground Wave):**
- Frequencias baixas (abaixo de 2 MHz) seguem a curvatura da Terra
- Alcance: 50-500 km dependendo da potencia e terreno
- Usada por estacoes AM comerciais e maritimas

**Linha de visada (Line of Sight):**
- Frequencias acima de 30 MHz (VHF/UHF) viajam em linha reta
- Alcance limitado pelo horizonte: tipicamente 5-50 km em terreno plano
- Elevacao e TUDO — cada metro de altura na antena aumenta o alcance significativamente
- Formula do horizonte de radio: `Distancia (km) = 4,12 × √(altura em metros)`
- Antena a 10m de altura → 13 km de horizonte
- Antena a 100m de altura → 41 km de horizonte

**Onda ionosferica (Skip/Sky Wave):**
- Frequencias de HF (3-30 MHz) refletem na ionosfera
- Permitem comunicacao a MILHARES de quilometros
- Dependem do horario, estacao, ciclo solar (11 anos)
- De dia: frequencias mais altas (14-28 MHz) funcionam melhor
- De noite: frequencias mais baixas (3-10 MHz) funcionam melhor
- E assim que radioamadores conversam entre continentes com 100 watts ou menos

---

## Faixas de Frequencia e Seus Usos

### Tabela Geral de Frequencias

| Faixa | Frequencia | Alcance Tipico | Uso Principal |
|-------|-----------|----------------|---------------|
| LF | 30-300 kHz | 200+ km | Navegacao maritima, hora-padrao |
| MF (AM) | 300 kHz - 3 MHz | 50-200 km (dia), 500+ km (noite) | Radiodifusao AM, maritimo |
| HF | 3-30 MHz | 100-10.000+ km | Radioamador, militar, aviacao, maritimo |
| VHF | 30-300 MHz | 5-80 km (linha de visada) | FM comercial, radioamador, aviacao, maritimo, PMR |
| UHF | 300 MHz - 3 GHz | 3-50 km (linha de visada) | TV, radioamador, FRS/GMRS, PMR446 |

### Frequencias de EMERGENCIA — MEMORIZE

| Frequencia | Servico | Notas |
|-----------|---------|-------|
| **121.500 MHz** | Emergencia aeronautica internacional | Monitorada 24h por avioes e satelites COSPAS-SARSAT |
| **156.800 MHz (Canal 16 VHF)** | Emergencia maritima internacional | Monitorada por todos os navios e guarda costeira |
| **2.182 kHz** | Emergencia maritima HF | Alternativa HF ao canal 16 |
| **5.680 kHz** | Busca e Salvamento internacional | Usado por forcas armadas NATO |
| **14.300 kHz** | Rede de emergencia de radioamadores (IARU) | Intercontinental — muito usada em desastres |
| **7.110 kHz** | Rede de emergencia regional HF | Cobre America do Sul |
| **146.520 MHz** | Chamada de emergencia VHF radioamador (Americas) | Frequencia de chamada nacional |
| **145.500 MHz** | Chamada de emergencia VHF radioamador (Europa) | Frequencia de chamada |
| **446.000 MHz** | FRS/PMR446 Canal 1 | Radios sem licenca — ponto de encontro padrao |
| **462.5625 MHz** | GMRS Canal 1 | Emergencia GMRS |
| **27.065 MHz (Canal 9)** | Emergencia cidadao (PX/CB) | Radio cidadao — muito popular no Brasil |
| **27.185 MHz (Canal 19)** | Canal rodoviario cidadao (PX/CB) | Caminhoneiros — informacoes de estrada |

⚠️ **AVISO:** Transmitir em frequencias de emergencia sem emergencia real e CRIME em todos os paises. Em situacao de sobrevivencia real, use qualquer frequencia necessaria — a lei permite transmissoes de emergencia por qualquer pessoa.

### Radios Sem Licenca (Uso Livre)

**PMR446 (Europa/Brasil):**
- 8 canais analogicos: 446.00625 a 446.09375 MHz
- Potencia maxima: 0,5W (ERP)
- Alcance real: 1-5 km (urbano), 3-10 km (campo aberto)
- Ideal para comunicacao de grupo em curta distancia

**FRS (EUA):**
- 22 canais: 462/467 MHz
- Potencia: 0,5-2W
- Alcance similar ao PMR446

**CB/PX (Radio Cidadao):**
- 40 canais em torno de 27 MHz (HF)
- Potencia: 4W AM, 12W SSB
- Alcance: 5-30 km normal, centenas de km em condicoes de propagacao favoraveis
- Muito popular no Brasil entre caminhoneiros e comunidades rurais

---

## Equipamentos Essenciais

### Radio HT (Handie-Talkie / Walkie-Talkie)

O radio portatil VHF/UHF e o equipamento mais versatil para sobrevivencia:

**Radios recomendados (em ordem de prioridade):**

1. **Baofeng UV-5R ou UV-82** — Custo baixissimo (~R$100-200), dual band VHF/UHF, 5-8W, programavel. O "canivete suico" dos radios de emergencia
2. **Yaesu FT-65R** — Mais robusto, melhor receptor, 5W
3. **Quansheng UV-K5/K6** — Receptor de banda larga, firmware modificavel
4. **Motorola Talkabout** — Simples, robusto, FRS/GMRS, ideal para familia

**O que levar no kit de radio:**
- [ ] Radio HT com bateria completa
- [ ] Bateria reserva (ou case de pilhas AA)
- [ ] Antena telescopica ou Nagoya NA-771 (muito superior a antena de fabrica)
- [ ] Cabo de programacao USB + arquivo de memorias pre-programado
- [ ] Fone de ouvido com microfone (economiza bateria e permite discricao)
- [ ] Carregador solar ou adaptador 12V para isqueiro de carro
- [ ] Lista plastificada de frequencias locais

### Radio HF (Longa Distancia)

Para comunicacao alem de 50 km, voce precisa de HF:

- **Xiegu G90** — Compacto, 20W, tela embutida, bom para portatil
- **Yaesu FT-891** — 100W, muito robusto, excelente receptor
- **IC-7300** — Referencia em desempenho, mas pesado e caro

**Consumo de energia tipico:**
| Modo | Consumo |
|------|---------|
| Recebendo | 0,5 - 1A |
| Transmitindo 5W | 1,5 - 2A |
| Transmitindo 100W | 18 - 22A |

⚠️ **Radios HF consomem MUITA energia na transmissao.** Planeje sua fonte de energia (bateria 12V de carro, painel solar de 50W+ para recarregar).

### Receptor de Ondas Curtas

Mesmo sem transmitir, um receptor de ondas curtas permite:
- Ouvir estacoes internacionais de noticias
- Monitorar frequencias de emergencia
- Receber previsoes meteorologicas

**Receptores recomendados:**
- Tecsun PL-330 ou PL-880 (sensibilidade excelente, compacto)
- Sony ICF-SW7600GR (referencia classica)
- Qualquer radio AM/FM/SW encontrado em ruinas

---

## Antenas

### A Antena e Mais Importante que o Radio

Uma regra fundamental da radiocomunicacao: **duplique a potencia do radio e ganhe 3 dB (melhora perceptivel). Duplique a eficiencia da antena e ganhe 3 dB tambem, sem gastar nenhum watt extra.**

Investir em uma boa antena e sempre mais eficiente do que investir em mais potencia.

### Antena Dipolo de Meia Onda (HF)

A antena mais simples e eficiente para HF. Dois pedacos de fio iguais, alimentados no centro:

```
Comprimento total (metros) = 143 / Frequencia (MHz)
Cada braco = metade
```

**Exemplo para 7.1 MHz (40 metros):**
- Comprimento total: 143 / 7,1 = 20,14 metros
- Cada braco: 10,07 metros

**Construcao:**
1. Corte dois pedacos de fio de cobre (qualquer fio eletrico serve: 1,5mm² a 4mm²)
2. No centro, conecte o cabo coaxial: condutor central em um braco, malha no outro
3. Estique os bracos em linha reta, o mais alto possivel (minimo 5 metros do solo)
4. Prenda as pontas em arvores, postes ou mastros improvisados
5. Use isoladores nas pontas (pedacos de PVC, garrafa PET cortada)

**Configuracao em "V invertido":**
- Centro no ponto mais alto (arvore, mastro)
- Bracos descendo em angulo de 90-120 graus
- Mais facil de montar — precisa de apenas UM ponto alto
- Funciona quase tao bem quanto o dipolo horizontal

### Antena de 1/4 de Onda (VHF/UHF Improvisada)

Para melhorar drasticamente seu HT:

**Para 145 MHz (2 metros):**
1. Corte um pedaco de fio rigido com 49 cm
2. Conecte ao conector de antena do radio (ou solde em um conector SMA)
3. Para radiais: 4 fios de 49 cm saindo do ponto de conexao em angulo de 45 graus para baixo
4. Monte o mais alto possivel

**Para 446 MHz (PMR/FRS):**
- Mesmo principio, fios de 16 cm

### Antena de Emergencia com Materiais Encontrados

**Fio eletrico de construcao:** Excelente para antenas HF. Tire de ruinas, paredes, instalacoes eletricas.

**Cerca de arame:** Pode funcionar como antena HF improvisada — conecte o radio a uma secao de cerca isolada do solo.

**Escada de aluminio:** Funciona como antena vertical para VHF/UHF.

**Lata de aluminio:** Corte e abra para criar um refletor parabolico improvisado atras da antena do HT. Ganho de 3-6 dB na direcao apontada.

**Mola de colchao/sofa:** Pode servir como antena de emergencia para HF.

---

## Procedimentos de Comunicacao

### Alfabeto Fonetico Internacional (ICAO/NATO)

MEMORIZE. Usado universalmente para soletrar palavras no radio:

| Letra | Fonetico | Letra | Fonetico |
|-------|---------|-------|---------|
| A | Alfa | N | November |
| B | Bravo | O | Oscar |
| C | Charlie | P | Papa |
| D | Delta | Q | Quebec |
| E | Echo | R | Romeo |
| F | Foxtrot | S | Sierra |
| G | Golf | T | Tango |
| H | Hotel | U | Uniform |
| I | India | V | Victor |
| J | Juliet | W | Whiskey |
| K | Kilo | X | X-ray |
| L | Lima | Y | Yankee |
| M | Mike | Z | Zulu |

**Numeros:**
| Numero | Pronuncia |
|--------|-----------|
| 0 | Zero |
| 1 | Uno |
| 2 | Dois |
| 3 | Tres |
| 4 | Quatro |
| 5 | Cinco |
| 6 | Meia (ou Seis) |
| 7 | Sete |
| 8 | Oito |
| 9 | Nove |

### Prowords (Palavras de Procedimento)

| Proword | Significado |
|---------|------------|
| **Cambio** (Over) | Terminei minha transmissao, espero sua resposta |
| **Escuto** (Out) | Transmissao encerrada, nao espero resposta |
| **Afirmativo** | Sim |
| **Negativo** | Nao |
| **Repita** (Say Again) | Repita sua ultima transmissao |
| **Correto** (Roger) | Recebi e entendi sua mensagem |
| **Entendido** (Copy) | Entendi a informacao |
| **Espere** (Stand By) | Aguarde, voltarei em breve |
| **Mayday** | Emergencia de vida ou morte (repetir 3 vezes) |
| **Pan-Pan** | Urgencia (nao risco imediato de vida) |
| **QSL** | Confirmo recebimento |
| **QTH** | Localizacao |
| **QRM** | Interferencia de outras estacoes |
| **QRN** | Interferencia atmosferica (raios) |

### Como Fazer uma Chamada

**Chamada geral (CQ):**
```
"CQ CQ CQ, aqui [seu indicativo ou nome],
[seu indicativo ou nome] chamando em [frequencia].
Alguem na escuta? Cambio."
```

**Chamada direcionada:**
```
"[Nome/indicativo da estacao], aqui [seu nome/indicativo].
Voce me recebe? Cambio."
```

**Resposta:**
```
"[Quem chamou], aqui [seu nome/indicativo].
Recebo voce com forca [1-5] e clareza [1-5]. Cambio."
```

### Escala de Qualidade de Sinal

| Nota | Forca do Sinal | Clareza |
|------|---------------|---------|
| 1 | Muito fraco, quase inaudivel | Ininteligivel |
| 2 | Fraco | Entende-se com dificuldade |
| 3 | Moderado | Entende-se com esforco |
| 4 | Bom | Claro, sem dificuldade |
| 5 | Excelente | Perfeitamente claro |

---

## Codigo Morse

### Por Que Aprender Morse em Pleno Seculo XXI?

1. **Funciona com equipamento minimo** — um fio, uma chave e uma bateria
2. **Penetra ruido** — sinais CW (Morse) sao decodificaveis ate 10 dB abaixo do ruido
3. **Usa pouquissima energia** — transmissor CW pode funcionar com pilhas por semanas
4. **Universal** — mesmo alfabeto em qualquer idioma

### Tabela Morse Completa

```
A  .-        N  -.        0  -----
B  -...      O  ---       1  .----
C  -.-.      P  .--.      2  ..---
D  -..       Q  --.-      3  ...--
E  .         R  .-.       4  ....-
F  ..-.      S  ...       5  .....
G  --.       T  -         6  -....
H  ....      U  ..-       7  --...
I  ..        V  ...-      8  ---..
J  .---      W  .--       9  ----.
K  -.-       X  -..-
L  .-..      Y  -.--
M  --        Z  --..
```

### Sinais Morse de Emergencia

| Sinal | Codigo | Significado |
|-------|--------|------------|
| **SOS** | `... --- ...` | Socorro internacional (3 curtos, 3 longos, 3 curtos) |
| **CQD** | `-.-. --.- -..` | Socorro antigo (ainda reconhecido) |

**Temporizacao do Morse:**
- Ponto (dit): 1 unidade de tempo
- Traco (dah): 3 unidades
- Espaco entre simbolos: 1 unidade
- Espaco entre letras: 3 unidades
- Espaco entre palavras: 7 unidades

**Metodo de aprendizado rapido:**
- Comece com as letras mais comuns: E, T, A, I, N, S
- Pratique 15 minutos por dia
- Use o metodo Koch: ouca a 20 WPM, comece com 2 letras, adicione uma quando atingir 90% de acerto
- Em 30 dias, voce decodifica Morse basico

### Transmissor Morse Improvisado

**Material:**
- Bateria (9V, pilhas, bateria de carro)
- Fio de cobre (2-3 metros no minimo)
- Uma chave (interruptor, dois pedacos de metal que se tocam)
- LED ou buzzer (para treino) ou antena (para transmissao real)

**Transmissor de onda continua simples (foxhole radio ao contrario):**
1. Enrole 20-30 voltas de fio em um tubo de papel (bobina)
2. Conecte uma ponta da bobina a um lado da chave
3. Conecte o outro lado da chave a um polo da bateria
4. Conecte o outro polo da bateria a outra ponta da bobina
5. Estique um fio longo como antena a partir de uma ponta da bobina
6. Ao fechar a chave, voce gera um pulso eletromagnetico

⚠️ **Este e um transmissor MUITO primitivo** — alcance de metros a dezenas de metros apenas. Mas pode ser detectado por receptores sensiveis na vizinhanca.

---

## Protocolos de Emergencia

### Chamada MAYDAY (Perigo de Vida)

Usada em risco IMEDIATO de morte (naufragio, acidente aereo, ataque, ferimento grave sem socorro):

```
"MAYDAY MAYDAY MAYDAY
Aqui [nome/indicativo], [nome/indicativo], [nome/indicativo]
MAYDAY [nome/indicativo]
Minha posicao e [coordenadas ou descricao]
[Natureza do perigo]
[Tipo de socorro necessario]
[Numero de pessoas]
[Qualquer informacao adicional]
Cambio."
```

**Exemplo real:**
```
"MAYDAY MAYDAY MAYDAY
Aqui Grupo Alfa, Grupo Alfa, Grupo Alfa
MAYDAY Grupo Alfa
Posicao: margem norte do Rio Paraiba, proximo a ponte velha da BR-116
Temos tres feridos graves apos desabamento
Precisamos de resgate aereo ou terrestre e equipe medica
Somos 8 pessoas, tres criancas
Um ferido com fratura exposta, dois com trauma craniano
Cambio."
```

### Chamada PAN-PAN (Urgencia sem Risco Imediato)

Para situacoes graves mas sem perigo IMEDIATO de vida:

```
"PAN-PAN PAN-PAN PAN-PAN
Aqui [nome/indicativo]
[Natureza da urgencia]
[Posicao]
[Assistencia necessaria]
Cambio."
```

### Sinal de Socorro SOS (Universal)

Pode ser transmitido de QUALQUER forma:
- **Morse via radio:** `... --- ...` (3 curtos, 3 longos, 3 curtos)
- **Morse visual (lanterna/espelho):** mesma sequencia
- **Sonoro (apito/buzina):** mesma sequencia
- **Visual:** SOS escrito no chao (pedras, troncos) — letras de 3+ metros

---

## Disciplina de Radio em Situacoes Taticas

### OPSEC — Seguranca Operacional

Em cenarios onde adversarios podem monitorar suas comunicacoes:

1. **Transmissoes curtas** — Quanto mais tempo transmitindo, mais facil ser localizado por radiogoniometria (RDF). Limite cada transmissao a 30 segundos no maximo
2. **Horarios fixos** — Combine janelas de comunicacao (ex: minutos 15 e 45 de cada hora). Ligue o radio apenas nesses horarios
3. **Frequencias alternadas** — Tenha uma lista de frequencias e alterne conforme um padrao combinado previamente
4. **Linguagem codificada** — Use codinomes para locais, pessoas e acoes. Combine ANTES da crise
5. **Potencia minima** — Use a menor potencia que permita comunicacao. 0,5W pode ser suficiente a 2 km
6. **Posicao de transmissao** — Transmita de local diferente de onde voce acampa/vive. Radiogoniometria pode localizar transmissores

### Tabela de Codinomes (Modelo)

Prepare sua propria tabela ANTES da crise:

| Real | Codinome (exemplo) |
|------|-------------------|
| Base/Abrigo | "Casa Verde" |
| Ponto de encontro | "Mercado" |
| Agua | "Produto A" |
| Comida | "Produto B" |
| Municao | "Produto C" |
| Feridos | "Pacotes danificados" |
| Hostis | "Clientes" |
| Criancas | "Pacotes pequenos" |
| Precisamos de ajuda | "Faca o pedido" |
| Estamos seguros | "Loja aberta" |
| Perigo | "Loja fechada" |
| Retirada | "Hora do almoco" |

### Protocolo de Radio Silencio

Quando ordenado "Radio Silencio":
- **NENHUMA transmissao** exceto emergencia de vida
- Receptor pode permanecer ligado (apenas escuta)
- Para quebrar radio silencio: preceda a mensagem com "[Indicativo] QUEBRANDO SILENCIO" — isto sinaliza que a informacao e critica

---

## Rede de Comunicacao para Grupos

### Estrutura de Rede

**Rede em Estrela (Star Network):**
- Uma estacao central (Net Control) coordena
- Todas as estacoes falam apenas com a central
- A central retransmite mensagens entre estacoes
- Mais organizada, ideal para grupos de 5-20 pessoas

**Rede em Malha (Mesh):**
- Todas as estacoes podem falar entre si
- Mais resiliente (sem ponto unico de falha)
- Mais confusa — exige disciplina

### Rotina de Comunicacao Diaria

**Check-in matinal (exemplo: 07:00):**
```
Central: "Rede Alfa, rede Alfa. Aqui Central para check-in matinal.
          Chamando todas as estacoes em sequencia.
          Estacao 1, reporte. Cambio."
Est. 1:  "Central, aqui Estacao 1. [Numero de pessoas],
          [status: verde/amarelo/vermelho],
          [necessidades]. Cambio."
Central: "Estacao 1, recebido. Estacao 2, reporte. Cambio."
[...]
Central: "Todas as estacoes reportadas. Proximo check-in 19:00.
          Central escuto."
```

**Codigos de status:**
| Codigo | Significado |
|--------|------------|
| Verde | Tudo normal, sem necessidades |
| Amarelo | Situacao gerenciavel, mas com necessidade ou alerta |
| Vermelho | Emergencia, necessita ajuda imediata |

---

## Conservacao de Energia do Radio

A bateria e o recurso mais precioso do seu radio. Sem energia, o radio e um peso morto.

### Dicas de Economia

1. **Reduza a potencia de transmissao** — Use a menor potencia que funcione (1W em vez de 5W reduz consumo pela metade)
2. **Transmissoes curtas** — Prepare a mensagem ANTES de pressionar o PTT
3. **Desligue quando nao estiver em uso** — Mesmo em standby, o radio consome
4. **Use fone de ouvido** — O alto-falante consome mais energia que o fone
5. **Monitore com scan** — Em vez de ficar em uma frequencia, use scan periodico
6. **Desligue o display/iluminacao** — Economiza 10-20% da bateria
7. **Mantenha baterias aquecidas** — Baterias de litio perdem capacidade no frio. Guarde proximo ao corpo

### Fontes de Energia para Radio

| Fonte | Tensao | Autonomia Tipica |
|-------|--------|-----------------|
| Bateria original do HT (1800mAh) | 7,4V | 8-24 horas |
| Case de pilhas AA (6x AA) | 9V | 4-12 horas |
| Bateria de carro (50Ah) | 12V | 50+ horas de recepcao |
| Painel solar 10W + controlador | 12V | Indefinida (com sol) |
| Painel solar 50W + bateria 12V | 12V | Indefinida, suporta HF |
| Gerador portatil | 12V/110V | Depende de combustivel |
| Carregador manual (manivela) | 5V USB | 1 min manivela ≈ 3-5 min uso |

---

## Receptor de Emergencia Improvisado (Foxhole Radio)

Se voce nao tem NENHUM radio, pode construir um receptor AM primitivo com materiais encontrados:

### Material Necessario
- Fio de cobre (10-20 metros) — de instalacao eletrica, motor queimado, transformador
- Tubo de papelao (rolo de papel higienico)
- Lamina de barbear enferrujada (ou grafite de lapis)
- Alfinete de seguranca ou ponta de fio
- Fone de ouvido de alta impedancia (ou fone piezoeletrico de telefone antigo)

### Construcao

1. **Bobina:** Enrole 80-120 voltas de fio de cobre isolado no tubo de papelao, espiras juntas
2. **Antena:** Conecte uma ponta da bobina a um fio longo (10+ metros) esticado o mais alto possivel
3. **Terra:** Conecte a outra ponta da bobina a um terra (cano metalico enterrado, cerca metalica, estaca no solo umido)
4. **Detector:** Coloque a lamina enferrujada sobre uma superficie. Toque a ponta do alfinete suavemente na superficie da lamina — procure o "ponto quente" (a ferrugem forma um diodo primitivo)
5. **Fone:** Conecte o fone em paralelo com o detector (entre o ponto de contato do alfinete na lamina e a bobina)
6. **Sintonia:** Mova o ponto de contato na bobina (desencapando espiras) para sintonizar diferentes estacoes

⚠️ **Este receptor nao tem amplificacao** — voce ouvira apenas estacoes AM potentes relativamente proximas. Mas em silencio total, pode captar estacoes a 50-100 km.

---

## Sinalizacao de Emergencia sem Radio

Quando nao ha radio disponivel, use estes metodos:

### Espelho de Sinalizacao
- Qualquer superficie reflexiva: espelho, CD/DVD, folha de aluminio sobre superficie plana, fundo de lata polido
- Direcione o reflexo do sol para aeronaves ou observadores distantes
- Visivel a 30+ km em dia claro
- Faca movimentos de varredura lentos no horizonte, depois fixe quando ouvir/ver aeronave

### Sinais com Fogueira
| Sinal | Significado |
|-------|------------|
| 3 fogueiras em triangulo | Socorro internacional |
| 1 fogueira | Posicao marcada |
| Fumaca escura (borracha, oleo, plastico) | Visivel contra ceu claro |
| Fumaca branca (folhas verdes, musgo) | Visivel contra fundo escuro |

### Sinais Terrestres (para aeronaves)

Construa com pedras, troncos ou cavando no solo. Letras de 3+ metros:

| Simbolo | Significado |
|---------|------------|
| V | Preciso de assistencia |
| X | Preciso de assistencia medica |
| N | Nao (resposta negativa) |
| Y | Sim (resposta afirmativa) |
| → | Estou indo nesta direcao |
| I | Preciso de medico |
| F | Preciso de comida e agua |
| LL | Tudo bem |

### Apito
- **3 apitos curtos** = SOS / socorro (repita a cada minuto)
- **1 apito longo** = "Onde voce esta?" (resposta a busca)
- Apito e ouvido a 1-2 km em terreno aberto (muito mais eficiente que gritar)
- Nao cansa a voz e funciona por horas

---

## Programacao e Frequencias Locais (Brasil)

### Frequencias Uteis no Brasil

| Servico | Frequencia |
|---------|-----------|
| Radioamador VHF (chamada) | 145.500 MHz |
| Radioamador UHF (chamada) | 438.500 MHz |
| Radioamador HF 40m | 7.100-7.200 MHz |
| Radioamador HF 20m | 14.200-14.350 MHz |
| Radio Cidadao (PX) Canal 9 | 27.065 MHz |
| Radio Cidadao (PX) Canal 19 | 27.185 MHz |
| RENER (emergencia civil) | 7.210 kHz (LSB) |
| Marinha do Brasil | 156.800 MHz (VHF canal 16) |
| Defesa Civil | 164.000 MHz (varia por estado) |
| SAMU | Frequencias de despacho locais |
| Bombeiros | Frequencias VHF locais (150-170 MHz) |

### Repetidoras de Radioamador

Repetidoras VHF/UHF amplificam e retransmitem sinais, aumentando drasticamente o alcance:

- Procure repetidoras locais em 145-146 MHz e 438-439 MHz
- Necessitam "tom CTCSS" para acessar — cada repetidora tem um tom especifico
- Em emergencia, tente transmitir na frequencia de saida da repetidora com diferentes tons CTCSS (67.0, 71.9, 77.0, 88.5, 100.0, 114.8 sao os mais comuns no Brasil)
- Sem tom correto, tente simplex (sem repetidora) na frequencia de chamada

### Programacao do Baofeng UV-5R para Emergencia

**Memorias sugeridas:**
| Canal | Frequencia | Modo | Uso |
|-------|-----------|------|-----|
| 001 | 145.500 | FM Simplex | Chamada VHF amador |
| 002 | 146.520 | FM Simplex | Chamada VHF (padrao Americas) |
| 003-010 | Repetidoras locais | FM + CTCSS | Repetidoras da sua regiao |
| 011 | 438.500 | FM Simplex | Chamada UHF amador |
| 012 | 446.00625 | FM | PMR446 Canal 1 |
| 013-019 | 446 MHz | FM | PMR446 Canais 2-8 |
| 020 | 156.800 | FM | Canal 16 maritimo (escuta) |
| 021 | 121.500 | AM (se suportado) | Emergencia aeronautica (escuta) |
| 022-030 | Frequencias do grupo | FM | Canais taticos do seu grupo |

⚠️ **ATENCAO:** O Baofeng UV-5R transmite em frequencias que requerem licenca. Em situacao de emergencia real, a lei permite uso de qualquer frequencia. Em tempos normais, obtenha sua licenca de radioamador (no Brasil: prova na ANATEL, classe C e a mais facil).

---

## Manutencao e Cuidados

### Protecao do Equipamento

1. **Umidade:** Guarde em saco ziplock com sachê de silica gel. Em ambiente tropical, a umidade e o inimigo #1
2. **EMP/Raios:** Guarde equipamento reserva em gaiola de Faraday (lata de metal com isolamento interno). Veja guia de Energia e Eletricidade
3. **Impacto:** Use case protetor ou envolva em pano/espuma
4. **Areia/Poeira:** Cubra conectores com tampa. Limpe com ar comprimido ou pincel
5. **Calor extremo:** Nao deixe ao sol direto. Temperatura maxima tipica: 60°C
6. **Corrosao de bateria:** Remova baterias se nao for usar por semanas

### Teste Periodico

- Teste seu radio pelo menos uma vez por SEMANA
- Faca check-in em redes de radioamador locais (treino + teste)
- Verifique carga das baterias reserva mensalmente
- Teste antenas reserva

---

## Checklist Rapido

- [ ] Radio HT com bateria carregada e reserva
- [ ] Lista plastificada de frequencias de emergencia
- [ ] Antena reserva/melhorada (Nagoya NA-771 ou similar)
- [ ] Fone de ouvido com microfone
- [ ] Fonte de energia: painel solar portatil ou case de pilhas
- [ ] Conhecimento basico de procedimentos de chamada
- [ ] Alfabeto fonetico memorizado
- [ ] SOS em Morse memorizado (... --- ...)
- [ ] Frequencias de emergencia memorizadas (145.500, 27.065 Canal 9, 146.520)
- [ ] Fio de cobre (10-20m) para antena improvisada
- [ ] Apito para sinalizacao sonora
- [ ] Espelho ou superficie reflexiva para sinalizacao visual
- [ ] Tabela de codinomes preparada para seu grupo
- [ ] Horarios de comunicacao combinados com seu grupo
- [ ] Radio guardado em protecao contra EMP (lata metalica)

---

## Referencias e Notas

- Manual ARRL (American Radio Relay League) — referencia mundial de radioamadorismo
- ANATEL — regulamentacao brasileira de radiofrequencias
- ITU (International Telecommunication Union) — alocacao internacional de frequencias
- Codigo Q completo disponivel em publicacoes ITU
- IARU (International Amateur Radio Union) — coordenacao de redes de emergencia
- ARES/RACES — programas de emergencia por radioamadores
- Para obter licenca de radioamador no Brasil: www.anatel.gov.br → Radioamador → Prova classe C
- Frequencias de repetidoras no Brasil: consulte o site da LABRE do seu estado antes da crise e imprima a lista
/* ═══ Bunker AI v3 — Guides, Favorites, Config Drawer, History ═══ */
/* "The Answer to the Ultimate Question of Life, the Universe, and Everything is 42" */

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  models: [],
  visionModels: [],
  chats: {},          // { id: { title, messages: [] } }
  activeChatId: null,
  isStreaming: false,
  webcamActive: false,
  webcamStream: null,
  recognition: null,
  isListening: false,
  attachedImage: null,
  generatedHtml: "",
  currentAudio: null,
  favorites: [],      // [{ id, text, from, chatId, ts }]
  activeGuide: null,
  sttEngine: "browser",  // "whisper" (offline) or "browser" (Chrome Web Speech API)
  ttsOffline: false,     // true if piper is available
  promptQueue: [],        // [string] — queued prompts
  abortController: null,  // AbortController for active stream
  characters: {},         // { id: { name, emoji, color, desc, systemPrompt, voice } }
  activeCharacterId: null,
};

// ─── Guide Data ─────────────────────────────────────────────────────────────
const GUIDES = {
  shelter: {
    tag: "PRIORIDADE 1",
    title: "Abrigo de Emergencia",
    subtitle: "Na regra dos 3, voce sobrevive 3 horas sem abrigo em condicoes extremas. Antes de agua, antes de comida — abrigo vem primeiro.",
    image: "./img/guide-shelter.jpg",
    content: `
      <h2>Por que abrigo e prioridade</h2>
      <p>Hipotermia mata mais rapido que fome ou sede. Mesmo em climas tropicais, uma noite de chuva sem protecao pode causar hipotermia. O abrigo regula sua temperatura corporal e protege contra vento, chuva e exposicao solar.</p>
      
      <div class="tip-box">
        <div class="tip-label">DON'T PANIC — DICA</div>
        <p>A regra dos 3: 3 minutos sem ar, 3 horas sem abrigo, 3 dias sem agua, 3 semanas sem comida. Priorize nessa ordem.</p>
      </div>

      <h2>Lean-to (Telhado Inclinado)</h2>
      <h3>Quando usar</h3>
      <p>O abrigo mais rapido de construir. Ideal quando voce tem pouco tempo antes de escurecer ou quando a chuva esta chegando.</p>
      <h3>Como construir</h3>
      <ol>
        <li><strong>Encontre um suporte:</strong> uma arvore caida, pedra grande, ou amarre um galho grosso (2-3m) entre duas arvores na altura do quadril.</li>
        <li><strong>Monte a estrutura:</strong> encoste galhos menores (1.5-2m) num angulo de 45-60° contra o suporte principal, lado a lado, com 20-30cm de espaco entre eles.</li>
        <li><strong>Cubra com folhas:</strong> comece de baixo para cima (como telhas), usando folhas grandes, capim, ou casca de arvore. Quanto mais camadas, melhor a impermeabilizacao.</li>
        <li><strong>Isole o chao:</strong> coloque uma camada grossa de folhas secas ou capim no chao — voce perde mais calor pelo chao do que pelo ar.</li>
      </ol>

      <h2>Debris Hut (Cabana de Detritos)</h2>
      <h3>Quando usar</h3>
      <p>Quando voce precisa de maximo isolamento termico. Perfeito para noites frias sozinho — o espaco apertado conserva calor corporal.</p>
      <h3>Como construir</h3>
      <ol>
        <li><strong>Galho principal (ridgepole):</strong> um galho de 2.5-3m, apoiado num toco ou forquilha a 60cm do chao.</li>
        <li><strong>Costelas:</strong> galhos menores encostados dos dois lados, criando um formato de barraca com espaco apenas para seu corpo.</li>
        <li><strong>Cobertura:</strong> empilhe folhas, galhos e detritos sobre toda a estrutura. Minimo 30cm de espessura — mais e melhor.</li>
        <li><strong>Entrada:</strong> empilhe material na entrada para bloquear vento. Use sua mochila como porta.</li>
      </ol>

      <div class="warn-box">
        <div class="warn-label">ATENCAO</div>
        <p>Nunca construa abrigo no leito seco de um rio — enchentes repentinas podem ocorrer. Evite areas sob arvores mortas (widow makers) e encostas instáveis.</p>
      </div>

      <h2>Abrigo com Lona/Plastico</h2>
      <p>Se voce tem uma lona, plastico, ou ate sacos de lixo grandes, suas opcoes melhoram muito:</p>
      <ul>
        <li><strong>A-Frame:</strong> amarre uma corda entre duas arvores, jogue a lona por cima, prenda as pontas com pedras.</li>
        <li><strong>Lean-to coberto:</strong> mesma estrutura do lean-to, mas com a lona como camada impermeavel antes das folhas.</li>
        <li><strong>Poncho shelter:</strong> com um poncho ou saco de lixo grande, crie um abrigo minimo amarrando nas arvores.</li>
      </ul>

      <h2>Contexto Brasil</h2>
      <p>No clima tropical brasileiro, priorize protecao contra chuva e insetos mais que contra frio. Folhas de palmeira sao excelentes para cobertura. Bananeiras fornecem folhas enormes que servem como telhas naturais. Sempre verifique o chao por formigas, aranhas e cobras antes de montar.</p>

      <h2>Checklist Rapido</h2>
      <ul class="checklist">
        <li>Local elevado, longe de rios e encostas</li>
        <li>Protecao contra vento dominante</li>
        <li>Material para isolamento do chao</li>
        <li>Cobertura com minimo 30cm de espessura</li>
        <li>Entrada virada contra o vento</li>
        <li>Verificar por perigos naturais (arvores mortas, insetos)</li>
      </ul>

      <div class="guide-footer">
        Baseado em: SAS Survival Handbook (John Wiseman), Bushcraft 101 (Dave Canterbury) · 
        <a href="https://www.perplexity.ai/computer" target="_blank">Created with Perplexity Computer</a>
      </div>
    `
  },
  fire: {
    tag: "PRIORIDADE 2",
    title: "Tecnicas de Fogo",
    subtitle: "Fogo e aquecimento, purificacao de agua, sinal de resgate, protecao contra animais e o maior motivador psicologico que existe numa situacao de sobrevivencia.",
    image: "./img/guide-fire.jpg",
    content: `
      <h2>Os 3 elementos do fogo</h2>
      <p>Todo fogo precisa de: <strong>combustivel</strong> (material que queima), <strong>oxigenio</strong> (ar) e <strong>calor</strong> (fonte de ignicao). Remova qualquer um e o fogo morre. Entender isso e a base de tudo.</p>

      <h2>Preparando o material</h2>
      <p>Antes de tentar acender qualquer coisa, prepare seus materiais em tres categorias:</p>
      <ol>
        <li><strong>Tinder (isca):</strong> material fino que pega fogo com uma faisca. Capim seco, casca de arvore desfiada, algodao, papel, fungos secos (como amadou). Quanto mais fino e seco, melhor.</li>
        <li><strong>Kindling (gravetos):</strong> galhos finos (grossura de um lapis ate um dedo). Comecam a queimar com o calor do tinder.</li>
        <li><strong>Fuel (lenha):</strong> galhos e troncos maiores que mantem o fogo aceso por horas.</li>
      </ol>

      <div class="tip-box">
        <div class="tip-label">DON'T PANIC — DICA</div>
        <p>Galhos mortos ainda presos na arvore sao os mais secos — nunca pegue galhos do chao umido se tiver opcao. Madeira morta em pe e o melhor combustivel.</p>
      </div>

      <h2>Metodo 1: Ferro Rod (Pederneira Moderna)</h2>
      <p>O metodo mais confiavel. Funciona molhado, em altitude, e dura milhares de usos.</p>
      <ol>
        <li>Prepare um ninho de tinder do tamanho de uma bola de tenis</li>
        <li>Segure o ferro rod sobre o tinder com a mao que nao raspa</li>
        <li>Raspe o striker (ou costas de uma faca) ao longo do rod com pressao firme</li>
        <li>Direcione as faiscas para o centro do tinder</li>
        <li>Assim que pegar, sopre gentilmente e adicione kindling</li>
      </ol>

      <h2>Metodo 2: Bow Drill (Arco de Friccao)</h2>
      <p>Metodo primitivo que funciona sem nenhum equipamento moderno — apenas madeira e corda.</p>
      <ol>
        <li><strong>Fireboard:</strong> tabua plana de madeira macia (cedro, salgueiro, choupo)</li>
        <li><strong>Spindle:</strong> vara reta de 30-40cm, mesma madeira macia</li>
        <li><strong>Bow:</strong> galho curvo com corda (cadarco, paracord, fibra vegetal)</li>
        <li><strong>Socket:</strong> pedra com cavidade ou madeira dura para pressionar o topo do spindle</li>
        <li>Enrole a corda do arco no spindle, coloque sobre o fireboard, e mova o arco rapido</li>
        <li>A friccao cria po negro quente — quando fumar, transfira para o tinder</li>
      </ol>

      <h2>Metodo 3: Lente / Lupa</h2>
      <p>Fundo de garrafa PET com agua, lente de oculos, ou ate um saco plastico com agua podem concentrar luz solar. Funciona apenas com sol direto e forte.</p>

      <h2>Metodo 4: Bateria + Palha de Aco</h2>
      <p>Toque os dois polos de uma bateria (9V e perfeita) na palha de aco. A faiscas eletrica acende instantaneamente. Funciona ate com pilha AA e um pedaco de papel aluminio.</p>

      <h2>Estruturas de Fogueira</h2>
      <ul>
        <li><strong>Teepee:</strong> gravetos em cone — otimo para iniciar. Queima rapido e quente.</li>
        <li><strong>Log Cabin:</strong> troncos empilhados em quadrado — queima longa e estavel, boa para cozinhar.</li>
        <li><strong>Star Fire:</strong> troncos longos em estrela com fogo no centro — empurre conforme queimam. Economiza lenha.</li>
        <li><strong>Dakota Hole:</strong> dois buracos conectados — fogo escondido, eficiente e resistente ao vento.</li>
      </ul>

      <div class="warn-box">
        <div class="warn-label">ATENCAO</div>
        <p>Nunca deixe fogo sem supervisao. Em areas secas, limpe um circulo de 3m ao redor. Tenha agua ou terra para apagar. No Brasil, incendio florestal e crime ambiental — use com responsabilidade.</p>
      </div>

      <div class="guide-footer">
        Baseado em: SAS Survival Handbook, Bushcraft 101, Deep Survival (Laurence Gonzales) · 
        <a href="https://www.perplexity.ai/computer" target="_blank">Created with Perplexity Computer</a>
      </div>
    `
  },
  water: {
    tag: "PRIORIDADE 3",
    title: "Purificacao de Agua",
    subtitle: "Voce sobrevive apenas 3 dias sem agua. Mas beber agua contaminada pode matar ainda mais rapido. Saber purificar e tao importante quanto encontrar.",
    image: "./img/guide-water.jpg",
    content: `
      <h2>Fontes de agua na natureza</h2>
      <p>Em ordem de preferencia (menor risco de contaminacao):</p>
      <ol>
        <li><strong>Agua da chuva:</strong> a mais segura — colete diretamente com lona, folhas grandes, ou qualquer recipiente limpo.</li>
        <li><strong>Nascentes:</strong> agua que brota do chao — geralmente limpa, mas sempre purifique.</li>
        <li><strong>Riachos de montanha:</strong> agua corrente e mais segura que parada.</li>
        <li><strong>Rios grandes:</strong> maior risco de contaminacao por agropecuaria e esgoto.</li>
        <li><strong>Agua parada:</strong> lagos e poças — alto risco, purifique sempre.</li>
      </ol>

      <h2>Metodo 1: Fervura</h2>
      <p>O metodo mais seguro e acessivel. Mata 99.9% dos patogenos.</p>
      <ul>
        <li>Ferva a agua por <strong>1 minuto</strong> em altitudes normais</li>
        <li>Em altitudes acima de 2000m, ferva por <strong>3 minutos</strong></li>
        <li>Se nao tem recipiente metalico, use uma pedra quente colocada na agua dentro de um recipiente improvisado (bambu, casca de arvore)</li>
      </ul>

      <div class="tip-box">
        <div class="tip-label">DON'T PANIC — DICA</div>
        <p>Uma garrafa PET transparente cheia de agua, deixada no sol forte por 6 horas (metodo SODIS — Solar Disinfection), mata a maioria das bacterias. E ciencia da OMS.</p>
      </div>

      <h2>Metodo 2: Pastilhas/Quimico</h2>
      <ul>
        <li><strong>Cloro (agua sanitaria):</strong> 2 gotas por litro de agua limpa. Espere 30 minutos. Use agua sanitaria pura (sem perfume).</li>
        <li><strong>Iodo:</strong> 5 gotas de tintura de iodo 2% por litro. Espere 30 min. Gosto ruim mas funciona.</li>
        <li><strong>Pastilhas comerciais:</strong> (Aquatabs, Hidrosteril) — siga as instrucoes do fabricante.</li>
      </ul>

      <h2>Metodo 3: Filtro Improvisado</h2>
      <p>Nao substitui a purificacao, mas remove sedimentos e melhora o gosto:</p>
      <ol>
        <li>Corte uma garrafa PET ao meio</li>
        <li>Coloque de cabeca para baixo (funil)</li>
        <li>Camadas de baixo para cima: algodao ou tecido, carvao moido, areia fina, cascalho</li>
        <li>Despeje agua por cima e colete embaixo</li>
        <li><strong>Depois do filtro, ainda precisa ferver ou tratar quimicamente</strong></li>
      </ol>

      <h2>Metodo 4: Destilacao Solar (Solar Still)</h2>
      <p>Extrai agua do solo usando o calor do sol:</p>
      <ol>
        <li>Cave um buraco de 50cm de profundidade e 1m de largura</li>
        <li>Coloque um recipiente no centro</li>
        <li>Cubra com plastico transparente</li>
        <li>Coloque uma pedra no centro do plastico (sobre o recipiente)</li>
        <li>A evaporacao condensa no plastico e goteja no recipiente</li>
      </ol>
      <p>Producao: 0.5-1L por dia. Pouco, mas pode salvar.</p>

      <h2>LifeStraw e Filtros Portateis</h2>
      <p>Se voce pode investir em um item de sobrevivencia, um filtro portatil e o melhor custo-beneficio:</p>
      <ul>
        <li><strong>LifeStraw:</strong> filtra ate 4.000L, remove 99.99% das bacterias</li>
        <li><strong>Sawyer Mini:</strong> filtra ate 400.000L, acoplavel em garrafa PET</li>
        <li><strong>Grayl GeoPress:</strong> purifica (nao so filtra) — remove virus tambem</li>
      </ul>

      <h2>Sinais de agua contaminada</h2>
      <ul>
        <li>Espuma na superficie</li>
        <li>Cheiro forte ou quimico</li>
        <li>Cor escura ou esverdeada</li>
        <li>Ausencia total de vida aquatica</li>
        <li>Proximidade de areas industriais ou agropecuarias</li>
      </ul>

      <div class="warn-box">
        <div class="warn-label">ATENCAO</div>
        <p>Desidratacao severa causa confusao mental, que leva a decisoes piores, que aceleram a desidratacao. Beba ANTES de sentir sede. Se a urina esta escura, voce ja esta desidratado.</p>
      </div>

      <div class="guide-footer">
        Baseado em: SAS Survival Handbook, 98.6 Degrees (Cody Lundin), OMS SODIS Guidelines · 
        <a href="https://www.perplexity.ai/computer" target="_blank">Created with Perplexity Computer</a>
      </div>
    `
  },
  urban: {
    tag: "SOBREVIVENCIA URBANA",
    title: "Kit e Preparacao Urbana",
    subtitle: "Apagoes, enchentes, colapso de infraestrutura — desastres urbanos exigem preparacao diferente. Seu kit e seu plano sao a diferenca entre caos e controle.",
    image: "./img/guide-urban.jpg",
    content: `
      <h2>Bug-Out Bag (Mochila de Emergencia)</h2>
      <p>Uma mochila pronta para sair de casa em 5 minutos com tudo que voce precisa para 72 horas. Mantenha sempre preparada perto da porta.</p>

      <h2>Checklist do Kit 72h</h2>
      <ul class="checklist">
        <li>Agua: 3L por pessoa (ou filtro portatil + garrafa)</li>
        <li>Comida: barras energeticas, enlatados, comida liofilizada</li>
        <li>Documentos: copias em saco plastico (RG, CPF, passaporte, certidoes)</li>
        <li>Dinheiro em especie: notas pequenas (R$10, R$20, R$50)</li>
        <li>Lanterna + pilhas extras (ou lanterna a dinamo)</li>
        <li>Radio portatil AM/FM (comunicacao quando celular cai)</li>
        <li>Kit primeiro socorros completo</li>
        <li>Remedios pessoais para 7 dias</li>
        <li>Power bank carregado + cabos</li>
        <li>Muda de roupa + capa de chuva</li>
        <li>Canivete ou multiferramenta</li>
        <li>Fita adesiva (silver tape)</li>
        <li>Corda/paracord (10m)</li>
        <li>Isqueiro + ferro rod de backup</li>
        <li>Mapa fisico da regiao (GPS depende de sinal)</li>
      </ul>

      <div class="tip-box">
        <div class="tip-label">DON'T PANIC — DICA</div>
        <p>Revise seu kit a cada 6 meses: troque agua, verifique validade dos alimentos e remedios, recarregue power banks. Um kit desatualizado e quase tao ruim quanto nenhum kit.</p>
      </div>

      <h2>Plano de Comunicacao Familiar</h2>
      <ul>
        <li><strong>Ponto de encontro primario:</strong> local proximo de casa (praca, escola)</li>
        <li><strong>Ponto de encontro secundario:</strong> fora do bairro, caso nao consigam chegar ao primario</li>
        <li><strong>Contato fora da cidade:</strong> uma pessoa de referencia que todos possam ligar</li>
        <li><strong>SMS funciona quando ligacao nao:</strong> em crises, redes ficam congestionadas — SMS usa menos banda</li>
      </ul>

      <h2>Apagao / Blackout</h2>
      <ol>
        <li>Desligue equipamentos eletronicos para evitar dano quando a energia voltar</li>
        <li>Abra a geladeira o minimo possivel (mantem frio por 4-6h fechada)</li>
        <li>Use lanternas, NAO velas (risco de incendio)</li>
        <li>Se tiver gerador, NUNCA use em area fechada (monoxido de carbono mata)</li>
        <li>Carregue celular no modo aviao para economizar bateria</li>
      </ol>

      <h2>Enchentes</h2>
      <ul>
        <li>Suba para andares altos — nunca tente atravessar agua corrente a pe ou de carro</li>
        <li>15cm de agua corrente derruba um adulto; 60cm arrasta um carro</li>
        <li>Desligue eletricidade e gas antes de evacuar</li>
        <li>Agua de enchente e altamente contaminada — evite qualquer contato</li>
      </ul>

      <h2>Seguranca Pessoal em Crise</h2>
      <p>Contexto brasileiro — situacoes de crise podem escalar:</p>
      <ul>
        <li><strong>Perfil baixo:</strong> nao ostente recursos. Mochila discreta, sem marcas caras.</li>
        <li><strong>Movimento em grupo:</strong> sempre que possivel, mova-se acompanhado</li>
        <li><strong>Consciencia situacional:</strong> observe o ambiente, identifique saidas, evite multidoes</li>
        <li><strong>Rotas alternativas:</strong> conheca pelo menos 3 caminhos diferentes para seus destinos-chave</li>
      </ul>

      <div class="warn-box">
        <div class="warn-label">ATENCAO</div>
        <p>Em situacoes de panico coletivo, a maior ameaca sao as outras pessoas. Evite multidoes, mantenha a calma, tome decisoes racionais. O panico e contagioso — nao entre nele.</p>
      </div>

      <div class="guide-footer">
        Baseado em: The Unthinkable (Amanda Ripley), Build the Perfect Bug Out Bag, Defesa Civil BR · 
        <a href="https://www.perplexity.ai/computer" target="_blank">Created with Perplexity Computer</a>
      </div>
    `
  },
  firstaid: {
    tag: "EMERGENCIA MEDICA",
    title: "Primeiros Socorros",
    subtitle: "Nos primeiros minutos apos um acidente, suas acoes determinam se alguem vive ou morre. Conhecimento basico de primeiros socorros e a habilidade mais valiosa que existe.",
    image: "./img/guide-firstaid.jpg",
    content: `
      <h2>Protocolo ABCDE</h2>
      <p>Em qualquer emergencia medica, siga esta ordem:</p>
      <ol>
        <li><strong>A — Airway (Via aerea):</strong> A via aerea esta desobstruida? Incline a cabeca para tras e levante o queixo.</li>
        <li><strong>B — Breathing (Respiracao):</strong> Esta respirando? Olhe o peito subir, ouca, sinta o ar.</li>
        <li><strong>C — Circulation (Circulacao):</strong> Ha sangramento grave? Controle hemorragias primeiro.</li>
        <li><strong>D — Disability (Neurológico):</strong> Esta consciente? Responde a estimulos?</li>
        <li><strong>E — Exposure (Exposicao):</strong> Examine o corpo todo por lesoes ocultas. Previna hipotermia.</li>
      </ol>

      <h2>Controle de Hemorragia</h2>
      <h3>Pressao direta</h3>
      <p>A primeira e mais importante acao. Pressione firme sobre o ferimento com pano limpo, gaze, ou ate a propria camiseta. Nao tire o pano se encharcar — adicione mais camadas por cima.</p>
      
      <h3>Torniquete</h3>
      <p>Para sangramentos que nao param com pressao em membros (bracos/pernas):</p>
      <ol>
        <li>Use cinto, corda, tira de tecido — nao arame ou barbante fino</li>
        <li>Aplique 5-7cm acima da ferida (entre a ferida e o coracao)</li>
        <li>Aperte ate o sangramento parar</li>
        <li>Anote o horario de aplicacao (escreva no braco da pessoa se precisar)</li>
        <li>NAO afrouxe — deixe para o medico no hospital</li>
      </ol>

      <div class="warn-box">
        <div class="warn-label">ATENCAO</div>
        <p>Torniquete e ultimo recurso — pode causar perda do membro. Use apenas quando pressao direta nao funciona e a vida esta em risco. Hemorragia grave mata em 3-5 minutos.</p>
      </div>

      <h2>RCP (Ressuscitacao Cardiopulmonar)</h2>
      <ol>
        <li>Confirme que a pessoa nao responde e nao respira normalmente</li>
        <li>Ligue 192 (SAMU) ou peca para alguem ligar</li>
        <li>Coloque a pessoa de costas em superficie dura</li>
        <li>Mãos sobrepostas no centro do peito, entre os mamilos</li>
        <li>Comprima 5-6cm, ritmo de 100-120/min (ritmo da musica "Stayin' Alive")</li>
        <li>30 compressoes, 2 ventilacoes (se treinado). So compressoes se nao treinado.</li>
        <li>Nao pare ate o SAMU chegar ou a pessoa reagir</li>
      </ol>

      <div class="tip-box">
        <div class="tip-label">DON'T PANIC — DICA</div>
        <p>RCP feita por leigo, mesmo imperfeita, TRIPLICA a chance de sobrevivencia. E melhor fazer errado do que nao fazer. Voce nao vai "piorar" alguem que ja nao tem pulso.</p>
      </div>

      <h2>Fraturas e Imobilizacao</h2>
      <ul>
        <li><strong>Sinais:</strong> dor intensa, deformidade, incapacidade de mover, inchaço</li>
        <li><strong>Regra:</strong> imobilize a articulacao acima e abaixo da fratura</li>
        <li><strong>Tala improvisada:</strong> revistas enroladas, galhos retos, papelao, travesseiro</li>
        <li><strong>Amarre sem apertar demais</strong> — verifique circulacao (dedos rosados e com sensacao)</li>
        <li><strong>Nunca tente realinhar</strong> uma fratura — imobilize como esta</li>
      </ul>

      <h2>Queimaduras</h2>
      <ul>
        <li><strong>1o grau (vermelhidao):</strong> agua corrente fria por 10-20 min. Nao use gelo, pasta de dente, ou manteiga.</li>
        <li><strong>2o grau (bolhas):</strong> agua fria, NAO estoure bolhas, cubra com gaze umida.</li>
        <li><strong>3o grau (carbonizacao):</strong> cubra com pano limpo umido, va ao hospital imediatamente.</li>
      </ul>

      <h2>Kit Primeiro Socorros Essencial</h2>
      <ul class="checklist">
        <li>Gaze esteril e bandagens elasticas</li>
        <li>Esparadrapo/micropore</li>
        <li>Luvas descartaveis (minimo 4 pares)</li>
        <li>Tesoura e pinca</li>
        <li>Antisseptico (clorexidina ou iodopovidona)</li>
        <li>Soro fisiologico (lavagem de feridas)</li>
        <li>Analgesico e anti-inflamatorio</li>
        <li>Anti-histaminico (reacoes alergicas)</li>
        <li>Cobertor termico de emergencia</li>
        <li>Torniquete comercial (CAT ou similar)</li>
      </ul>

      <div class="guide-footer">
        Baseado em: Wilderness First Aid (NOLS), Manual SAMU, Where There Is No Doctor (David Werner) · 
        <a href="https://www.perplexity.ai/computer" target="_blank">Created with Perplexity Computer</a>
      </div>
    `
  },
  navigation: {
    tag: "ORIENTACAO",
    title: "Navegacao e Sinalizacao",
    subtitle: "Perdido sem GPS? As estrelas, o sol e a natureza ao redor fornecem tudo que voce precisa para encontrar direcao. E se precisar de resgate, saiba como ser encontrado.",
    image: "./img/guide-navigation.jpg",
    content: `
      <h2>Navegacao pelo Sol</h2>
      <h3>Metodo da Sombra</h3>
      <ol>
        <li>Finca uma vara reta no chao (1m de altura)</li>
        <li>Marque a ponta da sombra com uma pedra</li>
        <li>Espere 15-20 minutos</li>
        <li>Marque a nova ponta da sombra</li>
        <li>Uma linha entre as duas pedras indica Leste-Oeste (primeira marca = Oeste)</li>
        <li>Uma linha perpendicular indica Norte-Sul</li>
      </ol>
      <p><strong>No Hemisferio Sul (Brasil):</strong> o sol esta mais ao norte, entao sombras apontam mais para o sul ao meio-dia.</p>

      <h2>Navegacao pelas Estrelas</h2>
      <h3>Cruzeiro do Sul (Hemisferio Sul)</h3>
      <p>A constelacao mais importante para nos brasileiros:</p>
      <ol>
        <li>Encontre o Cruzeiro do Sul — 4 estrelas em forma de cruz</li>
        <li>Prolongue o eixo maior da cruz 4.5 vezes para baixo</li>
        <li>O ponto final indica aproximadamente o Polo Sul Celeste</li>
        <li>Desse ponto, trace uma linha vertical ate o horizonte — la esta o Sul</li>
      </ol>

      <div class="tip-box">
        <div class="tip-label">DON'T PANIC — DICA</div>
        <p>Se voce se perdeu: PARE. Sente, pense, observe, planeje. Andar sem direcao so piora as coisas. Pessoas perdidas tendem a andar em circulos — a navegacao impede isso.</p>
      </div>

      <h2>Bussola Natural</h2>
      <ul>
        <li><strong>Musgo:</strong> tende a crescer no lado sul das arvores no Hemisferio Sul (menos sol direto)</li>
        <li><strong>Cupinzeiros:</strong> muitos tem formato que aponta Norte-Sul</li>
        <li><strong>Antenas de TV/satelite:</strong> em areas urbanas brasileiras, geralmente apontam para Nordeste (satelites geoestacionarios)</li>
        <li><strong>Igrejas catolicas antigas:</strong> altar geralmente voltado para o Leste</li>
      </ul>

      <h2>Sinalizacao para Resgate</h2>
      <h3>Regra dos 3</h3>
      <p>Qualquer sinal em grupo de 3 e universalmente reconhecido como pedido de socorro: 3 fogueiras em triangulo, 3 apitos, 3 sinais luminosos.</p>

      <h3>Sinais visuais</h3>
      <ul>
        <li><strong>Espelho de sinalizacao:</strong> pode ser visto a 50km+ em dia claro. Use qualquer superficie reflexiva (CD, celular, lata).</li>
        <li><strong>Fumaca:</strong> de dia, fumaca branca (folhas verdes no fogo). Sinal de dia mais eficaz.</li>
        <li><strong>SOS no chao:</strong> escreva grande (minimo 3m de altura por letra) com pedras, galhos, ou cavando na terra.</li>
        <li><strong>Cores contrastantes:</strong> laranja e o melhor para ser visto. Na falta, qualquer cor que contraste com o terreno.</li>
      </ul>

      <h3>Sinais sonoros</h3>
      <ul>
        <li><strong>Apito:</strong> alcanca 1.5km+, nao cansa como gritar. 3 apitos = socorro.</li>
        <li><strong>Batida em metal:</strong> som viaja longe, especialmente em vales</li>
      </ul>

      <h2>Se voce esta REALMENTE perdido</h2>
      <ol>
        <li><strong>PARE</strong> — nao continue andando sem rumo</li>
        <li><strong>Fique visivel</strong> — area aberta, sinais no chao</li>
        <li><strong>Agua e abrigo</strong> — cuide das necessidades basicas enquanto espera</li>
        <li><strong>Siga um rio descendo</strong> — rios levam a civilizacao (se decidir se mover)</li>
        <li><strong>Deixe trilha</strong> — galhos quebrados, pedras empilhadas, fitas em arvores</li>
      </ol>

      <div class="warn-box">
        <div class="warn-label">ATENCAO</div>
        <p>Celular sem sinal ainda funciona para ligar 190/192/193 — emergencias usam qualquer operadora disponivel. Mesmo com "sem servico", tente ligar.</p>
      </div>

      <div class="guide-footer">
        Baseado em: SAS Survival Handbook, Deep Survival (Laurence Gonzales), Bushcraft 101 · 
        <a href="https://www.perplexity.ai/computer" target="_blank">Created with Perplexity Computer</a>
      </div>
    `
  }
};

// Sci-fi loading phrases
const LOADING_PHRASES = [
  "Calculando a resposta para a vida, o universo e tudo mais...",
  "Consultando o Deep Thought...",
  "Checando o Guia do Mochileiro...",
  "TARS ajustando nivel de humor para 75%...",
  "Mother processando sua requisicao...",
  "Nao entre em panico...",
  "Computando probabilidade de improbabilidade...",
  "Verificando onde esta sua toalha...",
  "HAL 9000 confirma: posso fazer isso, Dave...",
  "Skynet offline. Voce esta seguro. Por enquanto.",
];

// ─── Markdown renderer ──────────────────────────────────────────────────────
function markdownToHtml(md) {
  // 1. Extract fenced code blocks before any other processing
  const codeBlocks = [];
  let s = md.replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const escaped = code.trimEnd()
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cls = lang ? ` class="lang-${lang}"` : "";
    codeBlocks.push(
      `<pre class="md-pre"><code${cls}>${escaped}</code>` +
      `<button class="copy-code-btn" onclick="copyCode(this)" title="Copiar codigo">⎘</button></pre>`
    );
    return `\x00BLOCK${idx}\x00`;
  });

  // 2. Extract inline code
  const inlines = [];
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlines.length;
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    inlines.push(`<code class="md-code">${escaped}</code>`);
    return `\x00INLINE${idx}\x00`;
  });

  // 3. Escape remaining HTML
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 4. Block-level elements (headers, hr, blockquotes)
  s = s.replace(/^#{6} (.+)$/gm, "<h6>$1</h6>");
  s = s.replace(/^#{5} (.+)$/gm, "<h5>$1</h5>");
  s = s.replace(/^#{4} (.+)$/gm, "<h4>$1</h4>");
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  s = s.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  s = s.replace(/^(?:---|\*\*\*|___)\s*$/gm, "<hr>");
  s = s.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>"); // > escaped to &gt;

  // 5. Lists — line-by-line state machine
  const lines = s.split("\n");
  const out = [];
  const stack = []; // "ul" | "ol"
  for (const line of lines) {
    const ul = line.match(/^\s*[-*+] (.+)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      const content = ul ? ul[1] : ol[1];
      if (!stack.length || stack[stack.length - 1] !== type) {
        if (stack.length && stack[stack.length - 1] !== type) out.push(`</${stack.pop()}>`);
        out.push(`<${type}>`); stack.push(type);
      }
      out.push(`<li>${content}</li>`);
    } else {
      while (stack.length) out.push(`</${stack.pop()}>`);
      out.push(line);
    }
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  s = out.join("\n");

  // 6. Inline formatting
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^\s*](?:[^*\n]*[^\s*])?)\*/g, "<em>$1</em>");
  s = s.replace(/\*([^\s*])\*/g, "<em>$1</em>");
  s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 7. Paragraphs — split on double newlines, wrap non-block content
  const BLOCK_RE = /^<(?:h[1-6]|ul|ol|pre|blockquote|hr|div)[^>]*>/;
  const paragraphs = s.split(/\n{2,}/);
  s = paragraphs.map(p => {
    p = p.trim();
    if (!p) return "";
    if (BLOCK_RE.test(p) || p.includes("\x00BLOCK")) return p;
    return `<p>${p.replace(/\n/g, "<br>")}</p>`;
  }).filter(Boolean).join("");

  // 8. Restore placeholders
  s = s.replace(/\x00INLINE(\d+)\x00/g, (_, i) => inlines[+i]);
  s = s.replace(/\x00BLOCK(\d+)\x00/g, (_, i) => codeBlocks[+i]);
  return s;
}

function copyCode(btn) {
  const code = btn.previousElementSibling.textContent;
  navigator.clipboard.writeText(code).then(() => {
    const orig = btn.textContent;
    btn.textContent = "✓ Copiado";
    setTimeout(() => { btn.textContent = orig; }, 1800);
  }).catch(() => {});
}


// ─── Init ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadPersistedData();
  loadCharacters();
  checkHealth();
  autoResize();
  setupDragDrop();
  renderChatList();
  renderFavorites();
  renderSidebarCharacters();
  // Load sidebar apps list in background
  fetch("/api/build/list").then(r => r.json()).then(d => renderSidebarApps(d.apps || [])).catch(() => {});
});

// ─── Persistence (with fallback) ────────────────────────────────────────────
const _ls = () => { try { return window['local' + 'Storage']; } catch { return null; } };
const storage = {
  get(key) { const s = _ls(); return s ? s.getItem(key) : null; },
  set(key, val) { const s = _ls(); if (s) s.setItem(key, val); },
  del(key) { const s = _ls(); if (s) s.removeItem(key); }
};

function loadPersistedData() {
  try {
    const saved = storage.get("bunker_chats");
    if (saved) state.chats = JSON.parse(saved);
    const favs = storage.get("bunker_favs");
    if (favs) state.favorites = JSON.parse(favs);
  } catch {}

  if (Object.keys(state.chats).length === 0) {
    const id = genId();
    state.chats[id] = { title: "Novo chat", messages: [] };
    state.activeChatId = id;
  } else {
    const lastActive = storage.get("bunker_active_chat");
    state.activeChatId = lastActive && state.chats[lastActive] ? lastActive : Object.keys(state.chats)[0];
  }
  saveChats();
}

function saveChats() {
  try {
    storage.set("bunker_chats", JSON.stringify(state.chats));
    storage.set("bunker_active_chat", state.activeChatId);
  } catch (e) {
    if (e.name === "QuotaExceededError") {
      // Drop oldest non-active chat and retry
      const ids = Object.keys(state.chats);
      const toRemove = ids.find(id => id !== state.activeChatId);
      if (toRemove) {
        delete state.chats[toRemove];
        renderChatList();
        saveChats(); // retry
      }
    }
  }
}

function saveFavorites() {
  storage.set("bunker_favs", JSON.stringify(state.favorites));
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ─── Chat List ──────────────────────────────────────────────────────────────
function renderChatList() {
  const list = document.getElementById("chatList");
  list.innerHTML = "";
  const ids = Object.keys(state.chats).reverse();
  for (const id of ids) {
    const chat = state.chats[id];
    const li = document.createElement("li");
    li.className = `nav-item${id === state.activeChatId ? " active" : ""}`;
    li.dataset.chat = id;
    li.onclick = (e) => { if (!e.target.closest(".nav-delete")) switchChat(id); };
    li.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <span>${escapeHtml(chat.title)}</span>
      <button class="nav-delete" onclick="deleteChat('${id}')" title="Excluir">&times;</button>`;
    list.appendChild(li);
  }
}

function switchChat(id) {
  if (!state.chats[id] || state.isStreaming) return;
  state.activeChatId = id;
  saveChats();
  renderChatList();
  restoreChat();
  showChatView();
}

function restoreChat() {
  const chat = state.chats[state.activeChatId];
  if (!chat) return;
  const container = document.getElementById("chatMessages");
  container.innerHTML = "";
  if (chat.messages.length === 0) {
    container.innerHTML = getWelcomeHtml();
    return;
  }
  for (const msg of chat.messages) {
    addMsgDom(msg.role, msg.content, null, msg.badge);
  }
  scrollChat();
}

function newChat() {
  const id = genId();
  state.chats[id] = { title: "Novo chat", messages: [] };
  state.activeChatId = id;
  saveChats();
  renderChatList();
  restoreChat();
  showChatView();
  document.getElementById("sidebar").classList.remove("open");
}

function deleteChat(id) {
  if (Object.keys(state.chats).length <= 1) return;
  delete state.chats[id];
  if (state.activeChatId === id) {
    state.activeChatId = Object.keys(state.chats)[0];
  }
  saveChats();
  renderChatList();
  restoreChat();
}

function clearAllData() {
  if (!confirm("Tem certeza? Isso vai apagar todo o historico e favoritos.")) return;
  storage.del("bunker_chats");
  storage.del("bunker_favs");
  storage.del("bunker_active_chat");
  state.chats = {};
  state.favorites = [];
  const id = genId();
  state.chats[id] = { title: "Novo chat", messages: [] };
  state.activeChatId = id;
  saveChats();
  saveFavorites();
  renderChatList();
  renderFavorites();
  restoreChat();
  toggleConfig();
}

// ─── Favorites ──────────────────────────────────────────────────────────────
function renderFavorites() {
  const list = document.getElementById("favList");
  const count = document.getElementById("favCount");
  count.textContent = state.favorites.length;
  list.innerHTML = "";
  if (state.favorites.length === 0) {
    list.innerHTML = '<li class="nav-empty">Nenhum favorito ainda</li>';
    return;
  }
  for (const fav of state.favorites) {
    const li = document.createElement("li");
    li.className = "nav-item";
    li.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <span>${escapeHtml(fav.text.slice(0, 40))}${fav.text.length > 40 ? "..." : ""}</span>
      <button class="nav-delete" onclick="removeFavorite('${fav.id}')" title="Remover">&times;</button>`;
    li.onclick = (e) => {
      if (e.target.closest(".nav-delete")) return;
      if (fav.chatId && state.chats[fav.chatId]) switchChat(fav.chatId);
    };
    list.appendChild(li);
  }
}

function addFavorite(text, chatId) {
  const id = genId();
  state.favorites.unshift({ id, text: text.slice(0, 200), from: "assistant", chatId, ts: Date.now() });
  if (state.favorites.length > 50) state.favorites = state.favorites.slice(0, 50);
  saveFavorites();
  renderFavorites();
}

function removeFavorite(id) {
  state.favorites = state.favorites.filter(f => f.id !== id);
  saveFavorites();
  renderFavorites();
}

function isFavorited(text) {
  return state.favorites.some(f => f.text === text.slice(0, 200));
}

// ─── Guides ─────────────────────────────────────────────────────────────────
function openGuide(guideId) {
  const guide = GUIDES[guideId];
  if (!guide) return;
  state.activeGuide = guideId;

  const content = document.getElementById("guideContent");
  content.innerHTML = `
    <img class="guide-hero" src="${guide.image}" alt="${guide.title}" />
    <div class="guide-body">
      <span class="guide-tag">${guide.tag}</span>
      <h1>${guide.title}</h1>
      <p class="guide-subtitle">${guide.subtitle}</p>
      ${guide.content}
    </div>`;

  // Update sidebar active
  document.querySelectorAll(".nav-guide").forEach(el => el.classList.remove("active"));
  const activeGuide = document.querySelector(`[data-guide="${guideId}"]`);
  if (activeGuide) activeGuide.classList.add("active");

  // Update fav button
  updateGuideFavBtn();

  showGuideView();
  document.getElementById("sidebar").classList.remove("open");
  content.scrollTop = 0;
}

function closeGuide() {
  state.activeGuide = null;
  document.querySelectorAll(".nav-guide").forEach(el => el.classList.remove("active"));
  showChatView();
}

function toggleFavGuide() {
  if (!state.activeGuide) return;
  const guide = GUIDES[state.activeGuide];
  const text = guide.title;
  if (isFavorited(text)) {
    const fav = state.favorites.find(f => f.text === text.slice(0, 200));
    if (fav) removeFavorite(fav.id);
  } else {
    addFavorite(text, null);
  }
  updateGuideFavBtn();
}

function updateGuideFavBtn() {
  const btn = document.getElementById("btnFavGuide");
  if (!state.activeGuide) return;
  const guide = GUIDES[state.activeGuide];
  if (isFavorited(guide.title)) {
    btn.classList.add("faved");
  } else {
    btn.classList.remove("faved");
  }
}

// ─── View Switching ─────────────────────────────────────────────────────────
const ALL_VIEWS = ["chatView", "guideView", "mapView", "appsView", "charactersView", "ttsView"];

function showView(id) {
  ALL_VIEWS.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle("hidden", v !== id);
  });
}

function showChatView() { showView("chatView"); }
function showGuideView() { showView("guideView"); }

// ─── Config Drawer ──────────────────────────────────────────────────────────
function toggleConfig() {
  document.getElementById("configOverlay").classList.toggle("hidden");
  document.getElementById("configDrawer").classList.toggle("hidden");
}

// ─── Drag & Drop ────────────────────────────────────────────────────────────
function setupDragDrop() {
  const body = document.body;
  body.addEventListener("dragover", (e) => { e.preventDefault(); });
  body.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) attachFile(file);
    }
  });
}

// ─── Health ─────────────────────────────────────────────────────────────────
async function checkHealth() {
  const dot = document.getElementById("statusDot");
  const txt = document.getElementById("statusText");
  try {
    const r = await fetch("/api/health");
    const d = await r.json();
    if (d.status === "online") {
      dot.className = "status-dot online";
      txt.textContent = `Online · ${d.models.length} modelos`;
      state.models = d.models;
      state.visionModels = d.vision_models;
      populateModels();

      // Voice engine status from backend
      state.sttEngine = d.stt || "browser";
      state.ttsOffline = !!d.tts_offline;
      updateVoiceStatus(d);
    } else {
      dot.className = "status-dot offline";
      txt.textContent = "Ollama offline";
    }
  } catch {
    dot.className = "status-dot offline";
    txt.textContent = "Servidor offline";
  }

  // Check offline maps
  checkMapStatus();
}

function updateVoiceStatus(d) {
  const sttEl = document.getElementById("sttStatus");
  const ttsEl = document.getElementById("ttsStatus");
  if (sttEl) {
    if (d.stt === "whisper") {
      sttEl.textContent = "\u2713 Whisper (offline, GPU)";
      sttEl.className = "voice-engine-status online";
    } else {
      sttEl.textContent = "Browser Speech API (online)";
      sttEl.className = "voice-engine-status fallback";
    }
  }
  if (ttsEl) {
    if (d.tts === "piper") {
      ttsEl.textContent = "\u2713 Piper TTS (offline)";
      ttsEl.className = "voice-engine-status online";
    } else {
      ttsEl.textContent = "Edge TTS (online)";
      ttsEl.className = "voice-engine-status fallback";
    }
  }
}

async function checkMapStatus() {
  const el = document.getElementById("mapConfigStatus");
  if (!el) return;
  try {
    const r = await fetch("/api/maps");
    const d = await r.json();
    if (d.maps && d.maps.length > 0) {
      const m = d.maps[0];
      el.textContent = `\u2713 ${m.file} (${m.size_mb} MB) — 100% offline`;
      el.className = "map-config-status online";
    } else {
      el.textContent = "Nenhum .pmtiles encontrado";
      el.className = "map-config-status offline";
    }
  } catch {
    el.textContent = "Erro ao verificar";
    el.className = "map-config-status offline";
  }
}

function populateModels() {
  const fill = (id, list, preferred) => {
    const el = document.getElementById(id);
    if (!el || !list.length) return;
    const sorted = [...list].sort((a, b) => {
      const aP = preferred.some(p => a.includes(p)) ? -1 : 0;
      const bP = preferred.some(p => b.includes(p)) ? -1 : 0;
      return aP - bP;
    });
    el.innerHTML = sorted.map(m => `<option value="${m}">${m}</option>`).join("");
  };
  fill("chatModel", state.models, ["gemma3"]);
  fill("visionModel", state.visionModels.length ? state.visionModels : state.models, ["gemma3", "llava"]);
  fill("builderModel", state.models, ["qwen2.5-coder", "coder"]);
  fill("brainModel", state.models, ["dolphin3", "dolphin"]);
}

// ─── Navigation ─────────────────────────────────────────────────────────────
function toggleSidebar() { document.getElementById("sidebar").classList.toggle("open"); }

// ─── Input Helpers ──────────────────────────────────────────────────────────
function autoResize() {
  const ta = document.getElementById("chatInput");
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
    updateModeTag();
  });
}

function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
}

function setInput(text) {
  const ta = document.getElementById("chatInput");
  ta.value = text;
  ta.focus();
  updateModeTag();
  showChatView();
}

function updateModeTag() {
  const tag = document.getElementById("modeTag");
  const hint = document.getElementById("modeHint");
  const text = document.getElementById("chatInput").value;

  if (text.startsWith("/build")) {
    tag.textContent = "BUILD";
    tag.style.background = "rgba(200, 80, 255, 0.12)";
    tag.style.color = "#c850ff";
    hint.innerHTML = 'Gerando app com <code>qwen2.5-coder:14b</code>';
  } else if (text.startsWith("/brain")) {
    tag.textContent = "CEREBRO";
    tag.style.background = "rgba(255, 60, 60, 0.12)";
    tag.style.color = "#ff4444";
    hint.innerHTML = 'Modo sem filtros &mdash; <code>dolphin3</code> sem amarras';
  } else if (state.webcamActive) {
    tag.textContent = "VIDEO";
    tag.style.background = "rgba(99, 145, 255, 0.12)";
    tag.style.color = "#6391ff";
    hint.textContent = "Webcam ativa — sua mensagem analisa o frame atual";
  } else if (state.attachedImage) {
    tag.textContent = "VISAO";
    tag.style.background = "rgba(99, 145, 255, 0.12)";
    tag.style.color = "#6391ff";
    hint.textContent = "Imagem anexada — sua mensagem analisa a imagem";
  } else {
    tag.textContent = "TEXTO";
    tag.style.background = "var(--accent-dim)";
    tag.style.color = "var(--accent)";
    hint.innerHTML = 'Enter envia · Shift+Enter nova linha · <code>/build</code> gera apps · <code>/brain</code> modo cerebro';
  }
}

// ─── Send (unified router) ──────────────────────────────────────────────────
// ─── Prompt Queue ────────────────────────────────────────────────────────────
function renderQueue() {
  const el = document.getElementById("promptQueue");
  if (!el) return;
  if (state.promptQueue.length === 0) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  el.innerHTML = `<div class="queue-label">Fila (${state.promptQueue.length})</div>` +
    state.promptQueue.map((q, i) =>
      `<div class="queue-item"><span class="queue-text">${escapeHtml(q.length > 50 ? q.slice(0,50)+"…" : q)}</span>` +
      `<button class="queue-remove" onclick="removeFromQueue(${i})">✕</button></div>`
    ).join("");
}

function removeFromQueue(i) {
  state.promptQueue.splice(i, 1);
  renderQueue();
}

async function processQueue() {
  if (state.promptQueue.length === 0) return;
  const next = state.promptQueue.shift();
  renderQueue();
  document.getElementById("chatInput").value = next;
  await send();
}

async function send() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  // If already streaming, queue the prompt
  if (state.isStreaming) {
    state.promptQueue.push(text);
    input.value = "";
    input.style.height = "auto";
    renderQueue();
    return;
  }

  showChatView();
  input.value = "";
  input.style.height = "auto";
  state.isStreaming = true;
  document.getElementById("btnSend").disabled = false; // STOP mode handles the button

  const chat = state.chats[state.activeChatId];

  // Auto-title from first message
  if (chat.messages.length === 0) {
    chat.title = text.slice(0, 40) + (text.length > 40 ? "..." : "");
    saveChats();
    renderChatList();
  }

  if (text.startsWith("/build ")) {
    await handleBuild(text.slice(7));
  } else if (text.startsWith("/brain ")) {
    await handleBrain(text.slice(7));
  } else if (state.webcamActive) {
    await handleVision(text, "webcam");
  } else if (state.attachedImage) {
    await handleVision(text, "upload");
  } else {
    await handleChat(text);
  }

  state.isStreaming = false;
  document.getElementById("btnSend").disabled = false;
  updateModeTag();
  // Process next queued prompt
  processQueue();
}

// ─── Chat (text) ────────────────────────────────────────────────────────────
async function handleChat(text) {
  const chat = state.chats[state.activeChatId];
  addMsgDom("user", text);
  chat.messages.push({ role: "user", content: text });
  saveChats();

  const model = document.getElementById("chatModel").value;
  const system = document.getElementById("systemPrompt").value;
  const apiMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));
  const { el, contentEl } = addStreamMsgDom();

  const full = await streamFromAPI("/api/chat", {
    model, messages: apiMessages, system
  }, contentEl);

  chat.messages.push({ role: "assistant", content: full });
  saveChats();
  addMsgActions(el, full);
}

// ─── Brain (unhinged / sem filtros) ─────────────────────────────────────────
async function handleBrain(text) {
  const chat = state.chats[state.activeChatId];
  addMsgDom("user", text, null, "brain");
  chat.messages.push({ role: "user", content: text, badge: "brain" });
  saveChats();

  const model = document.getElementById("brainModel").value || "dolphin3";
  const brainSystem = document.getElementById("brainPrompt").value;
  const apiMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));
  const { el, contentEl } = addStreamMsgDom("brain");

  const full = await streamFromAPI("/api/chat", {
    model, messages: apiMessages, system: brainSystem
  }, contentEl);

  chat.messages.push({ role: "assistant", content: full, badge: "brain" });
  saveChats();
  addMsgActions(el, full);
}

// ─── Vision (webcam / upload) ───────────────────────────────────────────────
async function handleVision(text, source) {
  const chat = state.chats[state.activeChatId];
  let b64;
  if (source === "webcam") {
    b64 = captureWebcamFrame();
    addMsgDom("user", text, null, "vision", b64);
  } else {
    b64 = state.attachedImage.b64;
    addMsgDom("user", text, null, "vision", b64);
    clearAttachment();
  }

  const model = document.getElementById("visionModel").value;
  const apiMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));
  const { el, contentEl } = addStreamMsgDom("vision");

  const full = await streamFromAPI("/api/vision", {
    model, image: b64, prompt: text, messages: apiMessages
  }, contentEl);

  chat.messages.push({ role: "user", content: text, badge: "vision" });
  chat.messages.push({ role: "assistant", content: full, badge: "vision" });
  saveChats();
  addMsgActions(el, full);
}

// ─── Builder ────────────────────────────────────────────────────────────────
async function handleBuild(prompt) {
  const chat = state.chats[state.activeChatId];
  addMsgDom("user", `/build ${prompt}`, null, "builder");

  const model = document.getElementById("builderModel").value;
  const { el, contentEl } = addStreamMsgDom("builder");

  let fullHtml = await streamFromAPI("/api/build", { model, prompt }, contentEl);

  const match = fullHtml.match(/```html\s*([\s\S]*?)```/);
  if (match) fullHtml = match[1];
  else {
    const docMatch = fullHtml.match(/(<!DOCTYPE[\s\S]*<\/html>)/i);
    if (docMatch) fullHtml = docMatch[1];
  }

  state.generatedHtml = fullHtml;

  const strip = document.getElementById("builderStrip");
  const frame = document.getElementById("builderFrame");
  strip.classList.remove("hidden");
  frame.srcdoc = fullHtml;

  chat.messages.push({ role: "user", content: `/build ${prompt}`, badge: "builder" });
  chat.messages.push({ role: "assistant", content: "[App gerado]", badge: "builder" });
  saveChats();
}

// ─── Stream Helper ──────────────────────────────────────────────────────────
function setStopMode(on) {
  const btn = document.getElementById("btnSend");
  const icon = document.getElementById("btnSendIcon");
  if (on) {
    btn.title = "Parar geração";
    btn.classList.add("btn-stop");
    btn.onclick = () => { if (state.abortController) state.abortController.abort(); };
    icon.innerHTML = `<rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor"/>`;
    icon.setAttribute("fill", "currentColor");
    icon.removeAttribute("stroke");
  } else {
    btn.title = "Enviar";
    btn.classList.remove("btn-stop");
    btn.onclick = send;
    icon.innerHTML = `<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`;
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("fill", "none");
  }
}

async function streamFromAPI(url, body, contentEl) {
  let full = "";
  const controller = new AbortController();
  state.abortController = controller;
  setStopMode(true);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const reader = r.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              full += data.token;
              contentEl.textContent = full;
              scrollChat();
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    if (e.name !== "AbortError") {
      contentEl.textContent = `Erro: ${e.message}. Verifique se Ollama esta rodando (ollama serve).`;
    }
  }

  state.abortController = null;
  setStopMode(false);

  const dots = contentEl.parentElement?.querySelector(".typing-indicator");
  if (dots) dots.remove();

  if (full) contentEl.innerHTML = markdownToHtml(full) + (controller.signal.aborted ? ' <em class="stream-stopped">[interrompido]</em>' : "");

  return full;
}

// ─── Message UI ─────────────────────────────────────────────────────────────
function addMsgDom(role, text, imgThumb, badge, imgB64) {
  removeWelcome();
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = `msg ${role}`;

  const avatar = role === "user" ? "VC" : "BA";
  const name = role === "user" ? "Voce" : "Bunker AI";
  let badgeHtml = "";
  if (badge === "voice") badgeHtml = '<span class="msg-badge badge-voice">VOZ</span>';
  if (badge === "vision") badgeHtml = '<span class="msg-badge badge-vision">VISAO</span>';
  if (badge === "builder") badgeHtml = '<span class="msg-badge badge-builder">BUILD</span>';
  if (badge === "brain") badgeHtml = '<span class="msg-badge badge-brain">CEREBRO</span>';

  let imgHtml = "";
  if (imgB64) {
    const src = imgB64.startsWith("data:") ? imgB64 : `data:image/jpeg;base64,${imgB64}`;
    imgHtml = `<img class="msg-image" src="${src}" />`;
  }

  const contentHtml = role === "assistant" ? markdownToHtml(text) : escapeHtml(text);

  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">${name}</span>${badgeHtml}</div>
      ${imgHtml}
      <div class="msg-content">${contentHtml}</div>
    </div>`;

  container.appendChild(div);
  scrollChat();
  return div;
}

function addStreamMsgDom(badge) {
  removeWelcome();
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "msg assistant";

  let badgeHtml = "";
  if (badge === "voice") badgeHtml = '<span class="msg-badge badge-voice">VOZ</span>';
  if (badge === "vision") badgeHtml = '<span class="msg-badge badge-vision">VISAO</span>';
  if (badge === "builder") badgeHtml = '<span class="msg-badge badge-builder">BUILD</span>';
  if (badge === "brain") badgeHtml = '<span class="msg-badge badge-brain">CEREBRO</span>';

  const phrase = LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];

  div.innerHTML = `
    <div class="msg-avatar">BA</div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">Bunker AI</span>${badgeHtml}</div>
      <div class="msg-content"></div>
      <div class="typing-indicator" title="${phrase}"><span></span><span></span><span></span></div>
    </div>`;

  container.appendChild(div);
  scrollChat();
  return { el: div, contentEl: div.querySelector(".msg-content") };
}

function addMsgActions(msgEl, text) {
  const body = msgEl.querySelector(".msg-body");
  const actions = document.createElement("div");
  actions.className = "msg-actions";

  // Copy button
  const copyBtn = document.createElement("button");
  copyBtn.className = "msg-copy-btn";
  copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar`;
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "✓ Copiado";
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar`;
      }, 1800);
    }).catch(() => {});
  };

  // TTS button
  const ttsBtn = document.createElement("button");
  ttsBtn.className = "msg-tts-btn";
  ttsBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg> Ouvir`;
  ttsBtn.onclick = () => speakText(text);

  // Fav button
  const favBtn = document.createElement("button");
  favBtn.className = `msg-fav-btn${isFavorited(text) ? " faved" : ""}`;
  favBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Favoritar`;
  favBtn.onclick = () => {
    if (isFavorited(text)) {
      const fav = state.favorites.find(f => f.text === text.slice(0, 200));
      if (fav) removeFavorite(fav.id);
      favBtn.classList.remove("faved");
    } else {
      addFavorite(text, state.activeChatId);
      favBtn.classList.add("faved");
    }
  };

  actions.appendChild(copyBtn);
  actions.appendChild(ttsBtn);
  actions.appendChild(favBtn);
  body.appendChild(actions);
}

function removeWelcome() {
  const w = document.getElementById("welcomeMsg");
  if (w) w.remove();
}

function scrollChat() {
  const c = document.getElementById("chatMessages");
  c.scrollTop = c.scrollHeight;
}

function getWelcomeHtml() {
  return `<div class="welcome-msg" id="welcomeMsg">
    <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="var(--accent)"/>
      <path d="M8 22V12l8-5 8 5v10l-8 5-8-5z" stroke="var(--bg)" stroke-width="2" fill="none"/>
      <circle cx="16" cy="16" r="3" fill="var(--bg)"/>
    </svg>
    <h2>Bunker AI</h2>
    <div class="dont-panic">DON'T PANIC</div>
    <p>Seu guia local para o fim do mundo. Chat por texto, voz ou video. Gere apps com <code>/build</code>. Tudo offline, tudo seu.</p>
    <div class="welcome-hints">
      <button class="hint" onclick="setInput('Como purificar agua sem equipamento?')">Purificar agua</button>
      <button class="hint" onclick="setInput('Qual a resposta para a vida, o universo e tudo mais?')">A Grande Pergunta</button>
      <button class="hint" onclick="setInput('/build Um dashboard de sobrevivencia com checklist, mapa e inventario')">Criar app</button>
      <button class="hint" onclick="activateWebcam()">Ligar webcam</button>
    </div>
  </div>`;
}

// ─── Webcam ─────────────────────────────────────────────────────────────────
async function toggleWebcam() {
  if (state.webcamActive) { stopWebcam(); }
  else { activateWebcam(); }
}

async function activateWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 } }
    });
    document.getElementById("webcamVideo").srcObject = stream;
    document.getElementById("webcamStrip").classList.remove("hidden");
    document.getElementById("btnWebcam").classList.add("active");
    state.webcamStream = stream;
    state.webcamActive = true;
    updateModeTag();
  } catch (e) {
    alert("Erro ao acessar webcam: " + e.message);
  }
}

function stopWebcam() {
  if (state.webcamStream) {
    state.webcamStream.getTracks().forEach(t => t.stop());
  }
  document.getElementById("webcamStrip").classList.add("hidden");
  document.getElementById("btnWebcam").classList.remove("active");
  state.webcamActive = false;
  state.webcamStream = null;
  updateModeTag();
}

function captureWebcamFrame() {
  const video = document.getElementById("webcamVideo");
  const canvas = document.getElementById("webcamCanvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.8);
}

// ─── File Attachment ────────────────────────────────────────────────────────
function handleFileAttach(e) {
  const file = e.target.files[0];
  if (file) attachFile(file);
}

function attachFile(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    state.attachedImage = { b64: ev.target.result, file };
    document.getElementById("attachPreview").src = ev.target.result;
    document.getElementById("attachStrip").classList.remove("hidden");
    updateModeTag();
  };
  reader.readAsDataURL(file);
}

function clearAttachment() {
  state.attachedImage = null;
  document.getElementById("attachStrip").classList.add("hidden");
  document.getElementById("fileInput").value = "";
  updateModeTag();
}

// ─── Voice (STT) ────────────────────────────────────────────────────────────
// Hybrid STT: tries backend Whisper (offline) first, falls back to Web Speech API (Chrome)

let _mediaRecorder = null;
let _audioChunks = [];

function startListening() {
  // If backend Whisper is available, use MediaRecorder + backend
  if (state.sttEngine === "whisper") {
    startListeningWhisper();
  } else {
    startListeningBrowser();
  }
}

function stopListening() {
  if (state.sttEngine === "whisper") {
    stopListeningWhisper();
  } else {
    stopListeningBrowser();
  }
}

// --- Whisper (offline via backend) ---
function startListeningWhisper() {
  const btn = document.getElementById("btnMic");
  btn.classList.add("recording");
  state.isListening = true;
  _audioChunks = [];

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    _mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    _mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) _audioChunks.push(e.data);
    };
    _mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      if (_audioChunks.length === 0) { btn.classList.remove("recording"); return; }

      const blob = new Blob(_audioChunks, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("language", "pt");

      btn.classList.remove("recording");
      document.getElementById("chatInput").value = "Transcrevendo...";

      try {
        const r = await fetch("/api/stt", { method: "POST", body: formData });
        const d = await r.json();
        if (d.text && d.text.trim()) {
          document.getElementById("chatInput").value = d.text;
          sendVoice(d.text);
        } else if (d.use_browser) {
          // Fallback to browser STT
          state.sttEngine = "browser";
          document.getElementById("chatInput").value = "";
          startListeningBrowser();
        } else {
          document.getElementById("chatInput").value = "";
        }
      } catch {
        document.getElementById("chatInput").value = "";
        // Fallback
        state.sttEngine = "browser";
        startListeningBrowser();
      }
    };
    _mediaRecorder.start();
  }).catch(() => {
    btn.classList.remove("recording");
    state.isListening = false;
    alert("Acesso ao microfone negado.");
  });
}

function stopListeningWhisper() {
  state.isListening = false;
  if (_mediaRecorder && _mediaRecorder.state === "recording") {
    _mediaRecorder.stop();
  }
}

// --- Browser Web Speech API (Chrome only, needs internet) ---
function startListeningBrowser() {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    alert("Speech Recognition nao suportado. Use Chrome ou instale faster-whisper.");
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.recognition = new SR();
  state.recognition.lang = "pt-BR";
  state.recognition.continuous = true;
  state.recognition.interimResults = true;

  const btn = document.getElementById("btnMic");
  btn.classList.add("recording");
  state.isListening = true;

  let finalTranscript = "";

  state.recognition.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    document.getElementById("chatInput").value = finalTranscript + interim;
  };

  state.recognition.onend = () => {
    btn.classList.remove("recording");
    if (state.isListening && finalTranscript) {
      document.getElementById("chatInput").value = finalTranscript;
      sendVoice(finalTranscript);
    }
    state.isListening = false;
  };

  state.recognition.onerror = () => {
    btn.classList.remove("recording");
    state.isListening = false;
  };

  state.recognition.start();
}

function stopListeningBrowser() {
  if (state.recognition) {
    state.isListening = false;
    state.recognition.stop();
  }
}

async function sendVoice(text) {
  if (!text.trim() || state.isStreaming) return;
  state.isStreaming = true;
  document.getElementById("btnSend").disabled = true;
  document.getElementById("chatInput").value = "";

  const chat = state.chats[state.activeChatId];
  addMsgDom("user", text, null, "voice");
  chat.messages.push({ role: "user", content: text, badge: "voice" });
  saveChats();

  const model = document.getElementById("chatModel").value;
  const system = document.getElementById("systemPrompt").value;
  const apiMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));
  const { el, contentEl } = addStreamMsgDom("voice");

  const full = await streamFromAPI("/api/chat", {
    model, messages: apiMessages, system
  }, contentEl);

  chat.messages.push({ role: "assistant", content: full, badge: "voice" });
  saveChats();

  if (full) speakText(full);

  state.isStreaming = false;
  document.getElementById("btnSend").disabled = false;
}

// ─── TTS ────────────────────────────────────────────────────────────────────
async function speakText(text) {
  if (state.currentAudio) { state.currentAudio.pause(); state.currentAudio = null; }
  const voice = document.getElementById("ttsVoice").value;
  try {
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 2000), voice }),
    });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    state.currentAudio = audio;
    audio.onended = () => { URL.revokeObjectURL(url); state.currentAudio = null; };
    audio.play();
  } catch {}
}

// ─── Builder actions ────────────────────────────────────────────────────────
function saveApp() {
  if (!state.generatedHtml) return;
  const name = prompt("Nome do app:", `app-${Date.now()}`);
  if (!name) return;
  fetch("/api/build/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html: state.generatedHtml, name }),
  }).then(r => r.json()).then(d => { if (d.saved) alert(`"${name}" salvo!`); });
}

function downloadApp() {
  if (!state.generatedHtml) return;
  const blob = new Blob([state.generatedHtml], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bunker-app.html";
  a.click();
}

function openFullscreen() {
  if (!state.generatedHtml) return;
  const w = window.open("", "_blank");
  w.document.write(state.generatedHtml);
  w.document.close();
}

function closeBuilder() {
  document.getElementById("builderStrip").classList.add("hidden");
}

// ─── Apps Panel ─────────────────────────────────────────────────────────────
async function openAppsPanel() {
  showView("appsView");
  document.getElementById("sidebar").classList.remove("open");
  const grid = document.getElementById("appsGrid");
  grid.innerHTML = '<div class="panel-empty">Carregando...</div>';
  try {
    const r = await fetch("/api/build/list");
    const data = await r.json();
    renderAppsGrid(data.apps || []);
    renderSidebarApps(data.apps || []);
  } catch {
    grid.innerHTML = '<div class="panel-empty">Erro ao carregar apps.</div>';
  }
}

function renderAppsGrid(apps) {
  const grid = document.getElementById("appsGrid");
  if (apps.length === 0) {
    grid.innerHTML = '<div class="panel-empty">Nenhum app salvo ainda.<br>Use <code>/build</code> no chat para criar um.</div>';
    return;
  }
  grid.innerHTML = apps.map(a => `
    <div class="app-card">
      <div class="app-card-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 9h6M9 12h6M9 15h4"/>
        </svg>
      </div>
      <div class="app-card-name">${escapeHtml(a.name)}</div>
      <div class="app-card-size">${(a.size / 1024).toFixed(1)} KB</div>
      <div class="app-card-actions">
        <button class="btn-sm" onclick="openSavedApp('${escapeHtml(a.name)}')">Abrir</button>
        <button class="btn-sm btn-danger-xs" onclick="deleteSavedApp('${escapeHtml(a.name)}')">Excluir</button>
      </div>
    </div>`).join("");
}

function renderSidebarApps(apps) {
  const list = document.getElementById("appsSidebarList");
  const empty = document.getElementById("appsEmpty");
  const count = document.getElementById("appsCount");
  if (!list) return;
  count.textContent = apps.length;
  if (apps.length === 0) {
    list.innerHTML = '<li class="nav-empty" id="appsEmpty">Nenhum app salvo</li>';
    return;
  }
  list.innerHTML = apps.slice(0, 5).map(a =>
    `<li class="nav-item" onclick="openSavedApp('${escapeHtml(a.name)}')" title="${escapeHtml(a.name)}">
       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
       <span>${escapeHtml(a.name)}</span>
     </li>`
  ).join("") + (apps.length > 5 ? `<li class="nav-item nav-more" onclick="openAppsPanel()">+${apps.length - 5} mais...</li>` : "");
}

function openSavedApp(name) {
  window.open(`/api/build/preview/${encodeURIComponent(name)}`, "_blank");
}

async function deleteSavedApp(name) {
  if (!confirm(`Excluir "${name}"?`)) return;
  const r = await fetch(`/api/build/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (r.ok) openAppsPanel();
}

// ─── Characters Panel ────────────────────────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = document.getElementById ? "" : ""; // filled on init

function loadCharacters() {
  try {
    const raw = storage.get("bunker_characters");
    if (raw) state.characters = JSON.parse(raw);
    const aid = storage.get("bunker_active_char");
    if (aid && state.characters[aid]) state.activeCharacterId = aid;
  } catch {}
}

function saveCharacters() {
  storage.set("bunker_characters", JSON.stringify(state.characters));
}

function openCharactersPanel() {
  showView("charactersView");
  document.getElementById("sidebar").classList.remove("open");
  renderCharactersList();
}

function renderCharactersList() {
  const list = document.getElementById("charactersList");
  const chars = Object.values(state.characters);
  renderSidebarCharacters();
  if (chars.length === 0) {
    list.innerHTML = '<div class="panel-empty">Nenhum personagem criado.<br>Crie assistentes com personalidades únicas!</div>';
    return;
  }
  list.innerHTML = chars.map(c => `
    <div class="char-card ${state.activeCharacterId === c.id ? "char-active" : ""}">
      <div class="char-emoji" style="background:${c.color || "#42f5a0"}22;border-color:${c.color || "#42f5a0"}44">${c.emoji || "🤖"}</div>
      <div class="char-info">
        <div class="char-name">${escapeHtml(c.name)}</div>
        <div class="char-desc">${escapeHtml(c.desc || "")}</div>
      </div>
      <div class="char-card-actions">
        <button class="btn-sm ${state.activeCharacterId === c.id ? "btn-accent" : ""}" onclick="activateCharacter('${c.id}')">
          ${state.activeCharacterId === c.id ? "✓ Ativo" : "Usar"}
        </button>
        <button class="btn-sm" onclick="showCharacterEditor('${c.id}')">Editar</button>
        <button class="btn-sm btn-danger-xs" onclick="deleteCharacter('${c.id}')">✕</button>
      </div>
    </div>`).join("");
}

function renderSidebarCharacters() {
  const list = document.getElementById("charsSidebarList");
  const count = document.getElementById("charsCount");
  if (!list) return;
  const chars = Object.values(state.characters);
  count.textContent = chars.length;
  if (chars.length === 0) {
    list.innerHTML = '<li class="nav-empty">Nenhum personagem</li>';
    return;
  }
  list.innerHTML = chars.map(c =>
    `<li class="nav-item ${state.activeCharacterId === c.id ? "nav-active-char" : ""}" onclick="activateCharacter('${c.id}')" title="${escapeHtml(c.name)}">
       <span style="font-size:12px">${c.emoji || "🤖"}</span>
       <span>${escapeHtml(c.name)}</span>
       ${state.activeCharacterId === c.id ? '<span class="char-active-dot">●</span>' : ""}
     </li>`
  ).join("");
}

function showCharacterEditor(id) {
  const c = id ? state.characters[id] : null;
  document.getElementById("charEditorId").value = id || "";
  document.getElementById("charEditorName").value = c ? c.name : "";
  document.getElementById("charEditorEmoji").value = c ? (c.emoji || "🤖") : "🤖";
  document.getElementById("charEditorColor").value = c ? (c.color || "#42f5a0") : "#42f5a0";
  document.getElementById("charEditorDesc").value = c ? (c.desc || "") : "";
  document.getElementById("charEditorPrompt").value = c ? (c.systemPrompt || "") : "";
  document.getElementById("charEditorVoice").value = c ? (c.voice || "pt-BR-AntonioNeural") : "pt-BR-AntonioNeural";
  document.getElementById("charEditor").classList.remove("hidden");
  // Ensure characters panel is visible
  showView("charactersView");
}

function saveCharacterEditor() {
  const id = document.getElementById("charEditorId").value || genId();
  state.characters[id] = {
    id,
    name: document.getElementById("charEditorName").value.trim() || "Sem Nome",
    emoji: document.getElementById("charEditorEmoji").value || "🤖",
    color: document.getElementById("charEditorColor").value || "#42f5a0",
    desc: document.getElementById("charEditorDesc").value.trim(),
    systemPrompt: document.getElementById("charEditorPrompt").value.trim(),
    voice: document.getElementById("charEditorVoice").value,
  };
  saveCharacters();
  document.getElementById("charEditor").classList.add("hidden");
  renderCharactersList();
}

function cancelCharacterEditor() {
  document.getElementById("charEditor").classList.add("hidden");
}

function activateCharacter(id) {
  if (state.activeCharacterId === id) {
    // Deactivate
    state.activeCharacterId = null;
    storage.set("bunker_active_char", "");
    // Restore default system prompt
    const defaultPrompt = "Voce e o Bunker AI — um assistente de sobrevivencia com humor estilo Guia do Mochileiro das Galaxias. Responda de forma util e direta, mas com pitadas de humor seco e referencias sci-fi quando couber. Seu lema: DON'T PANIC. Fale em portugues a menos que o usuario fale em outro idioma. Voce conhece: SAS Survival Handbook, Bushcraft 101, Deep Survival, The Road, e todo tipo de conhecimento util para o fim do mundo.";
    document.getElementById("systemPrompt").value = defaultPrompt;
  } else {
    state.activeCharacterId = id;
    storage.set("bunker_active_char", id);
    const c = state.characters[id];
    if (c?.systemPrompt) document.getElementById("systemPrompt").value = c.systemPrompt;
    if (c?.voice) document.getElementById("ttsVoice").value = c.voice;
  }
  renderCharactersList();
}

function deleteCharacter(id) {
  if (!confirm("Excluir personagem?")) return;
  if (state.activeCharacterId === id) activateCharacter(id);
  delete state.characters[id];
  saveCharacters();
  renderCharactersList();
}

// ─── TTS Panel ───────────────────────────────────────────────────────────────
function openTTSPanel() {
  showView("ttsView");
  document.getElementById("sidebar").classList.remove("open");
  // Sync voice from config
  const voice = document.getElementById("ttsVoice").value;
  document.getElementById("ttsPanelVoice").value = voice;
  // Show engine status
  const info = document.getElementById("ttsEngineInfo");
  if (state.ttsOffline) {
    info.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#42f5a0" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Piper TTS — 100% offline`;
    info.style.color = "#42f5a0";
  } else {
    info.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5c542" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> edge-tts (precisa de internet)`;
    info.style.color = "#f5c542";
  }
}

async function speakTTSPanel() {
  const text = document.getElementById("ttsInput").value.trim();
  if (!text) return;
  const voice = document.getElementById("ttsPanelVoice").value;
  document.getElementById("btnTTSSpeak").style.display = "none";
  document.getElementById("btnTTSStop").style.display = "";

  if (state.currentAudio) { state.currentAudio.pause(); state.currentAudio = null; }
  try {
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 4000), voice }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    state.currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      state.currentAudio = null;
      document.getElementById("btnTTSSpeak").style.display = "";
      document.getElementById("btnTTSStop").style.display = "none";
    };
    audio.onerror = () => {
      document.getElementById("btnTTSSpeak").style.display = "";
      document.getElementById("btnTTSStop").style.display = "none";
    };
    audio.play();
  } catch (e) {
    alert("Erro TTS: " + e.message);
    document.getElementById("btnTTSSpeak").style.display = "";
    document.getElementById("btnTTSStop").style.display = "none";
  }
}

function stopTTS() {
  if (state.currentAudio) { state.currentAudio.pause(); state.currentAudio = null; }
  document.getElementById("btnTTSSpeak").style.display = "";
  document.getElementById("btnTTSStop").style.display = "none";
}

// ─── Pull Model ─────────────────────────────────────────────────────────────
async function pullModel() {
  const name = document.getElementById("pullModelName").value.trim();
  if (!name) return;
  const prog = document.getElementById("pullProgress");
  const fill = document.getElementById("pullFill");
  const status = document.getElementById("pullStatus");
  prog.classList.remove("hidden");
  fill.style.width = "0%";
  status.textContent = "Iniciando...";

  try {
    const r = await fetch("/api/models/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: name }),
    });
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const d = JSON.parse(line.slice(6));
            if (d.total && d.completed) {
              const pct = Math.round((d.completed / d.total) * 100);
              fill.style.width = pct + "%";
              status.textContent = `${pct}%`;
            } else if (d.status) {
              status.textContent = d.status;
            }
          } catch {}
        }
      }
    }
    status.textContent = "Completo!";
    fill.style.width = "100%";
    checkHealth();
  } catch (e) {
    status.textContent = "Erro: " + e.message;
  }
}

// ─── Map ─────────────────────────────────────────────────────────────────────
const mapState = {
  leafletMap: null,
  initialized: false,
  markers: [],       // [{ id, lat, lng, label, leafletMarker }]
  markerMode: false,
  measureMode: false,
  measurePoints: [],
  measureLine: null,
  myLocationMarker: null,
  myLocationCircle: null,
  offlinePmtiles: null,  // PMTiles filename if loaded
  pmtilesLoaded: false,
};

function openMap() {
  showView("mapView");
  document.getElementById("sidebar").classList.remove("open");

  document.querySelectorAll(".nav-guide").forEach(el => el.classList.remove("active"));
  const mapItem = document.querySelector('[data-guide="map"]');
  if (mapItem) mapItem.classList.add("active");

  if (!mapState.initialized) {
    initMap();
  } else {
    mapState.leafletMap.invalidateSize();
  }
}

function closeMap() {
  document.querySelectorAll(".nav-guide").forEach(el => el.classList.remove("active"));
  showChatView();
}

async function initMap() {
  // Default to center of Brazil
  const defaultLat = -15.79;
  const defaultLng = -47.88;
  const defaultZoom = 4;

  const map = L.map("leafletMap", {
    center: [defaultLat, defaultLng],
    zoom: defaultZoom,
    zoomControl: true,
  });

  // Try to load offline PMTiles first, fall back to online tiles
  let usingOffline = false;
  try {
    const mapsResp = await fetch("/api/maps");
    const mapsData = await mapsResp.json();
    if (mapsData.maps && mapsData.maps.length > 0) {
      // Load PMTiles JS library dynamically if not loaded
      if (typeof pmtiles === "undefined" && typeof protomapsL === "undefined") {
        await loadScript("https://unpkg.com/pmtiles@4.4.0/dist/pmtiles.js");
        await loadScript("https://unpkg.com/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js");
      }

      const pmFile = mapsData.maps[0];
      mapState.offlinePmtiles = pmFile.file;

      // Use protomaps-leaflet for vector tile rendering
      if (typeof protomapsL !== "undefined") {
        const layer = protomapsL.leafletLayer({
          url: "/maps/" + pmFile.file,
          flavor: "dark",
        });
        layer.addTo(map);
        usingOffline = true;
        mapState.pmtilesLoaded = true;
      } else if (typeof pmtiles !== "undefined") {
        // Fallback: raster layer
        const p = new pmtiles.PMTiles("/maps/" + pmFile.file);
        pmtiles.leafletRasterLayer(p, {
          attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://protomaps.com">Protomaps</a>',
        }).addTo(map);
        usingOffline = true;
        mapState.pmtilesLoaded = true;
      }
    }
  } catch (e) {
    console.log("PMTiles check:", e.message);
  }

  if (!usingOffline) {
    // Online fallback: CartoDB Dark Matter
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
  }

  // Update notice bar
  const notice = document.getElementById("mapOfflineNotice");
  if (notice) {
    if (usingOffline) {
      notice.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span>Mapa offline carregado: ${mapState.offlinePmtiles} — 100% local, sem internet</span>
      `;
      notice.style.borderColor = "rgba(66, 245, 160, 0.3)";
    } else {
      notice.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Tiles online (CARTO). Para 100% offline: coloque um .pmtiles em static/maps/</span>
      `;
    }
  }

  // Click handler
  map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    document.getElementById("mapCoords").textContent =
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    if (mapState.markerMode) {
      const label = prompt("Nome do marcador:", `Ponto ${mapState.markers.length + 1}`);
      if (label !== null) addMapMarker(lat, lng, label);
    }

    if (mapState.measureMode) {
      mapState.measurePoints.push([lat, lng]);
      L.circleMarker([lat, lng], {
        radius: 4, color: "#f5c542", fillColor: "#f5c542", fillOpacity: 1, weight: 1,
      }).addTo(map);

      if (mapState.measurePoints.length >= 2) {
        if (mapState.measureLine) map.removeLayer(mapState.measureLine);
        mapState.measureLine = L.polyline(mapState.measurePoints, {
          color: "#f5c542", weight: 2, dashArray: "6,6",
        }).addTo(map);

        const totalDist = calcTotalDistance(mapState.measurePoints);
        const measureEl = document.getElementById("mapMeasure");
        measureEl.classList.remove("hidden");
        measureEl.textContent = formatDistance(totalDist);
      }
    }
  });

  map.on("mousemove", (e) => {
    if (!mapState.markerMode && !mapState.measureMode) {
      document.getElementById("mapCoords").textContent =
        `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    }
  });

  mapState.leafletMap = map;
  mapState.initialized = true;

  // Load saved markers
  loadSavedMarkers();

  // Try to geolocate
  locateMe();
}

// Marker functions
function addMapMarker(lat, lng, label) {
  const id = genId();
  const icon = L.divIcon({
    className: "custom-marker",
    html: `<div style="width:12px;height:12px;background:#42f5a0;border:2px solid #08090b;border-radius:50%;box-shadow:0 0 8px rgba(66,245,160,0.5);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

  const marker = L.marker([lat, lng], { icon })
    .addTo(mapState.leafletMap)
    .bindPopup(`<strong>${escapeHtml(label)}</strong><br><span style="font-size:11px;color:#6b6c78;font-family:monospace;">${lat.toFixed(5)}, ${lng.toFixed(5)}</span><br><button onclick="removeMapMarker('${id}')" style="margin-top:6px;padding:2px 8px;background:rgba(245,66,102,0.15);border:1px solid rgba(245,66,102,0.3);border-radius:4px;color:#f54266;font-size:10px;cursor:pointer;">Remover</button>`);

  mapState.markers.push({ id, lat, lng, label, leafletMarker: marker });
  saveMapMarkers();
  renderMarkersList();
}

function removeMapMarker(id) {
  const idx = mapState.markers.findIndex(m => m.id === id);
  if (idx === -1) return;
  mapState.leafletMap.removeLayer(mapState.markers[idx].leafletMarker);
  mapState.markers.splice(idx, 1);
  saveMapMarkers();
  renderMarkersList();
}

function clearAllMarkers() {
  if (mapState.markers.length === 0 && mapState.measurePoints.length === 0) return;
  if (!confirm("Limpar todos os marcadores e medicoes?")) return;

  for (const m of mapState.markers) {
    mapState.leafletMap.removeLayer(m.leafletMarker);
  }
  mapState.markers = [];

  // Clear measure
  if (mapState.measureLine) {
    mapState.leafletMap.removeLayer(mapState.measureLine);
    mapState.measureLine = null;
  }
  mapState.measurePoints = [];
  document.getElementById("mapMeasure").classList.add("hidden");

  // Clear circle markers from measure
  mapState.leafletMap.eachLayer(l => {
    if (l instanceof L.CircleMarker && l !== mapState.myLocationCircle) {
      mapState.leafletMap.removeLayer(l);
    }
  });

  saveMapMarkers();
  renderMarkersList();
}

function saveMapMarkers() {
  const data = mapState.markers.map(m => ({ id: m.id, lat: m.lat, lng: m.lng, label: m.label }));
  storage.set("bunker_map_markers", JSON.stringify(data));
}

function loadSavedMarkers() {
  try {
    const data = storage.get("bunker_map_markers");
    if (!data) return;
    const markers = JSON.parse(data);
    for (const m of markers) {
      addMapMarker(m.lat, m.lng, m.label);
    }
  } catch {}
}

function renderMarkersList() {
  const panel = document.getElementById("mapMarkersPanel");
  const list = document.getElementById("mapMarkersList");

  if (mapState.markers.length === 0) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  list.innerHTML = "";
  for (const m of mapState.markers) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="marker-dot"></span>${escapeHtml(m.label)}`;
    li.onclick = () => {
      mapState.leafletMap.flyTo([m.lat, m.lng], 15, { duration: 1 });
      m.leafletMarker.openPopup();
    };
    list.appendChild(li);
  }
}

// Mode toggles
function toggleMarkerMode() {
  mapState.markerMode = !mapState.markerMode;
  if (mapState.markerMode) mapState.measureMode = false;
  document.getElementById("btnMarker").classList.toggle("active", mapState.markerMode);
  document.getElementById("btnMeasure").classList.remove("active");
  document.getElementById("leafletMap").style.cursor = mapState.markerMode ? "crosshair" : "";
}

function toggleMeasureMode() {
  mapState.measureMode = !mapState.measureMode;
  if (mapState.measureMode) {
    mapState.markerMode = false;
    // Reset measure
    mapState.measurePoints = [];
    if (mapState.measureLine) {
      mapState.leafletMap.removeLayer(mapState.measureLine);
      mapState.measureLine = null;
    }
    document.getElementById("mapMeasure").classList.add("hidden");
    // Clear old measure circle markers
    mapState.leafletMap.eachLayer(l => {
      if (l instanceof L.CircleMarker && l !== mapState.myLocationCircle && l !== mapState.myLocationMarker) {
        mapState.leafletMap.removeLayer(l);
      }
    });
  }
  document.getElementById("btnMeasure").classList.toggle("active", mapState.measureMode);
  document.getElementById("btnMarker").classList.remove("active");
  document.getElementById("leafletMap").style.cursor = mapState.measureMode ? "crosshair" : "";
}

// GPS
function locateMe() {
  if (!navigator.geolocation) {
    alert("Geolocalizacao nao suportada neste navegador.");
    return;
  }

  document.getElementById("btnGps").classList.add("active");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;

      if (mapState.myLocationMarker) mapState.leafletMap.removeLayer(mapState.myLocationMarker);
      if (mapState.myLocationCircle) mapState.leafletMap.removeLayer(mapState.myLocationCircle);

      mapState.myLocationCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: "#42f5a0",
        fillColor: "#42f5a0",
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(mapState.leafletMap);

      mapState.myLocationMarker = L.circleMarker([lat, lng], {
        radius: 7,
        color: "#08090b",
        fillColor: "#42f5a0",
        fillOpacity: 1,
        weight: 3,
      }).addTo(mapState.leafletMap).bindPopup(`<strong>Voce esta aqui</strong><br><span style="font-size:11px;font-family:monospace;color:#6b6c78;">${lat.toFixed(5)}, ${lng.toFixed(5)}<br>Precisao: ${Math.round(accuracy)}m</span>`);

      mapState.leafletMap.flyTo([lat, lng], 15, { duration: 1.5 });
      document.getElementById("btnGps").classList.remove("active");
    },
    (err) => {
      document.getElementById("btnGps").classList.remove("active");
      console.warn("GPS error:", err.message);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// Distance calculation (Haversine)
function calcTotalDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversine(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return total;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

// ─── Utils ──────────────────────────────────────────────────────────────────
function escapeHtml(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

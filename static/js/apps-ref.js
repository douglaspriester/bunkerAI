/* ═══ Bunker OS — Reference Apps (SurvRef, SOS, Radio) + State Exposes ═══ */

// ─── Global aliases from window (set by main.js) ─────────────────────────────
const { state, storage, escapeHtml, markdownToHtml, guidesCache, LOADING_PHRASES,
        OS_APPS, _windows, openApp, closeWindow, focusWindow, osToast, openSavedApp,
        saveChats, saveFavorites, renderChatList, restoreChat, renderFavorites,
        addFavorite, removeFavorite, isFavorited, genId,
        renderDesktopIcons, startTaskbarClock, applyWallpaper, restoreSession,
        addMsgDom, addStreamMsgDom, addMsgActions, streamFromAPI, scrollChat,
        showView, showChatView, showGuideView,
        setGuidesIndex, setProtocolsIndex, setGamesIndex, setSearchIndex } = window;




// ═══ Survival Reference Database ═════════════════════════════════════════════
const SURV_REF = [
  { cat: '💧 Agua', items: [
    { title: 'Fervura', text: 'Ferver em ebulicao por 1 minuto (3 min acima de 1500m). Metodo mais confiavel. Deixar esfriar naturalmente.' },
    { title: 'Cloro — agua sanitaria 2.5%', text: '2 gotas por litro. Mexer e esperar 30 min. Deve ter leve odor de cloro. Se nao, repetir e esperar +15 min.' },
    { title: 'Cloro — agua sanitaria 6%', text: '1L: 2 gotas. 4L: 8 gotas. 8L: 16 gotas (1/4 colher cha). Esperar 30 min.' },
    { title: 'Iodo (tintura 2%)', text: 'Agua clara: 5 gotas/litro. Agua turva: 10 gotas/litro. Esperar 30 min.' },
    { title: 'Pre-filtrar', text: 'SEMPRE filtrar agua turva por pano limpo, filtro de cafe ou papel ANTES do tratamento quimico.' },
    { title: 'SODIS (solar)', text: 'Garrafa PET transparente ao sol direto por 6h (2 dias se nublado). UV mata patogenos.' },
    { title: 'Filtro improvisado', text: 'Camadas de baixo p/ cima: cascalho grosso → cascalho fino → areia → carvao ativado → pano. Sempre ferver depois.' },
    { title: 'Sinais de agua', text: 'Vegetacao verde, insetos em enxame, trilhas de animais convergindo, vales e depressoes.' },
    { title: 'Condensacao', text: 'Saco plastico sobre galho com folhas verdes. Em poucas horas coleta agua por evapotranspiracao.' },
    { title: 'Armazenamento', text: '4 litros por pessoa por dia (beber + higiene minima). Recipientes de grau alimentar em local fresco e escuro.' },
  ]},
  { cat: '🏥 Primeiros Socorros', items: [
    { title: 'Hemorragia grave', text: 'Pressao direta com pano limpo. NAO remover — adicionar mais por cima. Elevar acima do coracao. Torniquete 5-8cm acima da ferida SOMENTE se pressao falhar. Anotar horario. NAO remover torniquete depois de colocado.' },
    { title: 'RCP Adulto', text: '30 compressoes (5-6cm profundidade, 100-120/min) + 2 ventilacoes. Maos no centro do peito (esterno), bracos retos. Permitir retorno total do torax entre compressoes. NAO parar.' },
    { title: 'RCP Crianca (1-8 anos)', text: 'Mesma proporcao 30:2. Profundidade: ~5cm. Usar 1 ou 2 maos conforme tamanho da crianca.' },
    { title: 'RCP Bebe (<1 ano)', text: '30:2 com 2 dedos para compressoes. Profundidade: ~4cm. Cobrir boca E nariz do bebe com sua boca para ventilacoes.' },
    { title: 'Fratura', text: 'Imobilizar articulacao ACIMA e ABAIXO da fratura. Tala: material rigido (galhos, tabuas) com enchimento de pano. Checar circulacao abaixo (pulso, cor, sensacao). Fratura exposta: cobrir com pano esteril, NAO empurrar osso.' },
    { title: 'Queimadura', text: '1o grau (vermelha): agua corrente fria 10-20 min. 2o grau (bolhas): idem, NAO estourar bolhas, curativo solto. 3o grau (carbonizada/branca): NAO aplicar agua/creme. Cobrir com pano esteril seco. Evacuar. NUNCA usar gelo, manteiga ou pasta de dente.' },
    { title: 'Engasgo (Heimlich)', text: 'Atras da pessoa, punho fechado acima do umbigo, outra mao por cima. Puxar para dentro e para cima com forca. Se sozinho: empurrar contra borda de cadeira/mesa.' },
    { title: 'Hipotermia', text: 'Remover roupas molhadas. Aquecer gradualmente: cobertores, contato corpo-a-corpo. Liquidos MORNOS (NAO quentes). NAO esfregar extremidades. Sinais de choque: pele palida, pulso rapido, confusao — manter aquecido, pernas elevadas.' },
    { title: 'Soro caseiro', text: '1 litro de agua limpa + 6 colheres (cha) de acucar + 1 colher (cha) de sal. Beber aos poucos ao longo do dia.' },
  ]},
  { cat: '🔥 Fogo', items: [
    { title: 'Ferro cerium (fire steel)', text: 'Raspar com faca produz faiscas a 3000°C. Funciona molhado. Melhor ferramenta de sobrevivencia.' },
    { title: 'Arco e broca', text: 'Madeira seca e leve (cedro, salgueiro). Broca gira em cavidade na base. Brasa cai na tinder. Soprar gentilmente. Dificil — requer pratica.' },
    { title: 'Lente solar', text: 'Lupa, fundo de garrafa com agua, oculos, lente de gelo. Concentrar ponto de luz em tinder escuro. Funciona ao meio-dia.' },
    { title: 'Bateria + palha de aco', text: 'Tocar polos da bateria (9V ideal) em la de aco fina. Inflama instantaneamente.' },
    { title: 'Tinder (melhor → pior)', text: 'Lint de secadora, casca de betula, algodao + vaselina, raspas finas de madeira, fibra de coco, fungo seco, capim seco triturado.' },
    { title: 'Tepee (rapido)', text: 'Tinder no centro, cone de gravetos finos ao redor, lenha inclinada. Bom para calor rapido.' },
    { title: 'Log Cabin (longo)', text: 'Pilha quadrada ao redor do nucleo de tinder. Queima longa, bom para cozinhar.' },
    { title: 'Estrela (eficiente)', text: '4-5 toras irradiando do centro. Empurrar para dentro conforme queimam. Economiza lenha.' },
    { title: 'Buraco Dakota (discreto)', text: 'Cavar buraco de 30cm para fogo + tunel para ar. Pouca fumaca, protegido do vento. Ideal se discrição importa.' },
  ]},
  { cat: '🏕️ Abrigo', items: [
    { title: 'Regra dos 3', text: '3 min sem ar, 3 horas sem abrigo (clima extremo), 3 dias sem agua, 3 semanas sem comida.' },
    { title: 'Lean-to (30-60 min)', text: 'Viga de 2.5-3m apoiada em arvore a 45°. Galhos na lateral. Cobrir com folhas/musgos. Entrada oposta ao vento. Parede refletora de fogo: empilhar toras verdes do lado oposto.' },
    { title: 'Debris hut (1-2h)', text: '1 pessoa. Viga central 1.5x altura do corpo. Galhos em A dos lados. Cobrir com 30cm+ de folhas secas. Menor = mais quente.' },
    { title: 'A-frame (30-60 min)', text: '2 postes de suporte em A + viga central + lona ou galhos/folhas. Bom contra chuva.' },
    { title: 'Caverna de neve (2-3h)', text: 'Banco de neve compactado (min 1.2m). Cavar camara, furo de ar no topo. Interior fica ~0°C mesmo com -30°C fora.' },
    { title: 'Local ideal', text: 'Terreno elevado (evitar inundacao). Protecao contra vento. Perto de agua mas nao na margem. Longe de arvores mortas.' },
    { title: 'Isolamento do solo', text: 'NUNCA dormir direto no chao. Usar galhos, folhas, mochilas — minimo 10cm. Solo rouba calor 25x mais rapido que ar.' },
  ]},
  { cat: '🧭 Navegacao', items: [
    { title: 'Estrela Polar (Norte)', text: 'Encontre a Ursa Maior (concha). Prolongue 5x a distancia entre as 2 estrelas da borda (Dubhe e Merak). Polaris fica a ~1° do norte verdadeiro.' },
    { title: 'Cruzeiro do Sul', text: 'Prolongue o eixo maior do Cruzeiro 4.5x. Desse ponto, desca perpendicular ao horizonte = Sul.' },
    { title: 'Sombra e pau', text: 'Pau vertical no chao. Marcar ponta da sombra. Esperar 15-30 min. Marcar novamente. Linha entre marcas = Leste-Oeste (primeira marca = Oeste).' },
    { title: 'Metodo do relogio', text: 'Ponteiro das horas p/ sol. Bissetriz entre ponteiro e 12h aponta ~Sul (hem. norte) ou ~Norte (hem. sul).' },
    { title: 'Sol', text: 'Nasce ~Leste, se poe ~Oeste (exato nos equinocios). Ao meio-dia solar, sombras apontam Norte (hem. sul) ou Sul (hem. norte).' },
    { title: 'Lua crescente', text: 'Linha imaginaria entre as pontas da lua ate o horizonte aponta ~Sul (hem. norte) ou ~Norte (hem. sul).' },
    { title: 'Musgo (baixa confianca)', text: 'Musgo cresce no lado MAIS UMIDO. Usar APENAS como confirmacao junto com outros metodos.' },
  ]},
  { cat: '🪢 Nos Essenciais', items: [
    { title: 'Lais de guia (bowline)', text: 'Laco fixo que NAO aperta sob carga. Ideal para resgate e ancoragem. Facil de desfazer apos carga. "Coelho sai da toca, da volta na arvore, volta pra toca."' },
    { title: 'No de escota (sheet bend)', text: 'Unir duas cordas de espessuras diferentes. Mais confiavel que no direito para cordas desiguais.' },
    { title: 'Volta do fiel (clove hitch)', text: 'Fixacao rapida em poste/galho. Duas voltas sobrepostas. Usar com meia-volta extra para seguranca.' },
    { title: 'Taut-line hitch', text: 'Tensao ajustavel em estais de barraca. Desliza para ajustar mas trava sob carga.' },
    { title: 'Oito (figure-8)', text: 'No de seguranca para escalada. Nao aperta, facil de inspecionar. Usado como base para laco de oito.' },
    { title: 'No de prusik', text: 'Corda fina em corda grossa. Trava sob peso, desliza quando solto. Essencial para subir cordas.' },
    { title: 'No de caminhoneiro', text: 'Vantagem mecanica 3:1 para apertar cargas. Tensiona cordas com forca tripla.' },
  ]},
  { cat: '🌿 Plantas (Brasil)', items: [
    { title: '✅ Palmito (Jucara/Acai)', text: 'Nucleo do caule de palmeiras. Comer cru ou cozido. Rico em fibras e nutrientes.' },
    { title: '✅ Ora-pro-nobis', text: 'Folhas comestiveis cruas ou cozidas. 25% proteina (peso seco). Muito comum em cercos/muros.' },
    { title: '✅ Taioba', text: 'Folhas COZIDAS (nunca cruas — oxalato). Parece inhame. Abundante em areas umidas.' },
    { title: '✅ Banana (silvestre)', text: 'Fruto e coracao (flor). Folhas para cozinhar/embalar. Toda parte usavel.' },
    { title: '✅ Dente-de-leao', text: 'Folhas, flores e raizes comestiveis. Rico em vitaminas A, C, K. Cha da raiz e diuretico.' },
    { title: '✅ Taboa (cattail)', text: 'Perto de agua, espiga marrom. Brotos, raizes, polen — tudo comestivel. Disponivel o ano todo.' },
    { title: '⚠️ Mandioca BRAVA', text: 'TOXICA crua (cianeto). Exige processamento: ralar, prensar, torrar. Confundida com mansa — na duvida, processar.' },
    { title: '❌ Comigo-ninguem-pode', text: 'TOXICA. Causa queimacao severa na boca/garganta. Cristais de oxalato. NAO tocar nos olhos.' },
    { title: '❌ Mamona', text: 'Sementes contem ricina (letal). Folhas grandes palmadas. Evitar completamente.' },
    { title: '❌ Cicuta (hemlock)', text: 'Confundida com cenoura/salsinha. Caule liso com manchas roxas, cheiro ruim. Planta mais toxica das Americas.' },
    { title: 'Teste universal', text: 'Na duvida: NAO coma. Teste: contato na pele 8h → labio 15min → lingua 15min → mastigar/cuspir 15min → comer pouco e esperar 8h. Qualquer reacao = descartar.' },
  ]},
  { cat: '📡 Sinais de Socorro', items: [
    { title: 'Regra do 3', text: '3 de qualquer coisa (fogueiras, apitos, tiros, flashes) e universalmente reconhecido como socorro.' },
    { title: 'SOS (Morse)', text: '··· −−− ··· (3 curtos, 3 longos, 3 curtos). Universal. Usar com luz, som, espelho ou apito.' },
    { title: 'Apito', text: '3 apitos = socorro universal. Repetir a cada minuto. Som viaja mais longe que a voz.' },
    { title: 'Espelho de sinalizacao', text: 'Qualquer superficie reflexiva. Mirar entre os dedos em V apontando para aeronave. Visivel a 15+ km. Melhor sinal diurno.' },
    { title: 'Fogueira de sinal', text: '3 fogueiras em triangulo (socorro). Dia: adicionar folhas verdes para fumaca branca. Noite: madeira seca para chama alta.' },
    { title: 'MAYDAY', text: '"MAYDAY MAYDAY MAYDAY, aqui [nome], minha posicao e [coords/descricao], [situacao], [numero de pessoas]"' },
    { title: 'Marcas no chao', text: 'V = preciso ajuda. X = preciso medico. I = preciso suprimentos. → = sigo nesta direcao. Tamanho minimo: 3 metros. Alto contraste com o chao.' },
    { title: 'Roupa colorida', text: 'Espalhar roupas brilhantes (laranja e a melhor) em area aberta para visibilidade aerea.' },
    { title: 'Celular', text: 'Mesmo sem sinal, tentar 190/192/193 (Brasil) ou 112 (universal). SMS usa menos sinal que voz. Desligar quando nao usar para poupar bateria.' },
  ]},
  { cat: '☢️ Ameacas Nucleares/Quimicas', items: [
    { title: 'Abrigo (nuclear)', text: 'Entrar em edificio solido IMEDIATAMENTE. Paredes grossas de concreto/tijolo. Ir para o centro, longe de janelas. Ficar no minimo 24h.' },
    { title: 'Descontaminacao', text: 'Remover roupas externas (elimina ~90% contaminacao). Lavar corpo com sabao e agua morna. NAO esfregar. NAO usar condicionador (prende particulas).' },
    { title: 'Iodo (protecao tireoide)', text: 'Iodeto de potassio (KI) protege tireoide de iodo radioativo. Adulto: 130mg. Crianca 3-18: 65mg. SO tomar se autoridades recomendarem.' },
    { title: 'Ataque quimico', text: 'Subir (agentes quimicos sao mais pesados que ar). Cobrir boca/nariz com pano umido. Sair da area contra o vento.' },
    { title: 'Agua e comida', text: 'Apenas alimentos em embalagem FECHADA sao seguros. Agua encanada geralmente OK (sistema fechado). Nao consumir nada exposto ao ar livre.' },
  ]},
];

// Local escape helper for innerHTML interpolation of data values
function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function survRefInit() {
  const container = document.getElementById('survRefContent');
  if (!container) return;
  let html = '';
  SURV_REF.forEach(section => {
    html += `<div class="surv-section">
      <h3 class="surv-cat-title">${_esc(section.cat)}</h3>
      <div class="surv-cards">`;
    section.items.forEach(item => {
      html += `<div class="surv-card">
        <div class="surv-card-title">${_esc(item.title)}</div>
        <div class="surv-card-text">${_esc(item.text)}</div>
      </div>`;
    });
    html += '</div></div>';
  });
  container.innerHTML = html;
}
window.survRefInit = survRefInit;

function survRefFilter(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('#survRefContent .surv-section').forEach(sec => {
    const cards = sec.querySelectorAll('.surv-card');
    let anyVisible = false;
    cards.forEach(card => {
      const match = !q || card.textContent.toLowerCase().includes(q);
      card.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    sec.style.display = (!q || anyVisible) ? '' : 'none';
  });
}
window.survRefFilter = survRefFilter;

// ═══ SOS Widget ══════════════════════════════════════════════════════════════
function toggleSosWidget() {
  const panel = document.getElementById('sosPanel');
  if (panel) panel.classList.toggle('hidden');
}
window.toggleSosWidget = toggleSosWidget;

// Close SOS panel when clicking outside
document.addEventListener('click', (e) => {
  const widget = document.getElementById('sosWidget');
  const panel = document.getElementById('sosPanel');
  if (widget && panel && !widget.contains(e.target)) {
    panel.classList.add('hidden');
  }
});

// ═══ Radio Frequency Filter ═══════════════════════════════════════════════
function radioFilter(query) {
  const container = document.getElementById('radioView');
  if (!container) return;
  const q = query.toLowerCase().trim();
  const sections = container.querySelectorAll('.radio-section');
  sections.forEach(h3 => {
    // Find the next sibling (table or ul)
    let sibling = h3.nextElementSibling;
    if (!sibling) return;
    let sectionVisible = false;
    if (sibling.tagName === 'TABLE') {
      const rows = sibling.querySelectorAll('tr');
      rows.forEach((row, i) => {
        if (i === 0) return; // skip header
        const text = row.textContent.toLowerCase();
        const match = !q || text.includes(q);
        row.style.display = match ? '' : 'none';
        if (match) sectionVisible = true;
      });
    } else if (sibling.tagName === 'UL') {
      const items = sibling.querySelectorAll('li');
      items.forEach(li => {
        const match = !q || li.textContent.toLowerCase().includes(q);
        li.style.display = match ? '' : 'none';
        if (match) sectionVisible = true;
      });
    }
    if (!q) sectionVisible = true;
    h3.style.display = sectionVisible ? '' : 'none';
    if (sibling) sibling.style.display = sectionVisible ? '' : 'none';
  });
}
window.radioFilter = radioFilter;




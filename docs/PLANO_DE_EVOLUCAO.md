# Plano de evolução do Planets

> Implementação iniciada em 15/10/2026. A [primeira entrega](MELHORIAS_IMPLEMENTADAS.md) descreve o que já funciona e os limites atuais. Os marcos abaixo continuam como escopo completo; esta entrega não conclui a migração física nem a simulação atmosférica completa.

## 1. Objetivo e limite de realismo

Transformar o Planets em um simulador interativo no qual a **causa física determina o resultado** e a animação representa esse resultado. O alvo é uma aproximação cientificamente fundamentada em tempo real no navegador, com parâmetros e incertezas visíveis. Uma colisão de planetas com hidrodinâmica completa ou uma simulação relativística integral exigiria computação especializada; esses cálculos poderão gerar dados de referência fora do navegador, mas não devem ser prometidos como cálculo interativo exato.

Separar três experiências:

1. **Sistema Solar:** órbitas e propriedades coerentes, com condições iniciais documentadas.
2. **Laboratório:** criar corpos, impactos, eventos térmicos e buracos negros com parâmetros ajustáveis; deixar claro quando o cenário é hipotético.
3. **Futuro do Sol:** navegar pela idade estelar, reproduzindo uma trilha de evolução solar previamente calculada e os efeitos sobre os planetas.

Cada evento deve expor quatro coisas: parâmetros de entrada, previsão física, animação correspondente e balanço de massa/energia. Permitir um controle de “intensidade cinematográfica” somente para brilho, duração de trilhas e enquadramento; ele nunca altera o resultado físico.

## 2. Diagnóstico do projeto atual

| Área | Situação observada no código | Consequência |
| --- | --- | --- |
| Escalas | Distâncias e raios visuais são comprimidos; a gravidade usa essas coordenadas e um parâmetro gravitacional arbitrário. | Velocidade, atração, encontro e tamanho não descrevem o mesmo sistema físico. |
| Tempo | O relógio soma dias a uma data de 2026; a integração limita o tempo efetivamente simulado em altas velocidades. | Avançar muito pode produzir evolução orbital incorreta; bilhões de anos não cabem nesse modelo de calendário. |
| Colisões | O teste detecta interseção de esferas, mas o resultado é escolhido por condições simples. Uma colisão entre planetas gera sempre 22 fragmentos com velocidades aleatórias. | Ângulo, velocidade, composição e gravidade quase não mudam o desfecho; não há balanço físico verificável. |
| Partículas | Há uma única família de partículas para quase todos os eventos; o sistema tem limite de 1.400 instâncias. | Rocha, gelo, vapor e plasma parecem semelhantes. A atualização por remoção também deve ser revisada para evitar lacunas nas instâncias visíveis. |
| Buraco negro | Captura por contato com uma esfera visual; alongamento por distância; lente gravitacional como distorção radial de tela. | Horizonte, marés, acreção e imagem ótica não estão ligados à massa e à geometria física. |
| Temperatura e Sol | Corpos e estrela têm aparência majoritariamente estática. | Não há estado térmico, mudança de fase ou evolução solar. |
| Superfície e atmosfera | A superfície usa principalmente um mapa de cor; na Terra, as nuvens são uma textura numa esfera que apenas gira (`Planet.js`). O halo atmosférico é um shader de borda (`ShaderLibrary.js`). | Falta relevo e resposta local a eventos; nuvens não nascem, se deformam, precipitam ou desaparecem conforme vento, umidade e calor. O halo não representa pressão, composição nem espalhamento de luz. |

Antes de alterar os efeitos, gravar cenas de referência do estado atual: impacto de meteorito, choque frontal e rasante entre planetas, queda em buraco negro e órbitas com tempo acelerado. Medir taxa de quadros, custo de CPU/GPU e consumo de memória nos dispositivos-alvo.

## 3. Etapa 1 — Fundação física e arquitetura

**Prioridade P0. Pré-requisito para todas as etapas seguintes.**

1. Criar `SimulationState` independente do Three.js: posição e velocidade em metros e m/s, massa em kg, raio em metros, temperatura em K, composição, rotação e energia interna. Usar números de dupla precisão. A camada de desenho converte unidades físicas em coordenadas de cena; raios e distâncias visuais deixam de alimentar equações.
2. Centralizar constantes e conversões (`G`, `c`, unidade astronômica, massa solar, segundos por ano). Marcar na interface quando uma representação usa tamanho exagerado para visibilidade.
3. Inicializar órbitas com elementos orbitais/efemérides coerentes com o estado escolhido. Ao “soltar” um planeta, preservar sua velocidade física naquele instante; não substituir por uma velocidade circular estimada da posição comprimida.
4. Criar `TimeController` com dois tempos distintos: segundos de simulação orbital e idade da estrela em anos. Usar passo controlado para a dinâmica, interpolação para desenho, tratamento explícito de eventos e salto de épocas. Acelerar o relógio não pode descartar tempo silenciosamente.
5. Manter integrador gravitacional apropriado para órbitas com teste de estabilidade; usar passos menores em encontros próximos. Para períodos de milhões/bilhões de anos, usar evolução orbital secular ou estados pré-calculados por trecho, sem integrar cada dia. Separar corpos massivos de partículas visuais sem retroação gravitacional.
6. Publicar eventos estruturados (`ImpactEvent`, `ThermalEvent`, `TidalDisruptionEvent`, `StellarEvent`). Os efeitos leem esses eventos e não decidem sua física.
7. Fixar semente aleatória por cenário para repetição e comparação visual. Salvar estado inicial, configurações, versão do modelo e semente.

**Aceite:** órbitas de dois corpos permanecem estáveis pelo intervalo de teste definido; velocidades iniciais são compatíveis com a órbita exibida; pausar/continuar ou mudar FPS não altera o resultado além de tolerância documentada; o modo rápido preserva todos os eventos relevantes. O teste analítico de um corpo orbitando outro, a velocidade de escape e o período de Kepler devem passar.

## 4. Etapa 2 — Colisões e fragmentação

**Prioridade P0. Implementar após a fundação, antes do novo espetáculo visual.**

1. Definir materiais: rocha, metal, gelo, água, gás e misturas, com densidade, resistência, calor específico, albedo e temperaturas de transição. Distinguir planeta rochoso, gigante gasoso, asteroide, cometa e estrela; não aplicar cratera rochosa a uma atmosfera gasosa.
2. Melhorar detecção com tempo de contato contínuo, fase ampla espacial e resolução de múltiplos contatos no mesmo passo. Calcular velocidade relativa, ângulo de impacto, razão de massas, velocidade de escape e energia específica do impacto. Projetar o ponto de contato na superfície real para orientar a ejeção.
3. Implementar regimes fundamentados em leis de escala: cratera/erosão, fusão, colisão rasante com sobrevivência, ruptura parcial e ruptura catastrófica. Usar os regimes e parâmetros de [Leinhardt e Stewart](https://arxiv.org/abs/1106.6084) para corpos dominados pela gravidade; para projéteis pequenos, aplicar uma calibração específica de crateras e resistência do material. Validar qualquer extrapolação fora da faixa dos estudos.
4. Produzir remanescentes físicos: massa e velocidade do maior corpo, quantidade de massa ejetada, distribuição de tamanhos, cone/anel de ejeção, calor depositado e possível material reacretado. Fragmentos visuais pequenos podem representar conjuntos de massa; a massa que não aparece individualmente continua no balanço como poeira/vapor agregado.
5. Conservar massa e momento linear; registrar momento angular, energia cinética, potencial, térmica, de fusão/vaporização e energia radiada. Energia mecânica pode virar calor: ela não deve ser conservada isoladamente. Aplicar correções numéricas dentro de tolerâncias explícitas.
6. Casos especiais: estrela absorve material com aquecimento/acréscimo de massa; gigante gasoso produz perturbação de nuvens e pluma, não estilhaços de crosta; buraco negro segue o modelo da etapa 8.

**Cenas de aceite:** um meteorito pequeno produz cratera e ejeção local, sem destruir o planeta; um impacto frontal lento pode fundir corpos; um rasante comparável preserva dois remanescentes; uma colisão mais energética pode destruir um corpo. As quatro cenas devem mostrar resultados diferentes por causa dos parâmetros e um relatório de conservação.

## 5. Etapa 3 — Partículas e animação de eventos

**Prioridade P1. Construir sobre os eventos físicos da etapa 2.**

1. Separar sistemas visuais para fragmentos grandes, cascalho, poeira, vapor, plasma, gelo e material incandescente. Cada família recebe massa representada, posição/velocidade inicial, temperatura, vida útil e resposta à iluminação derivados do evento.
2. Animar em fases: compressão/flash de contato, ejeção inicial, pluma e material quente, dispersão balística, resfriamento/condensação, queda ou órbita dos remanescentes. Duração e extensão seguem escala física comprimida de modo documentado para legibilidade.
3. Usar formas/cores adequadas à temperatura e ao material; brilhos não podem representar arbitrariamente um planeta inteiro como plasma. No vácuo, representar ejeção balística e radiação; uma “onda de choque” esférica só aparece quando há meio gasoso para propagá-la.
4. Corrigir a compactação das instâncias ao remover partículas; evitar copiar transforms ou criar objetos Three.js por partícula em cada quadro. Reutilizar buffers e emitir lotes por material. Introduzir níveis de detalhe pela câmera e orçamentos dinâmicos por qualidade.
5. Criar crateras persistentes e deformações visuais proporcionais ao impacto, com marcas de fusão, deposição de poeira e recuperação/erosão apenas quando o modelo permitir. Para colisões de planetas, deformar ou substituir a malha do remanescente conforme a classe de resultado.
6. Usar roteiro de câmera opcional para revelar o evento, com opção de desativar; manter posição e escala reais da cena intactas.

**Aceite:** a animação de cada uma das quatro cenas de colisão permite identificar o material e o regime sem consultar números; sua direção e velocidade de ejeção correspondem ao evento; não surgem buracos ou instâncias antigas no pool; a cena permanece fluida nos perfis de hardware escolhidos na etapa 0.

## 6. Etapa 4 — Congelamento, aquecimento e mudança de fase

**Prioridade P1. Depende das propriedades de material e da luminosidade estelar.**

1. Calcular fluxo incidente pela luminosidade e distância, com albedo, emissividade, rotação e inércia térmica. Começar com temperatura de equilíbrio de corpo sem atmosfera; adicionar uma camada atmosférica simplificada e claramente identificada quando necessário. Não mostrar a temperatura de equilíbrio como temperatura real da superfície terrestre.
2. Evoluir energia térmica por intervalo de tempo: radiação absorvida, emissão, calor do impacto, aquecimento de maré quando existir, condução simplificada e calor latente. Em tempos longos, aproximar pelo equilíbrio; em eventos rápidos, integrar a resposta térmica.
3. Definir transições dependentes de substância **e pressão**: congelamento/derretimento, sublimação/condensação, vaporização, fusão de rocha e formação de superfície parcialmente fundida. Água líquida não deve aparecer automaticamente sobre um corpo sem pressão suficiente.
4. Acoplar estado a efeitos: gelo cresce/retrai de acordo com balanço de energia e disponibilidade de voláteis; cometas criam coma e cauda quando sublimam; aquecimento extremo muda albedo, nuvens, emissividade, cor térmica, brilho e taxa de perda de voláteis. Calor de impacto gera pontos quentes locais que resfriam.
5. Incluir camadas de simplificação visíveis no painel: “corpo sem atmosfera”, “atmosfera aproximada” e “evolução estelar”, com intervalos de incerteza quando os dados são insuficientes.

**Aceite:** duplicar a distância de uma fonte idealizada reduz o fluxo para um quarto; a temperatura de equilíbrio responde conforme a quarta raiz do fluxo; o mesmo corpo pode sublimar, derreter ou permanecer congelado conforme pressão/composição; uma zona de impacto esfria ao longo do tempo. Exibir aviso de modelo aproximado para clima planetário.

## 7. Etapa 5 — Texturas, materiais e identidade de cada corpo

**Prioridade P1. Pode começar após a definição das unidades e dos materiais; alimenta as etapas atmosférica e de superfície.**

1. Criar para cada corpo uma ficha versionada: massa, raio, gravidade, rotação e inclinação, composição superficial/atmosférica, pressão de referência, albedo, emissividade, fontes de calor, líquidos/gelos possíveis, topografia conhecida e fenômenos observáveis. Para gigantes gasosos, “superfície” significa nível de pressão de referência no topo das nuvens, não chão sólido. Distinguir valores medidos, estimados e artísticos.
2. Tratar as imagens existentes como **condição visual inicial**; não codificar nuvens, tempestades ou calotas permanentes dentro do mapa fixo da superfície. Separar mapas de albedo/cor, relevo e normais, rugosidade, brilho especular de oceanos/líquidos, composição, emissividade, temperatura, luzes noturnas, gelo e opacidade de nuvens. Usar PBR com iluminação do Sol na direção correta e espaço de cor consistente; evitar brilho metálico artificial em rocha.
3. Guardar origem, data/época, projeção, resolução, processamento e direitos de uso de cada textura. Observações de datas distintas não devem ser misturadas como se representassem o mesmo instante. Mapas de satélite da [NASA Earthdata](https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy) são um ponto de partida, sujeitos à licença específica de cada produto.
4. Criar níveis de detalhe por distância e zoom: mapa global comprimido para visão do Sistema Solar; tiles/mosaicos de maior resolução e relevo local apenas quando o usuário se aproxima. Controlar costuras de longitude, polos, mipmaps, filtragem e memória de GPU. As texturas devem permanecer nítidas sem exigir sempre a maior resolução.
5. Atualizar mapas dinâmicos por eventos: crateras e raios de ejeção, fuligem/poeira depositada, neve/gelo, área fundida, vapor, cicatrização/erosão quando aplicável. Renderizar essas marcas em camadas persistentes, vinculadas às coordenadas do corpo, e não em esferas flutuantes.
6. Diferenciar atmosfera visível de luz espalhada: shader com aproximação de espalhamento Rayleigh/Mie, absorção por gás/aerossol, espessura óptica, altitude e ângulo solar; sombras de nuvens na superfície e terminador diurno/noturno. Calibrar cor/intensidade por composição e densidade, com presets por qualidade. Halo ornamental não substitui a atmosfera física.

| Corpo/grupo | Material, textura e relevo | Camadas variáveis pertinentes |
| --- | --- | --- |
| Mercúrio e Lua | Regolito, crateras, escarpas e gelo apenas em regiões permanentemente sombreadas, quando indicado por dados. | Exosfera tênue; não gerar tempo meteorológico, nuvens ou aurora terrestre. |
| Vênus | Topografia rochosa sob uma cobertura de nuvens opaca; superfície só deve aparecer em modo específico ou com dados de radar. | Nuvens de ácido sulfúrico, névoa e circulação da alta atmosfera; efeito estufa extremo. |
| Terra | Continentes, batimetria aparente, oceanos especulares, gelo, neve, vegetação sazonal aproximada e luzes urbanas apenas na face noturna. | Nuvens em alturas distintas, vapor, aerossóis, tempestades, sombra no solo e espalhamento azul. |
| Marte | Regolito, crateras, dunas, vulcões e calotas sazonais. | Poeira suspensa, tempestades regionais/globais, nuvens finas e condensação/sublimação de CO₂. |
| Júpiter/Saturno | Camadas de nuvens, sem textura de “solo” ou cratera fixa. Anéis de Saturno com partículas em órbitas diferentes, sombra e lacunas. | Faixas, jatos zonais, redemoinhos e convecção em materiais condizentes com a composição. |
| Urano/Netuno | Gradientes de absorção do metano, regiões polares e nuvens altas; sem crosta exposta. | Variações sazonais, jatos e vórtices com intensidade específica de cada planeta. |
| Cometas/asteroides/luas geladas | Forma irregular, porosidade/relevo e gelo/rocha conforme composição. | Coma/cauda por sublimação e vento solar; plumas só com fonte física de energia. |

**Aceite:** ao desligar nuvens e efeitos, a superfície continua fisicamente identificável; ao alterar o estado térmico, gelo/poeira/marcas mudam sem editar o mapa de base; perto e longe, não aparecem costuras nem iluminação do lado errado; documentação identifica a fonte de cada camada.

## 8. Etapa 6 — Atmosferas e nuvens dinâmicas

**Prioridade P1. Depende das etapas 1, 4 e 5. O modelo numérico deve produzir os campos que o renderizador mostra.**

Uma previsão meteorológica global de alta fidelidade exige assimilação de observações e grande poder computacional, como no sistema [GEOS da NASA](https://gmao.gsfc.nasa.gov/geos-systems/). O produto terá dois modos distintos: **reprodução observacional**, que anima campos meteorológicos de uma época documentada sem aceitar alterações físicas arbitrárias; e **laboratório interativo**, que usa um modelo atmosférico reduzido, plausível e determinístico. O segundo não será anunciado como previsão do tempo real ou reconstrução exata de um dia histórico.

1. Criar `AtmosphereState` por planeta, em grade esférica de células de área aproximadamente uniforme e poucas camadas verticais/níveis de pressão. Campos mínimos: pressão, temperatura, vento horizontal, vapor/condensado compatível com a composição, fração e espessura óptica de nuvens, aerossóis/poeira e precipitação. Reservatórios de água, gelo, poeira e gases ficam na superfície/atmosfera com balanço de massa.
2. Evoluir circulação com rotação e força de Coriolis, gradiente horizontal de pressão, aquecimento diurno/latitudinal, resfriamento radiativo, transporte/advecção, atrito e circulação vertical parametrizada. Fixar limites de estabilidade e passos próprios da atmosfera; interpolar para a animação. Reduzir a grade em aparelhos modestos sem alterar as leis do cenário.
3. Fazer nuvens surgir onde há condensável suficiente e ar úmido/frio ou ascendente; deslocá-las pelo campo de vento, cisalhá-las, aumentar/dissipar espessura, precipitar e devolver material ao reservatório. Incluir calor latente na equação térmica. Na Terra, evaporação sobre oceanos, convergência tropical, frentes de latitudes médias e rotação devem organizar padrões de forma distinta. A [NASA descreve](https://science.nasa.gov/earth/earth-observatory/earths-clouds-on-the-move-154443/) a relação entre zonas de circulação e distribuição de nuvens; o [ciclo da água](https://science.nasa.gov/earth/earth-observatory/the-water-cycle/) fundamenta evaporação, condensação e precipitação.
4. Renderizar **camadas de nuvens** de altitude/espessura diferentes a partir dos campos: cobertura, densidade, bordas, sombras projetadas, auto-sombra aproximada e mudança de forma. Advecção de textura/ruído só detalha a aparência; a criação e dissipação dependem do estado físico. Em zoom próximo, apresentar volume aparente limitado; na visão distante, usar composição eficiente em casca esférica. Evitar que uma camada rígida gire inteira em velocidade constante.
5. Adaptar termodinâmica por planeta: água na Terra; ácido sulfúrico em Vênus; poeira e condensação de CO₂ em Marte; amônia/água e jatos em Júpiter; metano e nuvens altas em gigantes gelados. Não reutilizar regras terrestres de chuva e vapor d’água para todos. Condições iniciais e amplitudes vêm de observações ou de cenários explicitamente hipotéticos.
6. Acoplar fenômenos extremos: impactos injetam poeira/vapor/calor e criam ondas de pressão apenas quando há atmosfera; super aquecimento altera circulação, nuvens e aerossóis; congelamento muda condensação e gelo superficial; perda de atmosfera em longo prazo exige modelo próprio e não acontece por simples troca de cor.
7. Oferecer escalas de tempo compatíveis: segundos/minutos para plumas e choques, horas/dias para tempo meteorológico, estações para gelo e circulação, milhões de anos para clima/evolução. Ao saltar bilhões de anos, não “acelerar” um mapa de nuvens até piscar; usar estado climático/climatológico correspondente à época e gerar tempo meteorológico local após o salto.

**Aceite:** duas sementes produzem sistemas de nuvens diferentes mas compatíveis com os mesmos parâmetros; aumentar vapor e ascensão favorece condensação; ar seco descendente dissipa nuvens; vento transporta nuvens e poeira; a soma de água nos reservatórios fecha dentro de tolerância; o campo meteorológico e a imagem permanecem sincronizados ao pausar, acelerar ou voltar ao estado salvo.

## 9. Etapa 7 — Física da superfície terrestre e resposta atmosférica

**Prioridade P1. Primeira implementação completa na Terra; generalizar só depois de validar o acoplamento.**

1. Dividir a superfície terrestre em células com classe de terreno (oceano, solo, rocha, gelo, vegetação simplificada), elevação, temperatura, umidade, albedo e reservas de água/neve. Calcular insolação local por latitude, estação, hora e sombra; intercambiar calor e umidade com a atmosfera. O oceano tem maior inércia térmica e fluxo de evaporação; terreno seco aquece/resfria de modo diferente.
2. Deixar efeitos visíveis derivados do estado: variação do brilho/ondulação dos oceanos conforme vento, gelo marinho por temperatura e balanço de energia, neve onde precipitação e temperatura permitem, secagem/umidificação do solo, nuvens e sombra movendo-se no mesmo campo de vento. Vegetação só muda em cenários de longo prazo com uma regra ecológica aproximada e identificada.
3. Para entrada de meteorito, calcular trajetória na atmosfera, arrasto, aquecimento, ablação, possível fragmentação e energia entregue ao ar/solo. Um objeto que se desintegra na atmosfera não produz automaticamente cratera. No impacto, localizar deformação, ejeção, pulso térmico, poeira, vapor de água e onda de pressão no ar; ao atingir oceano, tratar deslocamento de água e onda por modelo de águas rasas **apenas se o evento justificar**. Evitar tsunami global ou incêndio planetário automático.
4. Ligar efeitos secundários a limiares do modelo: aerossóis reduzem radiação recebida, precipitam e escurecem/clareiam superfícies; grandes quantidades de vapor alteram nuvens e chuva; incêndios só aparecem onde houver combustível e fluxo térmico suficiente. Expor a janela temporal e a incerteza desses efeitos.
5. Na viagem ao futuro do Sol, elevar luminosidade conforme a trilha estelar e recalcular oceano, evaporação, nuvens, vapor e perda de habitabilidade. Separar cenários de **clima simplificado** e **observação atual**: o modelo reduzido não deve fornecer uma data precisa para a extinção de vida, evaporação total dos oceanos ou ruptura da atmosfera sem calibração especializada.
6. Criar vista aproximada da superfície para conferir a física local: horizonte e cor do céu mudam por composição/altura solar; nuvens têm base/topo e sombras coerentes; chuva/neve só aparece sob nuvens precipitantes; poeira e plumas seguem vento; temperatura e pressão locais aparecem como leitura do modelo.

**Cenas de aceite na Terra:** (a) frente úmida atravessa oceano e continente, nuvens se formam/movem e chove em células coerentes; (b) estação fria aumenta neve/gelo em regiões adequadas e a estação quente os reduz; (c) meteoro pequeno se consome no ar, enquanto outro maior atinge o solo e produz cratera, poeira, calor e onda de pressão; (d) no futuro solar, calor e umidade evoluem em conjunto com luminosidade, sem continuar mostrando a mesma imagem de nuvens do presente. Comparar padrões estatísticos globais e a aparência com observações, sem alegar previsão do tempo em escala local.

## 10. Etapa 8 — Buraco negro e acreção

**Prioridade P1. Módulo próprio, acoplado à dinâmica e aos efeitos.**

1. Separar massa física, raio de Schwarzschild `2GM/c²`, limite de captura e tamanho visual na tela. A gravidade distante de um buraco negro de determinada massa deve coincidir com a gravidade distante de qualquer corpo com a mesma massa; não há força extra por ser “buraco negro”.
2. Manter dinâmica newtoniana onde a aproximação é válida; na região próxima, usar um modelo relativístico simplificado e documentado ou trajetórias previamente calculadas. Não afirmar que um shader de lente é cálculo completo de relatividade geral.
3. Calcular gradiente de maré a partir de massa, distância e tamanho/resistência do corpo. Só iniciar alongamento, ruptura e trilhas quando o critério de maré for atingido. A sequência física é deformação, fragmentação, órbitas de detritos, alimentação do disco e captura. Nem todo corpo que passa perto deve ser imediatamente engolido.
4. Conservação e acreção: material em órbita carrega momento angular; parte pode alimentar o disco, parte escapar. A massa do buraco negro só aumenta pelo material efetivamente capturado. A luminosidade do disco depende da taxa de acreção e da eficiência assumida; sem material caindo, não há disco luminoso obrigatório.
5. Recriar a imagem: disco com rotação diferencial e gradiente térmico, assimetria de brilho Doppler, deflexão dependente do ângulo de visão e sombra. Preferir tabela de raios/lookup pré-calculada para uma primeira versão em WebGL; tratar rotação do buraco negro como extensão posterior. Usar a [visualização física da NASA](https://svs.gsfc.nasa.gov/13326) como referência de aparência, sem copiá-la como textura.

**Aceite:** fora da região próxima, trocar o Sol por um buraco negro de uma massa solar não muda instantaneamente as órbitas por “sucção”; o teste do raio de Schwarzschild confere com a fórmula; duplicar aproximadamente o tamanho do corpo intensifica a maré, enquanto afastá-lo a reduz fortemente; uma passagem rasante pode produzir detritos sem captura total. A lente e o disco mudam coerentemente com o ângulo de câmera.

## 11. Etapa 9 — Viagem ao futuro e gigante vermelha

**Prioridade P1 após tempo, temperatura e órbitas estarem desacoplados da cena.**

1. Adotar uma trilha de evolução de estrela de aproximadamente uma massa solar, com fonte e versão registradas, por exemplo produzida no [MESA](https://docs.mesastar.org/). A tabela deve conter idade da estrela, massa, raio, luminosidade, temperatura efetiva e perda de massa; interpolar cada variável na escala adequada. Não criar a gigante vermelha aumentando apenas a esfera e tornando-a vermelha.
2. Iniciar na idade solar atual aproximada (4,6 bilhões de anos), independente da data humana usada para mostrar a posição inicial dos planetas. Criar linha do tempo com marcos: presente, aumento gradual de luminosidade, fim da sequência principal, subgigante, gigante vermelha, fases finais e anã branca. Os tempos exatos virão da trilha selecionada; o marco da gigante vermelha fica da ordem de 5 bilhões de anos no futuro, conforme a [NASA](https://science.nasa.gov/sun/facts/).
3. Ao mover a linha do tempo, atualizar simultaneamente luminosidade, espectro/cor, raio, gravidade pela perda de massa, vento estelar e fluxo recebido por cada planeta. Recalcular órbitas por perda de massa lenta e aplicar marés/arrasto próximos à envoltória quando o modelo tiver dados. Usar intervalos e eventos pré-computados para saltar bilhões de anos sem simular cada órbita.
4. Tratar destinos planetários com graus de certeza. Mercúrio e Vênus são engolfados no cenário solar padrão; o destino exato da Terra depende de marés, arrasto e perda de massa, então o simulador deve mostrar a hipótese/modelo escolhido e sua incerteza, em vez de declarar um único resultado inevitável. A perda de habitabilidade terrestre deve ocorrer antes do contato físico com o Sol, quando o modelo térmico/climático indicar.
5. Visualizar a estrela por temperatura efetiva, granulação/convecção, luminosidade e expansão física; controlar exposição para que mudanças de brilho não “estourem” a imagem. A fase de anã branca precisa de geometria e resfriamento próprios. O Sol não termina como supernova neste cenário.
6. Interface: linha do tempo em anos relativos ao presente e idade estelar, saltos por fase, pausa, comparação lado a lado presente/futuro, gráfico de raio/luminosidade/temperatura e cartões de consequências por planeta. Separar “resultado do modelo” de “efeito visual”.

**Aceite:** idade estelar e data orbital nunca se confundem; os gráficos reproduzem a trilha escolhida nos pontos de referência; luminosidade, temperatura e órbitas respondem ao mesmo estado da estrela; avançar e voltar a uma idade reproduz o mesmo estado; cenários de destino incerto são identificados como tal.

## 12. Etapa 10 — Interface, desempenho e validação final

1. Criar painel “Por que aconteceu?” para impactos e rupturas: massas, velocidade, ângulo, regime previsto, material aquecido/ejetado, destino dos remanescentes e limitações do modelo. Mostrar unidades físicas junto à escala visual comprimida.
2. Criar biblioteca de cenários reproduzíveis: impacto pequeno na Terra, choque frontal e rasante Terra–Marte, frente de nuvens/chuva na Terra, mudança sazonal de gelo, tempestade de poeira em Marte, circulação de nuvens em Vênus/Júpiter, cometa aquecido, lua gelada, encontro de estrela com buraco negro, Sol gigante vermelha e fase de anã branca. Cada cenário contém semente, estado inicial e resultados esperados qualitativos.
3. Adicionar testes automatizados para conservação, continuidade orbital, estabilidade do integrador, resultados de colisões, mudanças de fase, transporte atmosférico, ciclo de condensáveis, maré, raio de Schwarzschild e interpolação da trilha estelar. Testes de imagem comparativos para quadros-chave com tolerância para diferenças de GPU.
4. Medir desempenho em máquina de referência desktop e celular antes de fixar orçamentos. Meta inicial de experiência: 60 quadros/s desktop em navegação e 30 quadros/s celular em cenas comuns; efeitos intensos terão orçamento adaptativo. Manter simulação física determinística mesmo quando partículas visuais forem reduzidas. Evitar regressões em carregamento e memória.
5. Revisar linguagem: “estimativa”, “aproximação” e “incerteza” onde cabem. Documentar equações, fontes, limites de validade e licença de dados/texturas. Criar versão do modelo para que cenas salvas continuem interpretáveis após atualizações.

**Aceite final:** cenários reproduzíveis, sem saltos injustificados no tempo, eventos com balanço físico consultável, visual ligado à causa, desempenho medido e limitações expostas ao usuário.

## 13. Ordem de entrega e esforço estimado

| Marco | Entrega demonstrável | Dependências | Estimativa para 1 pessoa |
| --- | --- | --- | --- |
| M0 | Cenas base, medições, especificação de unidades e tolerâncias | Nenhuma | 3–5 dias |
| M1 | Estado físico, tempo, integrador e órbitas validados | M0 | 2–3 semanas |
| M2 | Quatro regimes de colisão e balanço físico | M1 | 3–4 semanas |
| M3 | Partículas por material, crateras e animações novas | M2 | 2–3 semanas |
| M4 | Modelo térmico e mudanças de fase | M1–M3 | 2–3 semanas |
| M5 | Materiais, texturas e identidade visual por corpo | M1, M4 | 2–3 semanas |
| M6 | Atmosferas e nuvens dinâmicas; Terra como primeiro caso | M1, M4, M5 | 4–6 semanas |
| M7 | Resposta da superfície terrestre e impactos atmosféricos | M2, M4, M6 | 2–3 semanas |
| M8 | Maré, acreção e visual do buraco negro | M1–M3 | 2–4 semanas |
| M9 | Trilha solar, salto temporal e efeitos planetários | M1, M4, M6–M7 | 2–3 semanas |
| M10 | Cenários, interface, desempenho e validação integrada | Todos | 2 semanas |

**Total indicativo: 24–35 semanas de trabalho individual**, ajustado após M0. O primeiro lançamento útil deve ser M1–M3: colisões claramente melhores e sistema confiável. M4–M9 podem ser lançados como módulos progressivos. A Terra deve ser o primeiro planeta com circulação, nuvens e superfície acopladas; os demais usam a mesma infraestrutura, mas leis e composições próprias. Não iniciar o visual da gigante vermelha como trabalho isolado: ele depende da luminosidade, da perda de massa e dos efeitos térmicos/atmosféricos.

## 14. Critérios para decidir que a recriação ficou melhor

- **Coerência:** mudar só o ângulo ou velocidade de um impacto pode mudar o regime previsto; os efeitos refletem essa mudança.
- **Reprodutibilidade:** mesmo cenário e semente produzem o mesmo estado físico em máquinas com FPS diferente.
- **Contabilidade:** massa e momento são rastreáveis; calor, luz, ejeção e remanescentes fecham o orçamento de energia dentro de tolerâncias justificadas.
- **Fidelidade visual:** materiais, trajetórias, aquecimento e resfriamento são distinguíveis e não contradizem o vácuo, a pressão ou a escala do evento.
- **Atmosfera viva:** nuvens aparecem, se deslocam, mudam de forma e somem por causas meteorológicas; céu, sombra e precipitação respondem ao mesmo estado, com composição específica de cada planeta.
- **Superfície responsiva:** vento, insolação, temperatura, precipitação, gelo e impactos mudam a superfície da Terra conforme o modelo, sem pintura aleatória desconectada dos cálculos.
- **Honestidade científica:** o aplicativo separa dado, modelo aproximado e escolha artística; o destino incerto da Terra na fase gigante vermelha aparece como incerteza.
- **Usabilidade:** cada etapa entrega pelo menos um cenário clicável, comparável com a versão anterior e mensurável em desempenho.

### Referências iniciais

- [NASA Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) — parâmetros físicos planetários.
- [Leinhardt & Stewart, *Collisions Between Gravity-Dominated Bodies*](https://arxiv.org/abs/1106.6084) — regimes e leis de escala de impactos.
- [NASA, visualização de disco de acreção e lente gravitacional](https://svs.gsfc.nasa.gov/13326) — referências físicas e visuais para buracos negros.
- [NASA, fatos sobre o Sol](https://science.nasa.gov/sun/facts/) — idade e futuro como gigante vermelha.
- [MESA, documentação](https://docs.mesastar.org/) — geração de trilhas de evolução estelar.
- [NASA, ciclo da água](https://science.nasa.gov/earth/earth-observatory/the-water-cycle/) e [distribuição global de nuvens](https://science.nasa.gov/earth/earth-observatory/earths-clouds-on-the-move-154443/) — referências para a Terra.
- [NASA, atmosferas de Vênus](https://science.nasa.gov/venus/venus-facts/), [Marte](https://science.nasa.gov/mars/facts/) e [Júpiter](https://science.nasa.gov/jupiter/jupiter-facts/) — composição e fenômenos específicos.
- [NASA GEOS](https://gmao.gsfc.nasa.gov/geos-systems/) — referência de complexidade para modelagem atmosférica; o Planets usará um modelo reduzido.

As fórmulas e fontes numéricas exatas de cada módulo devem ser registradas junto à implementação e à versão do modelo; esta lista é o ponto de partida para a pesquisa e a calibração.

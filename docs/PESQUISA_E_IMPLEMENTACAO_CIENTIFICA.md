# Física celeste: levantamento, implementação e limites

Pesquisa e atualização de 2 de novembro de 2026. Este documento substitui a interpretação de que melhorar a geometria de uma explosão equivale a resolver a física de um impacto.

## Diagnóstico do simulador

O laboratório original mistura massas em quilogramas, distâncias comprimidas, raios aumentados e um tempo dinâmico próprio. A mesma distância desenhada não tem uma conversão única para metros em todos os planetas. Portanto, não basta trocar uma constante gravitacional ou acrescentar um efeito de relatividade para tornar esse laboratório quantitativamente realista.

As placas anteriores eram células geométricas fechadas cortadas por planos. Conservavam massa e textura, mas davam a aparência de fatias e polígonos de casca. Num impacto gigante, pressão, choque, aquecimento, fusão, vapor e gravidade própria precisam participar da evolução do material. Esta atualização troca a representação principal da ruptura por parcelas granulares; não apresenta esse modelo como uma solução de hidrodinâmica.

## 1. Gravitação e movimento dos planetas

Para massas pontuais ou campos externos aproximadamente esféricos, o termo newtoniano é `aᵢ = Σ G mⱼ (rⱼ-rᵢ)/|rⱼ-rᵢ|³`. A força não depende de o objeto ser um planeta, uma estrela ou um buraco negro: dependem a massa e a separação. Velocidade inicial, direção, energia e momento angular determinam se a trajetória é ligada ou de escape. Uma órbita elíptica tem componente radial de velocidade; impor velocidade circular ao soltar todo planeta altera sua órbita.

**Implementado:** cenário **Gravidade · N corpos**. O novo motor calcula o movimento em AU, dias e massas solares, com `G` convertido para essas unidades. A transformação para coordenadas de desenho é aplicada depois do cálculo. As velocidades iniciais seguem a geometria de Kepler e a relação vis-viva. Todos os nove corpos centrais participam, incluindo o movimento do Sol em torno do baricentro. Há diagnóstico do erro relativo da energia e integração kick–drift–kick em passos limitados. A liberação de órbitas elípticas no laboratório também passou a conservar sua componente radial inicial.

O cenário **Duas estrelas · centro de massa** acrescenta uma companheira de 0,65 massas solares, inicialmente a 8 AU. As duas estrelas se movem; a primária não fica artificialmente presa no centro. Os planetas respondem a ambas. Esse sistema é um experimento perturbado, não uma configuração cuja estabilidade de longo prazo tenha sido demonstrada.

**Limites:** raios desenhados continuam ampliados para exploração. Não há colisões por raios visuais nesses cenários. As fases iniciais são ilustrativas, não efemérides JPL para a data do relógio. Luas continuam elementos ilustrativos e não integram o sistema de massas desse novo motor. Não há garantia de precisão secular nem substituição dos integradores adaptativos especializados.

Referência de unidades e prática de integração: [REBOUND — unidades](https://rebound.hanno-rein.de/ipython_examples/Units/), [REBOUND — exemplo inicial](https://rebound.hanno-rein.de/quickstart/firstexample/). O projeto não passou a executar REBOUND: a implementação JavaScript é própria e seus testes constam abaixo.

## 2. Relatividade

Para uma massa central dominante e velocidades/campos suficientemente pequenos, uma correção pós-newtoniana pode reproduzir a precessão de Schwarzschild. A forma usada acrescenta `μ/(c²r³) [(4μ/r-v²)r + 4(r·v)v]` à aceleração relativa. A previsão analítica da contribuição relativística por órbita é `6πμ/[a(1-e²)c²]`.

**Implementado:** cenário **Mercúrio · relatividade**, com correção 1PN central e reação aproximada na fonte. A constante `c` é convertida para AU/dia. Não há amplificação visual do efeito. O passo é menor nesse modo. O teste compara numericamente o avanço dos periélios com e sem a correção; a contribuição adicional de Mercúrio fica próxima de 43 segundos de arco por século, além das perturbações newtonianas.

**Limites:** não é a formulação completa de Einstein–Infeld–Hoffmann para N corpos, não descreve Kerr, arrasto de referenciais, ondas gravitacionais ou a trajetória junto ao horizonte. A lente já existente continua um efeito visual aproximado; não se tornou um traçador de geodésicas.

Referência: [REBOUNDx — efeitos relativísticos e suas faixas de aplicação](https://reboundx.readthedocs.io/en/latest/effects.html).

## 3. Buracos negros

Um buraco negro não atrai arbitrariamente mais que outra fonte de mesma massa à mesma distância externa. A diferença decisiva está no campo próximo, no horizonte e na física do material que chega a essa região. Um disco exige material e transporte de energia/momento angular; não deve estar sempre luminoso por simples presença do buraco negro.

**Implementado:** experimento **Buraco negro · mesma massa solar**. A fonte central preserva uma massa solar e as condições orbitais externas; a iluminação solar é removida. Esse experimento é hipotético: o Sol real não termina como um buraco negro. A interface informa o horizonte físico de aproximadamente 2,95 km e deixa claro que o símbolo é ampliado.

No modelo visual de Schwarzschild, o disco agora começa em `3 Rₛ`, correspondente à órbita circular estável mais interna de um buraco negro sem rotação. Seu perfil é normalizado pelo horizonte, evitando constantes de desenho que deixavam de acompanhar a escala. A emissão depende da alimentação. O material granular que cruza o horizonte transfere sua massa e momento para a fonte, sem expirar por um prazo visual.

**Limites:** o encontro interativo do laboratório ainda usa coordenadas e horizonte ampliados. Não é um cálculo relativístico de captura, luminosidade de acreção ou emissão de jatos. Jatos exigiriam campos magnéticos e dinâmica de plasma, ausentes aqui.

Referências: [NASA — mesma massa, mesmas órbitas externas](https://science.nasa.gov/universe/10-questions-you-might-have-about-black-holes/), [NASA — anatomia e regiões de um buraco negro](https://science.nasa.gov/universe/black-holes/anatomy/).

## 4. Marés, ruptura, desprendimento e partículas

A maré é a diferença do campo gravitacional através de um corpo; no limite distante, cresce aproximadamente como `M/r³`, não como a atração central `M/r²`. A ruptura depende também de densidade, gravidade própria, rotação e resistência do material. O limite de Roche e a esfera de Hill tratam problemas distintos e não devem virar um único raio de destruição universal.

Simulações científicas de impactos planetários usam modelos de fluidos e equações de estado. A resolução importa: o estudo de convergência com SWIFT mostra que mesmo propriedades globais e perda atmosférica podem variar com o número de partículas. Isso impede chamar centenas de objetos de uma simulação SPH quantitativamente equivalente.

**Implementado:** a ruptura principal usa até 256 parcelas de material por encontro. Há liberação progressiva do movimento de ejeção, atração gravitacional entre as parcelas, integração simétrica, campo dos atratores externos e captura por cruzamento do horizonte. A distribuição conserva massa, centro de massa e momento linear em ambiente isolado. Os pais ocultos representam somente a massa gravitacional dessas parcelas; os nós não são adicionados novamente como corpos duplicados. O campo de cada nuvem sobre outros corpos é aproximado pelo monopolo dos grupos de origem.

As superfícies visuais são arredondadas, irregulares e aquecidas, em lugar das antigas placas. Na fusão, as células usadas para contabilizar massa não são mais exibidas como sólidos cortados: o transporte aparece como porções de material quente. Partículas pequenas e detritos de maré também deixaram de usar os icosaedros grosseiros anteriores. Poeira visual só sofre resistência próxima à atmosfera de um corpo ainda existente; não recebe atrito permanente no vácuo.

O número total de parcelas é limitado a 768. Se necessário, uma redução de detalhe reúne parcelas da mesma origem com massa, posição e velocidade ponderadas. Essa operação preserva massa, centro e momento, mas dissipa movimento relativo não resolvido. Ela não apaga material por idade. Os tamanhos dos nós desenhados não representam uma distribuição física medida de tamanhos de rochas.

**Limites:** é um modelo granular autogravitante em unidades do laboratório, não SPH. Faltam pressão, equação de estado, viscosidade, calor latente, vaporização quantitativa, fratura de material, atmosfera resolvida e conservação completa de momento angular. A autoatração permite aglomeração, mas não há identificação automática de novos planetas a partir dos aglomerados. Interações entre nuvens diferentes e fontes externas não têm a precisão de um solucionador conjunto de todas as parcelas. O caminho de fusão permanece prescrito e dissipativo. A antiga representação sólida fica como fallback de capacidade excepcional.

Referências: [Leinhardt & Stewart — regimes de colisão](https://arxiv.org/abs/1106.6084), [Kegerreis et al. — convergência de impactos com SWIFT](https://arxiv.org/abs/1901.09934), [galeria de simulações da Universidade de Durham](https://astro.dur.ac.uk/~vreke/giant_impacts/).

## 5. Futuro do Sol e gigante vermelha

Expansão de raio, temperatura, luminosidade e massa são variáveis diferentes. Uma gigante pode ser mais fria na superfície e muito mais luminosa por ter uma área maior. Na aproximação de perda lenta e isotrópica de massa, sem marés, `a M` fica aproximadamente constante: as órbitas se expandem quando a massa central cai. Isso compete com as marés estelares, que podem conduzir à incorporação de planetas.

**Implementado:** cenário **Futuro do Sol · gigante vermelha**, com controle de fase, pausa e avanço por **+fase**. Os pontos ilustrativos incluem Sol atual, saída da sequência principal, gigante vermelha, contração durante a evolução posterior, ramo assintótico e anã branca. O raio, a massa e a luminosidade variam separadamente; a temperatura deriva de `L = 4πR²σT⁴`. O pico ilustrativo usa 256 raios solares e 0,67 massas solares. As distâncias planetárias e o raio estelar compartilham a conversão AU–cena, evitando multiplicar o raio solar exagerado de exploração por centenas.

As órbitas se expandem conforme a perda de massa, e sua fase desacelera com a dependência de período dessa aproximação. Planetas cuja órbita foi alcançada pelo envelope permanecem ocultos depois da contração: não reaparecem na fase de anã branca. Voltar o controle para uma fase anterior restaura o estado correspondente. O estado térmico assume equilíbrio radiativo aproximado por representar intervalos evolutivos muito longos; não espera apenas alguns dias de clima após saltar bilhões de anos.

**Limites:** os pontos são uma trajetória didática interpolada, não uma tabela evolutiva MESA nem uma solução da estrutura estelar. O espaçamento do controle representa fases, não tempo linear. A animação orbital é condensada independentemente dos bilhões de anos: não é uma integração de cada revolução através de toda a vida solar. O cenário não inclui dissipação de marés estelares, vento resolvido ou nebulosa planetária. O modelo climático de referência não é uma previsão de atmosfera de vapor. A sobrevivência da Terra no caso de perda de massa sem marés não é apresentada como destino certo.

Um trabalho de 2008 previa incorporação da Terra no modelo considerado. O estudo de 2026 encontra sobrevivência com suas prescrições atualizadas, mas ressalta a sensibilidade às marés e à perda de massa. Por isso a interface informa a incerteza, em vez de declarar uma data inevitável de destruição.

Referências: [Schröder & Smith, 2008](https://arxiv.org/abs/0801.4031), [Esseldeurs, Mathis & Decin, 2026](https://arxiv.org/abs/2606.19575), [NASA — evolução de estrelas semelhantes ao Sol](https://science.nasa.gov/missions/hubble/hubble-witnesses-the-final-blaze-of-glory-of-sun-like-stars/).

## Validação e continuidade

Os testes abrangem inverso do quadrado, forças opostas, órbita circular de dez anos, vis-viva de todos os planetas, avanço relativístico adicional de Mercúrio, fontes de mesma massa, baricentro binário, liberação elíptica, relações estelares, ejeção com liberação progressiva, captura e redução conservativa de detalhe. São testes de invariantes e casos de referência, não uma validação contra um hidrocode.

A revisão passou por 45 testes automatizados e compilação de produção. A troca para a escala real preserva o motor físico ativo. A interface também diferencia o relógio orbital da evolução solar condensada. O disco, a exposição, a granulação visual e as partículas não constituem uma previsão fotométrica. Foram conferidos no navegador os cenários científicos e a nova ruptura.

Capturas da revisão: [material desprendido](ruptura-granular.png) e [gigante vermelha](gigante-vermelha.png).

Para continuar rumo a previsões quantitativas, a sequência necessária é: migrar também os encontros destrutivos para unidades físicas separadas do desenho; integrar todos os nós num solucionador conjunto com controle de erro; adicionar hidrodinâmica com equações de estado e energia interna; validar colisões contra casos publicados; carregar trajetórias estelares calculadas e modelos de marés; só então acrescentar um solucionador de campo forte/ray tracing relativístico. Um backend científico ou cálculo WebGPU dedicado é uma opção para essa etapa, mantendo o navegador como interface.

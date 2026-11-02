# Primeira entrega de melhorias — 15/10/2026

> Atualização posterior: a deformação e a captura pelo buraco negro foram refeitas. A [correção das marés](CORRECAO_MARES.md) substitui a descrição inicial de alongamento visual e acrescenta ruptura em detritos resolvidos no laboratório.

Esta entrega inicia o plano de evolução. É uma versão interativa com modelos reduzidos; as etapas científicas completas continuam no [plano](PLANO_DE_EVOLUCAO.md).

## O que está disponível

- Colisão contínua calcula o primeiro contato e processa encontros por ordem temporal. Impactos passam a distinguir fusão, encontro rasante, cratera local e ruptura conforme energia relativa, ângulo e proporção de massas.
- Na ruptura, remanescentes recebem massas ponderadas e velocidades que preservam massa e momento linear. A energia de ejeção no referencial do centro de massa é limitada a 30% da energia cinética relativa inicial. Isso substitui os 22 fragmentos de massa arbitrária da versão anterior. Os limiares são aproximações próprias; não são uma calibração das leis de escala de Leinhardt–Stewart.
- Fusão e impactos pequenos transferem massa/momento ao alvo. Marcas de impacto acompanham a curvatura do corpo e sua rotação; gigantes gasosos não recebem crateras de solo. O ponto atingido emite calor visual e resfria.
- Partículas diferenciam poeira, material quente e gelo, têm velocidades de ejeção orientadas e resfriamento visual. O pool compacta corretamente as instâncias sobreviventes. A expansão luminosa esférica só é usada quando o evento tem atmosfera.
- Terra: uma grade de transporte de umidade com sementes repetíveis, evaporação, condensação, precipitação e reservatório superficial alimenta a aparência das nuvens. O transporte usa passos fixos e conserva a quantidade de condensável. A textura de nuvens existente fornece detalhe visual, deslocado por latitude e deformado; não é uma observação do tempo atual.
- Camada de nuvens com opacidade variável, iluminação contínua, sombra aproximada na superfície e oclusão parcial das luzes noturnas; atmosfera iluminada pelo Sol, com espessura óptica aproximada e transição de crepúsculo.
- Vênus, Júpiter, Saturno, Urano e Netuno recebem deslocamento diferencial de suas texturas de nuvens; perfis de circulação e composição são distintos. Isso é uma animação de circulação prescrita, ainda sem resolução da dinâmica de fluidos desses planetas.
- Resposta térmica pelo fluxo solar em unidades físicas: `F = L/(4πr²)` e `T_eq = [(1-A)F/(4σε)]^(1/4)`. Um desvio calibrado pela temperatura de referência representa aproximadamente atmosfera/calor interno; a temperatura responde com inércia, afeta gelo, fusão visual e nuvens. Esse desvio fixo não calcula um efeito estufa variável.
- Novo controle de luminosidade solar e cenários de Terra em resfriamento/calor extremo. O brilho da iluminação responde ao controle; massa e luminosidade têm controles separados.
- Buracos negros atualizam massa, parâmetro gravitacional e raio físico de Schwarzschild juntos. A captura usa o centro do corpo, em lugar da soma de raios das duas esferas visuais; o horizonte exibido permanece exagerado. O disco aparece após captura, tem rotação diferencial e perde brilho sem alimentação. A deformação por maré usa gradiente inversamente proporcional ao cubo da distância; múltiplos buracos negros deixam de desfazer a deformação uns dos outros.
- Painel com temperatura estimada, composição, cobertura de nuvens, regime do último impacto e razão entre velocidade relativa e escape. Novos cenários de impacto lento e rasante permitem comparar resultados.

## Como experimentar

1. Iniciar o projeto e selecionar Terra → **Explorar de perto**. Acompanhar mudanças das nuvens com o tempo; pausar também pausa os campos físicos e a animação.
2. Abrir **Laboratório → Criar → Terra em resfriamento**. Observar durante cerca de 10–20 segundos na velocidade inicial: luminosidade reduzida, queda da temperatura e aumento do gelo. O cenário reinicia o sistema.
3. Comparar com **Terra sob calor extremo**, que também reinicia o sistema. A temperatura exibida identifica extrapolação do clima.
4. Após reiniciar, testar **Impacto lento · fusão**, **Impacto rasante** e **Terra × Marte** separadamente. Abrir a aba **Física** para consultar o regime. Evitar sobrepor os testes no mesmo sistema já destruído.
5. Criar um buraco negro no laboratório: sem material capturado, não há disco permanentemente brilhante. O tamanho de desenho do horizonte não corresponde à escala física dos planetas.

## Limites e próximos trabalhos

| Parte | Limite desta entrega | Próximo passo do plano |
| --- | --- | --- |
| Dinâmica orbital | O laboratório ainda usa coordenadas e tempos didáticos. Os novos cálculos de fluxo térmico usam distâncias de referência com uma conversão aproximada para o cenário. | Migrar todo o estado dinâmico para unidades físicas, desacopladas do desenho; revisar condições iniciais e salto temporal. |
| Colisões | Conservação instantânea de massa/momento linear e orçamento de ejeção; falta contabilizar spin, potencial gravitacional, energia interna e reacumulação completa. | Calibrar regimes de impacto e materiais, incluir momento angular e um registro de energia. |
| Atmosfera | Ventos prescritos; reservatório uniforme, sem mapa de solo/oceano nem solução de pressão, convecção ou calor latente. Nuvens são uma casca com detalhe visual, sem volume completo. | Resolver circulação e acoplar terreno, umidade, camadas verticais e balanço térmico. |
| Tempo meteorológico | Saltos acima de 2 dias por atualização integram somente os últimos 2 dias e registram o tempo meteorológico omitido, para limitar o custo em altas velocidades. O restante da simulação mantém seu relógio. | Adicionar climatologias por época e distinguir reprodução de dados observados de laboratório. |
| Congelamento/aquecimento | Gelo e fusão visuais derivam da temperatura média; não há mapa local de fases, pressão, hidrologia, oceanos, tsunamis ou incêndios. | Acoplar estado térmico local e mudanças de fase com pressão e calor latente. |
| Buraco negro | Marés e ótica ilustrativas em geometria comprimida; não há geodésicas relativísticas ou ruptura de maré com detritos resolvidos. | Separar distância/horizonte físicos, implementar trajetórias próximas e acreção com momento angular. |
| Futuro do Sol | O controle de luminosidade é um experimento térmico; não é uma trilha estelar. | Integrar uma trilha MESA/MIST documentada, massa/raio/temperatura, evolução orbital e linha do tempo de gigante vermelha. |
| Texturas | As imagens licenciadas existentes são reutilizadas. Não foram inventados mapas de relevo ou composição como se fossem observações. | Adicionar dados topográficos, materiais e níveis de detalhe documentados. |

## Verificação

18 testes automatizados cobrem órbitas existentes, detecção contínua, classificação de impactos, conservação de massa/momento, limite de energia dos fragmentos, fluxo e equilíbrio térmico, resposta à luminosidade, transporte e balanço de umidade, repetição com passos compatíveis, partículas e crescimento do horizonte. A compilação para produção também foi verificada. A conferência no navegador inclui Terra, impacto Terra–Marte, controles térmicos e adaptação de tela.

Referências: [regimes de impactos planetários](https://arxiv.org/abs/1106.6084), [ciclo da água da NASA](https://science.nasa.gov/earth/earth-observatory/the-water-cycle/), [atmosfera de Júpiter](https://science.nasa.gov/jupiter/jupiter-facts/). O código identifica as aproximações adotadas.

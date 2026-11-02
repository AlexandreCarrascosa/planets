# Buracos negros configuráveis e encontro de atração

No Laboratório, em Criar, escolha a massa e use **Ver corpos sendo atraídos**. O atalho **Hipermassivo · atrair corpos** escolhe 10 bilhões de massas solares. O botão Buraco negro permite posicionar manualmente o perfil escolhido. Há seis perfis, de 100 a 10 bilhões de massas solares.

O encontro de massas a partir de um milhão de sóis posiciona Sol e planetas numa formação hipotética próxima ao objeto, com velocidades transversais pequenas. Não representa a localização atual do Sistema Solar. Pausar, +passo, Visão geral e velocidade de 0,1× a 4× permitem acompanhar o movimento. Reiniciar restaura o sistema.

O campo central newtoniano usa unidades de raio de Schwarzschild (Rs) e Rs/c, integração leapfrog com subpassos adaptados à aproximação e detecção contínua de cruzamento do horizonte. O raio de maré compara a aceleração diferencial com a gravidade própria usando massas e raios físicos. Se houver ruptura fora do horizonte, 32 parcelas esféricas seguem trajetórias independentes, preservando a massa e a velocidade inicial, sem impulso de explosão. A massa capturada é contabilizada e incorporada ao objeto central. Para buracos negros maiores, o horizonte pode engolir corpos sem ruptura externa.

Os tamanhos dos corpos, a separação visual dos fragmentos, a deformação e a aparência junto ao horizonte são ampliados/ilustrativos. Um contorno fino localiza o horizonte escuro; não representa luz emitida por ele. O disco responde à captura. A opção Real retira a ampliação dos corpos. Os perfis menores continuam no laboratório de marés com distâncias didáticas e relógio limitado conforme a massa.

## Limites

Não há geodésicas relativísticas, lente gravitacional calculada, rotação Kerr, dilatação temporal observacional, hidrodinâmica, equação de estado ou simulação térmica/atmosférica neste encontro. O campo central mantém o buraco negro parado e despreza o recuo e a interação entre corpos menores; não deve ser usado para precisão perto do horizonte. A captura e a redução visual são convenções do simulador. “Hipermassivo” é um nome descritivo do perfil, não uma classificação formal com fronteira única.

## Referências

- [NASA: tamanhos e massas de buracos negros](https://www.nasa.gov/universe/nasa-animation-sizes-up-the-universes-biggest-black-holes/).
- [Chandra: massa, marés e captura sem ruptura externa](https://chandra.si.edu/resources/faq/black_hole/bhole-51.html).
- [NASA: aproximação de um buraco negro](https://science.nasa.gov/universe/what-happens-when-something-gets-too-close-to-a-black-hole/).

Testes cobrem os horizontes e massas dos seis perfis, força inversamente proporcional ao quadrado da distância, escala do raio de maré, pausa, ruptura/captura integral, massa contabilizada e descarte de recursos.
